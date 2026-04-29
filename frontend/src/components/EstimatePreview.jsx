/**
 * Read-only document preview — renders a scaled-down representation of the
 * final estimate document. Updates in real time as the user types in the form.
 *
 * Layout mirrors the Word template: orange header banner, 2-column meta grid,
 * numbered scope sections with line items, total bar, notes, and footer.
 *
 * Stateless — receives all data via props from App.jsx.
 */
import './EstimatePreview.css'

export default function EstimatePreview({ form, sections, total, fmt }) {
  return (
    <div className="preview-doc">
      {/* Header */}
      <div className="preview-doc-header">
        <div className="preview-doc-header-left">
          <div className="company-name">KG CONSTRUCTION CORP</div>
          <div className="company-sub">ESTIMATE · LICENSE #611502</div>
        </div>
        <div className="preview-doc-header-right">
          <div className="est-label">ESTIMATE</div>
          <div className="est-number">{form.estimateNumber || '—'}</div>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="preview-meta-grid">
        <div className="preview-meta-cell">
          <div className="preview-meta-label">Date</div>
          <div className="preview-meta-value">{form.date || '—'}</div>
        </div>
        <div className="preview-meta-cell">
          <div className="preview-meta-label">Project</div>
          <div className="preview-meta-value">{form.projectName || '—'}</div>
        </div>
        <div className="preview-meta-cell">
          <div className="preview-meta-label">Client</div>
          <div className="preview-meta-value">{form.preparedFor || '—'}</div>
        </div>
        <div className="preview-meta-cell">
          <div className="preview-meta-label">Location</div>
          <div className="preview-meta-value">{form.projectLocation || '—'}</div>
        </div>
        <div className="preview-meta-cell">
          <div className="preview-meta-label">Managed by</div>
          <div className="preview-meta-value">{form.managedBy ? form.managedBy.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>) : '—'}</div>
        </div>
        <div className="preview-meta-cell">
          <div className="preview-meta-label">Contact</div>
          <div className="preview-meta-value">
            {form.contactName ? `${form.contactName}${form.contactEmail ? ` · ${form.contactEmail}` : ''}` : '—'}
          </div>
        </div>
      </div>

      {/* Scope of Work */}
      <div className="preview-scope-label">Scope of Work</div>
      {sections.map((sec, si) => (
        <div key={sec.id} className="preview-section">
          <div className="preview-section-bar">
            <div className="preview-section-bar-left">
              <span className="preview-section-num">{si + 1}</span>
              <span className="preview-section-title">{sec.title || 'Untitled Section'}</span>
            </div>
            <span className="preview-section-price">${sec.price || '0.00'}</span>
          </div>
          {sec.lines.filter(l => l.description).map((line, li) => (
            <div key={line.id} className="preview-line-item">
              <div className="preview-line-item-left">
                <span className="preview-line-item-num">{si + 1}.{li + 1}</span>
                <span className="preview-line-item-desc">{line.description}</span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Total */}
      <div className="preview-total-bar">
        <span className="preview-total-label">Total Estimated Cost</span>
        <span className="preview-total-value">${fmt(total)}</span>
      </div>

      {/* Notes */}
      {form.additionalNotes && (
        <div className="preview-notes">
          <div className="preview-notes-header">Additional Notes</div>
          <p>{form.additionalNotes}</p>
        </div>
      )}

      {/* Payment Terms */}
      {form.paymentTerms && (
        <div className="preview-payment">
          <div className="preview-payment-header">Payment Terms</div>
          <p>{form.paymentTerms}</p>
        </div>
      )}

      {/* Footer */}
      <div className="preview-footer">
        <p>
          This estimate is valid for 30 days from the date issued.<br/>
          KG Construction Corp · License #611502
        </p>
      </div>
    </div>
  )
}
