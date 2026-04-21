import { useState } from 'react'

const API_URL = 'http://localhost:5000'

const emptyLine = () => ({ text: '' })
const emptySection = () => ({ title: '', price: '', lines: [emptyLine()] })

export default function EstimateForm({ form, setForm, sections, setSections }) {
  const [loading, setLoading] = useState(false)

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateSection = (sIdx, key, value) => {
    setSections(prev => {
      const updated = [...prev]
      updated[sIdx] = { ...updated[sIdx], [key]: value }
      return updated
    })
  }

  const updateLine = (sIdx, lIdx, value) => {
    setSections(prev => {
      const updated = [...prev]
      const lines = [...updated[sIdx].lines]
      lines[lIdx] = { text: value }
      updated[sIdx] = { ...updated[sIdx], lines }
      return updated
    })
  }

  const addSection = () => setSections(prev => [...prev, emptySection()])

  const removeSection = (sIdx) => {
    setSections(prev => prev.length > 1 ? prev.filter((_, i) => i !== sIdx) : prev)
  }

  const addLine = (sIdx) => {
    setSections(prev => {
      const updated = [...prev]
      updated[sIdx] = { ...updated[sIdx], lines: [...updated[sIdx].lines, emptyLine()] }
      return updated
    })
  }

  const removeLine = (sIdx, lIdx) => {
    setSections(prev => {
      const updated = [...prev]
      const lines = updated[sIdx].lines.filter((_, i) => i !== lIdx)
      updated[sIdx] = { ...updated[sIdx], lines: lines.length ? lines : [emptyLine()] }
      return updated
    })
  }

  const formatCurrency = (value) => {
    const num = parseFloat(value.replace(/,/g, ''))
    if (isNaN(num)) return value
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const recalculateTotal = (updatedSections) => {
    const total = updatedSections.reduce((sum, s) => {
      const price = parseFloat(s.price.replace(/,/g, '')) || 0
      return sum + price
    }, 0)
    const formatted = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    setForm(prev => ({ ...prev, quote: formatted, total: formatted }))
  }

  const handlePriceBlur = (sIdx, value) => {
    const formatted = formatCurrency(value)
    updateSection(sIdx, 'price', formatted)
    const updated = sections.map((s, i) => i === sIdx ? { ...s, price: formatted } : s)
    recalculateTotal(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      template: 'estimate',
      data: {
        ...form,
        sections: sections.map((s, sIdx) => ({
          num: String(sIdx + 1),
          title: s.title,
          price: s.price,
          lines: s.lines.map((l, lIdx) => ({
            lineNum: `${sIdx + 1}.${lIdx + 1}`,
            text: l.text,
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
      a.download = `estimate_${form.estimate_number || 'draft'}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Failed to connect to server: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="estimate-form" onSubmit={handleSubmit}>
      <h2>New Estimate</h2>

      <div className="form-grid">
        <div className="form-group">
          <label>Estimate Number *</label>
          <input
            type="text"
            value={form.estimate_number}
            onChange={e => updateField('estimate_number', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Date *</label>
          <input
            type="text"
            value={form.estimate_date}
            onChange={e => updateField('estimate_date', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Project Name *</label>
          <input
            type="text"
            value={form.project_name}
            onChange={e => updateField('project_name', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-grid two-col">
        <div className="form-group">
          <label>Prepared For (Address) *</label>
          <textarea
            rows={3}
            value={form.prepared_for}
            onChange={e => updateField('prepared_for', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Project Location *</label>
          <textarea
            rows={3}
            value={form.project_location}
            onChange={e => updateField('project_location', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Managed By *</label>
          <textarea
            rows={3}
            value={form.managed_by}
            onChange={e => updateField('managed_by', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Contact Name *</label>
          <input
            type="text"
            value={form.contact_name}
            onChange={e => updateField('contact_name', e.target.value)}
            required
          />
          <label style={{ marginTop: '0.5rem' }}>Contact Email *</label>
          <input
            type="email"
            value={form.contact_email}
            onChange={e => updateField('contact_email', e.target.value)}
            required
          />
        </div>
      </div>

      <hr />

      <h3>Scope of Work</h3>
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="section-block">
          <div className="section-header">
            <span className="section-number">{sIdx + 1}</span>
            <input
              type="text"
              placeholder="Section title"
              value={section.title}
              onChange={e => updateSection(sIdx, 'title', e.target.value)}
              className="section-title-input"
              required
            />
            <div className="price-input-wrapper">
              <span className="dollar-sign">$</span>
              <input
                type="text"
                placeholder="0.00"
                value={section.price}
                onChange={e => updateSection(sIdx, 'price', e.target.value)}
                onBlur={e => handlePriceBlur(sIdx, e.target.value)}
                className="section-price-input"
                required
              />
            </div>
            {sections.length > 1 && (
              <button type="button" className="btn-remove" onClick={() => removeSection(sIdx)}>
                Remove
              </button>
            )}
          </div>

          <div className="lines-block">
            {section.lines.map((line, lIdx) => (
              <div key={lIdx} className="line-row">
                <span className="line-number">{sIdx + 1}.{lIdx + 1}</span>
                <input
                  type="text"
                  placeholder="Line item description"
                  value={line.text}
                  onChange={e => updateLine(sIdx, lIdx, e.target.value)}
                  className="line-text-input"
                  required
                />
                {section.lines.length > 1 && (
                  <button type="button" className="btn-remove-sm" onClick={() => removeLine(sIdx, lIdx)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-add-line" onClick={() => addLine(sIdx)}>
              + Add Line Item
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn-add-section" onClick={addSection}>
        + Add Section
      </button>

      <hr />

      <div className="form-grid two-col">
        <div className="form-group">
          <label>Quote Total</label>
          <div className="total-display">${form.quote || '0.00'}</div>
        </div>
        <div className="form-group">
          <label>Total Estimated Cost</label>
          <div className="total-display">${form.total || '0.00'}</div>
        </div>
      </div>

      <div className="form-group">
        <label>Additional Notes</label>
        <textarea
          rows={4}
          value={form.additional_notes}
          onChange={e => updateField('additional_notes', e.target.value)}
          placeholder="Any additional notes for this estimate..."
        />
      </div>

      <div className="form-group">
        <label>Payment Terms</label>
        <textarea
          rows={3}
          value={form.payment_terms}
          onChange={e => updateField('payment_terms', e.target.value)}
          placeholder="e.g. Net 30, 50% deposit required..."
        />
      </div>

      <button type="submit" className="btn-generate" disabled={loading}>
        {loading ? 'Generating...' : 'Generate Estimate (.docx)'}
      </button>
    </form>
  )
}
