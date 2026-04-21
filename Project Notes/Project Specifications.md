**Claude Code Opus 4.6** 


**PROMPT:**



I want to build a simple web app (or desktop app) that allows me to generate professional estimates and invoices from predefined templates.

Core Requirements:



I need at least two templates to start:

1 Estimate template

1 Invoice template

The system should allow me to input job-specific data (client name, address, scope, pricing, etc.) and automatically populate the template.

I want to avoid manually editing Word documents each time.

Output Requirements:



The generated document should be downloadable as:

&#x20;

.DOCX (Microsoft Word)

.PDF Template Handling:



I already have sample estimate and invoice documents created in Microsoft Word

The templates must retain the exact formatting, layout, spacing, and design as my original Word documents

I am open to adding placeholders (e.g., {{client\_name}}) only if they do not alter the layout or formatting

Alternatively, suggest a method that allows dynamic data insertion without breaking the original design

Additional Considerations:



The system should be easy to expand with more templates in the future

Clean, professional formatting is critical

Ideally simple UI (form input → generate document)

What I Need From You:



Recommend the best architecture and tech stack

Suggest how to handle templates while preserving exact Word formatting

Provide a step-by-step implementation approach

(Optional) Sample code or starter structure





**RESPONSE:** 



Recommended Architecture

Use your actual .docx files as the templates, with {{placeholder}} tokens. This is the single most important decision, and here's why: your templates have complex formatting — merged table cells, mixed bold/italic runs, specific fonts, letterhead spacing — that is extremely painful to recreate in code. Any approach that tries to rebuild the document (generating fresh XML with a library like docx or python-docx) will fight you forever on visual fidelity. The right approach is to treat your Word files as the source of truth and just swap tokens inside them.

Tech stack:



Backend: Node.js + Express

