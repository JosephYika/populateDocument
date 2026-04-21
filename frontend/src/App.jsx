import { useState } from 'react'
import EstimateForm from './components/EstimateForm'
import EstimatePreview from './components/EstimatePreview'
import './App.css'

const emptyLine = () => ({ text: '' })
const emptySection = () => ({ title: '', price: '', lines: [emptyLine()] })

const today = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

function App() {
  const [form, setForm] = useState({
    estimate_number: '',
    estimate_date: today(),
    prepared_for: '',
    managed_by: '',
    contact_name: '',
    contact_email: '',
    project_location: '',
    project_name: '',
    quote: '',
    total: '',
    additional_notes: '',
    payment_terms: ''
  })
  const [sections, setSections] = useState([emptySection()])

  return (
    <div className="app">
      <header className="app-header">
        <h1>KG Construction Corp</h1>
        <p>Document Generator</p>
      </header>
      <main className="app-main">
        <div className="panel-form">
          <EstimateForm
            form={form}
            setForm={setForm}
            sections={sections}
            setSections={setSections}
          />
        </div>
        <div className="panel-preview">
          <EstimatePreview form={form} sections={sections} />
        </div>
      </main>
    </div>
  )
}

export default App
