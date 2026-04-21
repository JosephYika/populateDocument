import './EstimatePreview.css'

export default function EstimatePreview({ form, sections }) {
  return (
    <div className="preview-container">
      <div className="preview-page">
        {/* Header */}
        <div className="preview-header-bar">
          <div className="preview-title">ESTIMATE</div>
          <div className="preview-subtitle">Construction Services</div>
        </div>

        {/* Info Table */}
        <table className="preview-info-table">
          <tbody>
            <tr>
              <td className="info-label">ESTIMATE #:</td>
              <td className="info-value">{form.estimate_number || '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Date:</td>
              <td className="info-value">{form.estimate_date || '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Prepared For:</td>
              <td className="info-value info-bold">{form.prepared_for ? form.prepared_for.split('\n').map((l, i) => <span key={i}>{l}<br/></span>) : '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Managed By:</td>
              <td className="info-value">
                {form.managed_by ? form.managed_by.split('\n').map((l, i) => <span key={i}>{l}<br/></span>) : '—'}
                <div className="info-sublabel">Point of Contact:</div>
                <div>{form.contact_name || '—'}</div>
                <div>{form.contact_email || '—'}</div>
              </td>
            </tr>
            <tr>
              <td className="info-label">Project Location:</td>
              <td className="info-value info-bold">{form.project_location ? form.project_location.split('\n').map((l, i) => <span key={i}>{l}<br/></span>) : '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Prepared By:</td>
              <td className="info-value">
                <strong>KG Construction Corp</strong><br/>
                <em>License Number: 611502</em>
              </td>
            </tr>
            <tr>
              <td className="info-label">Quote:</td>
              <td className="info-value info-bold">${form.quote || '0.00'}</td>
            </tr>
          </tbody>
        </table>

        {/* Project Name */}
        <div className="preview-project-name">
          <span className="project-name-accent"></span>
          <span><strong>Project Name:</strong> {form.project_name || '—'}</span>
        </div>

        {/* Scope of Work */}
        <div className="preview-scope-header">SCOPE OF WORK</div>
        <p className="preview-scope-intro">
          The following work will be performed by KG Construction Corp at the above-referenced project location:
        </p>

        {sections.map((section, sIdx) => (
          <div key={sIdx} className="preview-section">
            <div className="preview-section-bar">
              <span className="preview-section-num">{sIdx + 1}</span>
              <span className="preview-section-title">{section.title || 'Untitled Section'}</span>
              <span className="preview-section-price">${section.price || '0.00'}</span>
            </div>
            <div className="preview-lines">
              {section.lines.map((line, lIdx) => (
                <div key={lIdx} className="preview-line">
                  <span className="preview-line-num">{sIdx + 1}.{lIdx + 1}</span>
                  <span className="preview-line-text">{line.text || '...'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Total */}
        <div className="preview-total-bar">
          <span className="preview-total-label">TOTAL ESTIMATED COST</span>
          <span className="preview-total-value">${form.total || '0.00'}</span>
        </div>

        {/* Additional Notes */}
        {form.additional_notes && (
          <div className="preview-notes">
            <div className="preview-notes-header">Additional Notes</div>
            <p>{form.additional_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
