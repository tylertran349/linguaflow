import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { ClerkExpressWithAuth, ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { Webhook } from 'svix';
import Sentence from './src/models/Sentence.js';
import UserSettings from './src/models/UserSettings.js';
import FlashcardSet from './src/models/FlashcardSet.js';
import { FSRS, Grade, s_0, d_0, retrievability, interval } from './src/services/fsrsService.js'; 
import UserFlashcardSetData from './src/models/UserFlashcardSetData.js';

// --- 1. INITIAL SETUP ---
const app = express();
const PORT = process.env.PORT || 3001;

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// --- 2. CLERK WEBHOOK HANDLER ---
// NOTE: This route must be placed BEFORE express.json() to ensure the raw body is available.
// Clerk requires the raw body to verify the webhook signature.
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log("Webhook received...");
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        return res.status(500).send('Webhook secret is not configured.');
    }

    // Get the headers
    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return res.status(400).send("Error occured -- no svix headers");
    }

    const payload = req.body;
    const body = JSON.stringify(payload);

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt;

    // Verify the payload with the headers
    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        });
    } catch (err) {
        console.error("Error verifying webhook:", err);
        return res.status(400).send("Error occured");
    }
    
    // Get the ID and type
    const { id } = evt.data;
    const eventType = evt.type;

    console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
    console.log('Webhook body:', body);

    // =================================================================================
    //  YOUR WEBHOOK LOGIC GOES HERE
    //  For example, you might create a new user in your database when a 'user.created' event is received.
    //
    //  if (eventType === 'user.created') {
    //      const { id, email_addresses } = evt.data;
    //      // Create new user in your MongoDB
    //  }
    // =================================================================================

    res.status(200).send('Webhook processed successfully');
});


// --- 3. STANDARD MIDDLEWARE ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data


// --- 4. MONGODB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas.'))
    .catch(err => console.error('Error connecting to MongoDB Atlas:', err));

// --- 6. API ROUTES ---
// All your API routes should be prefixed with '/api' to avoid conflicts with frontend routes.

// Example of a public API route
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from the public API!' });
});

// Example of a protected API route using Clerk middleware
// Any request to this route will be checked for a valid JWT.
// If valid, req.auth will be populated. If not, it will throw an error.
app.get('/api/protected-data', ClerkExpressRequireAuth(), (req, res) => {
    // req.auth contains the validated session and user information
    res.json({ 
        message: 'This is protected data.',
        userId: req.auth.userId,
        session: req.auth.sessionId
    });
});

// ============================================================
//  APPLICATION API ROUTES
// ============================================================

