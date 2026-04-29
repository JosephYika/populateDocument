"""
One-time template repair utility.

Word frequently splits text across multiple XML runs when editing, which
breaks Jinja2 tokens like {{ variable }}. This script reassembles split
tokens by collecting all run text in each paragraph, finding Jinja2 patterns,
and rebuilding runs so each token lives in a single run.

Also applies brand formatting (orange bold for line numbers, bold for
project_location) and converts loops to paragraph-level ({%p %}) to
prevent empty paragraphs in the rendered output.

Usage: Edit 'Estimate Template.docx' in Word, then run this script.
       Output goes to 'templates/estimate.docx' (the file the server uses).
"""
import re
import os
import shutil
from lxml import etree
from zipfile import ZipFile
from copy import deepcopy

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
XML_SPACE = '{http://www.w3.org/XML/1998/namespace}space'


def tag(name):
    """Build a fully-qualified Word XML tag, e.g. tag('p') → '{...}p'."""
    return f'{{{W}}}{name}'


def get_runs(para):
    """Return all <w:r> (run) elements that are direct children of a paragraph."""
    return para.findall(tag('r'))


def get_run_text(run):
    """Extract the text content of a run's <w:t> element."""
    t = run.find(tag('t'))
    return t.text if t is not None and t.text else ''


def set_run_text(run, text):
    """Set a run's text, creating the <w:t> element if needed."""
    t = run.find(tag('t'))
    if t is None:
        t = etree.SubElement(run, tag('t'))
    t.text = text
    # xml:space="preserve" prevents Word from collapsing whitespace.
    if text and (' ' in text or text != text.strip()):
        t.set(XML_SPACE, 'preserve')


def get_run_props(run):
    """Return the <w:rPr> (run properties / formatting) element, or None."""
    return run.find(tag('rPr'))


def has_jinja(text):
    """Check if text contains any Jinja2-like token syntax."""
    return '{{' in text or '{%' in text or re.search(r'\{[a-zA-Z_]', text)


def fix_paragraph(para):
    """Reassemble Jinja2 tokens that Word split across multiple runs.

    Strategy: concatenate all run text, regex-find token boundaries, check if
    any token spans more than one run. If so, rebuild the paragraph's runs so
    each token is contained in a single run, inheriting the formatting of the
    run where the token started.
    """
    runs = get_runs(para)
    if len(runs) < 2:
        return

    full_text = ''.join(get_run_text(r) for r in runs)
    if not has_jinja(full_text):
        return

    # Map each character position to its source run index.
    char_to_run = []
    for ri, run in enumerate(runs):
        txt = get_run_text(run)
        for _ in txt:
            char_to_run.append(ri)

    # Locate every Jinja2 token's character span.
    token_spans = []
    for m in re.finditer(r'\{\{.*?\}\}|\{%.*?%\s*\}|\{[a-zA-Z_][\w.]*\}', full_text):
        token_spans.append((m.start(), m.end()))

    if not token_spans:
        return

    # Only rebuild if at least one token crosses a run boundary.
    needs_fix = False
    for start, end in token_spans:
        if end > start and char_to_run[start] != char_to_run[end - 1]:
            needs_fix = True
            break
    if not needs_fix:
        return

    # Split the full text into segments: plain text between tokens, and the
    # tokens themselves. Each segment inherits formatting from its first char.
    segments = []
    pos = 0
    for start, end in token_spans:
        if pos < start:
            segments.append(('text', full_text[pos:start], char_to_run[pos]))
        segments.append(('token', full_text[start:end], char_to_run[start]))
        pos = end
    if pos < len(full_text):
        segments.append(('text', full_text[pos:], char_to_run[pos]))

    # Snapshot formatting before removing original runs.
    run_formats = []
    for run in runs:
        rpr = get_run_props(run)
        run_formats.append(deepcopy(rpr) if rpr is not None else None)

    for run in runs:
        para.remove(run)

    # Rebuild: one run per segment, cloning the original run's formatting.
    for seg_type, text, orig_run_idx in segments:
        new_run = etree.SubElement(para, tag('r'))
        if run_formats[orig_run_idx] is not None:
            new_run.insert(0, deepcopy(run_formats[orig_run_idx]))
        set_run_text(new_run, text)


def make_rpr(parent, color_val, bold=False, size='21'):
    """Build a <w:rPr> element with color, optional bold, and font size (half-points)."""
    W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    rpr = etree.SubElement(parent, tag('rPr'))
    if bold:
        etree.SubElement(rpr, tag('b'))
        etree.SubElement(rpr, tag('bCs'))
    color = etree.SubElement(rpr, tag('color'))
    color.set(f'{{{W_NS}}}val', color_val)
    sz = etree.SubElement(rpr, tag('sz'))
    sz.set(f'{{{W_NS}}}val', size)
    szCs = etree.SubElement(rpr, tag('szCs'))
    szCs.set(f'{{{W_NS}}}val', size)
    return rpr


