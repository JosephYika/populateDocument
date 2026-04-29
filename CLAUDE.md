# populateTemplate

Construction estimate document generator for **KG Construction Corp**.

## Overview

- **React + Vite frontend** with a live preview panel. The left side is a form for data entry (`EstimateForm.jsx`), and the right side renders a real-time preview (`EstimatePreview.jsx`) as the user types.
- **Flask (Python) backend** using `docxtpl` for template rendering. The `/api/generate` endpoint takes form data, populates a Word template (`templates/estimate.docx`), handles multiline field line breaks in the XML, and returns the finished `.docx` as a download.
- **Dynamic scope-of-work sections** with line items. Users can add/remove numbered sections, each with its own price and multiple line-item descriptions. Section prices auto-sum into the quote and total fields.
- **Template-driven and config-extensible.** `templates/config.json` defines available templates and their field schemas, so new document types can be added without changing application code.

## Stack

| Layer | Tech | Details |
|-------|------|---------|
| Frontend | React 19, Vite 8 | Port 5173, ES modules, `@vitejs/plugin-react` |
| Backend | Python, Flask, flask-cors | Port 5000, single `server.py` entry point |
| Doc generation | docxtpl, lxml | Jinja2 inside Word XML, post-process `<w:br/>` for newlines |
| Fonts | DM Sans (UI), DM Mono (numbers) | Loaded via Google Fonts in `index.html` |
| Linting | ESLint 9, eslint-plugin-react-hooks, eslint-plugin-react-refresh | Config in `eslint.config.js` |

## Running

- Frontend: `cd frontend && npm run dev`
- Backend: `cd backend && python server.py`

## Project Structure

```
populateTemplate/
  CLAUDE.md
  Client_Directory.xlsx       # Source Excel spreadsheet for client data import
  Estimate Template.docx      # Reference copy of the estimate template
  Project Notes/
    Commands.txt              # Git cheat-sheet for the developer
  templates/
    config.json               # Template registry — field schemas, section/line definitions
    estimate.docx             # The actual Word template with Jinja2 tokens
  backend/
    server.py                 # Flask app — all API endpoints (templates, generate, CRUD, search)
    models.py                 # SQLAlchemy models — ManagementCompany, PropertyManager, Client
    kg_construction.db        # SQLite database
    fix_template.py           # One-time utility — fixes split Jinja2 tokens in .docx XML
    test_generate.py          # Standalone test script — renders estimate.docx with sample data
    alembic.ini               # Alembic migration config
    alembic/                  # Database migrations
  scripts/
    import_from_excel.py      # Idempotent Excel import from Client_Directory.xlsx
  frontend/
    index.html                # Shell HTML — loads Google Fonts (DM Sans, DM Mono)
    package.json              # React 19, Vite 8, ESLint
    vite.config.js
    src/
      main.jsx                # React entry — StrictMode, hash-based router (App / AdminPage)
      App.jsx                 # Root component — state, layout, header with running total
      App.css                 # Global styles — variables, header, layout grid, form, admin, buttons
      config.js               # Shared constants (API_URL)
      utils/
        uid.js                # Auto-incrementing ID generator for React keys
      components/
        EstimateForm.jsx      # Form component — all fields, scope sections, submit handler
        EstimatePreview.jsx   # Preview component — document-style live render
        EstimatePreview.css   # Preview styles — header banner, meta grid, scope, footer
        SearchableSelect.jsx  # Searchable select components — ClientSelect, CompanySelect, ManagerSelect
        AdminPage.jsx         # Admin CRUD UI — clients, companies, managers tabs
      assets/
        hero.png              # KG Construction hero image
```

