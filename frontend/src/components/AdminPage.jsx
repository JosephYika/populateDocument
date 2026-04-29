/**
 * Admin CRUD page for managing clients, companies, and managers.
 *
 * Accessible at #/admin. Each entity type has its own tab component
 * (ClientsTab, CompaniesTab, ManagersTab) following the same pattern:
 *   - Load all active records on mount
 *   - Client-side search filter on the table
 *   - Modal dialog for create/edit
 *   - "Archive" soft-delete (calls DELETE, which sets status='archived')
 */
import { useState, useEffect, useCallback } from 'react'
import { CompanySelect, ManagerSelect } from './SearchableSelect'
import { API_URL } from '../config'

function AdminPage() {
  const [tab, setTab] = useState('clients')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-header-logo">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="12" height="11"/><path d="M6 14V9h4v5"/><path d="M5 6h1M10 6h1M5 9h1"/>
            </svg>
          </div>
          <div>
            <div className="app-header-title">KG Construction Corp</div>
            <div className="app-header-subtitle">ADMIN — DATA MANAGEMENT</div>
          </div>
        </div>
        <div className="app-header-right">
          <a href="/" style={{ fontSize: 13, color: 'var(--orange)', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Estimates
          </a>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '24px 28px' }}>
        <div className="admin-tabs">
          {['clients', 'companies', 'managers'].map(t => (
            <button
              key={t}
              className={`admin-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'clients' && <ClientsTab />}
        {tab === 'companies' && <CompaniesTab />}
        {tab === 'managers' && <ManagersTab />}
      </div>
    </div>
  )
}


function CompaniesTab() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    fetch(`${API_URL}/api/companies`).then(r => r.json()).then(setItems)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = items.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.address || '').toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => { setEditing(null); setShowModal(true) }
  const openEdit = (c) => { setEditing(c); setShowModal(true) }

  const handleSave = async (data) => {
    if (editing) {
      await fetch(`${API_URL}/api/companies/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
    } else {
      await fetch(`${API_URL}/api/companies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
    }
    setShowModal(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Archive this company? It will be hidden from searches.')) return
    await fetch(`${API_URL}/api/companies/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <>
      <div className="admin-toolbar">
        <input className="admin-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…" />
        <button className="admin-add-btn" onClick={openNew}>+ Add Company</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} onClick={() => openEdit(c)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.address}</td>
                <td>{c.phone}</td>
                <td>{c.default_email}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="admin-delete-btn" onClick={e => { e.stopPropagation(); handleDelete(c.id) }}>Archive</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>No companies found</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && <CompanyModal initial={editing} onSave={handleSave} onClose={() => setShowModal(false)} />}
    </>
  )
}

function CompanyModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    address: initial?.address || '',
    phone: initial?.phone || '',
    default_email: initial?.default_email || '',
    notes: initial?.notes || '',
  })
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>{initial ? 'Edit Company' : 'Add Company'}</h3>
        <div className="modal-fields">
          <label>Name *<input value={form.name} onChange={e => u('name', e.target.value)} required /></label>
          <label>Address<input value={form.address} onChange={e => u('address', e.target.value)} /></label>
          <label>Phone<input value={form.phone} onChange={e => u('phone', e.target.value)} /></label>
          <label>Email<input value={form.default_email} onChange={e => u('default_email', e.target.value)} /></label>
          <label>Notes<textarea rows={2} value={form.notes} onChange={e => u('notes', e.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-save" onClick={() => onSave(form)} disabled={!form.name}>Save</button>
        </div>
      </div>
    </div>
  )
}