def fix_line_item_formatting(root):
    """Apply brand formatting to line-item tokens in the template.

    {{line.lineNum}} → orange (#E8600A) bold
    {{line.text}}    → charcoal gray (#4A4A4A)
    Handles both cases: both tokens in a single run, or already separate.
    """
    for para in root.iter(tag('p')):
        runs = get_runs(para)
        for run in runs:
            text = get_run_text(run)
            if '{{line.lineNum}}' in text and '{{line.text}}' in text:
                idx = list(para).index(run)
                para.remove(run)

                r1 = etree.Element(tag('r'))
                make_rpr(r1, 'E8600A', bold=True)
                r1.insert(0, r1.find(tag('rPr')))
                set_run_text(r1, '{{line.lineNum}}')

                r2 = etree.Element(tag('r'))
                make_rpr(r2, '4A4A4A')
                r2.insert(0, r2.find(tag('rPr')))
                set_run_text(r2, ' {{line.text}}')

                para.insert(idx, r2)
                para.insert(idx, r1)
                break
            elif '{{line.lineNum}}' in text:
                rpr = run.find(tag('rPr'))
                if rpr is not None:
                    run.remove(rpr)
                rpr = make_rpr(run, 'E8600A', bold=True)
                run.insert(0, rpr)
            elif '{{line.text}}' in text:
                rpr = run.find(tag('rPr'))
                if rpr is not None:
                    run.remove(rpr)
                rpr = make_rpr(run, '4A4A4A')
                run.insert(0, rpr)


def fix_project_location_bold(root):
    """Make {{project_location}} bold."""
    for para in root.iter(tag('p')):
        for run in get_runs(para):
            text = get_run_text(run)
            if '{{project_location}}' in text:
                rpr = run.find(tag('rPr'))
                if rpr is None:
                    rpr = etree.SubElement(run, tag('rPr'))
                    run.insert(0, rpr)
                if rpr.find(tag('b')) is None:
                    etree.SubElement(rpr, tag('b'))
                    etree.SubElement(rpr, tag('bCs'))


def fix_spacing_around_loops(root):
    """Manage whitespace around Jinja2 loop constructs in the template.

    Word inserts empty paragraphs around {%p for %} / {%p endfor %} blocks.
    This function: (1) keeps one thin spacer between inner and outer endfor
    tags for visual section separation, (2) removes all other empty paragraphs
    adjacent to loop markers, (3) adds spacing after the "work will be
    performed" intro paragraph, and (4) adds spacing before Terms & Conditions.
    """
    W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    body = root.find(tag('body'))
    if body is None:
        return

    def para_text(el):
        if el is None or el.tag != tag('p'):
            return ''
        return ''.join(get_run_text(r) for r in get_runs(el)).strip()

    # First: find the two endfor paragraphs and handle spacing between them
    children = list(body)
    endfor_indices = []
    for i, child in enumerate(children):
        if child.tag != tag('p'):
            continue
        text = para_text(child)
        if 'endfor' in text:
            endfor_indices.append(i)

    spacer_set = set()
    if len(endfor_indices) >= 2:
        inner_idx = endfor_indices[0]
        outer_idx = endfor_indices[1]
        # Keep the first empty paragraph between them as a spacer
        spacer_placed = False
        for j in range(inner_idx + 1, outer_idx):
            if children[j].tag == tag('p') and not para_text(children[j]):
                if not spacer_placed:
                    ppr = children[j].find(tag('pPr'))
                    if ppr is None:
                        ppr = etree.SubElement(children[j], tag('pPr'))
                        children[j].insert(0, ppr)
                    spacing = etree.SubElement(ppr, tag('spacing'))
                    spacing.set(f'{{{W_NS}}}before', '120')
                    spacing.set(f'{{{W_NS}}}after', '0')
                    spacing.set(f'{{{W_NS}}}line', '120')
                    spacing.set(f'{{{W_NS}}}lineRule', 'exact')
                    spacer_set.add(id(children[j]))
                    spacer_placed = True

    # Second: remove all other empty paragraphs near loops
    children = list(body)
    to_remove = []
    for i, child in enumerate(children):
        if child.tag != tag('p'):
            continue
        if id(child) in spacer_set:
            continue
        text = para_text(child)
        if text:
            continue
        prev_text = para_text(children[i-1]) if i > 0 else ''
        next_text = para_text(children[i+1]) if i < len(children) - 1 else ''
        loop_markers = ['{%p', 'endfor', '{{section.', '{{line.']
        near_loop = any(m in prev_text for m in loop_markers) or any(m in next_text for m in loop_markers)
        if near_loop:
            to_remove.append(child)

    for p in to_remove:
        body.remove(p)

    # Add spacing after "The following work will be performed..." paragraph
    children = list(body)
    for i, child in enumerate(children):
        if child.tag != tag('p'):
            continue
        text = para_text(child)
        if 'following work will be performed' in text.lower():
            ppr = child.find(tag('pPr'))
            if ppr is None:
                ppr = etree.SubElement(child, tag('pPr'))
                child.insert(0, ppr)
            spacing = ppr.find(tag('spacing'))
            if spacing is None:
                spacing = etree.SubElement(ppr, tag('spacing'))
            spacing.set(f'{{{W_NS}}}after', '200')
            break

    # Add spacing before Terms & Conditions (visual separation, no page break)
    children = list(body)
    for i, child in enumerate(children):
        if child.tag != tag('p'):
            continue
        text = para_text(child)
        if 'TERMS' in text.upper() and 'CONDITIONS' in text.upper():
            ppr = child.find(tag('pPr'))
            if ppr is None:
                ppr = etree.SubElement(child, tag('pPr'))
                child.insert(0, ppr)
            # Remove page break if it was previously added
            page_break = ppr.find(tag('pageBreakBefore'))
            if page_break is not None:
                ppr.remove(page_break)
            spacing = ppr.find(tag('spacing'))
            if spacing is None:
                spacing = etree.SubElement(ppr, tag('spacing'))
            spacing.set(f'{{{W_NS}}}before', '400')
            break


