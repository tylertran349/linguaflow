import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClerkExpressWithAuth, ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { Webhook } from 'svix';

// --- 1. INITIAL SETUP ---
dotenv.config();

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


// --- 5. SERVE REACT FRONTEND IN PRODUCTION ---
// This code will only run in the production environment
if (process.env.NODE_ENV === 'production') {
    // Serve the static files from the Vite build folder
    app.use(express.static(path.join(__dirname, 'dist')));
}


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
//  ADD YOUR OTHER API ROUTES HERE
//  e.g., app.post('/api/documents', ClerkExpressRequireAuth(), createDocument);
// ============================================================


// --- 7. FRONTEND CATCH-ALL ROUTE ---
// This must be the last GET route.
// It sends the main index.html file to the client for any request that doesn't match an API route.
// This is essential for React Router to handle client-side routing.
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}


// --- 8. START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});