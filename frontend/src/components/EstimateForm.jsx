import { uid } from '../App'

const API_URL = 'http://localhost:5000'

const PAYMENT_OPTIONS = [
  { value: '', label: '— Select Payment Terms —' },
  { value: 'Full payment (100%) is due upon completion of the project.', label: 'Option 1 — 100% upon completion' },
  { value: 'A deposit of 50% of the total contract price is due upon signing (or accepting it electronically). The remaining balance is due upon project completion unless otherwise agreed in writing.', label: 'Option 2 — 50% deposit / 50% on completion' },
  { value: 'The contract sum shall be paid as follows: 60% upon project commencement, 30% at the midway milestone, and 10% upon final completion of all work.', label: 'Option 3 — 60% / 30% / 10% milestones' },
  { value: '60% of the total contract amount is due before work begins, and the remaining 40% is due at the final stage of the project.', label: 'Option 4 — 60% upfront / 40% final stage' },
]

const formatCurrency = (value) => {
  const num = parseFloat(String(value).replace(/,/g, ''))
  if (isNaN(num)) return value
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function EstimateForm({ form, setForm, sections, setSections, total, fmt, loading, setLoading }) {
  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const updateSection = (si, field, val, li) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s
      if (field === 'title') return { ...s, title: val }
      if (field === 'price') return { ...s, price: val }
      if (field === 'lineDesc') return { ...s, lines: s.lines.map((l, j) => j === li ? { ...l, description: val } : l) }
      return s
    }))
  }

  const handlePriceBlur = (si, value) => {
    const formatted = formatCurrency(value)
    updateSection(si, 'price', formatted)
  }

  const addSection = () => setSections(prev => [...prev, { id: uid(), title: '', price: '', lines: [{ id: uid(), description: '' }] }])
  const removeSection = (si) => setSections(prev => prev.filter((_, i) => i !== si))
  const addLine = (si) => setSections(prev => prev.map((s, i) => i === si ? { ...s, lines: [...s.lines, { id: uid(), description: '' }] } : s))
  const removeLine = (si, li) => setSections(prev => prev.map((s, i) => i === si ? { ...s, lines: s.lines.filter((_, j) => j !== li) } : s))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      template: 'estimate',
      data: {
        estimate_number: form.estimateNumber,
        estimate_date: form.date,
        prepared_for: form.preparedFor,
        managed_by: form.managedBy,
        contact_name: form.contactName,
        contact_email: form.contactEmail,
        project_location: form.projectLocation,
        project_name: form.projectName,
        quote: fmt(total),
        total: fmt(total),
        additional_notes: form.additionalNotes,
        payment_terms: form.paymentTerms,
        sections: sections.map((s, sIdx) => ({
          num: String(sIdx + 1),
          title: s.title,
          price: s.price,
          lines: s.lines.map((l, lIdx) => ({
            lineNum: `${sIdx + 1}.${lIdx + 1}`,
            text: l.description,
          })),
        })),
      },
    }

    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(`Error: ${err.error}`)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estimate_${form.estimateNumber || 'draft'}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Failed to connect to server: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const TrashIcon = ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l.7 9h4.6L11 4"/>
    </svg>
  )

  const PlusIcon = ({ size = 13, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/>
    </svg>
  )

  const DocIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5z"/><polyline points="10,2 10,6 14,6"/>
    </svg>
  )

  return (
    <form onSubmit={handleSubmit}>
      {/* Project Details Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-title">Project Details</span>
        </div>
        <div className="card-body">
          <div className="form-fields">
            <div className="field half">
              <label>Estimate Number <span className="required">*</span></label>
              <input type="text" value={form.estimateNumber} onChange={e => updateField('estimateNumber', e.target.value)} placeholder="1050" required />
            </div>
            <div className="field half">
              <label>Date <span className="required">*</span></label>
              <input type="text" value={form.date} onChange={e => updateField('date', e.target.value)} placeholder="MM/DD/YYYY" required />
            </div>
            <div className="field">
              <label>Project Name <span className="required">*</span></label>
              <input type="text" value={form.projectName} onChange={e => updateField('projectName', e.target.value)} placeholder="System Winterization &amp; Shut Off" required />
            </div>
            <div className="field">
              <label>Prepared For (Address) <span className="required">*</span></label>
              <textarea rows={2} value={form.preparedFor} onChange={e => updateField('preparedFor', e.target.value)} placeholder="Client name and address" required />
            </div>
            <div className="field">
              <label>Project Location <span className="required">*</span></label>
              <input type="text" value={form.projectLocation} onChange={e => updateField('projectLocation', e.target.value)} placeholder="Site address or location" required />
            </div>
            <div className="field half">
              <label>Managed By <span className="required">*</span></label>
              <input type="text" value={form.managedBy} onChange={e => updateField('managedBy', e.target.value)} placeholder="Project manager" required />
            </div>
            <div className="field half">
              <label>Contact Name <span className="required">*</span></label>
              <input type="text" value={form.contactName} onChange={e => updateField('contactName', e.target.value)} placeholder="Primary contact" required />
            </div>
            <div className="field">
              <label>Contact Email <span className="required">*</span></label>
              <input type="email" value={form.contactEmail} onChange={e => updateField('contactEmail', e.target.value)} placeholder="contact@email.com" required />
            </div>
          </div>
        </div>
      </div>

      {/* Scope of Work Card */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <span className="card-header-title">Scope of Work</span>
          <span className="card-header-meta">{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-body-compact">
          <div className="scope-sections">
            {sections.map((sec, si) => (
              <div key={sec.id} className="scope-section">
                <div className="scope-section-header">
                  <div className="scope-section-num">{si + 1}</div>
                  <input
                    className="scope-title-input"
                    value={sec.title}
                    onChange={e => updateSection(si, 'title', e.target.value)}
                    placeholder="Section title…"
                    required
                  />
                  <div className="scope-section-price-group">
                    <span className="price-label">$</span>
                    <input
                      className="scope-section-price-input"
                      type="text"
                      value={sec.price}
                      onChange={e => updateSection(si, 'price', e.target.value)}
                      onBlur={e => handlePriceBlur(si, e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {sections.length > 1 && (
                    <button type="button" className="btn-icon" onClick={() => removeSection(si)}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
                <div className="scope-lines">
                  {sec.lines.map((line, li) => (
                    <div key={line.id} className="line-row">
                      <span className="line-number">{si + 1}.{li + 1}</span>
                      <input
                        className="line-desc"
                        value={line.description}
                        onChange={e => updateSection(si, 'lineDesc', e.target.value, li)}
                        placeholder="Line item description"
                        required
                      />
                      {sec.lines.length > 1 && (
                        <button type="button" className="btn-icon" onClick={() => removeLine(si, li)}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-add-line" onClick={() => addLine(si)}>
                    <PlusIcon size={13} color="var(--orange)" /> Add line item
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn-add-section" onClick={addSection}>
              <PlusIcon size={14} /> Add Section
            </button>
          </div>
        </div>
      </div>

      {/* Summary & Terms Card */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <span className="card-header-title">Summary & Terms</span>
        </div>
        <div className="card-body">
          <div className="totals-grid">
            <div className="total-box neutral">
              <div className="total-box-label">Quote Total</div>
              <div className="total-box-value">${fmt(total)}</div>
            </div>
            <div className="total-box accent">
              <div className="total-box-label">Estimated Cost</div>
              <div className="total-box-value">${fmt(total)}</div>
            </div>
          </div>

          <div className="form-fields">
            <div className="field">
              <label>Additional Notes</label>
              <textarea rows={3} value={form.additionalNotes} onChange={e => updateField('additionalNotes', e.target.value)} />
            </div>
            <div className="field">
              <label>Payment Terms</label>
              <select value={form.paymentTerms} onChange={e => updateField('paymentTerms', e.target.value)}>
                {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="btn-generate" disabled={loading}>
            <DocIcon />
            {loading ? 'Generating...' : 'Generate Estimate (.docx)'}
          </button>
        </div>
      </div>
    </form>
  )
}
