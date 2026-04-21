import { useState } from 'react'
import EstimateForm from './components/EstimateForm'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>KG Construction Corp</h1>
        <p>Document Generator</p>
      </header>
      <main>
        <EstimateForm />
      </main>
    </div>
  )
}

export default App
