// models/FlashcardSet.js
import mongoose from 'mongoose';

const flashcardSchema = new mongoose.Schema({
    term: { type: String, required: true },
    definition: { type: String, required: true },
    termLanguage: { type: String }, // Language code for term TTS
    definitionLanguage: { type: String }, // Language code for definition TTS
    starred: { type: Boolean, default: false },
    
    // FSRS-6 (Free Spaced Repetition Scheduler v6) state fields for individual cards
    // These fields track the memory state and scheduling for each card
    stability: { type: Number, default: null }, // Memory stability in days (S)
    difficulty: { type: Number, default: null }, // Card difficulty [1-10] (D)
    reps: { type: Number, default: 0 }, // Number of successful reviews
    lapses: { type: Number, default: 0 }, // Number of times forgotten (grade=1)
    lastReviewed: { type: Date, default: null }, // When the card was last reviewed
    nextReviewDate: { type: Date, default: null }, // When the card is next due
    interval: { type: Number, default: null }, // Current interval in days
    lastGrade: { type: Number, default: null }, // Last grade given (1-4)
    
    // Example sentences generated for this flashcard
    exampleSentences: { type: [{
        sentence: { type: String, required: true },
        translation: { type: String, required: true }
    }], default: [] }
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
        cardsPerRound: { type: Number, default: 10 },
        newCardQuestionTypes: {
            flashcards: { type: Boolean, default: true },
            multipleChoice: { type: Boolean, default: false },
            written: { type: Boolean, default: false },
            trueFalse: { type: Boolean, default: false }
        },
        seenCardQuestionTypes: {
            flashcards: { type: Boolean, default: false },
            multipleChoice: { type: Boolean, default: false },
            written: { type: Boolean, default: true },
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
            },
            retypeAnswer: { type: Boolean, default: true },
            soundEffects: { type: Boolean, default: true },
            autoAdvance: { type: Boolean, default: false }
        },
        // AI settings for generating example sentences
        exampleSentenceModel: { type: String, enum: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'], default: 'gemini-2.5-flash' },
        exampleSentenceTemperature: { type: Number, default: 2.0 }
    },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isTrashed: { type: Boolean, default: false },
    trashedAt: { type: Date, default: null }
});

// Update the updatedAt field before saving
flashcardSetSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const FlashcardSet = mongoose.model('FlashcardSet', flashcardSetSchema);

export default FlashcardSet;
