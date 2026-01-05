
// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const API_URL = "https://workflows.platform.happyrobot.ai/hooks/staging/wfxnxbgynphv";
const API_KEY = "019b4ad3-89aa-73db-9593-2801abbacd71";
const PORT = 8080;

if (!API_URL || !API_KEY) {
  console.error('ERROR: Missing API_URL or API_KEY in environment.');
  process.exit(1);
}

// Basic validation (relaxed on purpose; backend is source of truth)
const isNonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const isE164ish = (s) => typeof s === 'string' && /^\+?[0-9]{7,15}$/.test(s.trim());

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Startup diagnostics (masked key)
console.log('API_URL:', `"${API_URL}"`);
console.log('API_KEY:', API_KEY ? API_KEY.slice(0, 6) + '…' : 'MISSING');
console.log('PORT:', PORT);

app.get('/health', (req, res) => res.json({ ok: true, status: 'UP' }));

app.post('/trigger', async (req, res) => {
  const { contactNumber, carrierContact, freightOrder } = req.body;

  // Minimal field checks
  const errors = [];
  if (!isNonEmpty(carrierContact)) errors.push('carrier contact name is required');
  if (!isNonEmpty(freightOrder)) errors.push('freightOrder (FRO) is required');
  if (!isE164ish(contactNumber)) errors.push('contactNumber must look like +4512345678');
  if (errors.length) {
    return res.status(400).type('text/html').send(htmlValidationError(errors));
  }

  // Payload (as per your working flow)
  const payload = {
    country: "US",
    trafficDirection: "Import",
    mode: "Road",
    carrier: String(carrierContact),
    freightOrder: String(freightOrder),
    contactNumber: String(contactNumber) // '+' preserved
  };

  // Log for verification
  console.log('\n=== Outgoing request ===');
  console.log('POST', API_URL);
  console.log('Headers: { content-type: application/json, x-api-key: **** }');
  console.log('Payload:', JSON.stringify(payload));

  try {
    const headers = {
      'content-type': 'application/json',
      'x-api-key': API_KEY
    };

    // Don’t swallow non-2xx; we want to see status and body as-is
    const apiResp = await axios.post(API_URL, payload, {
      headers,
      validateStatus: () => true
    });

    console.log('=== Response ===');
    console.log('Status:', apiResp.status);
    console.log('Body:', apiResp.data);

    // Normalize to object (in case gateway returns a JSON string)
    const data = typeof apiResp.data === 'object' ? apiResp.data : JSON.parse(apiResp.data);

    let queuedRunId = null;
    let followUpUrl = null;

    if (apiResp.status === 200 && Array.isArray(data.queued_run_ids) && data.queued_run_ids.length > 0) {
      queuedRunId = String(data.queued_run_ids[0]);

      // Build follow-up URL exactly as provided
      followUpUrl = `https://v2.platform.happyrobot.ai/maersk-5y5b/workflow/wfxnxbgynphv/runs?run_id=${queuedRunId}`;
    }

    // Success: return HTML with readable typography and link named "running_call"
    if (apiResp.status === 200 && followUpUrl) {
      return res.status(200).type('text/html').send(htmlSuccess(followUpUrl, data, apiResp.status, String(carrierContact)));
    }

    // Fallback HTML for success without run id or non-200
    return res.status(apiResp.status).type('text/html').send(htmlFallback(apiResp.status, data));
  } catch (err) {
    console.error('Axios error:', err.message);
    const status = err.response?.status || 500;
    const body = err.response?.data || { error: err.message };
    return res.status(status).type('text/html').send(htmlInternalError(status, body));
  }
});

// ---- HTML helper templates ----
function htmlValidationError(errors) {
  return `
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Validation Error</title></head>
      <body style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Noto Sans', Arial; margin: 24px; color:#0f172a;">
        <h2 style="margin:0 0 12px 0;">Request validation failed</h2>
        <ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
      </body>
    </html>
  `;
}

function htmlSuccess(followUpUrl, data, statusCode, carrierContact) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Call Triggered</title>
        <style>
          :root {
            --text: #0f172a;      /* slate-900 */
            --muted: #334155;     /* slate-700 */
            --link: #1d4ed8;      /* blue-700 */
            --link-hover: #1e40af;/* blue-800 */
            --border: #e2e8f0;    /* slate-200 */
            --card-bg: #ffffff;
            --pre-bg: #f8fafc;    /* slate-50 */
          }
          body {
            font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Noto Sans", Arial;
            color: var(--text);
            margin: 0;
            background: transparent;
          }
          .card {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            background: var(--card-bg);
          }
          h2 {
            margin: 0 0 12px 0;
            font-weight: 700;
            letter-spacing: 0.2px;
            color: var(--text);
          }
          p { margin: 6px 0 12px 0; color: var(--text); }
          a {
            color: var(--link);
            text-decoration: none;
            font-weight: 600;
          }
          a:hover { color: var(--link-hover); text-decoration: underline; }
          .muted { color: var(--muted); }
          details { margin-top: 12px; }
          summary { cursor: pointer; color: var(--muted); }
          pre {
            background: var(--pre-bg);
            color: var(--text);
            padding: 12px;
            border-radius: 8px;
            border: 1px solid var(--border);
            overflow: auto;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 0.95rem;
            line-height: 1.45;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>A call has been placed to ${escapeAttr(carrierContact)}.</h2>
          <p>Click the link for the live call transcript:
            <a href="${escapeAttr(followUpUrl)}" target="_blank" rel="noopener noreferrer">running-call</a>
          </p>
          <details>
            <summary>Raw response</summary>
            <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
          </details>
        </div>
      </body>
    </html>
  `;
}

function htmlFallback(statusCode, data) {
  return `
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Call Request</title></head>
      <body style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Noto Sans', Arial; margin:0; color:#0f172a;">
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; background:#fff;">
          <h2 style="margin:0 0 12px 0; font-weight:700;">${statusCode === 200 ? 'Call request processed' : 'Call request failed'}</h2>
          ${statusCode === 200 ? '<p>No queued run ID was returned.</p>' : `<p>Status: ${statusCode}</p>`}
          <pre style="background:#f8fafc; color:#0f172a; padding:12px; border-radius:8px; border:1px solid #e2e8f0; overflow:auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:0.95rem; line-height:1.45;">
${escapeHtml(JSON.stringify(data, null, 2))}
          </pre>
        </div>
      </body>
    </html>
  `;
}

function htmlInternalError(statusCode, body) {
  return `
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Internal Error</title></head>
      <body style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Noto Sans', Arial; margin:0; color:#0f172a;">
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; background:#fff;">
          <h2 style="margin:0 0 12px 0; font-weight:700;">Internal error while placing call</h2>
          <p>Status: ${statusCode}</p>
          <pre style="background:#f8fafc; color:#0f172a; padding:12px; border-radius:8px; border:1px solid #e2e8f0; overflow:auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:0.95rem; line-height:1.45;">
${escapeHtml(JSON.stringify(body, null, 2))}
          </pre>
        </div>
      </body>
    </html>
  `;
}

// Helpers to avoid HTML injection
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  // Minimal attribute escaper for href values
  return String(str)
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

app.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});