const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'tmp/' });
const app = express();
app.use(cors());

app.get('/', (req, res) => res.send('proxy ok'));

app.post('/api/files:upload', upload.single('file'), async (req, res) => {
  const apiKey = process.env.GENERATIVE_API_KEY || req.headers['x-api-key'];
  if (!apiKey) return res.status(500).json({ error: 'Missing GENERATIVE_API_KEY' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = path.resolve(req.file.path);
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), { filename: req.file.originalname });

    const r = await fetch('https://generativeai.googleapis.com/v1/files:upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
      body: form,
    });

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

app.use(express.json());
app.post('/api/generate', async (req, res) => {
  const apiKey = process.env.GENERATIVE_API_KEY || req.headers['x-api-key'];
  if (!apiKey) return res.status(500).json({ error: 'Missing GENERATIVE_API_KEY' });
  try {
    const r = await fetch('https://generativeai.googleapis.com/v1/models/gemini-3.5-flash:generateContent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const json = await r.text();
    res.status(r.status).send(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`dev proxy listening on ${port}`));
