from docxtpl import DocxTemplate
from lxml import etree
from copy import deepcopy
import os

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), '..', 'templates', 'estimate.docx')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'test_output.docx')

NEWLINE_MARKER = '||BR||'
MULTILINE_FIELDS = {'prepared_for', 'managed_by', 'project_location', 'additional_notes'}
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def prep_newlines(data):
    for key in MULTILINE_FIELDS:
        if key in data and isinstance(data[key], str):
            data[key] = data[key].replace('\n', NEWLINE_MARKER)
    return data


def apply_line_breaks_simple(doc):
    for para in doc.docx._element.iter(f'{{{W}}}p'):
        for run in para.iter(f'{{{W}}}r'):
            t_el = run.find(f'{{{W}}}t')
            if t_el is not None and t_el.text and NEWLINE_MARKER in t_el.text:
                parts = t_el.text.split(NEWLINE_MARKER)
                t_el.text = parts[0]
                t_el.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')

                parent = run.getparent()
                insert_idx = list(parent).index(run)

                rpr = run.find(f'{{{W}}}rPr')

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


test_data = {
    "estimate_number": "1042",
    "estimate_date": "04/21/2026",
    "prepared_for": "330 E 51st Street\nNew York, NY 10022",
    "managed_by": "XL | Real Property Management\n80 Fifth Ave, Suite 1501\nNew York, NY 10011",
    "contact_name": "Charlotte Brown",
    "contact_email": "charlotte@xl-rpm.com",
    "project_location": "330 E 51st Street\nNew York, NY 10022",
    "project_name": "Fence Replacement",
    "quote": "2,500.00",
    "total": "2,500.00",
    "additional_notes": "The team will assess conditions on-site prior to beginning work.\nAny unforeseen conditions discovered during the project may require a change order.",
    "payment_terms": "Net 30",
    "sections": [
        {
            "num": "1",
            "title": "Demolition and Disposal of Existing Fence",
            "price": "2,100.00",
            "lines": [
                {"lineNum": "1.1", "text": "Remove and dismantle existing fence, including posts and panels"},
                {"lineNum": "1.2", "text": "Extract and remove all embedded posts and footings as required"},
                {"lineNum": "1.3", "text": "Haul away and properly dispose of all demolished materials"},
            ]
        },
        {
            "num": "2",
            "title": "Site Protection",
            "price": "400.00",
            "lines": [
                {"lineNum": "2.1", "text": "Protect floors, walls, and all interior pathways during material transport"},
                {"lineNum": "2.2", "text": "Install protective coverings over landscaping and adjacent structures"},
                {"lineNum": "2.3", "text": "Maintain clean and safe work area throughout the project"},
            ]
        }
    ]
}

test_data = prep_newlines(test_data)
doc = DocxTemplate(TEMPLATE_PATH)
doc.render(test_data)
apply_line_breaks_simple(doc)
doc.save(OUTPUT_PATH)
print(f"Generated: {OUTPUT_PATH}")
print("Open the file in Word to verify formatting and token replacement.")
