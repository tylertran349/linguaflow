// models/FlashcardSet.js
import mongoose from 'mongoose';

const flashcardSchema = new mongoose.Schema({
    term: { type: String, required: true },
    definition: { type: String, required: true },
    termLanguage: { type: String }, // Language code for term TTS
    definitionLanguage: { type: String }, // Language code for definition TTS
    starred: { type: Boolean, default: false },
    
    // FSRS (Free Spaced Repetition Scheduler) state fields for individual cards
    stability: { type: Number, default: null },
    difficulty: { type: Number, default: null },
    reps: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    lastReviewed: { type: Date, default: null },
    nextReviewDate: { type: Date, default: null },
    interval: { type: Number, default: null },
});

const flashcardSetSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    isPublic: { type: Boolean, default: true }, // Public by default
    flashcards: [flashcardSchema],
    
    // Study options for this set
    studyOptions: {
        examDate: { type: Date, default: null },
        newCardsPerDay: { type: Number, default: 10 },
        questionTypes: {
            flashcards: { type: Boolean, default: true },
            multipleChoice: { type: Boolean, default: false },
            written: { type: Boolean, default: false },
            trueFalse: { type: Boolean, default: false }
        },
        questionFormat: { type: String, enum: ['term', 'definition'], default: 'term' }, // Answer with term or definition
        learningOptions: {
            studyStarredOnly: { type: Boolean, default: false },
            shuffle: { type: Boolean, default: false },
            studyRangeOnly: { 
                start: { type: String, default: '' },
                end: { type: String, default: '' }
            },
            excludeRange: {
                start: { type: String, default: '' },
                end: { type: String, default: '' }
            }
        }
    },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
flashcardSetSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const FlashcardSet = mongoose.model('FlashcardSet', flashcardSetSchema);

export default FlashcardSet;
