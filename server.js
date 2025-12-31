// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_URL || !API_KEY) {
  console.error('ERROR: Missing API_URL or API_KEY in environment.');
  process.exit(1);
}

// Basic validation (relaxed on purpose; backend will be the source of truth)
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
  const { contactNumber, carrier, freightOrder } = req.body;

  // Minimal field checks
  const errors = [];
  if (!isNonEmpty(carrier)) errors.push('carrier is required');
  if (!isNonEmpty(freightOrder)) errors.push('freightOrder (FRO) is required');
  if (!isE164ish(contactNumber)) errors.push('contactNumber must look like +4512345678');
  if (errors.length) return res.status(400).json({ ok: false, errors });

  // Build payload to MATCH your working curl:
  const payload = {
    country: 'DE',
    trafficDirection: '1',
    mode: '01',
    carrier: String(carrier),
    source: 'Goa',
    destination: 'Mumbai',
    frieghtOrder: String(freightOrder),  // <<-- FORCED typo key (matches your working curl)
    contactNumber: String(contactNumber)  // '+' preserved in JSON
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

    res.status(apiResp.status).json({
      ok: apiResp.status < 400,
      status: apiResp.status,
      data: apiResp.data
    });
  } catch (err) {
    console.error('Axios error:', err.message);
    if (err.response) {
      return res.status(err.response.status).json({
        ok: false,
        status: err.response.status,
        error: err.response.data
      });
    }
    res.status(500).json({ ok: false, status: 500, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
