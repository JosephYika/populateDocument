"""
Flask API server for KG Construction's estimate generator.

Serves two concerns:
  1. Document generation — accepts form data, renders a Word template via
     docxtpl/Jinja2, post-processes multiline fields into proper XML line
     breaks, and returns the finished .docx as a download.
  2. Client data CRUD — exposes REST endpoints for management companies,
     property managers, and clients (with search and soft-delete/archive).
"""

from copy import deepcopy

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from docxtpl import DocxTemplate
from lxml import etree
from sqlalchemy import or_
from datetime import datetime, timezone
import os
import io
import json

from models import Session, ManagementCompany, PropertyManager, Client

app = Flask(__name__)
CORS(app)

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')

# Fields that may contain newlines from the frontend textarea inputs.
MULTILINE_FIELDS = {'prepared_for', 'managed_by', 'project_location', 'additional_notes'}
# Placeholder swapped in before Jinja2 rendering, then replaced with <w:br/> after.
NEWLINE_MARKER = '||BR||'
# Word XML namespace — used to build element tags like <w:p>, <w:r>, <w:t>.
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def load_config():
    config_path = os.path.join(TEMPLATES_DIR, 'config.json')
    with open(config_path, 'r') as f:
        return json.load(f)


def prep_newlines(data):
    """Replace \\n with ||BR|| in multiline fields before Jinja2 rendering.

    We can't insert XML elements before rendering, so we use a text marker that
    survives Jinja2 substitution. apply_line_breaks_simple() converts these
    markers into proper <w:br/> elements afterward.
    """
    for key in MULTILINE_FIELDS:
        if key in data and isinstance(data[key], str):
            data[key] = data[key].replace('\n', NEWLINE_MARKER)
    return data


def apply_line_breaks_simple(doc):
    """Replace ||BR|| markers in rendered document XML with <w:br/> elements.

    For each marker found inside a text run, splits the run into alternating
    break-runs and text-runs. Copies the original run's formatting (rPr) onto
    each new run so font/size/color are preserved across the line break.
    """
    for para in doc.docx._element.iter(f'{{{W}}}p'):
        for run in para.iter(f'{{{W}}}r'):
            t_el = run.find(f'{{{W}}}t')
            if t_el is not None and t_el.text and NEWLINE_MARKER in t_el.text:
                parts = t_el.text.split(NEWLINE_MARKER)
                # Keep the text before the first marker in the original run.
                t_el.text = parts[0]
                if parts[0].endswith(' ') or parts[0].startswith(' '):
                    t_el.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')

                parent = run.getparent()
                insert_idx = list(parent).index(run)

                # Capture original formatting to clone onto new runs.
                rpr = run.find(f'{{{W}}}rPr')

                # For each subsequent part, insert a <w:br/> run then a text run.
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
    """Render a Word document from form data and return it as a .docx download.

    Pipeline: validate → load template → prep newline markers → Jinja2 render
    → convert markers to XML line breaks → stream response.
    """
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


# ── Search Endpoints ────────────────────────────────────────────
# Used by the SearchableSelect dropdowns on the form. Each returns
# active records matching a case-insensitive LIKE query, capped at
# the requested limit (max 50) to keep the dropdown responsive.

@app.route('/api/clients/search', methods=['GET'])
def search_clients():
    """Search clients by address, unit, building name, or owner name."""
    q = request.args.get('q', '').strip()
    limit = min(int(request.args.get('limit', 20)), 50)
    session = Session()
    try:
        query = session.query(Client).filter(Client.status == 'active')
        if q:
            pattern = f'%{q}%'
            query = query.filter(or_(
                Client.address.ilike(pattern),
                Client.unit.ilike(pattern),
                Client.building_name.ilike(pattern),
                Client.owner_name.ilike(pattern),
            ))
        results = query.order_by(Client.address).limit(limit).all()
        return jsonify([c.to_dict() for c in results])
    finally:
        session.close()


