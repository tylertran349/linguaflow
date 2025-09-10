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

// --- NEW: SENTENCE SUB-SCHEMA DEFINITION ---
// This defines the structure of each sentence we save for review.
const sentenceReviewSchema = new mongoose.Schema({
  // The original sentence data from Gemini
  targetSentence: { type: String, required: true },
  nativeSentence: { type: String, required: true },
  colorMapping: [{
    target: String,
    native: String,
    color: String,
  }],
  // Spaced Repetition System (SRS) data
  lastReviewed: { type: Date, default: Date.now },
  nextReviewDate: { type: Date, default: Date.now },
  interval: { type: Number, default: 15 }, // Interval in minutes
});


// --- MODIFIED: USER SCHEMA ---
// We now use the sentenceReviewSchema for the viewedSentences array.
const userSchema = new mongoose.Schema({
  clerkUserId: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  firstName: String,
  lastName: String,
  createdAt: { type: Date, default: Date.now },
  viewedSentences: [sentenceReviewSchema], // Use the new sub-schema here
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

// --- 1. NEW API ENDPOINT: Save a Sentence for Review ---
app.post('/api/sentences/save', ClerkExpressWithAuth(), async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const sentenceData = req.body.sentence;

        // Find the user
        const user = await User.findOne({ clerkUserId });
        if (!user) return res.status(404).json({ error: "User not found." });
        
        // Check if this exact sentence already exists in the user's review list
        const sentenceExists = user.viewedSentences.some(
            s => s.targetSentence === sentenceData.targetSentence
        );

        if (!sentenceExists) {
            // If it doesn't exist, add it to the array
            user.viewedSentences.push(sentenceData);
            await user.save();
            res.status(201).json({ message: "Sentence saved for review." });
        } else {
            // If it already exists, do nothing
            res.status(200).json({ message: "Sentence already exists in review queue." });
        }
    } catch (error) {
        console.error('Error saving sentence:', error);
        res.status(500).json({ error: "Failed to save sentence." });
    }
});


// --- 2. NEW API ENDPOINT: Get Sentences Due for Review ---
app.get('/api/sentences/review', ClerkExpressWithAuth(), async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await User.findOne({ clerkUserId });
        if (!user) return res.status(404).json({ error: "User not found." });

        const now = new Date();

        // Filter the sentences to find ones that are due today or were due in the past
        const dueSentences = user.viewedSentences.filter(sentence => {
            const nextReview = new Date(sentence.nextReviewDate);
            return nextReview <= now;
        });

        res.status(200).json(dueSentences);
    } catch (error) {
        console.error('Error fetching review sentences:', error);
        res.status(500).json({ error: "Failed to fetch review sentences." });
    }
});

app.put('/api/sentences/update-review', ClerkExpressWithAuth(), async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const { sentenceId, decision } = req.body; // decision will be 'correct' or 'incorrect'

        const user = await User.findOne({ clerkUserId });
        if (!user) return res.status(404).json({ error: "User not found." });

        // Mongoose's .id() method is a special helper to find a sub-document by its _id
        const sentence = user.viewedSentences.id(sentenceId);
        if (!sentence) return res.status(404).json({ error: "Sentence not found in user's reviews." });
        
        // --- The Core SRS Logic ---
        if (decision === 'correct') {
            // If correct, double the interval for the next review
            sentence.interval *= 2; 
        } else {
            // If incorrect, reset the interval back to 15 minutes
            sentence.interval = 15;
        }

        // Set the last reviewed date to now
        sentence.lastReviewed = new Date();
        
        // Calculate the next review date by adding the interval (in minutes) to today
        const newReviewDate = new Date();
        newReviewDate.setMinutes(newReviewDate.getMinutes() + sentence.interval);
        sentence.nextReviewDate = newReviewDate;

        await user.save(); // Save the entire user document with the updated sentence
        res.status(200).json({ message: "Review updated successfully." });

    } catch (error) {
        console.error('Error updating review sentence:', error);
        res.status(500).json({ error: "Failed to update review sentence." });
    }
});

// --- EXISTING TTS PROXY ROUTE --- (No changes below this line)
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