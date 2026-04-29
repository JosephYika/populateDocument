/**
 * Root component — owns all form state and renders the two-column layout:
 *   Left:  EstimateForm (data entry)
 *   Right: EstimatePreview (live document preview, updates as user types)
 *
 * The sticky header displays the company name and a running total that
 * auto-sums from section prices.
 */
import { useState } from 'react'
import EstimateForm from './components/EstimateForm'
import EstimatePreview from './components/EstimatePreview'
import { uid } from './utils/uid'
import './App.css'

/** Factory for the initial sections array — one empty section with one line. */
const defaultSections = () => [{
  id: uid(), title: '', price: '',
  lines: [{ id: uid(), description: '' }]
}]

/** Returns today's date formatted as MM/DD/YYYY for the default date field. */
const today = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

const DEFAULT_NOTES = 'Any additional work required beyond the agreed scope of work, including unforeseen conditions or client-requested changes, will be billed separately and clearly itemized on the final invoice.'

/** Format a number as "1,234.00". Returns the string only — $ is added in JSX. */
const fmt = n => (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function App() {
  const [form, setForm] = useState({
    estimateNumber: '',
    date: today(),
    projectName: '',
    preparedFor: '',
    projectLocation: '',
    managedBy: '',
    contactName: '',
    contactEmail: '',
    additionalNotes: DEFAULT_NOTES,
    paymentTerms: ''
  })
  const [sections, setSections] = useState(defaultSections())
  const [loading, setLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedManager, setSelectedManager] = useState(null)

  // Running total: sum all section prices (stripping commas from formatted values).
  const total = sections.reduce((a, s) => a + (parseFloat(String(s.price).replace(/,/g, '')) || 0), 0)

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
            <div className="app-header-subtitle">ESTIMATE GENERATOR</div>
          </div>
        </div>
        <div className="app-header-right">
          <div className="app-header-total">
            Total: <span>${fmt(total)}</span>
          </div>
          <a href="#/admin" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none', marginLeft: 12 }}>Admin</a>
        </div>
      </header>

      <main className="app-main">
        <div className="panel-form">
          <EstimateForm
            form={form}
            setForm={setForm}
            sections={sections}
            setSections={setSections}
            total={total}
            fmt={fmt}
            uid={uid}
            loading={loading}
            setLoading={setLoading}
            selectedClient={selectedClient}
            setSelectedClient={setSelectedClient}
            selectedCompany={selectedCompany}
            setSelectedCompany={setSelectedCompany}
            selectedManager={selectedManager}
            setSelectedManager={setSelectedManager}
          />
        </div>
        <div className="panel-preview">
          <div className="preview-label-bar">
            <span>Live Preview</span>
            <span>Auto-updates as you type</span>
          </div>
          <div className="preview-wrapper">
            <div className="preview-inner">
              <EstimatePreview form={form} sections={sections} total={total} fmt={fmt} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
