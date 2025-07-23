// server.js
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001; // We'll run our proxy on this port

app.get('/api/tts', async (req, res) => {
  try {
    const { text, lang } = req.query;
    if (!text || !lang) {
      return res.status(400).send('Missing "text" or "lang" query parameter');
    }
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) {
      throw new Error(`Google TTS API responded with ${response.status}`);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (error) {
    console.error('TTS Proxy Error:', error);
    res.status(500).send('Failed to fetch TTS audio');
  }
});

app.listen(PORT, () => {
  console.log(`TTS Proxy server is running on http://localhost:${PORT}`);
});