function ManagersTab() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    fetch(`${API_URL}/api/managers`).then(r => r.json()).then(setItems)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = items.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => { setEditing(null); setShowModal(true) }
  const openEdit = (m) => { setEditing(m); setShowModal(true) }

  const handleSave = async (data) => {
    if (editing) {
      await fetch(`${API_URL}/api/managers/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
    } else {
      await fetch(`${API_URL}/api/managers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
    }
    setShowModal(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Archive this manager? They will be hidden from searches.')) return
    await fetch(`${API_URL}/api/managers/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <>
      <div className="admin-toolbar">
        <input className="admin-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search managers…" />
        <button className="admin-add-btn" onClick={openNew}>+ Add Manager</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} onClick={() => openEdit(m)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>{m.email}</td>
                <td>{m.phone}</td>
                <td>{m.role}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="admin-delete-btn" onClick={e => { e.stopPropagation(); handleDelete(m.id) }}>Archive</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>No managers found</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && <ManagerModal initial={editing} onSave={handleSave} onClose={() => setShowModal(false)} />}
    </>
  )
}

function ManagerModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    role: initial?.role || '',
    company_id: initial?.company_id || null,
    notes: initial?.notes || '',
  })
  const [selectedCompany, setSelectedCompany] = useState(null)
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (initial?.company_id) {
      fetch(`${API_URL}/api/companies/${initial.company_id}`).then(r => r.json()).then(c => {
        setSelectedCompany({ value: c.id, label: c.name, data: c })
      })
    }
  }, [initial])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>{initial ? 'Edit Manager' : 'Add Manager'}</h3>
        <div className="modal-fields">
          <label>Name *<input value={form.name} onChange={e => u('name', e.target.value)} required /></label>
          <label>Company
            <CompanySelect
              value={selectedCompany}
              onChange={(opt) => {
                setSelectedCompany(opt)
                u('company_id', opt?.value || null)
              }}
              placeholder="Search companies…"
              creatable={false}
            />
          </label>
          <label>Email<input value={form.email} onChange={e => u('email', e.target.value)} /></label>
          <label>Phone<input value={form.phone} onChange={e => u('phone', e.target.value)} /></label>
          <label>Role<input value={form.role} onChange={e => u('role', e.target.value)} placeholder="e.g. Portfolio Manager" /></label>
          <label>Notes<textarea rows={2} value={form.notes} onChange={e => u('notes', e.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-save" onClick={() => onSave(form)} disabled={!form.name}>Save</button>
        </div>
      </div>
    </div>
  )
}


function ClientsTab() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    fetch(`${API_URL}/api/clients`).then(r => r.json()).then(setItems)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = items.filter(c =>
    c.address.toLowerCase().includes(search.toLowerCase()) ||
    (c.owner_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.unit || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => { setEditing(null); setShowModal(true) }
  const openEdit = (c) => { setEditing(c); setShowModal(true) }

  const handleSave = async (data) => {
    if (editing) {
      await fetch(`${API_URL}/api/clients/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
    } else {
      await fetch(`${API_URL}/api/clients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
    }
    setShowModal(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Archive this client? They will be hidden from searches.')) return
    await fetch(`${API_URL}/api/clients/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <>
      <div className="admin-toolbar">
        <input className="admin-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients by address, owner, or company…" />
        <button className="admin-add-btn" onClick={openNew}>+ Add Client</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Address</th><th>Unit</th><th>Owner</th><th>Company</th><th>Manager</th><th>Billing</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} onClick={() => openEdit(c)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{c.address}</td>
                <td>{c.unit}</td>
                <td>{c.owner_name}</td>
                <td>{c.company?.name}</td>
                <td>{c.manager?.name}</td>
                <td>{c.send_directly_to_client ? 'Direct' : 'Via manager'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="admin-delete-btn" onClick={e => { e.stopPropagation(); handleDelete(c.id) }}>Archive</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>No clients found</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && <ClientModal initial={editing} onSave={handleSave} onClose={() => setShowModal(false)} />}
    </>
  )
}

function ClientModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    address: initial?.address || '',
    unit: initial?.unit || '',
    building_name: initial?.building_name || '',
    owner_name: initial?.owner_name || '',
    default_company_id: initial?.default_company_id || null,
    default_manager_id: initial?.default_manager_id || null,
    send_directly_to_client: initial?.send_directly_to_client || false,
    client_email: initial?.client_email || '',
    notes: initial?.notes || '',
  })
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedManager, setSelectedManager] = useState(null)
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (initial?.default_company_id && initial?.company) {
      setSelectedCompany({ value: initial.company.id, label: initial.company.name, data: initial.company })
    }
    if (initial?.default_manager_id && initial?.manager) {
      setSelectedManager({ value: initial.manager.id, label: initial.manager.name, data: initial.manager })
    }
  }, [initial])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" onClick={e => e.stopPropagation()}>
        <h3>{initial ? 'Edit Client' : 'Add Client'}</h3>
        <div className="modal-fields">
          <label>Address *<input value={form.address} onChange={e => u('address', e.target.value)} required /></label>
          <div className="modal-row">
            <label className="modal-half">Unit<input value={form.unit} onChange={e => u('unit', e.target.value)} /></label>
            <label className="modal-half">Building Name<input value={form.building_name} onChange={e => u('building_name', e.target.value)} /></label>
          </div>
          <label>Owner Name<input value={form.owner_name} onChange={e => u('owner_name', e.target.value)} /></label>
          <label>Management Company
            <CompanySelect
              value={selectedCompany}
              onChange={(opt) => {
                setSelectedCompany(opt)
                u('default_company_id', opt?.value || null)
              }}
              placeholder="Search companies…"
              creatable={false}
            />
          </label>
          <label>Property Manager
            <ManagerSelect
              value={selectedManager}
              onChange={(opt) => {
                setSelectedManager(opt)
                u('default_manager_id', opt?.value || null)
              }}
              placeholder="Search managers…"
              companyId={form.default_company_id}
              creatable={false}
            />
          </label>
          <div className="modal-row" style={{ alignItems: 'center', gap: 12 }}>
            <label style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.send_directly_to_client}
                onChange={e => u('send_directly_to_client', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#C05008' }}
              />
              Bill directly to client
            </label>
            <label style={{ flex: 1 }}>Client Email<input value={form.client_email} onChange={e => u('client_email', e.target.value)} /></label>
          </div>
          <label>Notes<textarea rows={2} value={form.notes} onChange={e => u('notes', e.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-save" onClick={() => onSave(form)} disabled={!form.address}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default AdminPage