## Backend Details

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/templates` | GET | Returns template list from `config.json` |
| `/api/generate` | POST | Accepts `{ template, data }`, renders the Word doc, returns `.docx` download |
| `/api/clients/search` | GET | Search clients by address, unit, building, owner. Params: `q`, `limit` |
| `/api/companies/search` | GET | Search companies by name. Params: `q`, `limit` |
| `/api/managers/search` | GET | Search managers by name/email. Params: `q`, `limit`, `company_id` |
| `/api/{clients,companies,managers}` | GET/POST | List all (active) or create new |
| `/api/{clients,companies,managers}/<id>` | GET/PUT/DELETE | Read, update, or soft-delete (archive) |

### Payload Structure (POST /api/generate)

```json
{
  "template": "estimate",
  "data": {
    "estimate_number": "1050",
    "estimate_date": "04/24/2026",
    "prepared_for": "Client Name\n123 Main St",
    "managed_by": "Company Name\n123 Company Address",
    "contact_name": "Contact",
    "contact_email": "contact@email.com",
    "project_location": "Site Address",
    "project_name": "Project Title",
    "quote": "5,000.00",
    "total": "5,000.00",
    "additional_notes": "Notes text...",
    "payment_terms": "Full payment (100%) is due upon completion...",
    "sections": [
      {
        "num": "1",
        "title": "Section Title",
        "price": "5,000.00",
        "lines": [
          { "lineNum": "1.1", "text": "Line item description" }
        ]
      }
    ]
  }
}
```

### Multiline Field Handling

Multiline fields (`prepared_for`, `managed_by`, `project_location`, `additional_notes`) go through a two-step process:
1. **`prep_newlines()`** — replaces `\n` with `||BR||` marker before Jinja2 rendering
2. **`apply_line_breaks_simple()`** — post-processes the rendered XML, replacing `||BR||` with proper `<w:br/>` elements while preserving run formatting (`rPr`)

### Template Fixer (`fix_template.py`)

One-time utility that repairs Word templates where Jinja2 tokens get split across multiple XML runs (common when editing in Word). It:
- Detects split `{{ }}` and `{% %}` tokens across runs
- Rebuilds paragraph runs to keep tokens intact
- Fixes common Word-editing artifacts (`#sections`, `% }` spacing, single-brace tokens)
- Applies formatting: orange bold for `{{line.lineNum}}`, gray for `{{line.text}}`
- Makes `{{project_location}}` bold
- Cleans up empty paragraphs near loop constructs
- Converts `{% for %}` to `{%p for %}` (paragraph-level loops for cleaner output)

**Workflow:** Edit `Estimate Template.docx` in Word, then run `python backend/fix_template.py` to repair tokens and output to `templates/estimate.docx`.

### Template Config (`templates/config.json`)

Defines available templates and their field schemas. Each template entry has:
- `id` / `name` / `file` — identifier, display name, and `.docx` filename
- `fields[]` — flat field definitions with `key`, `label`, `type` (text/date/textarea/email/currency), `required`
- `sections` — nested structure defining scope-of-work sections with `lines` sub-items

## Frontend Details

### Architecture

- **`App.jsx`** — Root component. Owns all state (`form`, `sections`, `loading`). Computes `total` from section prices. Renders sticky header with running total, two-column grid layout, and passes props down.
- **`EstimateForm.jsx`** — Controlled form. Three card sections: Project Details, Scope of Work, Summary & Terms. Handles all field updates, section/line CRUD, price formatting on blur, and the generate submit handler.
- **`EstimatePreview.jsx`** — Stateless preview. Renders a document-styled preview with orange header banner, 2-column meta grid, scope sections with numbered line items, total bar, notes, payment terms, and footer.

### State Management

All state lives in `App.jsx` via `useState`:
- `form` — object with all flat fields (estimateNumber, date, projectName, preparedFor, etc.)
- `sections` — array of `{ id, title, price, lines: [{ id, description }] }`
- `loading` — boolean for submit button state

Each section and line gets a unique `id` via the `uid()` counter (`utils/uid.js`).

### Key Helpers

- **`fmt(n)`** — Formats number with 2 decimal places, comma separators. Returns number string only (no `$`); dollar sign added in JSX.
- **`uid()`** — Auto-incrementing ID generator for React keys on dynamic sections/lines. Lives in `utils/uid.js`.
- **`formatCurrency(value)`** — In EstimateForm, formats price inputs on blur (strips commas, re-formats).
- **`today()`** — Returns current date as `MM/DD/YYYY` string for the default date field.

### Form Behavior

- **Section pricing only** — no per-line-item amounts. Price input in section header.
- **Auto-sum** — section prices reduce into `total`, displayed in header and Summary card.
- **Price formatting** — raw input during typing, formatted to `1,234.00` on blur via `handlePriceBlur`.
- **Payment Terms** — dropdown with 4 predefined options (100% on completion, 50/50, 60/30/10 milestones, 60/40 split). Not free text.
- **Additional Notes** — pre-filled with default disclaimer about unforeseen conditions.
- **Generate** — POSTs to `/api/generate`, receives blob, triggers browser download as `estimate_{number}.docx`.

### Inline SVG Icons

Three icon components defined inline in `EstimateForm.jsx`:
- `TrashIcon` — delete sections/lines (red hover)
- `PlusIcon` — add sections/lines
- `DocIcon` — generate button icon

The header building icon is inline SVG in `App.jsx`.

## Design System

### Brand Colors