@app.route('/api/companies/search', methods=['GET'])
def search_companies():
    """Search management companies by name."""
    q = request.args.get('q', '').strip()
    limit = min(int(request.args.get('limit', 20)), 50)
    session = Session()
    try:
        query = session.query(ManagementCompany).filter(ManagementCompany.status == 'active')
        if q:
            query = query.filter(ManagementCompany.name.ilike(f'%{q}%'))
        results = query.order_by(ManagementCompany.name).limit(limit).all()
        return jsonify([c.to_dict() for c in results])
    finally:
        session.close()


@app.route('/api/managers/search', methods=['GET'])
def search_managers():
    """Search managers by name or email. Optionally filter by company_id."""
    q = request.args.get('q', '').strip()
    company_id = request.args.get('company_id', type=int)
    limit = min(int(request.args.get('limit', 20)), 50)
    session = Session()
    try:
        query = session.query(PropertyManager).filter(PropertyManager.status == 'active')
        if company_id:
            query = query.filter(PropertyManager.company_id == company_id)
        if q:
            pattern = f'%{q}%'
            query = query.filter(or_(
                PropertyManager.name.ilike(pattern),
                PropertyManager.email.ilike(pattern),
            ))
        results = query.order_by(PropertyManager.name).limit(limit).all()
        return jsonify([m.to_dict() for m in results])
    finally:
        session.close()


# ── Companies CRUD ──────────────────────────────────────────────
# Standard REST endpoints for management companies.
# DELETE is a soft-delete — sets status to 'archived' so the record
# is hidden from searches but preserved for historical references.

@app.route('/api/companies', methods=['GET'])
def list_companies():
    session = Session()
    try:
        results = session.query(ManagementCompany).filter(
            ManagementCompany.status == 'active'
        ).order_by(ManagementCompany.name).all()
        return jsonify([c.to_dict() for c in results])
    finally:
        session.close()


@app.route('/api/companies', methods=['POST'])
def create_company():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    session = Session()
    try:
        company = ManagementCompany(
            name=data['name'],
            address=data.get('address'),
            phone=data.get('phone'),
            default_email=data.get('default_email'),
            notes=data.get('notes'),
        )
        session.add(company)
        session.commit()
        session.refresh(company)
        return jsonify(company.to_dict()), 201
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        session.close()


@app.route('/api/companies/<int:id>', methods=['GET'])
def get_company(id):
    session = Session()
    try:
        company = session.query(ManagementCompany).get(id)
        if not company:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(company.to_dict())
    finally:
        session.close()


@app.route('/api/companies/<int:id>', methods=['PUT'])
def update_company(id):
    data = request.get_json()
    session = Session()
    try:
        company = session.query(ManagementCompany).get(id)
        if not company:
            return jsonify({'error': 'Not found'}), 404
        for field in ('name', 'address', 'phone', 'default_email', 'notes'):
            if field in data:
                setattr(company, field, data[field])
        company.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(company)
        return jsonify(company.to_dict())
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        session.close()


@app.route('/api/companies/<int:id>', methods=['DELETE'])
def delete_company(id):
    session = Session()
    try:
        company = session.query(ManagementCompany).get(id)
        if not company:
            return jsonify({'error': 'Not found'}), 404
        company.status = 'archived'
        company.updated_at = datetime.now(timezone.utc)
        session.commit()
        return jsonify({'ok': True})
    finally:
        session.close()


# ── Managers CRUD ───────────────────────────────────────────────
# Same pattern as companies. Managers belong to a company (optional FK).

@app.route('/api/managers', methods=['GET'])
def list_managers():
    session = Session()
    try:
        results = session.query(PropertyManager).filter(
            PropertyManager.status == 'active'
        ).order_by(PropertyManager.name).all()
        return jsonify([m.to_dict() for m in results])
    finally:
        session.close()