Templating: docxtemplater — this is the industry-standard library for exactly this use case. It opens your .docx, replaces {{tokens}} without touching any surrounding XML, and supports loops ({#items}...{/items}) for line items of variable length. Formatting is preserved perfectly because the library only edits text nodes.

PDF conversion: LibreOffice in headless mode (soffice --convert-to pdf). It renders .docx → .pdf with near-perfect fidelity, far better than any JS-only PDF library.

Frontend: Plain HTML + a small amount of vanilla JS or React, depending on your comfort. For a form-in/document-out tool, plain HTML is honestly fine and faster to build.

Storage: Templates sit in a templates/ folder on disk. Adding a new template = drop a .docx in the folder and register it in a small JSON config.



How to Handle Your Templates Specifically

Looking at your two files, here's what needs to become dynamic:

Estimate — variable: estimate #, date, prepared-for address, managed-by block, project location, project name, quote total, and crucially the scope-of-work sections (you have 5 numbered sections, each with sub-items and a price — this needs a loop).

Invoice — variable: bill-to block, project ref, invoice date, due date, invoice #, and the line items table (which groups rows under section headers like "1. Site Protection" — also needs a loop, and specifically a nested one: sections → items).

The grouped-items pattern in the invoice is the trickiest part. docxtemplater handles it natively with nested loops, but you'll need to restructure the templates slightly — I'll show you exactly how below.

Step-by-Step Implementation

1\. Prep your templates (one-time, in Word)

Open each .docx in Word and replace the hard-coded values with tokens. Critical rule: type each token in one go, without pausing — Word will otherwise split it across multiple XML runs and docxtemplater won't find it. If a token isn't being replaced, open the file, select the token, re-type it cleanly.

For the estimate's scope sections, wrap them in loop tags:

{#sections}

| {num} | {title} | ${price} |

{#lines}{lineNum} {text}

{/lines}

{/sections}

For the invoice's grouped line items:

{#groups}

| {groupTitle} |

{#items}| {num} | {desc} | {qty} | {unitPrice} | {total} |

{/items}

{/groups}

2\. Project structure

invoice-app/

├── server.js

├── templates/

│   ├── estimate.docx

│   ├── invoice.docx

│   └── config.json        # lists templates + their fields

├── public/

│   └── index.html         # the form UI

└── package.json

3\. Install dependencies

bashnpm init -y

npm install express docxtemplater pizzip libreoffice-convert multer

4\. Core server code

javascript// server.js

const express = require('express');

const fs = require('fs');

const path = require('path');

const PizZip = require('pizzip');

const Docxtemplater = require('docxtemplater');

const libre = require('libreoffice-convert');

const { promisify } = require('util');



const convertAsync = promisify(libre.convert);

const app = express();

app.use(express.json({ limit: '2mb' }));

app.use(express.static('public'));



app.post('/generate', async (req, res) => {

&#x20; const { template, data, format } = req.body; // format: 'docx' | 'pdf'



&#x20; // 1. Load the template

&#x20; const templatePath = path.join(\_\_dirname, 'templates', `${template}.docx`);

&#x20; const content = fs.readFileSync(templatePath, 'binary');

&#x20; const zip = new PizZip(content);

&#x20; const doc = new Docxtemplater(zip, {

&#x20;   paragraphLoop: true,

&#x20;   linebreaks: true,

&#x20; });



&#x20; // 2. Fill in the data

&#x20; try {

&#x20;   doc.render(data);

&#x20; } catch (err) {

&#x20;   return res.status(400).json({ error: err.message });

&#x20; }



&#x20; const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });



&#x20; // 3. Return DOCX or convert to PDF

&#x20; if (format === 'pdf') {

&#x20;   const pdfBuffer = await convertAsync(docxBuffer, '.pdf', undefined);

&#x20;   res.set({

&#x20;     'Content-Type': 'application/pdf',

&#x20;     'Content-Disposition': `attachment; filename="${template}.pdf"`,

&#x20;   });

&#x20;   return res.send(pdfBuffer);

&#x20; }



&#x20; res.set({

&#x20;   'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

&#x20;   'Content-Disposition': `attachment; filename="${template}.docx"`,

&#x20; });

&#x20; res.send(docxBuffer);

});



app.listen(3000, () => console.log('Running on http://localhost:3000'));

5\. Example payload for an estimate

json{

&#x20; "template": "estimate",

&#x20; "format": "pdf",

&#x20; "data": {

&#x20;   "estimateNum": "1037",

&#x20;   "date": "04/20/2026",

&#x20;   "preparedFor": "94 Thompson Street #PHT, New York, NY 10012",

&#x20;   "projectName": "Exterior Plumbing Winterization",

&#x20;   "quote": "3,200.00",

&#x20;   "sections": \[

&#x20;     {

&#x20;       "num": "1",

&#x20;       "title": "Outdoor Bathroom Winterization",

&#x20;       "price": "550.00",

&#x20;       "lines": \[

&#x20;         { "lineNum": "1.1", "text": "Drain all domestic hot and cold-water lines..." },

&#x20;         { "lineNum": "1.2", "text": "Blowout water lines with compressed air..." }

&#x20;       ]

&#x20;     }

&#x20;   ]

&#x20; }

}

6\. The frontend form — a single HTML page with fields mirroring the payload structure, plus a "+ Add Section" / "+ Add Line Item" button for the repeating parts. Submit → fetch('/generate') → trigger browser download.

A Few Practical Notes



LibreOffice must be installed on whatever machine runs the server (apt install libreoffice on Linux, brew on macOS, installer on Windows). On a Mac or Windows laptop this is fine; if you deploy to a cloud host later, use a Docker image with LibreOffice baked in.

Token splitting across runs is the #1 thing that breaks docxtemplater. If a token doesn't replace, open the unpacked XML and you'll see the token split into pieces — just retype it in Word to fix.

Currency/date formatting should be done in your app code before passing to docxtemplater, not in the template. docxtemplater does support format filters via its parser option if you want them later.

Adding a template later = drop newtype.docx into templates/, add an entry to config.json describing its fields, and add a form view for it. No code changes to the generation logic.



Want me to build a working starter?

I can set up the full project — server, both templates converted with placeholders, a sample HTML form, and a test that generates a real DOCX and PDF from your actual templates — and hand it to you as a downloadable zip. That way you're starting from something proven against your files rather than a generic skeleton.





