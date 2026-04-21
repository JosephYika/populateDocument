from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from docxtpl import DocxTemplate
from lxml import etree
import os
import io
import json

app = Flask(__name__)
CORS(app)

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')

MULTILINE_FIELDS = {'prepared_for', 'managed_by', 'project_location', 'additional_notes'}
NEWLINE_MARKER = '||BR||'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def load_config():
    config_path = os.path.join(TEMPLATES_DIR, 'config.json')
    with open(config_path, 'r') as f:
        return json.load(f)


def prep_newlines(data):
    """Replace \\n with a marker in multiline fields before rendering."""
    for key in MULTILINE_FIELDS:
        if key in data and isinstance(data[key], str):
            data[key] = data[key].replace('\n', NEWLINE_MARKER)
    return data


def apply_line_breaks(doc):
    """Post-process: replace NEWLINE_MARKER with <w:br/> in the document XML."""
    for part in [doc.docx._part] + list(doc.docx._part.rels.values()):
        if hasattr(part, '_element'):
            xml_str = etree.tostring(part._element, encoding='unicode')
            if NEWLINE_MARKER in xml_str:
                xml_str = xml_str.replace(NEWLINE_MARKER, '</w:t><w:br/><w:t xml:space="preserve">')
                new_element = etree.fromstring(xml_str)
                part._element.getparent().replace(part._element, new_element)
                part._element = new_element


def apply_line_breaks_simple(doc):
    """Post-process: replace NEWLINE_MARKER with <w:br/> in document XML."""
    for para in doc.docx._element.iter(f'{{{W}}}p'):
        for run in para.iter(f'{{{W}}}r'):
            t_el = run.find(f'{{{W}}}t')
            if t_el is not None and t_el.text and NEWLINE_MARKER in t_el.text:
                parts = t_el.text.split(NEWLINE_MARKER)
                t_el.text = parts[0]
                if parts[0].endswith(' ') or parts[0].startswith(' '):
                    t_el.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')

                parent = run.getparent()
                insert_idx = list(parent).index(run)

                rpr = run.find(f'{{{W}}}rPr')
                from copy import deepcopy

                for i, part_text in enumerate(parts[1:], 1):
                    br_run = etree.SubElement(parent, f'{{{W}}}r')
                    if rpr is not None:
                        br_run.insert(0, deepcopy(rpr))
                    etree.SubElement(br_run, f'{{{W}}}br')
                    parent.insert(insert_idx + i * 2 - 1, br_run)

                    text_run = etree.SubElement(parent, f'{{{W}}}r')
                    if rpr is not None:
                        text_run.insert(0, deepcopy(rpr))
                    new_t = etree.SubElement(text_run, f'{{{W}}}t')
                    new_t.text = part_text
                    new_t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
                    parent.insert(insert_idx + i * 2, text_run)


@app.route('/api/templates', methods=['GET'])
def list_templates():
    config = load_config()
    return jsonify(config['templates'])


@app.route('/api/generate', methods=['POST'])
def generate():
    payload = request.get_json()

    template_name = payload.get('template')
    data = payload.get('data')

    if not template_name or not data:
        return jsonify({'error': 'Missing template or data'}), 400

    config = load_config()
    template_entry = next(
        (t for t in config['templates'] if t['id'] == template_name), None
    )
    if not template_entry:
        return jsonify({'error': f'Unknown template: {template_name}'}), 404

    template_path = os.path.join(TEMPLATES_DIR, template_entry['file'])
    if not os.path.exists(template_path):
        return jsonify({'error': f'Template file not found: {template_entry["file"]}'}), 404

    try:
        doc = DocxTemplate(template_path)
        data = prep_newlines(data)
        doc.render(data)
        apply_line_breaks_simple(doc)
    except Exception as e:
        return jsonify({'error': f'Template rendering failed: {str(e)}'}), 400

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    filename = f"{template_name}_{data.get('estimate_number', 'output')}.docx"

    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )


if __name__ == '__main__':
    app.run(port=5000)
