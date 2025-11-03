import mongoose from 'mongoose';

const userFlashcardSetDataSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    setId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashcardSet', required: true },
    studyOptions: {
        examDate: { type: Date, default: null },
        newCardsPerDay: { type: Number, default: 10 },
        questionTypes: {
            flashcards: { type: Boolean, default: true },
            multipleChoice: { type: Boolean, default: false },
            written: { type: Boolean, default: false },
            trueFalse: { type: Boolean, default: false }
        },
        questionFormat: { type: String, enum: ['term', 'definition'], default: 'term' },
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
    lastStudied: { type: Date, default: Date.now }
});

// Create a compound index to ensure a user has only one data document per set
userFlashcardSetDataSchema.index({ userId: 1, setId: 1 }, { unique: true });

const UserFlashcardSetData = mongoose.model('UserFlashcardSetData', userFlashcardSetDataSchema);

export default UserFlashcardSetData;