@app.route('/api/managers', methods=['POST'])
def create_manager():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    session = Session()
    try:
        manager = PropertyManager(
            name=data['name'],
            company_id=data.get('company_id'),
            email=data.get('email'),
            phone=data.get('phone'),
            role=data.get('role'),
            notes=data.get('notes'),
        )
        session.add(manager)
        session.commit()
        session.refresh(manager)
        return jsonify(manager.to_dict()), 201
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        session.close()


@app.route('/api/managers/<int:id>', methods=['GET'])
def get_manager(id):
    session = Session()
    try:
        manager = session.query(PropertyManager).get(id)
        if not manager:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(manager.to_dict())
    finally:
        session.close()


@app.route('/api/managers/<int:id>', methods=['PUT'])
def update_manager(id):
    data = request.get_json()
    session = Session()
    try:
        manager = session.query(PropertyManager).get(id)
        if not manager:
            return jsonify({'error': 'Not found'}), 404
        for field in ('name', 'company_id', 'email', 'phone', 'role', 'notes'):
            if field in data:
                setattr(manager, field, data[field])
        manager.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(manager)
        return jsonify(manager.to_dict())
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        session.close()


@app.route('/api/managers/<int:id>', methods=['DELETE'])
def delete_manager(id):
    session = Session()
    try:
        manager = session.query(PropertyManager).get(id)
        if not manager:
            return jsonify({'error': 'Not found'}), 404
        manager.status = 'archived'
        manager.updated_at = datetime.now(timezone.utc)
        session.commit()
        return jsonify({'ok': True})
    finally:
        session.close()


# ── Clients CRUD ────────────────────────────────────────────────
# Clients link to a default company and manager, enabling cascading
# auto-fill on the estimate form when a client is selected.

@app.route('/api/clients', methods=['GET'])
def list_clients():
    session = Session()
    try:
        results = session.query(Client).filter(
            Client.status == 'active'
        ).order_by(Client.address).all()
        return jsonify([c.to_dict() for c in results])
    finally:
        session.close()


@app.route('/api/clients', methods=['POST'])
def create_client():
    data = request.get_json()
    if not data or not data.get('address'):
        return jsonify({'error': 'Address is required'}), 400
    session = Session()
    try:
        client = Client(
            address=data['address'],
            unit=data.get('unit'),
            building_name=data.get('building_name'),
            owner_name=data.get('owner_name'),
            default_company_id=data.get('default_company_id'),
            default_manager_id=data.get('default_manager_id'),
            send_directly_to_client=data.get('send_directly_to_client', False),
            client_email=data.get('client_email'),
            notes=data.get('notes'),
        )
        session.add(client)
        session.commit()
        session.refresh(client)
        return jsonify(client.to_dict()), 201
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        session.close()


@app.route('/api/clients/<int:id>', methods=['GET'])
def get_client(id):
    session = Session()
    try:
        client = session.query(Client).get(id)
        if not client:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(client.to_dict())
    finally:
        session.close()


@app.route('/api/clients/<int:id>', methods=['PUT'])
def update_client(id):
    data = request.get_json()
    session = Session()
    try:
        client = session.query(Client).get(id)
        if not client:
            return jsonify({'error': 'Not found'}), 404
        for field in ('address', 'unit', 'building_name', 'owner_name',
                      'default_company_id', 'default_manager_id',
                      'send_directly_to_client', 'client_email', 'notes'):
            if field in data:
                setattr(client, field, data[field])
        client.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(client)
        return jsonify(client.to_dict())
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        session.close()


@app.route('/api/clients/<int:id>', methods=['DELETE'])
def delete_client(id):
    session = Session()
    try:
        client = session.query(Client).get(id)
        if not client:
            return jsonify({'error': 'Not found'}), 404
        client.status = 'archived'
        client.updated_at = datetime.now(timezone.utc)
        session.commit()
        return jsonify({'ok': True})
    finally:
        session.close()


if __name__ == '__main__':
    app.run(port=5000)
