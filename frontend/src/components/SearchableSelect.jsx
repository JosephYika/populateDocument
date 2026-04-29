/**
 * Searchable select dropdowns for clients, companies, and managers.
 *
 * Built on react-select's async variants — options are fetched from the API
 * as the user types (debounced 250ms). The "creatable" variants allow typing
 * a free-text value when no match exists, identified by the __isNew__ flag.
 *
 * Exports: ClientSelect, CompanySelect, ManagerSelect
 */
import { useCallback, useRef } from 'react'
import AsyncSelect from 'react-select/async'
import AsyncCreatableSelect from 'react-select/async-creatable'
import { API_URL } from '../config'

/** react-select style overrides to match the app's brand colors and typography. */
const brandStyles = {
  control: (base, state) => ({
    ...base,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    minHeight: '38px',
    borderWidth: '1.5px',
    borderColor: state.isFocused ? '#C05008' : 'oklch(91% 0.006 55)',
    borderRadius: '5px',
    boxShadow: state.isFocused ? '0 0 0 3px #FDF0E6' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#C05008' : 'oklch(91% 0.006 55)' },
    background: 'white',
    cursor: 'text',
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 12px',
  }),
  input: (base) => ({
    ...base,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    color: '#2A2A2A',
    margin: 0,
    padding: 0,
  }),
  singleValue: (base) => ({
    ...base,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    color: '#2A2A2A',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9A9A9A',
    fontSize: '14px',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '8px',
    border: '1px solid oklch(91% 0.006 55)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
  }),
  option: (base, state) => ({
    ...base,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    padding: '8px 12px',
    borderRadius: '5px',
    cursor: 'pointer',
    backgroundColor: state.isFocused ? '#FDF0E6' : 'transparent',
    color: '#2A2A2A',
    '&:active': { backgroundColor: '#F9CFA8' },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#6B6B6B',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: '#9A9A9A',
    padding: '0 8px',
    '&:hover': { color: '#6B6B6B' },
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
    transition: 'transform 0.2s',
  }),
  clearIndicator: (base) => ({
    ...base,
    color: '#9A9A9A',
    padding: '0 4px',
    '&:hover': { color: '#E53E3E' },
  }),
  loadingIndicator: (base) => ({
    ...base,
    color: '#C05008',
  }),
}

/** Promise-based debounce — delays API calls until the user pauses typing. */
function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    return new Promise(resolve => {
      timer = setTimeout(() => resolve(fn(...args)), ms)
    })
  }
}

/** Dropdown option: shows address on line 1, owner · company on line 2. */
function ClientOptionLabel({ data }) {
  if (data.__isNew__) return <div style={{ fontSize: '13px' }}>Use: <strong>{data.label}</strong></div>
  const unit = data.unit ? `, ${data.unit}` : ''
  const addr = `${data.address}${unit}`
  const parts = []
  if (data.owner_name) parts.push(data.owner_name)
  if (data.company?.name) parts.push(data.company.name)
  const sub = parts.join(' · ')
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3 }}>{addr}</div>
      {sub && <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function CompanyOptionLabel({ data }) {
  if (data.__isNew__) return <div style={{ fontSize: '13px' }}>Use: <strong>{data.label}</strong></div>
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3 }}>{data.name}</div>
      {data.address && <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: 1 }}>{data.address}</div>}
    </div>
  )
}

function ManagerOptionLabel({ data }) {
  if (data.__isNew__) return <div style={{ fontSize: '13px' }}>Use: <strong>{data.label}</strong></div>
  const sub = data.email || ''
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3 }}>{data.name}</div>
      {sub && <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

// ── API fetch functions ────────────────────────────────────────
// Each returns an array of { value, label, data } objects for react-select.

async function fetchClients(q) {
  const res = await fetch(`${API_URL}/api/clients/search?q=${encodeURIComponent(q)}&limit=20`)
  const data = await res.json()
  return data.map(c => ({ value: c.id, label: c.address + (c.unit ? `, ${c.unit}` : ''), data: c }))
}

async function fetchCompanies(q) {
  const res = await fetch(`${API_URL}/api/companies/search?q=${encodeURIComponent(q)}&limit=20`)
  const data = await res.json()
  return data.map(c => ({ value: c.id, label: c.name, data: c }))
}

async function fetchManagers(q, companyId) {
  let url = `${API_URL}/api/managers/search?q=${encodeURIComponent(q)}&limit=20`
  if (companyId) url += `&company_id=${companyId}`
  const res = await fetch(url)
  const data = await res.json()
  return data.map(m => ({ value: m.id, label: m.name, data: m }))
}

const createLabel = (val) => `Use: "${val}"`
const noResults = () => "No matches — type to enter manually"

export function ClientSelect({ value, onChange, placeholder }) {
  const loadOptions = useCallback(debounce(fetchClients, 250), [])
  return (
    <AsyncCreatableSelect
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isClearable
      styles={brandStyles}
      noOptionsMessage={noResults}
      formatCreateLabel={createLabel}
      formatOptionLabel={(opt) => <ClientOptionLabel data={opt.data || opt} />}
      allowCreateWhileLoading
    />
  )
}

export function CompanySelect({ value, onChange, placeholder, creatable = true }) {
  const loadOptions = useCallback(debounce(fetchCompanies, 250), [])
  const Component = creatable ? AsyncCreatableSelect : AsyncSelect
  const creatableProps = creatable
    ? { noOptionsMessage: noResults, formatCreateLabel: createLabel, allowCreateWhileLoading: true }
    : { noOptionsMessage: () => "No matches" }
  return (
    <Component
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isClearable
      styles={brandStyles}
      formatOptionLabel={(opt) => <CompanyOptionLabel data={opt.data || opt} />}
      {...creatableProps}
    />
  )
}

export function ManagerSelect({ value, onChange, placeholder, companyId, creatable = true }) {
  // Ref avoids stale closure in the debounced loadOptions callback.
  const companyIdRef = useRef(companyId)
  companyIdRef.current = companyId
  const loadOptions = useCallback(debounce((q) => fetchManagers(q, companyIdRef.current), 250), [])
  const Component = creatable ? AsyncCreatableSelect : AsyncSelect
  const creatableProps = creatable
    ? { noOptionsMessage: noResults, formatCreateLabel: createLabel, allowCreateWhileLoading: true }
    : { noOptionsMessage: () => "No matches" }
  return (
    <Component
      key={companyId || 'all'}
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isClearable
      styles={brandStyles}
      formatOptionLabel={(opt) => <ManagerOptionLabel data={opt.data || opt} />}
      {...creatableProps}
    />
  )
}
