// models/UserSettings.js
import mongoose from 'mongoose';
import mongooseEncryption from 'mongoose-encryption';

const userSettingsSchema = new mongoose.Schema({
    // This links the settings to the Clerk user ID
    userId: { type: String, required: true, unique: true, index: true },
    
    // Your settings object
    settings: {
        //... (all your existing settings fields)
        nativeLanguage: String,
        targetLanguage: String,
        difficulty: String,
        model: String,
        ttsEngine: String,
        sentenceCount: Number,
        webSpeechRate: Number,
        googleTranslateRate: Number,
        sentenceDisplayHistorySize: Number,
        readAndRespondHistorySize: Number,
        writeAResponseHistorySize: Number,
        temperature: Number,
    },
    
    // The topic string
    topic: String,

    // The new encrypted API key field
    geminiApiKey: { type: String }
});

// --- ENCRYPTION SETUP ---
// Make sure you have a long, random string for MONGOOSE_ENCRYPTION_KEY in your .env file
const encKey = process.env.MONGOOSE_ENCRYPTION_KEY;

// We only apply encryption if the key is provided
if (encKey) {
    userSettingsSchema.plugin(mongooseEncryption, {
        secret: encKey,
        encryptedFields: ['geminiApiKey'], // Field to encrypt
        // This ensures that if someone tries to get all docs, the encrypted field is not returned
        excludeFromEncryption: [], 
        // We recommend using authenticated encryption
        authenticated: true
    });
}

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

export default UserSettings;