def fix_known_issues(xml_text):
    """Text-level fixes for issues that can't be solved by run-merging.

    Repairs common Word-editing artifacts:
    - '#sections' typo → 'section' (Word sometimes inserts # from autocorrect)
    - Single-braced tokens → double-braced (Word sometimes eats a brace)
    - Normalizes endfor whitespace
    - Converts {% %} to {%p %} (paragraph-level loops) so docxtpl removes
      the containing paragraph instead of leaving an empty line
    """
    xml_text = xml_text.replace('{% for #sections in sections %}', '{% for section in sections %}')
    if '{{project_name}}' not in xml_text:
        xml_text = xml_text.replace('{project_name}', '{{project_name}}')
    if '{{payment_terms}}' not in xml_text:
        xml_text = xml_text.replace('{payment_terms}', '{{payment_terms}}')
    xml_text = re.sub(r'\{%\s*endfor\s*%\s*\}', '{% endfor %}', xml_text)
    xml_text = xml_text.replace('{% for section in sections %}', '{%p for section in sections %}')
    xml_text = xml_text.replace('{% for line in section.lines %}', '{%p for line in section.lines %}')
    xml_text = xml_text.replace('{% endfor %}', '{%p endfor %}')
    return xml_text


def fix_template(input_path, output_path):
    """Main entry point: read a .docx, apply all fixes, write the result.

    A .docx file is a ZIP archive. We extract it to a temp directory, parse
    and modify word/document.xml, then re-zip everything into the output path.
    """
    temp_dir = input_path + '_temp_fix'
    os.makedirs(temp_dir, exist_ok=True)

    with ZipFile(input_path, 'r') as z:
        z.extractall(temp_dir)

    xml_path = os.path.join(temp_dir, 'word', 'document.xml')
    tree = etree.parse(xml_path)
    root = tree.getroot()

    # Pass 1: XML-level fixes (operate on parsed element tree).
    for para in root.iter(tag('p')):
        fix_paragraph(para)

    fix_line_item_formatting(root)
    fix_project_location_bold(root)
    fix_spacing_around_loops(root)

    tree.write(xml_path, xml_declaration=True, encoding='UTF-8', standalone=True)

    # Pass 2: text-level fixes (string replacements on serialized XML).
    with open(xml_path, 'r', encoding='utf-8') as f:
        xml_text = f.read()
    xml_text = fix_known_issues(xml_text)
    with open(xml_path, 'w', encoding='utf-8') as f:
        f.write(xml_text)

    # Re-package the modified files back into a .docx ZIP.
    with ZipFile(output_path, 'w') as zout:
        for dirpath, dirnames, filenames in os.walk(temp_dir):
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                arcname = os.path.relpath(full, temp_dir)
                zout.write(full, arcname)

    shutil.rmtree(temp_dir)
    print(f"Fixed template saved to: {output_path}")


if __name__ == '__main__':
    base = os.path.join(os.path.dirname(__file__), '..')
    input_file = os.path.join(base, 'Estimate Template.docx')
    output_file = os.path.join(base, 'templates', 'estimate.docx')
    fix_template(input_file, output_file)
