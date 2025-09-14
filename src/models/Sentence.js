// models/Sentence.js
import mongoose from 'mongoose';

const sentenceSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    targetSentence: { type: String, required: true },
    nativeSentence: { type: String, required: true },
    colorMapping: [Object],
    reviewDueDate: { type: Date, default: () => new Date(), index: true },
    starred: { type: Boolean, default: false, index: true },
    // Add any other fields you might need, like interval, easeFactor, etc.
});

// Create a compound index to ensure a user doesn't save the exact same sentence twice
sentenceSchema.index({ userId: 1, targetSentence: 1 }, { unique: true });

const Sentence = mongoose.model('Sentence', sentenceSchema);

export default Sentence;