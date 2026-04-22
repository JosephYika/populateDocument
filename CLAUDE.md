# populateTemplate

Construction estimate document generator for **KG Construction Corp**.

## Overview

- **React + Vite frontend** with a live preview panel. The left side is a form for data entry (`EstimateForm.jsx`), and the right side renders a real-time preview (`EstimatePreview.jsx`) as the user types.
- **Flask (Python) backend** using `docxtpl` for template rendering. The `/api/generate` endpoint takes form data, populates a Word template (`templates/estimate.docx`), handles multiline field line breaks in the XML, and returns the finished `.docx` as a download.
- **Dynamic scope-of-work sections** with line items. Users can add/remove numbered sections, each with its own price and multiple line-item descriptions. Section prices auto-sum into the quote and total fields.
- **Template-driven and config-extensible.** `templates/config.json` defines available templates and their field schemas, so new document types can be added without changing application code.

## Stack

- **Frontend:** React, Vite (port 5173)
- **Backend:** Python, Flask, flask-cors, docxtpl, lxml (port 5000)
- **Fonts:** DM Sans (UI), DM Mono (numbers) — loaded via Google Fonts

## Running

- Frontend: `cd frontend && npm run dev`
- Backend: `cd backend && python server.py`

## Design System

### Brand Colors
- **Primary Orange:** `#C05008` (`--orange`)
- **Dark Orange:** `#9A3F06` (`--orange-dark`)
- **Light Orange:** `#FDF0E6` (`--orange-light`)
- **Mid Orange:** `#F9CFA8` (`--orange-mid`)
- **Charcoal:** `#4A4A4A`
- **Text:** `#2A2A2A` (`--text`)
- **Muted Text:** `#6B6B6B` (`--text-muted`)
- **Faint Text:** `#9A9A9A` (`--text-faint`)

### Layout
- Sticky header bar with company logo, name, and running total
- Two-column layout: scrollable form (left), sticky live preview (right)
- Form organized into 3 card sections: Project Details, Scope of Work, Summary & Terms
- Preview styled as a document with orange header banner, meta grid, and footer

### Key UI Decisions
- Section-level pricing only (no per-line-item amounts) — price input in section header
- Payment Terms is a dropdown with 4 predefined options (not free text)
- Additional Notes has a default disclaimer about unforeseen conditions
- `fmt()` helper returns number only (no `$`); dollar sign added in JSX where needed
- Focus states use orange border + light orange box-shadow glow
- Price input uses `DM Mono` font, formatted as currency on blur

## Current State (2026-04-22)

### What's Done
- Full UI redesign implemented from Claude Design handoff (Estimate Generator.html)
- Sticky header, card-based form layout, live document preview
- DM Sans + DM Mono typography
- Brand color updated to `#C05008` across all elements
- Payment Terms converted to dropdown with 4 predefined options
- Default Additional Notes disclaimer text added
- Line item amounts removed — pricing is per-section only
- Scope of Work price input styled as white pill with `$` prefix in brand orange
- Placeholders updated: Estimate Number → "1050", Project Name → "System Winterization & Shut Off"
- Backend (Flask) and frontend (Vite) both functional and tested

### What's Not Yet Done
- Redesign changes are saved to files but not yet committed to git
- Preview multiline fields (prepared_for, project_location, managed_by) don't render line breaks in the new preview component
- No responsive/mobile layout adjustments
- No form validation beyond HTML `required` attributes
- No localStorage persistence for form data
