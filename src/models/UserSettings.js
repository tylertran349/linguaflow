// models/UserSettings.js
import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
    // This links the settings to the Clerk user ID
    userId: { type: String, required: true, unique: true, index: true },
    
    // Your settings object
    settings: {
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
    },
    
    // The topic string
    topic: String
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

export default UserSettings;