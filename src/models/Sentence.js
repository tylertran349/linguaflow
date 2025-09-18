// models/Sentence.js
import mongoose from 'mongoose';

const sentenceSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    targetSentence: { type: String, required: true },
    nativeSentence: { type: String, required: true },
    colorMapping: [Object],
    reviewDueDate: { type: Date, default: () => new Date(), index: true },
    starred: { type: Boolean, default: false, index: true },
    
    // FSRS (Free Spaced Repetition Scheduler) state fields
    stability: { type: Number, default: null }, // Time in days for R to decay from 1 to 0.9
    difficulty: { type: Number, default: null }, // How hard it is to recall (1-10)
    lastReviewed: { type: Date, default: null }, // When the card was last reviewed
    nextReviewDate: { type: Date, default: null }, // When the card should next be reviewed
    interval: { type: Number, default: null }, // Minutes until next review
    reviewCount: { type: Number, default: 0 }, // Number of times this card has been reviewed
});

// Create a compound index to ensure a user doesn't save the exact same sentence twice
sentenceSchema.index({ userId: 1, targetSentence: 1 }, { unique: true });

const Sentence = mongoose.model('Sentence', sentenceSchema);

export default Sentence;