// --- GOOGLE TRANSLATE TTS PROXY ---
// This route is called by the ttsService.js on the frontend
app.get('/api/tts', async (req, res) => {
    try {
        const { text, lang, speed } = req.query;

        if (!text || !lang) {
            return res.status(400).send('Missing required query parameters: text and lang');
        }
        
        // Google's TTS endpoint has a "slow" parameter. We can map our speed to that.
        // If the speed is less than 1.0, we'll use the "slow" version.
        const isSlow = parseFloat(speed) < 1.0;
        
        const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&slow=${isSlow}`;

        // Fetch the audio from Google's server. We must include a User-Agent header
        // or the request will be blocked.
        const fetchResponse = await fetch(googleTtsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!fetchResponse.ok) {
            throw new Error(`Google TTS API responded with status: ${fetchResponse.status}`);
        }
        
        // Set the correct content type for the audio file
        res.setHeader('Content-Type', 'audio/mpeg');

        // Pipe the audio stream from Google's response directly to our client's response.
        // This is very efficient as it doesn't load the whole audio file into server memory.
        fetchResponse.body.pipe(res);

    } catch (error) {
        console.error("Error in TTS proxy:", error);
        res.status(500).send("Failed to fetch TTS audio.");
    }
});

// --- GET User Settings ---
app.get('/api/settings', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        // Use .select('+geminiApiKey') to explicitly request the encrypted field
        const userSettings = await UserSettings.findOne({ userId: userId }).select('+geminiApiKey');
        
        if (!userSettings) {
            return res.status(200).json({}); 
        }

        res.json(userSettings);
    } catch (error) {
        console.error("Error fetching user settings:", error);
        res.status(500).json({ message: "Failed to fetch user settings." });
    }
});

// --- CREATE/UPDATE User Settings ---
app.put('/api/settings', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { settings, topic, apiKey } = req.body;

        // 1. Find the existing settings first
        let userSettings = await UserSettings.findOne({ userId: userId });

        // 2. If no settings exist, create a new document in memory
        if (!userSettings) {
            userSettings = new UserSettings({ userId: userId });
        }

        // 3. Apply the changes from the request to the document
        userSettings.settings = settings;
        userSettings.topic = topic;
        
        // Only set the API key if a new one was provided
        if (apiKey) {
            userSettings.geminiApiKey = apiKey;
        }

        // 4. Save the document. This is when the encryption plugin will run
        //    on the final, correct data.
        const savedSettings = await userSettings.save();

        res.json(savedSettings);
    } catch (error) {
        console.error("Error saving user settings:", error);
        res.status(500).json({ message: "Failed to save user settings." });
    }
});


// --- FETCH SENTENCES DUE FOR REVIEW ---
app.get('/api/sentences/review', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        
        // Find all starred sentences for the user
        const allSentences = await Sentence.find({
            userId: userId,
            starred: true
        });

        // Filter sentences that are due for review using FSRS-6 algorithm
        const sentencesToReview = allSentences.filter(sentence => {
            // If no FSRS-6 state exists, consider it due (first review)
            if (!sentence.stability || !sentence.difficulty) {
                return true;
            }
            const nextReviewDate = new Date(sentence.nextReviewDate);
            return new Date() >= nextReviewDate;
        });

        // Handle backward compatibility: add targetLanguage if missing
        const processedSentences = sentencesToReview.map(sentence => {
            if (!sentence.targetLanguage) {
                // For existing sentences without targetLanguage, we'll need to infer it
                // or use a default. Since we can't reliably infer the language from the text,
                // we'll mark it as needing migration and let the frontend handle it
                sentence.targetLanguage = null; // This will trigger fallback in frontend
            }
            return sentence;
        });

        res.json(processedSentences);
    } catch (error) {
        console.error("Error fetching review sentences:", error);
        res.status(500).json({ message: 'Failed to fetch sentences for review.' });
    }
});

// --- FETCH ALL STARRED SENTENCES (for search) ---
app.get('/api/sentences/starred', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        
        // Find all starred sentences for the user (not filtered by due date)
        const allStarredSentences = await Sentence.find({
            userId: userId,
            starred: true
        }).sort({ reviewDueDate: -1 }); // Sort by most recently added first

        // Handle backward compatibility: add targetLanguage if missing
        const processedSentences = allStarredSentences.map(sentence => {
            if (!sentence.targetLanguage) {
                sentence.targetLanguage = null; // This will trigger fallback in frontend
            }
            return sentence;
        });

        res.json(processedSentences);
    } catch (error) {
        console.error("Error fetching starred sentences:", error);
        res.status(500).json({ message: 'Failed to fetch starred sentences.' });
    }
});

// --- SAVE A NEW SENTENCE ---
app.post('/api/sentences/save', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { sentence } = req.body;

        // Use findOneAndUpdate with 'upsert: true' to either create a new sentence
        // or update the existing one. This prevents duplicates.
        await Sentence.findOneAndUpdate(
            { userId: userId, targetSentence: sentence.targetSentence },
            { 
              ...sentence, 
              userId: userId,
              $setOnInsert: { reviewDueDate: new Date() }
            },
            { upsert: true, new: true }
        );
        
        res.status(201).json({ message: 'Sentence saved successfully.' });
    } catch (error) {
        console.error("Error saving sentence:", error);
        if (error.code === 11000) {
            return res.status(200).json({ message: 'Sentence already exists.' });
        }
        res.status(500).json({ message: 'Failed to save sentence.' });
    }
});


// --- UPDATE A SENTENCE'S REVIEW DATE ---
app.put('/api/sentences/update-review', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { sentenceId, grade } = req.body;
        
        // Validate grade
        if (!grade || ![1, 2, 3, 4].includes(grade)) {
            return res.status(400).json({ message: 'Invalid grade. Must be 1, 2, 3, or 4.' });
        }

        // Get the current sentence
        const sentence = await Sentence.findById(sentenceId);
        if (!sentence) {
            return res.status(404).json({ message: 'Sentence not found.' });
        }

        // Calculate next review using FSRS-6 algorithm
        const fsrs = new FSRS();
        const fsrsUpdate = fsrs.schedule(sentence, grade);
        
        // Calculate interval in minutes from now to next review date
        const now = new Date();
        const nextReviewDate = new Date(fsrsUpdate.reviewDate);
        const intervalMinutes = Math.max(0, Math.round((nextReviewDate.getTime() - now.getTime()) / (1000 * 60)));
        
        // Update the sentence with new FSRS-6 state
        // Map reviewDate to nextReviewDate to match the Sentence schema
        await Sentence.findByIdAndUpdate(sentenceId, {
            stability: fsrsUpdate.stability,
            difficulty: fsrsUpdate.difficulty,
            lastReviewed: fsrsUpdate.lastReviewed,
            nextReviewDate: fsrsUpdate.reviewDate, // Map reviewDate to nextReviewDate
            interval: intervalMinutes,
            lapses: fsrsUpdate.lapses,
            reps: fsrsUpdate.reps,
            reviewCount: (sentence.reviewCount || 0) + 1,
            // Keep the old reviewDueDate for backward compatibility
            reviewDueDate: fsrsUpdate.reviewDate
        });

        res.json({ 
            message: 'Review updated successfully.',
            nextReviewDate: fsrsUpdate.reviewDate,
            interval: intervalMinutes
        });
    } catch (error) {
        console.error("Error updating review:", error);
        res.status(500).json({ message: 'Failed to update review.' });
    }
});

// --- MIGRATE EXISTING SENTENCES WITH TARGET LANGUAGE ---
app.post('/api/sentences/migrate-target-language', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { targetLanguage } = req.body;
        
        if (!targetLanguage) {
            return res.status(400).json({ message: 'Target language is required for migration.' });
        }

        // Update all sentences for this user that don't have targetLanguage
        const result = await Sentence.updateMany(
            { 
                userId: userId,
                targetLanguage: { $exists: false }
            },
            { 
                $set: { targetLanguage: targetLanguage }
            }
        );

        res.json({ 
            message: `Successfully migrated ${result.modifiedCount} sentences with target language: ${targetLanguage}`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("Error migrating sentences:", error);
        res.status(500).json({ message: 'Failed to migrate sentences.' });
    }
});

// --- STAR/UNSTAR A SENTENCE ---
app.put('/api/sentences/star', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { sentence, starred } = req.body;

        if (starred) {
            // Star the sentence - save to MongoDB
            await Sentence.findOneAndUpdate(
                { userId: userId, targetSentence: sentence.targetSentence },
                { 
                    ...sentence, 
                    userId: userId,
                    starred: true,
                    $setOnInsert: { reviewDueDate: new Date() }
                },
                { upsert: true, new: true }
            );
        } else {
            // Unstar the sentence - remove from MongoDB
            await Sentence.findOneAndDelete({
                userId: userId,
                targetSentence: sentence.targetSentence
            });
        }

        res.json({ message: starred ? 'Sentence starred successfully.' : 'Sentence unstarred successfully.' });
    } catch (error) {
        console.error("Error updating star status:", error);
        res.status(500).json({ message: 'Failed to update star status.' });
    }
});

// ============================================================
//  FLASHCARDS API ROUTES
// ============================================================

// --- GET ALL FLASHCARD SETS (user's own + public sets) ---
app.get('/api/flashcards/sets', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        
        // Get user's own sets and public sets from other users (exclude trashed)
        // Use $ne: true to include sets where isTrashed is false or doesn't exist (for backward compatibility)
        const userSets = await FlashcardSet.find({ userId: userId, isTrashed: { $ne: true } });
        const publicSets = await FlashcardSet.find({ 
            userId: { $ne: userId },
            isPublic: true,
            isTrashed: { $ne: true }
        });
        
        res.json([...userSets, ...publicSets]);
    } catch (error) {
        console.error("Error fetching flashcard sets:", error);
        res.status(500).json({ message: 'Failed to fetch flashcard sets.' });
    }
});

// --- GET USER'S OWN FLASHCARD SETS ---
app.get('/api/flashcards/my-sets', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        // Use $ne: true to include sets where isTrashed is false or doesn't exist (for backward compatibility)
        const sets = await FlashcardSet.find({ userId: userId, isTrashed: { $ne: true } }).sort({ updatedAt: -1 });
        
        // Migrate legacy cards in all sets
        for (const set of sets) {
            let hasLegacyCards = false;
            const fsrs = new FSRS();
            
            for (let i = 0; i < set.flashcards.length; i++) {
                const card = set.flashcards[i];
                // Check if card has lastReviewed but no lastGrade (legacy "Studied" status)
                if (card.lastReviewed && !card.lastGrade) {
                    hasLegacyCards = true;
                    
                    // Assign "Good" grade (Grade.Good = 3)
                    card.lastGrade = Grade.Good;
                    
                    // Initialize FSRS fields if they don't exist
                    if (!card.stability || !card.difficulty) {
                        // Initialize as if it's a new card with Grade.Good
                        card.stability = s_0(Grade.Good);
                        card.difficulty = d_0(Grade.Good);
                        
                        // Calculate next review date using FSRS interval for Good grade
                        const now = new Date();
                        const intervalDays = Math.max(Math.round(interval(fsrs.r_d, card.stability)), 1);
                        card.nextReviewDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
                        
                        // Initialize other FSRS fields if missing
                        if (!card.lapses) card.lapses = 0; // Good doesn't count as a lapse
                        if (!card.reps) card.reps = 1;
                    } else {
                        // Card has FSRS fields, calculate next review based on existing stability
                        const now = new Date();
                        const intervalDays = Math.max(Math.round(interval(fsrs.r_d, card.stability)), 1);
                        card.nextReviewDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
                    }
                }
            }
            
            // Save the set if we migrated any cards
            if (hasLegacyCards) {
                set.updatedAt = Date.now();
                await set.save();
                console.log(`Migrated legacy cards in set ${set._id}`);
            }
        }
        
        res.json(sets);
    } catch (error) {
        console.error("Error fetching user's flashcard sets:", error);
        res.status(500).json({ message: 'Failed to fetch flashcard sets.' });
    }
});

// --- GET A SINGLE FLASHCARD SET ---
app.get('/api/flashcards/sets/:setId', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Don't allow access to trashed sets through normal endpoints
        if (set.isTrashed) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Check if user has access (own set or public)
        if (set.userId !== userId && !set.isPublic) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        
        // Migrate legacy cards: cards with lastReviewed but no lastGrade
        let hasLegacyCards = false;
        const fsrs = new FSRS();
        
        for (let i = 0; i < set.flashcards.length; i++) {
            const card = set.flashcards[i];
            // Check if card has lastReviewed but no lastGrade (legacy "Studied" status)
            if (card.lastReviewed && !card.lastGrade) {
                hasLegacyCards = true;
                
                // Assign "Good" grade (Grade.Good = 3)
                card.lastGrade = Grade.Good;
                
                // Initialize FSRS fields if they don't exist
                if (!card.stability || !card.difficulty) {
                    // Initialize as if it's a new card with Grade.Good
                    card.stability = s_0(Grade.Good);
                    card.difficulty = d_0(Grade.Good);
                    
                    // Calculate next review date using FSRS interval for Good grade
                    const now = new Date();
                    const intervalDays = Math.max(Math.round(interval(fsrs.r_d, card.stability)), 1);
                    card.nextReviewDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
                    
                    // Initialize other FSRS fields if missing
                    if (!card.lapses) card.lapses = 0; // Good doesn't count as a lapse
                    if (!card.reps) card.reps = 1;
                } else {
                    // Card has FSRS fields, calculate next review based on existing stability
                    const now = new Date();
                    const intervalDays = Math.max(Math.round(interval(fsrs.r_d, card.stability)), 1);
                    card.nextReviewDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
                }
            }
        }
        
        // Save the set if we migrated any cards
        if (hasLegacyCards) {
            set.updatedAt = Date.now();
            await set.save();
            console.log(`Migrated legacy cards in set ${setId}`);
        }
        
        // Fetch user-specific study data for this set
        const userSetData = await UserFlashcardSetData.findOne({ userId, setId });

        // Convert set to a plain object to modify it
        const setObj = set.toObject();

        // If user-specific data exists, override the default study options
        if (userSetData) {
            setObj.studyOptions = userSetData.studyOptions;
        }

        res.json(setObj);
    } catch (error) {
        console.error("Error fetching flashcard set:", error);
        res.status(500).json({ message: 'Failed to fetch flashcard set.' });
    }
});

// --- GET USER-SPECIFIC DATA FOR A SET ---
app.get('/api/flashcards/sets/:setId/user-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;

        const userSetData = await UserFlashcardSetData.findOne({ userId, setId });
        
        if (!userSetData) {
            // It's okay if it doesn't exist, the user just hasn't studied this set yet
            return res.status(200).json(null); 
        }

        res.json(userSetData);
    } catch (error) {
        console.error("Error fetching user data for set:", error);
        res.status(500).json({ message: 'Failed to fetch user data for set.' });
    }
});

// --- UPDATE/CREATE USER-SPECIFIC STUDY OPTIONS FOR A SET ---
app.put('/api/flashcards/sets/:setId/user-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        const { studyOptions } = req.body;

        if (!studyOptions) {
            return res.status(400).json({ message: 'Study options are required.' });
        }

        const updatedData = await UserFlashcardSetData.findOneAndUpdate(
            { userId, setId },
            { 
                $set: { studyOptions: studyOptions, lastStudied: new Date() },
                $setOnInsert: { userId, setId }
            },
            { upsert: true, new: true }
        );

        res.json(updatedData);

    } catch (error) {
        console.error("Error updating user data for set:", error);
        res.status(500).json({ message: 'Failed to update user data for set.' });
    }
});

// --- Helper function to get start of day in user's timezone ---
// timezoneOffsetMinutes: The user's timezone offset in minutes (from Date.getTimezoneOffset())
// Note: getTimezoneOffset() returns the difference in minutes between UTC and local time
// e.g., Pacific Time (UTC-8) returns +480, UTC+5:30 returns -330
// referenceTime: Optional Date object to use as reference (defaults to now)
const getStartOfDayInUserTimezone = (timezoneOffsetMinutes, referenceTime = null) => {
    const now = referenceTime || new Date();
    
    // If no timezone offset provided, use server time (fallback)
    if (timezoneOffsetMinutes === undefined || timezoneOffsetMinutes === null || isNaN(timezoneOffsetMinutes)) {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return today;
    }
    
    // Convert the timezone offset to the user's current time
    // getTimezoneOffset returns positive for west of UTC, negative for east
    // So we need to subtract the offset to get UTC, then add the user's offset
    const serverOffsetMinutes = now.getTimezoneOffset();
    const userLocalTime = new Date(now.getTime() + (serverOffsetMinutes - timezoneOffsetMinutes) * 60000);
    
    // Get start of day in user's timezone
    const startOfDayUserTime = new Date(userLocalTime);
    startOfDayUserTime.setHours(0, 0, 0, 0);
    
    // Convert back to UTC for storage
    const startOfDayUTC = new Date(startOfDayUserTime.getTime() - (serverOffsetMinutes - timezoneOffsetMinutes) * 60000);
    
    return startOfDayUTC;
};

// --- Check if two dates are the same day in user's timezone ---
// referenceTime: Optional Date object to use for calculating server offset (defaults to now)
const isSameDayInUserTimezone = (date1, date2, timezoneOffsetMinutes, referenceTime = null) => {
    if (!date1 || !date2) return false;
    
    const now = referenceTime || new Date();
    
    // If no timezone offset provided, compare using server time (fallback)
    if (timezoneOffsetMinutes === undefined || timezoneOffsetMinutes === null || isNaN(timezoneOffsetMinutes)) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        return d1.getTime() === d2.getTime();
    }
    
    const serverOffsetMinutes = now.getTimezoneOffset();
    const offsetDiff = serverOffsetMinutes - timezoneOffsetMinutes;
    
    // Convert both dates to user's local time
    const d1UserTime = new Date(new Date(date1).getTime() + offsetDiff * 60000);
    const d2UserTime = new Date(new Date(date2).getTime() + offsetDiff * 60000);
    
    // Compare year, month, and day
    return d1UserTime.getFullYear() === d2UserTime.getFullYear() &&
           d1UserTime.getMonth() === d2UserTime.getMonth() &&
           d1UserTime.getDate() === d2UserTime.getDate();
};

// --- GET/UPDATE NEW CARDS SHOWN COUNTER FOR A SET ---
app.post('/api/flashcards/sets/:setId/new-cards-shown', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        const { count, timezoneOffsetMinutes } = req.body; // Number of new cards being shown + user's timezone offset

        if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
            return res.status(400).json({ message: 'Invalid count. Must be a non-negative integer.' });
        }

        // Use a single reference time for all calculations to ensure consistency
        const now = new Date();
        const todayStartUTC = getStartOfDayInUserTimezone(timezoneOffsetMinutes, now);

        if (count === 0) {
            // No-op, but still return current counter
            const userData = await UserFlashcardSetData.findOne({ userId, setId });
            
            if (!userData) {
                return res.json({ 
                    newCardsShownToday: 0,
                    newCardsShownDate: todayStartUTC
                });
            }

            // Check if counter date is the same day as today in user's timezone
            if (!isSameDayInUserTimezone(userData.newCardsShownDate, now, timezoneOffsetMinutes, now)) {
                return res.json({ 
                    newCardsShownToday: 0,
                    newCardsShownDate: todayStartUTC
                });
            }

            return res.json({ 
                newCardsShownToday: userData.newCardsShownToday || 0,
                newCardsShownDate: userData.newCardsShownDate
            });
        }

        // First, check if we have existing data and if it's from today
        const existingData = await UserFlashcardSetData.findOne({ userId, setId });
        
        if (!existingData) {
            // No existing data - create new with upsert to handle race conditions
            const userData = await UserFlashcardSetData.findOneAndUpdate(
                { userId, setId },
                { 
                    $setOnInsert: { userId, setId },
                    $set: { newCardsShownToday: count, newCardsShownDate: todayStartUTC }
                },
                { upsert: true, new: true }
            );
            return res.json({ 
                newCardsShownToday: userData.newCardsShownToday,
                newCardsShownDate: userData.newCardsShownDate
            });
        }
        
        // Check if counter needs reset (different day in user's timezone)
        const isSameDay = isSameDayInUserTimezone(existingData.newCardsShownDate, now, timezoneOffsetMinutes, now);
        
        let userData;
        if (!isSameDay) {
            // Reset counter to 0 for new day, then set to count (atomic operation)
            userData = await UserFlashcardSetData.findOneAndUpdate(
                { userId, setId },
                { 
                    $set: { newCardsShownToday: count, newCardsShownDate: todayStartUTC }
                },
                { new: true }
            );
        } else {
            // Atomically increment counter using $inc
            userData = await UserFlashcardSetData.findOneAndUpdate(
                { userId, setId },
                { 
                    $inc: { newCardsShownToday: count }
                },
                { new: true }
            );
        }

        res.json({ 
            newCardsShownToday: userData?.newCardsShownToday || count,
            newCardsShownDate: userData?.newCardsShownDate || todayStartUTC
        });

    } catch (error) {
        console.error("Error updating new cards shown counter:", error);
        res.status(500).json({ message: 'Failed to update new cards shown counter.' });
    }
});

// --- GET NEW CARDS SHOWN COUNTER FOR A SET ---
app.get('/api/flashcards/sets/:setId/new-cards-shown', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        
        // Get timezone offset from query parameter (sent by client)
        // parseInt returns NaN for empty strings or non-numeric values, which is handled by helper functions
        const rawOffset = req.query.timezoneOffset;
        const timezoneOffsetMinutes = rawOffset !== undefined && rawOffset !== ''
            ? parseInt(rawOffset, 10) 
            : null;

        // Use a single reference time for all calculations to ensure consistency
        const now = new Date();
        const todayStartUTC = getStartOfDayInUserTimezone(timezoneOffsetMinutes, now);

        let userData = await UserFlashcardSetData.findOne({ userId, setId });
        
        if (!userData) {
            // Return default if no user data exists
            return res.json({ 
                newCardsShownToday: 0,
                newCardsShownDate: todayStartUTC
            });
        }

        // Check if the counter date is the same day as today in user's timezone
        if (!isSameDayInUserTimezone(userData.newCardsShownDate, now, timezoneOffsetMinutes, now)) {
            // Counter is for a different day, reset it atomically and return 0
            await UserFlashcardSetData.findOneAndUpdate(
                { userId, setId },
                { $set: { newCardsShownToday: 0, newCardsShownDate: todayStartUTC } }
            );
            return res.json({ 
                newCardsShownToday: 0,
                newCardsShownDate: todayStartUTC
            });
        }

        res.json({ 
            newCardsShownToday: userData.newCardsShownToday || 0,
            newCardsShownDate: userData.newCardsShownDate
        });

    } catch (error) {
        console.error("Error fetching new cards shown counter:", error);
        res.status(500).json({ message: 'Failed to fetch new cards shown counter.' });
    }
});

// --- CREATE A NEW FLASHCARD SET ---
app.post('/api/flashcards/sets', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { title, description, isPublic, flashcards, studyOptions } = req.body;
        
        if (!title || !flashcards || !Array.isArray(flashcards)) {
            return res.status(400).json({ message: 'Title and flashcards array are required.' });
        }
        
        const newSet = new FlashcardSet({
            userId,
            title,
            description: description || '',
            isPublic: isPublic !== undefined ? isPublic : true,
            flashcards,
            studyOptions: studyOptions || {
                examDate: null,
                newCardsPerDay: 10,
                newCardQuestionTypes: {
                    flashcards: true,
                    multipleChoice: false,
                    written: false,
                    trueFalse: false
                },
                seenCardQuestionTypes: {
                    flashcards: false,
                    multipleChoice: false,
                    written: true,
                    trueFalse: false
                },
                questionFormat: 'term',
                learningOptions: {
                    studyStarredOnly: false,
                    shuffle: false
                }
            }
        });
        
        await newSet.save();
        res.status(201).json(newSet);
    } catch (error) {
        console.error("Error creating flashcard set:", error);
        res.status(500).json({ message: 'Failed to create flashcard set.' });
    }
});

// --- UPDATE FLASHCARD SET ---
app.put('/api/flashcards/sets/:setId', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        const updateData = req.body;
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Don't allow updating trashed sets
        if (set.isTrashed) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Only the owner can update
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only update your own sets.' });
        }
        
        // Update allowed fields
        if (updateData.title !== undefined) set.title = updateData.title;
        if (updateData.description !== undefined) set.description = updateData.description;
        if (updateData.isPublic !== undefined) set.isPublic = updateData.isPublic;
        if (updateData.flashcards !== undefined) set.flashcards = updateData.flashcards;
        if (updateData.studyOptions !== undefined) set.studyOptions = updateData.studyOptions;
        
        set.updatedAt = Date.now();
        await set.save();
        
        res.json(set);
    } catch (error) {
        console.error("Error updating flashcard set:", error);
        res.status(500).json({ message: 'Failed to update flashcard set.' });
    }
});

// --- MOVE FLASHCARD SET TO TRASH ---
app.delete('/api/flashcards/sets/:setId', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Only the owner can delete
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only delete your own sets.' });
        }
        
        // Move to trash instead of permanent delete
        set.isTrashed = true;
        set.trashedAt = new Date();
        await set.save();
        
        res.json({ message: 'Flashcard set moved to trash successfully.' });
    } catch (error) {
        console.error("Error moving flashcard set to trash:", error);
        res.status(500).json({ message: 'Failed to move flashcard set to trash.' });
    }
});

// --- GET TRASHED FLASHCARD SETS ---
app.get('/api/flashcards/trash', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const sets = await FlashcardSet.find({ userId: userId, isTrashed: true }).sort({ trashedAt: -1 });
        res.json(sets);
    } catch (error) {
        console.error("Error fetching trashed flashcard sets:", error);
        res.status(500).json({ message: 'Failed to fetch trashed flashcard sets.' });
    }
});

// --- RESTORE FLASHCARD SET FROM TRASH ---
app.post('/api/flashcards/sets/:setId/restore', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Only the owner can restore
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only restore your own sets.' });
        }
        
        if (!set.isTrashed) {
            return res.status(400).json({ message: 'This set is not in trash.' });
        }
        
        set.isTrashed = false;
        set.trashedAt = null;
        await set.save();
        
        res.json({ message: 'Flashcard set restored successfully.' });
    } catch (error) {
        console.error("Error restoring flashcard set:", error);
        res.status(500).json({ message: 'Failed to restore flashcard set.' });
    }
});

// --- PERMANENTLY DELETE FLASHCARD SET FROM TRASH ---
app.delete('/api/flashcards/trash/:setId', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Only the owner can permanently delete
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only delete your own sets.' });
        }
        
        if (!set.isTrashed) {
            return res.status(400).json({ message: 'This set is not in trash. Use the regular delete endpoint to move it to trash first.' });
        }
        
        await FlashcardSet.findByIdAndDelete(setId);
        res.json({ message: 'Flashcard set permanently deleted successfully.' });
    } catch (error) {
        console.error("Error permanently deleting flashcard set:", error);
        res.status(500).json({ message: 'Failed to permanently delete flashcard set.' });
    }
});

// --- AUTO-DELETE TRASHED SETS OLDER THAN 30 DAYS ---
app.post('/api/flashcards/trash/cleanup', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const result = await FlashcardSet.deleteMany({
            isTrashed: true,
            trashedAt: { $lt: thirtyDaysAgo }
        });
        
        res.json({ 
            message: `Permanently deleted ${result.deletedCount} flashcard set(s) older than 30 days.`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error("Error cleaning up trash:", error);
        res.status(500).json({ message: 'Failed to clean up trash.' });
    }
});

// --- IMPORT CARDS TO EXISTING SET ---
app.post('/api/flashcards/sets/:setId/import', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        const { flashcards } = req.body;
        
        if (!flashcards || !Array.isArray(flashcards)) {
            return res.status(400).json({ message: 'Flashcards array is required.' });
        }
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Only the owner can import
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only import to your own sets.' });
        }
        
        // Add new flashcards to existing set
        set.flashcards = [...set.flashcards, ...flashcards];
        set.updatedAt = Date.now();
        await set.save();
        
        res.json(set);
    } catch (error) {
        console.error("Error importing flashcards:", error);
        res.status(500).json({ message: 'Failed to import flashcards.' });
    }
});

// --- UPDATE A SINGLE FLASHCARD ---
app.put('/api/flashcards/sets/:setId/cards/:cardIndex', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId, cardIndex } = req.params;
        const cardUpdates = req.body;
        
        if (cardUpdates.term !== undefined && !cardUpdates.term.trim()) {
            return res.status(400).json({ message: 'Term cannot be empty.' });
        }
        if (cardUpdates.definition !== undefined && !cardUpdates.definition.trim()) {
            return res.status(400).json({ message: 'Definition cannot be empty.' });
        }

        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only update cards in your own sets.' });
        }
        
        const cardIndexNum = parseInt(cardIndex);
        if (isNaN(cardIndexNum) || cardIndexNum < 0 || cardIndexNum >= set.flashcards.length) {
            return res.status(400).json({ message: 'Invalid card index.' });
        }

        const cardToUpdate = set.flashcards[cardIndexNum];

        // Update only the fields that are sent in the request
        if (cardUpdates.term !== undefined) cardToUpdate.term = cardUpdates.term;
        if (cardUpdates.definition !== undefined) cardToUpdate.definition = cardUpdates.definition;
        if (cardUpdates.starred !== undefined) cardToUpdate.starred = cardUpdates.starred;
        if (cardUpdates.termLanguage !== undefined) cardToUpdate.termLanguage = cardUpdates.termLanguage;
        if (cardUpdates.definitionLanguage !== undefined) cardToUpdate.definitionLanguage = cardUpdates.definitionLanguage;
        if (cardUpdates.exampleSentences !== undefined) cardToUpdate.exampleSentences = cardUpdates.exampleSentences;
        
        set.updatedAt = Date.now();
        await set.save();
        
        res.json(set.flashcards[cardIndexNum]);

    } catch (error) {
        console.error("Error updating flashcard:", error);
        res.status(500).json({ message: 'Failed to update flashcard.' });
    }
});

// --- DELETE A SINGLE FLASHCARD ---
app.delete('/api/flashcards/sets/:setId/cards/:cardIndex', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId, cardIndex } = req.params;

        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only delete cards from your own sets.' });
        }
        
        const cardIndexNum = parseInt(cardIndex);
        if (isNaN(cardIndexNum) || cardIndexNum < 0 || cardIndexNum >= set.flashcards.length) {
            return res.status(400).json({ message: 'Invalid card index.' });
        }

        // Remove the card from the array
        set.flashcards.splice(cardIndexNum, 1);
        
        set.updatedAt = Date.now();
        await set.save();
        
        res.json({ message: 'Flashcard deleted successfully.' });

    } catch (error) {
        console.error("Error deleting flashcard:", error);
        res.status(500).json({ message: 'Failed to delete flashcard.' });
    }
});

// --- UPDATE STUDY OPTIONS FOR A SET ---
app.put('/api/flashcards/sets/:setId/study-options', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId } = req.params;
        const { studyOptions } = req.body;
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        // Only the owner can update study options
        if (set.userId !== userId) {
            return res.status(403).json({ message: 'You can only update study options for your own sets.' });
        }
        
        set.studyOptions = { ...set.studyOptions, ...studyOptions };
        set.updatedAt = Date.now();
        await set.save();
        
        res.json(set);
    } catch (error) {
        console.error("Error updating study options:", error);
        res.status(500).json({ message: 'Failed to update study options.' });
    }
});

// --- UPDATE FLASHCARD REVIEW (using FSRS) ---
app.put('/api/flashcards/cards/:setId/:cardIndex/review', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { setId, cardIndex } = req.params;
        const { grade } = req.body;
        
        if (!grade || ![1, 2, 3, 4].includes(grade)) {
            return res.status(400).json({ message: 'Invalid grade. Must be 1, 2, 3, or 4.' });
        }
        
        const set = await FlashcardSet.findById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Flashcard set not found.' });
        }
        
        const cardIndexNum = parseInt(cardIndex);
        if (cardIndexNum < 0 || cardIndexNum >= set.flashcards.length) {
            return res.status(400).json({ message: 'Invalid card index.' });
        }
        
        const card = set.flashcards[cardIndexNum];
        
        // Calculate next review using FSRS algorithm
        const fsrs = new FSRS();
        const fsrsUpdate = fsrs.schedule(card, grade);
        
        // Update the card with new FSRS state
        card.stability = fsrsUpdate.stability;
        card.difficulty = fsrsUpdate.difficulty;
        card.lastReviewed = fsrsUpdate.lastReviewed;
        card.reviewDate = fsrsUpdate.reviewDate; // This should be nextReviewDate
        card.nextReviewDate = fsrsUpdate.reviewDate;
        card.lapses = fsrsUpdate.lapses;
        card.reps = fsrsUpdate.reps;
        card.lastGrade = grade;
        
        set.updatedAt = Date.now();
        await set.save();
        
        res.json({ 
            message: 'Review updated successfully.',
            nextReviewDate: fsrsUpdate.reviewDate,
        });
    } catch (error) {
        console.error("Error updating flashcard review:", error);
        res.status(500).json({ message: 'Failed to update flashcard review.' });
    }
});

// --- 7. FRONTEND CATCH-ALL ROUTE ---
app.use(express.static(path.join(__dirname, 'dist')));

// only handle non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- 8. AUTO-DELETE TRASHED SETS OLDER THAN 30 DAYS (runs every 24 hours) ---
const cleanupTrash = async () => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const result = await FlashcardSet.deleteMany({
            isTrashed: true,
            trashedAt: { $lt: thirtyDaysAgo }
        });
        
        if (result.deletedCount > 0) {
            console.log(`Auto-deleted ${result.deletedCount} flashcard set(s) older than 30 days from trash.`);
        }
    } catch (error) {
        console.error("Error in trash cleanup:", error);
    }
};

// Run cleanup immediately on server start, then every 24 hours
cleanupTrash();
setInterval(cleanupTrash, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

// --- 9. START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});