| Token | Hex | CSS Variable |
|-------|-----|-------------|
| Primary Orange | `#C05008` | `--orange` |
| Dark Orange | `#9A3F06` | `--orange-dark` |
| Light Orange | `#FDF0E6` | `--orange-light` |
| Mid Orange | `#F9CFA8` | `--orange-mid` |
| Charcoal | `#4A4A4A` | (used directly) |
| Text | `#2A2A2A` | `--text` |
| Muted Text | `#6B6B6B` | `--text-muted` |
| Faint Text | `#9A9A9A` | `--text-faint` |
| Background | oklch(97% 0.008 55) | `--bg` |
| Surface | `#FFFFFF` | `--surface` |
| Border | oklch(91% 0.006 55) | `--border` |

### Typography

- **Body/UI:** DM Sans — weights 300-600, used everywhere
- **Numbers/Prices:** DM Mono — weights 400-500, used for price inputs, totals, line numbers, estimate number in preview
- **Base size:** 14px for form inputs, scaled down for labels (12px), meta text (11px), preview (9-12px)

### Layout

- **Sticky header** (56px) — white with bottom border, company logo (orange square with building SVG), name, subtitle, running total
- **Two-column grid** — `1fr 400px`, 24px gap, 28px padding, max-width 1400px centered
- **Left panel** — scrollable form column
- **Right panel** — sticky preview (`top: 80px`, max-height `calc(100vh - 108px)`, overflow-y auto)

### Card System

- White background, 12px border-radius, 1px border, subtle shadow
- Card header: 13px padding, uppercase 11px title in faint text, bottom border
- Card body: 20px padding (compact: 16px for Scope of Work)

### Form Controls

- Inputs: 14px, 9px 12px padding, 1.5px border, 5px radius
- Focus: orange border + `0 0 0 3px var(--orange-light)` glow
- Select: custom dropdown chevron via SVG background-image
- Half-width fields: `flex: 0 0 calc(50% - 6px)` side-by-side

### Scope of Work Sections

- Each section: bordered card with header (light bg) and line items area
- Section header: numbered orange badge (26px), title input (bold, no border), price pill (white bg, `$` in orange, value in DM Mono)
- Line items: numbered (`1.1`, `1.2`) in DM Mono, description input, trash button
- Add line: orange text link. Add section: full-width dashed border button (orange on hover)

### Preview Document

- Header banner: orange background, company name + license #, estimate number (DM Mono)
- Meta grid: 2-column, 1px gap borders, label/value pairs
- Scope sections: light orange header bar with numbered badge, white line items below
- Total bar: orange background, white text, DM Mono value
- Notes: gray background card. Payment terms: light orange background card
- Footer: centered, faint text, "valid for 30 days" + license info

### Buttons

- Generate: full-width, orange bg, white text, 9px radius, orange shadow, hover lifts (-1px) and darkens
- Header generate: compact pill version (unused in current layout but styled)
- Icon buttons: transparent, faint color, red on hover (delete actions)

### Scrollbar

Custom webkit scrollbar: 6px wide, transparent track, border-colored thumb with 3px radius.

## Current State (2026-04-29)

### What's Done
- Full UI redesign — sticky header, card-based form, live document preview
- DM Sans + DM Mono typography, brand color `#C05008` throughout
- Payment Terms dropdown (4 options), default Additional Notes disclaimer
- Section-level pricing with auto-sum into quote/total
- Backend multiline handling with `||BR||` marker and XML post-processing
- Template fixer utility for repairing split Jinja2 tokens
- SQLite database with SQLAlchemy ORM + Alembic migrations
- Searchable select dropdowns (react-select) for client, company, manager
- Cascading auto-fill: selecting a client populates address, company, manager, email
- Managed By field populates with company name + address (multiline)
- Admin UI at `#/admin` for CRUD management of all entities (soft-delete/archive)
- Excel import script for initial data load from Client_Directory.xlsx
- Shared `API_URL` constant in `config.js`, `uid()` extracted to `utils/uid.js`
- Codebase cleanup: removed dead code, deduplicated SearchableSelect exports (creatable prop), deleted unused scaffold files
- Updated estimate template: T&C review notice, check payment address, fixed section numbering, consolidated terms
- Codebase documentation: consistent comments across all source files — module/file-level docstrings, function purpose and parameter docs, key logic decisions explained (multiline pipeline, cascading auto-fill, template fix strategy, upsert matching keys)

### What's Not Yet Done
- Preview multiline fields (prepared_for, project_location) don't render line breaks in the preview component
- No responsive/mobile layout adjustments
- No form validation beyond HTML `required` attributes
- No localStorage persistence for form data
- No branded favicon