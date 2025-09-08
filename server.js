// server.js
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import mongoose from 'mongoose';
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import { Webhook } from 'svix';
import bodyParser from 'body-parser';

// --- EXPRESS AND PORT SETUP ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- DEFINE USER SCHEMA AND MODEL ---
const userSchema = new mongoose.Schema({
  clerkUserId: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  firstName: String,
  lastName: String,
  createdAt: { type: Date, default: Date.now },
  // This is where your spaced repetition data will go!
  viewedSentences: [{
    sentenceId: String,
    lastReviewed: Date,
    interval: Number,
    easeFactor: Number,
  }],
});

const User = mongoose.model('User', userSchema);

// --- MIDDLEWARE ---
app.use(cors());

// Webhook handler needs the raw body, so it must come before express.json()
app.post('/api/webhooks', bodyParser.raw({ type: 'application/json' }), async function (req, res) {
  try {
    const payloadString = req.body.toString('utf8');
    const svixHeaders = req.headers;

    const wh = new Webhook(process.env.WEBHOOK_SECRET);
    const evt = wh.verify(payloadString, svixHeaders);
    const { id, ...attributes } = evt.data;
    const eventType = evt.type;

    console.log(`Received webhook event: ${eventType}`);

    switch (eventType) {
      case 'user.created': {
        const newUser = new User({
          clerkUserId: id,
          email: attributes.email_addresses[0]?.email_address,
          firstName: attributes.first_name,
          lastName: attributes.last_name,
        });
        await newUser.save();
        console.log(`User ${id} was created in MongoDB.`);
        break;
      }
      case 'user.updated': {
        await User.findOneAndUpdate({ clerkUserId: id }, {
          firstName: attributes.first_name,
          lastName: attributes.last_name,
        });
        console.log(`User ${id} was updated in MongoDB.`);
        break;
      }
      case 'user.deleted': {
        await User.findOneAndDelete({ clerkUserId: id });
        console.log(`User ${id} was deleted from MongoDB.`);
        break;
      }
    }

    res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Use express.json() for all other routes
app.use(express.json());


// --- PROTECTED API ROUTE EXAMPLE ---
// We use ClerkExpressWithAuth() to protect this route
// It ensures only signed-in users can access it
app.get('/api/user-progress', ClerkExpressWithAuth(), async (req, res) => {
  try {
    const user = await User.findOne({ clerkUserId: req.auth.userId });
    if (!user) {
        return res.status(404).json({ error: "User not found." });
    }
    // For now, we just send back the user data.
    // Later, you can add logic to calculate progress.
    res.status(200).json(user.viewedSentences);
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).send('Failed to fetch user progress');
  }
});


// --- EXISTING TTS PROXY ROUTE ---
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
  console.log(`Server is running on http://localhost:${PORT}`);
});