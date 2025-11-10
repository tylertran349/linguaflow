// src/components/Flashcards.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, Star, X, AlertTriangle, Check, Crown, Plus, Edit2, Trash2, Play, Settings, Eye, EyeOff, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/Flashcards.css';
import { FSRS, Grade, FSRS_GRADES } from '../services/fsrsService';
import EditCardModal from './EditCardModal';
import CollapsibleSection from './CollapsibleSection';

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

// Retry helper for DB write operations
const RETRY_DELAY_MS = 2000;
const retryUntilSuccess = async (operation, { onError } = {}) => {
    // Retries forever until the operation resolves successfully
    // Caller controls UI state (e.g., loading spinners)
    // Token fetching and request creation should be done inside the operation so each retry is fresh
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const result = await operation();
            return result;
        } catch (err) {
            if (onError) onError(err);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};

// Helper to find language code from language name
const getLanguageCode = (langName) => {
    const lang = supportedLanguages.find(l => l.name === langName);
    return lang ? lang.code : null;
};

const defaultStudyOptions = {
    examDate: null,
    newCardsPerDay: 10,
    cardsPerRound: 10,
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
        shuffle: false,
        studyRangeOnly: { start: '', end: '' },
        excludeRange: { start: '', end: '' },
        retypeAnswer: true,
        soundEffects: true
    }
};

function Flashcards({ settings, onApiKeyMissing, isSavingSettings, isRetryingSave }) {
    const { isSignedIn } = useUser();
    const { getToken } = useAuth();
    
    // Main state
    const [sets, setSets] = useState([]);
    const [currentSet, setCurrentSet] = useState(null);
    const [viewMode, setViewMode] = useState('sets'); // 'sets', 'create', 'edit', 'study', 'view'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    
    // Create/Edit state
    const [setTitle, setSetTitle] = useState('');
    const [setDescription, setSetDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [flashcards, setFlashcards] = useState([]);
    const [editingCardIndex, setEditingCardIndex] = useState(null);
    
    // Import state
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [termDefSeparator, setTermDefSeparator] = useState('tab'); // 'tab', 'comma', 'custom'
    const [customTermDefSeparator, setCustomTermDefSeparator] = useState('');
    const [rowSeparator, setRowSeparator] = useState('newline'); // 'newline', 'semicolon', 'custom'
    const [customRowSeparator, setCustomRowSeparator] = useState('');
    
    // Create/Edit pagination
    const [showAllCreateEdit, setShowAllCreateEdit] = useState(false);
    const [renderedCardCount, setRenderedCardCount] = useState(10);
    
    // Study state
    const [studyOptions, setStudyOptions] = useState(defaultStudyOptions);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [cardsToStudy, setCardsToStudy] = useState([]);
    const [isProcessingReview, setIsProcessingReview] = useState(false);
    const [writtenAnswer, setWrittenAnswer] = useState('');
    const [answerFeedback, setAnswerFeedback] = useState(null); // 'correct' or 'incorrect'
    const [currentQuestionType, setCurrentQuestionType] = useState('flashcards');
    const [studyAction, setStudyAction] = useState(null);
    const [mcqOptions, setMcqOptions] = useState([]);
    const [hasFlippedOnce, setHasFlippedOnce] = useState(false);
    const [retypeInputValue, setRetypeInputValue] = useState('');
    const [isRetypeCorrect, setIsRetypeCorrect] = useState(false);
    const [showDontKnowAnswer, setShowDontKnowAnswer] = useState(false);
    const [dontKnowInputValue, setDontKnowInputValue] = useState('');
    const [isDontKnowRetypeCorrect, setIsDontKnowRetypeCorrect] = useState(false);

    // Synchronous guard against race conditions from fast clicks
    const isProcessingReviewRef = useRef(false);

    // State for the new study round logic
    const [isRoundComplete, setIsRoundComplete] = useState(false);

    // Edit card modal state
    const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
    const [cardToEdit, setCardToEdit] = useState(null);

    const getCardStatus = (card) => {
        if (!card.lastReviewed) {
            return { label: 'New Card', className: 'status-new' };
        }

        if (card.lastGrade) {
            const gradeInfo = FSRS_GRADES.find(g => g.grade === card.lastGrade);
            if (gradeInfo) {
                return { 
                    label: `Studied: ${gradeInfo.label}`, 
                    className: `status-${gradeInfo.label.toLowerCase()}` 
                };
            }
        }

        return { label: 'Studied', className: 'status-studied' }; // Fallback
    };

    // Study options modal
    const [showStudyOptionsModal, setShowStudyOptionsModal] = useState(false);
    
    // View state
    const [showAllCards, setShowAllCards] = useState(false);
    const [renderedViewCardCount, setRenderedViewCardCount] = useState(10);
    const [viewSearchTerm, setViewSearchTerm] = useState('');

    // Fetch all sets
    const fetchSets = async () => {
        if (!isSignedIn) return;
        
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/api/flashcards/my-sets`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch flashcard sets');
            }
            
            const data = await response.json();
            setSets(data);
            setHasLoadedOnce(true);
            return true;
        } catch (err) {
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSignedIn && hasLoadedOnce) {
            // If the user signs in and we've previously loaded, refresh sets.
            fetchSets();
        }
        // Initial load is handled by the retry effect below when hasLoadedOnce is false.
    }, [isSignedIn, hasLoadedOnce]);

    // Initial load with retry for up to ~20 seconds
    useEffect(() => {
        if (!isSignedIn || hasLoadedOnce) return;

        let isActive = true;
        const maxDurationMs = 20000;
        const retryDelayMs = 3000;
        const startTime = Date.now();

        const attempt = async () => {
            const success = await fetchSets();
            if (!isActive) return;
            if (success) {
                return; // hasLoadedOnce will be set in fetchSets
            }
        };

        // First attempt immediately
        attempt();

        const id = setInterval(() => {
            if (!isActive) return;
            const elapsed = Date.now() - startTime;
            if (hasLoadedOnce) {
                clearInterval(id);
                return;
            }
            if (elapsed >= maxDurationMs) {
                clearInterval(id);
                if (!hasLoadedOnce) {
                    setError('Unable to load flashcard sets. Please refresh the page.');
                    setLoading(false);
                }
                return;
            }
            attempt();
        }, retryDelayMs);

        return () => {
            isActive = false;
            clearInterval(id);
        };
    }, [isSignedIn, hasLoadedOnce]);

    // Load set for viewing/editing
    const loadSet = async (setId) => {
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${setId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch flashcard set');
            }
            
            const data = await response.json();
            setCurrentSet(data);
            setSetTitle(data.title);
            setSetDescription(data.description || '');
            setIsPublic(data.isPublic);
            setFlashcards(data.flashcards || []);
            
            const loadedOptions = data.studyOptions || {};
            console.log('Loaded study options from DB:', loadedOptions);
            console.log('Loaded soundEffects value:', loadedOptions.learningOptions?.soundEffects);
            
            const mergedOptions = {
                ...defaultStudyOptions,
                ...loadedOptions,
                cardsPerRound: loadedOptions.cardsPerRound || defaultStudyOptions.cardsPerRound,
                newCardQuestionTypes: {
                    ...defaultStudyOptions.newCardQuestionTypes,
                    ...(loadedOptions.newCardQuestionTypes || {}),
                },
                seenCardQuestionTypes: {
                    ...defaultStudyOptions.seenCardQuestionTypes,
                    ...(loadedOptions.seenCardQuestionTypes || {}),
                },
                learningOptions: {
                    ...defaultStudyOptions.learningOptions,
                    ...(loadedOptions.learningOptions || {}),
                    studyRangeOnly: {
                        ...defaultStudyOptions.learningOptions.studyRangeOnly,
                        ...(loadedOptions.learningOptions?.studyRangeOnly || {}),
                    },
                    excludeRange: {
                        ...defaultStudyOptions.learningOptions.excludeRange,
                        ...(loadedOptions.learningOptions?.excludeRange || {}),
                    },
                    soundEffects: loadedOptions.learningOptions?.soundEffects ?? defaultStudyOptions.learningOptions.soundEffects,
                },
            };
            console.log('Merged soundEffects value:', mergedOptions.learningOptions.soundEffects);
            setStudyOptions(mergedOptions);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Parse import text using configured separators
    const parseImportText = (text) => {
        const parsed = [];
        
        // Determine row separator
        let rowSep;
        if (rowSeparator === 'newline') {
            rowSep = '\n';
        } else if (rowSeparator === 'semicolon') {
            rowSep = ';';
        } else { // custom
            rowSep = customRowSeparator || '\n';
        }
        
        // Split text into rows
        const rows = text.split(rowSep).filter(row => row.trim());
        
        // Determine term/definition separator
        let termDefSep;
        if (termDefSeparator === 'tab') {
            termDefSep = '\t';
        } else if (termDefSeparator === 'comma') {
            termDefSep = ',';
        } else { // custom
            termDefSep = customTermDefSeparator || '\t';
        }
        
        // Parse each row
        for (const row of rows) {
            const trimmedRow = row.trim();
            if (!trimmedRow) continue;
            
            // Split by term/definition separator
            const parts = trimmedRow.split(termDefSep);
            
            if (parts.length >= 2) {
                const term = parts[0].trim();
                const definition = parts.slice(1).join(termDefSep).trim(); // Join back in case separator appears in definition
                
                if (term && definition) {
                    parsed.push({
                        term,
                        definition,
                        termLanguage: settings?.targetLanguage ? getLanguageCode(settings.targetLanguage) : null,
                        definitionLanguage: settings?.nativeLanguage ? getLanguageCode(settings.nativeLanguage) : null
                    });
                }
            }
        }
        
        return parsed;
    };

    // Handle import
    const handleImport = () => {
        if (!importText.trim()) return;
        
        const parsed = parseImportText(importText);
        if (parsed.length === 0) {
            setError('Could not parse any flashcards from the text. Try using tab, comma, dash, or colon separators.');
            return;
        }
        
        setFlashcards(prev => [...prev, ...parsed]);
        setImportText('');
        setShowImport(false);
    };

    // Save set
    const saveSet = async (options = {}) => {
        const { fromStudyModal = false } = options;

        if (!isSignedIn) {
            setError('Please sign in to save flashcard sets');
            return;
        }
        
        if (!setTitle.trim()) {
            setError('Title is required');
            return;
        }
        
        if (flashcards.length === 0) {
            setError('At least one flashcard is required');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        const CHUNK_SIZE = 100; // Send 100 cards per request
        const isNewSet = !currentSet;

        try {
            let setId = currentSet?._id;

            // Step 1: Create the set or update its metadata and first chunk (with retry)
            if (isNewSet) {
                const firstChunk = flashcards.slice(0, CHUNK_SIZE);
                const newSet = await retryUntilSuccess(async () => {
                    const token = await getToken();
                    const response = await fetch(`${API_BASE_URL}/api/flashcards/sets`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            title: setTitle,
                            description: setDescription,
                            isPublic,
                            flashcards: firstChunk,
                            studyOptions
                        })
                    });
                    if (!response.ok) throw new Error('Failed to create flashcard set');
                    return response.json();
                }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });
                setId = newSet._id;
            } else { // It's an existing set
                const firstChunk = flashcards.slice(0, CHUNK_SIZE);
                await retryUntilSuccess(async () => {
                    const token = await getToken();
                    const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${setId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            title: setTitle,
                            description: setDescription,
                            isPublic,
                            flashcards: firstChunk, // This will replace existing cards
                            studyOptions
                        })
                    });
                    if (!response.ok) throw new Error('Failed to update flashcard set');
                }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });
            }

            // Step 2: Upload remaining chunks (each chunk with retry)
            if (flashcards.length > CHUNK_SIZE) {
                for (let i = CHUNK_SIZE; i < flashcards.length; i += CHUNK_SIZE) {
                    const chunk = flashcards.slice(i, i + CHUNK_SIZE);
                    await retryUntilSuccess(async () => {
                        const token = await getToken();
                        const importResponse = await fetch(`${API_BASE_URL}/api/flashcards/sets/${setId}/import`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ flashcards: chunk })
                        });
                        if (!importResponse.ok) throw new Error(`Failed to import chunk starting at index ${i}`);
                    }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });
                }
            }
            
            if (fromStudyModal) {
                await loadSet(setId);
            } else {
                await fetchSets();
                resetCreateState();
                setViewMode('sets');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveStudyOptions = async () => {
        if (!currentSet) return;
        setLoading(true);
        setError(null);
        try {
            // Ensure all learningOptions fields are explicitly included
            const optionsToSave = {
                ...studyOptions,
                learningOptions: {
                    studyStarredOnly: studyOptions.learningOptions?.studyStarredOnly ?? false,
                    shuffle: studyOptions.learningOptions?.shuffle ?? false,
                    studyRangeOnly: studyOptions.learningOptions?.studyRangeOnly ?? { start: '', end: '' },
                    excludeRange: studyOptions.learningOptions?.excludeRange ?? { start: '', end: '' },
                    retypeAnswer: studyOptions.learningOptions?.retypeAnswer ?? true,
                    soundEffects: studyOptions.learningOptions?.soundEffects ?? true,
                }
            };
            
            console.log('Saving study options - soundEffects value:', optionsToSave.learningOptions.soundEffects);

            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${currentSet._id}/user-data`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ studyOptions: optionsToSave })
                });
                if (!response.ok) {
                    throw new Error('Failed to save study options');
                }
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });

            // After saving user-specific options, we need to reload the main set
            // to see the merged view of the data.
            await loadSet(currentSet._id);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Delete set
    const handleDeleteSet = async (setId) => {
        if (!confirm('Are you sure you want to delete this set?')) return;
        
        setLoading(true);
        setError(null);
        try {
            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${setId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Failed to delete flashcard set');
                }
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });

            await fetchSets();
            if (currentSet && currentSet._id === setId) {
                setViewMode('sets');
                resetCreateState();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Add card
    const addCard = () => {
        const newCard = {
            term: '',
            definition: '',
            termLanguage: settings?.targetLanguage ? getLanguageCode(settings.targetLanguage) : null,
            definitionLanguage: settings?.nativeLanguage ? getLanguageCode(settings.nativeLanguage) : null,
            starred: false
        };
        
        setFlashcards(prev => [...prev, newCard]);
        
        // When adding a new card, expand the list if it's collapsed
        if (!showAllCreateEdit) {
            setShowAllCreateEdit(true);
        }
        
        setEditingCardIndex(flashcards.length);
    };

    // Update card
    const updateCard = (index, field, value) => {
        setFlashcards(prev => prev.map((card, i) => 
            i === index ? { ...card, [field]: value } : card
        ));
    };

    // Delete card
    const deleteCard = (index) => {
        setFlashcards(prev => prev.filter((_, i) => i !== index));
    };

    // Toggle star
    const toggleStar = (index) => {
        setFlashcards(prev => prev.map((card, i) => 
            i === index ? { ...card, starred: !card.starred } : card
        ));
    };

    // Play TTS
    const playTTS = (text, languageCode) => {
        if (!text || !languageCode) return;
        speakText(text, languageCode, settings);
    };

    // Play success sound effect
    const playSuccessSound = () => {
        if (!studyOptions.learningOptions?.soundEffects) return;
        try {
            const audio = new Audio('/hero_simple-celebration-01.ogg');
            audio.volume = 1; 
            audio.play().catch(err => {
                console.warn('Could not play success sound:', err);
            });
        } catch (err) {
            console.warn('Error creating audio:', err);
        }
    };

    // Play error sound effect
    const playErrorSound = () => {
        if (!studyOptions.learningOptions?.soundEffects) return;
        try {
            const audio = new Audio('/alert_error-02.ogg');
            audio.volume = 1;
            audio.play().catch(err => {
                console.warn('Could not play error sound:', err);
            });
        } catch (err) {
            console.warn('Error creating audio:', err);
        }
    };

    // Start studying
    const startStudy = useCallback(() => {
        if (!currentSet) return;
        
        setError(null);

        const { studyRangeOnly, excludeRange } = studyOptions.learningOptions;
        let cards;

        const rangeStart = parseInt(studyRangeOnly?.start, 10);
        const rangeEnd = parseInt(studyRangeOnly?.end, 10);

        if (!isNaN(rangeStart) && !isNaN(rangeEnd) && rangeStart > 0 && rangeEnd >= rangeStart) {
            // "Study only" range is active, so we ignore due dates and other filters on the card pool.
            cards = currentSet.flashcards.slice(rangeStart - 1, rangeEnd);
        } else {
            // No "study only" range, so we start with all cards and filter them down.
            let cardPool = [...currentSet.flashcards];

            const excludeStart = parseInt(excludeRange?.start, 10);
            const excludeEnd = parseInt(excludeRange?.end, 10);

            if (!isNaN(excludeStart) && !isNaN(excludeEnd) && excludeStart > 0 && excludeEnd >= excludeStart) {
                cardPool = cardPool.filter((_, index) => {
                    const cardNum = index + 1;
                    return cardNum < excludeStart || cardNum > excludeEnd;
                });
            }
            
            // Filter for due cards
            const now = new Date();
            const dueCards = cardPool.filter(card => 
                !card.nextReviewDate || new Date(card.nextReviewDate) <= now
            );

            // Separate new cards from review cards
            let reviewCards = dueCards.filter(card => card.lastReviewed);
            let newCards = dueCards.filter(card => !card.lastReviewed);

            // Shuffle before picking if the option is enabled
            if (studyOptions.learningOptions.shuffle) {
                reviewCards.sort(() => Math.random() - 0.5);
                newCards.sort(() => Math.random() - 0.5);
            }

            // Prioritize review cards, then fill the round with new cards
            const cardsForRound = reviewCards.slice(0, studyOptions.cardsPerRound);
            const remainingSlots = studyOptions.cardsPerRound - cardsForRound.length;

            if (remainingSlots > 0) {
                cardsForRound.push(...newCards.slice(0, remainingSlots));
            }

            cards = cardsForRound;
        }
        
        // Filter by starred only if option is enabled
        if (studyOptions.learningOptions.studyStarredOnly) {
            cards = cards.filter(card => card.starred);
        }
        
        if (studyOptions.learningOptions.shuffle) {
            // Re-separate into review and new cards to shuffle them independently
            const reviewCardsInSession = cards.filter(card => card.lastReviewed);
            const newCardsInSession = cards.filter(card => !card.lastReviewed);
            
            const shuffledReview = [...reviewCardsInSession].sort(() => Math.random() - 0.5);
            const shuffledNew = [...newCardsInSession].sort(() => Math.random() - 0.5);

            cards = [...shuffledReview, ...shuffledNew];
        }
        
        if (cards.length === 0) {
            setError("No cards to study with the current settings. Try adjusting the study options or wait for cards to become due.");
            return;
        }

        const hasNewCards = cards.some(c => !c.lastReviewed);
        const hasSeenCards = cards.some(c => c.lastReviewed);

        const activeNewCardTypes = Object.entries(studyOptions.newCardQuestionTypes)
            .filter(([, isActive]) => isActive)
            .map(([type]) => type);

        const activeSeenCardTypes = Object.entries(studyOptions.seenCardQuestionTypes)
            .filter(([, isActive]) => isActive)
            .map(([type]) => type);

        if (hasNewCards && activeNewCardTypes.length === 0) {
            setError("Your study session includes new cards, but you have no question types selected for them. Please adjust your study options.");
            return;
        }

        if (hasSeenCards && activeSeenCardTypes.length === 0) {
            setError("Your study session includes review cards, but you have no question types selected for them. Please adjust your study options.");
            return;
        }

        // Assign a random question type to each card for this session
        const cardsWithQuestionTypes = cards.map(card => {
            const isNew = !card.lastReviewed;
            const questionTypes = isNew ? activeNewCardTypes : activeSeenCardTypes;
            const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

            const newCardData = {
                ...card,
                questionType,
            };

            if (questionType === 'trueFalse') {
                // 50% chance of being a correct pair
                const isCorrectPairing = Math.random() < 0.5;
                newCardData.isTrueFalseCorrect = isCorrectPairing;

                if (!isCorrectPairing) {
                    const otherCards = currentSet.flashcards.filter(c => c._id !== card._id);
                    if (otherCards.length > 0) {
                        const randomCard = otherCards[Math.floor(Math.random() * otherCards.length)];
                        newCardData.falsePair = randomCard;
                    } else {
                        // Not enough cards to make a false pair, so force it to be true.
                        newCardData.isTrueFalseCorrect = true;
                    }
                }
            }
            return newCardData;
        });

        setCardsToStudy(cardsWithQuestionTypes);
        setCurrentCardIndex(0);
        setShowAnswer(false);
        setWrittenAnswer('');
        setAnswerFeedback(null);
        setHasFlippedOnce(false);
        setRetypeInputValue('');
        setIsRetypeCorrect(false);
        setShowDontKnowAnswer(false);
        setDontKnowInputValue('');
        setIsDontKnowRetypeCorrect(false);
        if (cardsWithQuestionTypes.length > 0) {
            setCurrentQuestionType(cardsWithQuestionTypes[0].questionType);
        }
        setIsRoundComplete(false);
        setViewMode('study');
    }, [currentSet, studyOptions]);

    useEffect(() => {
        if (studyAction) {
            setStudyAction(null);
            startStudy();
        }
    }, [studyAction, startStudy]);

    useEffect(() => {
        if (viewMode === 'study' && currentQuestionType === 'multipleChoice' && cardsToStudy.length > 0 && currentSet) {
            const currentCard = cardsToStudy[currentCardIndex];
            const isAnswerWithTerm = studyOptions.questionFormat === 'term';
            const answerProperty = isAnswerWithTerm ? 'term' : 'definition';

            const correctAnswer = currentCard[answerProperty];

            let wrongAnswers = currentSet.flashcards
                .map(card => card[answerProperty])
                .filter(ans => ans.trim() !== correctAnswer.trim());

            const uniqueWrongAnswers = [...new Set(wrongAnswers)];
            const shuffledWrongAnswers = uniqueWrongAnswers.sort(() => 0.5 - Math.random());
            const options = [correctAnswer, ...shuffledWrongAnswers.slice(0, 3)];
            
            setMcqOptions(options.sort(() => 0.5 - Math.random()));
        }
    }, [viewMode, currentQuestionType, currentCardIndex, cardsToStudy, currentSet, studyOptions.questionFormat]);

    useEffect(() => {
        if (showAllCreateEdit) {
            let mounted = true;
            let count = 10;
            const increment = 20; // Render in chunks of 20 to avoid freezing

            const renderMore = () => {
                if (!mounted) return;
                
                count = Math.min(count + increment, flashcards.length);
                setRenderedCardCount(count);

                if (count < flashcards.length) {
                    requestAnimationFrame(renderMore);
                }
            };
            
            requestAnimationFrame(renderMore);

            return () => {
                mounted = false;
            };
        } else {
            setRenderedCardCount(10);
        }
    }, [showAllCreateEdit, flashcards.length]);

    useEffect(() => {
        if (showAllCards && currentSet && currentSet.flashcards.length > 50) {
            let mounted = true;
            let count = 10;
            const increment = 20; // Render in chunks of 20

            const renderMore = () => {
                if (!mounted) return;

                count = Math.min(count + increment, currentSet.flashcards.length);
                setRenderedViewCardCount(count);

                if (count < currentSet.flashcards.length) {
                    requestAnimationFrame(renderMore);
                }
            };

            requestAnimationFrame(renderMore);

            return () => {
                mounted = false;
            };
        } else {
            setRenderedViewCardCount(10);
        }
    }, [showAllCards, currentSet]);

    const handleStopStudying = () => {
        setViewMode('view');
        setIsRoundComplete(false);
        setCardsToStudy([]);
    };

    const handleKeepStudying = () => {
        startStudy();
    };

    // Handle review decision
    const handleReviewDecision = async (grade) => {
        if (isProcessingReviewRef.current) return;
        isProcessingReviewRef.current = true;
        
        setIsProcessingReview(true);
        try {
            const card = cardsToStudy[currentCardIndex];
            let cardIndexInSet = currentSet.flashcards.findIndex(c => c._id === card._id);
            
            if (cardIndexInSet === -1) {
                const fallbackIndex = currentSet.flashcards.findIndex(c => c.term === card.term && c.definition === card.definition);
                if (fallbackIndex === -1) throw new Error('Card not found in set');
                cardIndexInSet = fallbackIndex;
            }

            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/cards/${currentSet._id}/${cardIndexInSet}/review`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ grade })
                });
                if (!response.ok) throw new Error('Failed to update review');
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });

            const reviewedCard = cardsToStudy[currentCardIndex];
            if (grade === Grade.Forgot || grade === Grade.Hard) {
                setCardsToStudy(prev => [...prev, reviewedCard]);
            }

            const newCards = cardsToStudy.filter((_, index) => index !== currentCardIndex);
            setCardsToStudy(newCards);
            
            if (newCards.length === 0) {
                setIsRoundComplete(true);
            } else {
                const nextIndex = currentCardIndex >= newCards.length ? 0 : currentCardIndex;
                setCurrentCardIndex(nextIndex);
                setShowAnswer(false);
                setWrittenAnswer('');
                setAnswerFeedback(null);
                setHasFlippedOnce(false);
                setRetypeInputValue('');
                setIsRetypeCorrect(false);
                setShowDontKnowAnswer(false);
                setDontKnowInputValue('');
                setIsDontKnowRetypeCorrect(false);
                setCurrentQuestionType(newCards[nextIndex].questionType);
            }
            
            loadSet(currentSet._id);
        } catch (err) {
            setError(err.message);
        } finally {
            isProcessingReviewRef.current = false;
            setIsProcessingReview(false);
        }
    };

    const handleSkip = () => {
        if (currentQuestionType === 'written') {
            setShowDontKnowAnswer(true);
            return;
        }

        if (cardsToStudy.length === 0) return;

        const newCards = cardsToStudy.filter((_, index) => index !== currentCardIndex);
        setCardsToStudy(newCards);

        if (newCards.length === 0) {
            setIsRoundComplete(true);
        } else {
            const nextIndex = currentCardIndex >= newCards.length ? 0 : currentCardIndex;
            setCurrentCardIndex(nextIndex);
            setShowAnswer(false);
            setWrittenAnswer('');
            setAnswerFeedback(null);
            setHasFlippedOnce(false);
            setRetypeInputValue('');
            setIsRetypeCorrect(false);
            setShowDontKnowAnswer(false);
            setDontKnowInputValue('');
            setIsDontKnowRetypeCorrect(false);
            setCurrentQuestionType(newCards[nextIndex].questionType);
        }
    };

    const handleRealSkip = () => {
        handleReviewDecision(Grade.Forgot);
    };

    const handleSaveCardEdit = async (editedCard) => {
        if (!currentSet || !editedCard) return;
    
        setLoading(true);
        setError(null);
    
        try {
            const cardIndexInSet = currentSet.flashcards.findIndex(c => c._id === editedCard._id);
    
            if (cardIndexInSet === -1) {
                throw new Error("Card not found in the current set.");
            }

            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${currentSet._id}/cards/${cardIndexInSet}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        term: editedCard.term,
                        definition: editedCard.definition,
                        starred: editedCard.starred,
                        termLanguage: editedCard.termLanguage,
                        definitionLanguage: editedCard.definitionLanguage
                    })
                });
                if (!response.ok) {
                    let message = 'Failed to update flashcard.';
                    try {
                        const errorData = await response.json();
                        message = errorData.message || message;
                    } catch (_) {}
                    throw new Error(message);
                }
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });
    
            // Update local state to reflect the change
            const updatedFlashcards = currentSet.flashcards.map(card =>
                card._id === editedCard._id ? { ...card, ...editedCard } : card
            );
            const updatedSet = { ...currentSet, flashcards: updatedFlashcards };
            setCurrentSet(updatedSet);
    
            const updatedCardsToStudy = cardsToStudy.map(card =>
                card._id === editedCard._id ? { ...card, ...editedCard } : card
            );
            setCardsToStudy(updatedCardsToStudy);
    
            setIsEditCardModalOpen(false);
            setCardToEdit(null);
    
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Reset create state
    const resetCreateState = () => {
        setSetTitle('');
        setSetDescription('');
        setIsPublic(true);
        setFlashcards([]);
        setEditingCardIndex(null);
        setCurrentSet(null);
        setImportText('');
        setShowImport(false);
        setStudyOptions(defaultStudyOptions);
        setShowAllCreateEdit(false);
        setRenderedCardCount(10);
    };

    // Render sets list
    const renderSetsList = () => {
        if (loading && sets.length === 0) {
            return <p className="status-message">Loading flashcard sets...</p>;
        }
        
        if (error) {
            return <p className="status-message error">{error}</p>;
        }
        
        if (sets.length === 0) {
            return (
                <div className="initial-state-container">
                    <p className="status-message">No flashcard sets yet. Create one to get started!</p>
                    <button className="generate-button" onClick={() => setViewMode('create')}>
                        Create New Set
                    </button>
                </div>
            );
        }
        
        return (
            <div className="flashcards-sets-list">
                <div className="sets-header">
                    <h2>Your Flashcard Sets</h2>
                    <button className="generate-button" onClick={() => setViewMode('create')}>
                        <Plus size={20} /> Create New Set
                    </button>
                </div>
                <div className="sets-grid">
                    {sets.map(set => (
                        <div key={set._id} className="set-card">
                            <div className="set-card-header">
                                <h3>{set.title}</h3>
                                <div className="set-card-actions">
                                    {set.isPublic ? <Eye size={18} /> : <EyeOff size={18} />}
                                    <button onClick={() => { loadSet(set._id); setViewMode('view'); }}>
                                        <Play size={18} />
                                    </button>
                                    <button onClick={() => { loadSet(set._id); setViewMode('edit'); }}>
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDeleteSet(set._id)}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            <p className="set-description">{set.description || 'No description'}</p>
                            <p className="set-meta">{set.flashcards?.length || 0} cards</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render study options modal
    const renderStudyOptionsModal = () => {
        const isCardsPerRoundInvalid = !studyOptions.cardsPerRound || studyOptions.cardsPerRound < 1;

        const handleSave = async () => {
            if (isCardsPerRoundInvalid) {
                setError('Cards Per Round must be at least 1.');
                return;
            }
            await saveStudyOptions();
            setShowStudyOptionsModal(false);
            setStudyAction('restart');
        };

        const handleCancel = () => {
            if (currentSet) {
                const loadedOptions = currentSet.studyOptions || {};
                const mergedOptions = {
                    ...defaultStudyOptions,
                    ...loadedOptions,
                    newCardQuestionTypes: {
                        ...defaultStudyOptions.newCardQuestionTypes,
                        ...(loadedOptions.newCardQuestionTypes || {}),
                    },
                    seenCardQuestionTypes: {
                        ...defaultStudyOptions.seenCardQuestionTypes,
                        ...(loadedOptions.seenCardQuestionTypes || {}),
                    },
                    learningOptions: {
                        ...defaultStudyOptions.learningOptions,
                        ...(loadedOptions.learningOptions || {}),
                        studyRangeOnly: {
                            ...defaultStudyOptions.learningOptions.studyRangeOnly,
                            ...(loadedOptions.learningOptions?.studyRangeOnly || {}),
                        },
                        excludeRange: {
                            ...defaultStudyOptions.learningOptions.excludeRange,
                            ...(loadedOptions.learningOptions?.excludeRange || {}),
                        },
                        soundEffects: loadedOptions.learningOptions?.soundEffects ?? defaultStudyOptions.learningOptions.soundEffects,
                    },
                };
                setStudyOptions(mergedOptions);
            }
            setShowStudyOptionsModal(false);
        };
        
        const handleBackdropClick = (e) => {
            if (e.target === e.currentTarget) {
                handleCancel();
            }
        };
        
        return (
            <div className="modal-backdrop" onClick={handleBackdropClick}>
                <div className="modal-content study-options-modal">
                    <div className="modal-header">
                        <h3>Study Options</h3>
                        <button onClick={handleCancel} className="close-button"><X size={20} /></button>
                    </div>
                    <div className="modal-scroll-wrapper">
                        {renderStudyOptionsForm(isCardsPerRoundInvalid)}
                    </div>
                    <div className="modal-actions">
                        <button className="generate-button" onClick={handleSave} disabled={loading || isCardsPerRoundInvalid}>
                            {loading ? 'Saving...' : 'Save Options'}
                        </button>
                        <button onClick={handleCancel}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    };

    // Render study options form
    const renderStudyOptionsForm = (isCardsPerRoundInvalid) => (
        <div className="study-options-section">
            <div className="form-group">
                <label>Cards Per Round</label>
                <input
                    type="number"
                    min="1"
                    value={studyOptions.cardsPerRound ?? ''}
                    onChange={(e) => {
                        const value = e.target.value;
                        setStudyOptions(prev => ({ ...prev, cardsPerRound: value === '' ? null : parseInt(value, 10) }));
                    }}
                    className={isCardsPerRoundInvalid ? 'input-error' : ''}
                />
                {isCardsPerRoundInvalid && <p className="error-text" style={{ color: 'var(--color-red)', fontSize: '0.8rem', marginTop: '4px' }}>Must be at least 1.</p>}
            </div>
            <div className="form-group">
                <label>Exam Date (optional)</label>
                <input
                    type="date"
                    value={studyOptions.examDate ? new Date(studyOptions.examDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setStudyOptions(prev => ({ ...prev, examDate: e.target.value ? new Date(e.target.value) : null }))}
                />
            </div>
            <div className="form-group">
                <label>New Cards Per Day</label>
                <input
                    type="number"
                    min="1"
                    value={studyOptions.newCardsPerDay}
                    onChange={(e) => setStudyOptions(prev => ({ ...prev, newCardsPerDay: parseInt(e.target.value) || 10 }))}
                />
            </div>
            <div className="form-group">
                <label>Question Types for New Cards</label>
                <div className="checkbox-group">
                    <div className="toggle-switch-container">
                        <span>Flashcards</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.newCardQuestionTypes.flashcards}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, newCardQuestionTypes: { ...prev.newCardQuestionTypes, flashcards: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Multiple Choice</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.newCardQuestionTypes.multipleChoice}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, newCardQuestionTypes: { ...prev.newCardQuestionTypes, multipleChoice: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Written</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.newCardQuestionTypes.written}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, newCardQuestionTypes: { ...prev.newCardQuestionTypes, written: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>True & False</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.newCardQuestionTypes.trueFalse}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, newCardQuestionTypes: { ...prev.newCardQuestionTypes, trueFalse: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>
            </div>
            <div className="form-group">
                <label>Question Types for Seen Cards</label>
                <div className="checkbox-group">
                    <div className="toggle-switch-container">
                        <span>Flashcards</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.seenCardQuestionTypes.flashcards}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, seenCardQuestionTypes: { ...prev.seenCardQuestionTypes, flashcards: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Multiple Choice</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.seenCardQuestionTypes.multipleChoice}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, seenCardQuestionTypes: { ...prev.seenCardQuestionTypes, multipleChoice: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Written</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.seenCardQuestionTypes.written}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, seenCardQuestionTypes: { ...prev.seenCardQuestionTypes, written: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>True & False</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.seenCardQuestionTypes.trueFalse}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, seenCardQuestionTypes: { ...prev.seenCardQuestionTypes, trueFalse: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>
            </div>
            <div className="form-group">
                <label>Question Format</label>
                <select
                    value={studyOptions.questionFormat}
                    onChange={(e) => setStudyOptions(prev => ({ ...prev, questionFormat: e.target.value }))}
                >
                    <option value="term">Answer with Term</option>
                    <option value="definition">Answer with Definition</option>
                </select>
            </div>
            <div className="form-group">
                <label>Learning Options</label>
                <div className="checkbox-group">
                    <div className="toggle-switch-container">
                        <span>Study starred terms only</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.learningOptions.studyStarredOnly}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, studyStarredOnly: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Shuffle terms</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.learningOptions.shuffle}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, shuffle: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Retype answer if incorrect (for written questions)</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.learningOptions.retypeAnswer}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, retypeAnswer: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Play sound effects</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.learningOptions?.soundEffects ?? true}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, soundEffects: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>
            </div>
            <div className="form-group">
                <label>Study only cards in range</label>
                <div className="range-inputs">
                    <input
                        type="number"
                        min="1"
                        placeholder="Start"
                        value={studyOptions.learningOptions.studyRangeOnly?.start || ''}
                        onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, studyRangeOnly: { ...prev.learningOptions.studyRangeOnly, start: e.target.value } } }))}
                    />
                    <span>-</span>
                    <input
                        type="number"
                        min="1"
                        placeholder="End"
                        value={studyOptions.learningOptions.studyRangeOnly?.end || ''}
                        onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, studyRangeOnly: { ...prev.learningOptions.studyRangeOnly, end: e.target.value } } }))}
                    />
                </div>
            </div>
            <div className="form-group">
                <label>Do not study cards in range</label>
                <div className="range-inputs">
                    <input
                        type="number"
                        min="1"
                        placeholder="Start"
                        value={studyOptions.learningOptions.excludeRange?.start || ''}
                        onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, excludeRange: { ...prev.learningOptions.excludeRange, start: e.target.value } } }))}
                    />
                    <span>-</span>
                    <input
                        type="number"
                        min="1"
                        placeholder="End"
                        value={studyOptions.learningOptions.excludeRange?.end || ''}
                        onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, excludeRange: { ...prev.learningOptions.excludeRange, end: e.target.value } } }))}
                    />
                </div>
            </div>
        </div>
    );

    // Render create/edit form
    const renderCreateEdit = () => {
        const isEdit = !!currentSet;
        
        const cardsToShow = flashcards.slice(0, renderedCardCount);

        return (
            <div className="flashcards-create-edit">
                <div className="create-header">
                    <h2>{isEdit ? 'Edit Set' : 'Create New Set'}</h2>
                    <button className="back-button" onClick={() => { resetCreateState(); setViewMode('sets'); }}>
                        <X size={20} /> Cancel
                    </button>
                </div>
                
                <div className="create-form">
                    <div className="form-group">
                        <label>Title *</label>
                        <input
                            type="text"
                            value={setTitle}
                            onChange={(e) => setSetTitle(e.target.value)}
                            placeholder="Enter set title"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={setDescription}
                            onChange={(e) => setSetDescription(e.target.value)}
                            placeholder="Enter set description (optional)"
                            rows={3}
                        />
                    </div>
                    
                    <div className="form-group">
                        <div className="toggle-switch-container">
                            <span>Make this set public (default: public)</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div className="cards-section">
                        <div className="cards-header">
                            <h3>Flashcards ({flashcards.length})</h3>
                            <div className="cards-actions">
                                <button onClick={() => setShowImport(!showImport)}>
                                    {isEdit ? 'Import More Cards' : 'Import from Text'}
                                </button>
                                <button onClick={addCard}>
                                    <Plus size={18} /> Add Card
                                </button>
                            </div>
                        </div>
                        
                        {showImport && (
                            <div className="import-section">
                                <div className="import-options">
                                    <div className="import-option-group">
                                        <label className="import-option-label">Between Term and Definition:</label>
                                        <div className="radio-group">
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="termDefSep"
                                                    value="tab"
                                                    checked={termDefSeparator === 'tab'}
                                                    onChange={(e) => setTermDefSeparator(e.target.value)}
                                                />
                                                Tab
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="termDefSep"
                                                    value="comma"
                                                    checked={termDefSeparator === 'comma'}
                                                    onChange={(e) => setTermDefSeparator(e.target.value)}
                                                />
                                                Comma
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="termDefSep"
                                                    value="custom"
                                                    checked={termDefSeparator === 'custom'}
                                                    onChange={(e) => setTermDefSeparator(e.target.value)}
                                                />
                                                Custom:
                                                <input
                                                    type="text"
                                                    value={customTermDefSeparator}
                                                    onChange={(e) => setCustomTermDefSeparator(e.target.value)}
                                                    placeholder="Enter separator"
                                                    className="custom-separator-input"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                    <div className="import-option-group">
                                        <label className="import-option-label">Between Rows:</label>
                                        <div className="radio-group">
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="rowSep"
                                                    value="newline"
                                                    checked={rowSeparator === 'newline'}
                                                    onChange={(e) => setRowSeparator(e.target.value)}
                                                />
                                                New Line
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="rowSep"
                                                    value="semicolon"
                                                    checked={rowSeparator === 'semicolon'}
                                                    onChange={(e) => setRowSeparator(e.target.value)}
                                                />
                                                Semicolon
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="rowSep"
                                                    value="custom"
                                                    checked={rowSeparator === 'custom'}
                                                    onChange={(e) => setRowSeparator(e.target.value)}
                                                />
                                                Custom:
                                                <input
                                                    type="text"
                                                    value={customRowSeparator}
                                                    onChange={(e) => setCustomRowSeparator(e.target.value)}
                                                    placeholder="Enter separator"
                                                    className="custom-separator-input"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <textarea
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    placeholder="Paste your flashcards here using the separators configured above."
                                    rows={6}
                                />
                                <div className="import-actions">
                                    <button onClick={handleImport}>Import</button>
                                    <button onClick={() => { 
                                        setShowImport(false); 
                                        setImportText('');
                                        setTermDefSeparator('tab');
                                        setCustomTermDefSeparator('');
                                        setRowSeparator('newline');
                                        setCustomRowSeparator('');
                                    }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {flashcards.length === 0 ? (
                            <p className="status-message">No flashcards yet. Add or import some cards.</p>
                        ) : (
                            <div className="cards-list">
                                {cardsToShow.map((card, index) => {
                                    return (
                                    <div key={index} className={`card-item ${editingCardIndex === index ? 'editing' : ''}`}>
                                        <div className="card-header">
                                            <button onClick={() => toggleStar(index)} className={`star-button ${card.starred ? 'starred' : ''}`}>
                                                <Star size={24} color="#ffdc62" fill={card.starred ? '#ffdc62' : 'none'} />
                                            </button>
                                            <span>Card {index + 1}</span>
                                            <button onClick={() => deleteCard(index)} className="delete-card">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="card-content">
                                            <div className="card-field">
                                                <label>Term</label>
                                                <div className="field-with-tts">
                                                    <textarea
                                                        value={card.term}
                                                        onChange={(e) => updateCard(index, 'term', e.target.value)}
                                                        onInput={(e) => {
                                                            e.target.style.height = 'auto';
                                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                                        }}
                                                        placeholder="Enter term"
                                                        rows={1}
                                                    />
                                                    {card.term && card.termLanguage && (
                                                        <button onClick={() => playTTS(card.term, card.termLanguage)} className="tts-button">
                                                            <Volume2 size={24} color="var(--color-green)" />
                                                        </button>
                                                    )}
                                                </div>
                                                <select
                                                    value={card.termLanguage || ''}
                                                    onChange={(e) => updateCard(index, 'termLanguage', e.target.value || null)}
                                                >
                                                    <option value="">Select language</option>
                                                    {supportedLanguages.map(lang => (
                                                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="card-field">
                                                <label>Definition</label>
                                                <div className="field-with-tts">
                                                    <textarea
                                                        value={card.definition}
                                                        onChange={(e) => updateCard(index, 'definition', e.target.value)}
                                                        onInput={(e) => {
                                                            e.target.style.height = 'auto';
                                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                                        }}
                                                        placeholder="Enter definition"
                                                        rows={1}
                                                    />
                                                    {card.definition && card.definitionLanguage && (
                                                        <button onClick={() => playTTS(card.definition, card.definitionLanguage)} className="tts-button">
                                                            <Volume2 size={24} color="var(--color-green)" />
                                                        </button>
                                                    )}
                                                </div>
                                                <select
                                                    value={card.definitionLanguage || ''}
                                                    onChange={(e) => updateCard(index, 'definitionLanguage', e.target.value || null)}
                                                >
                                                    <option value="">Select language</option>
                                                    {supportedLanguages.map(lang => (
                                                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                        
                        {flashcards.length > 10 && !showAllCreateEdit && (
                            <button className="show-more-button" onClick={() => setShowAllCreateEdit(true)}>
                                Show All {flashcards.length} Cards <ChevronDown size={18} />
                            </button>
                        )}
                        {flashcards.length > 10 && showAllCreateEdit && (
                            <button className="show-more-button" onClick={() => setShowAllCreateEdit(false)}>
                                Show Less <ChevronUp size={18} />
                            </button>
                        )}
                    </div>
                    
                    <div className="form-actions">
                        <button className="generate-button" onClick={saveSet} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Set'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render view mode
    const renderView = () => {
        if (!currentSet) return null;

        const filteredCards = currentSet.flashcards.filter(card => {
            const term = card.term || '';
            const definition = card.definition || '';
            return term.toLowerCase().includes(viewSearchTerm.toLowerCase()) || 
                   definition.toLowerCase().includes(viewSearchTerm.toLowerCase());
        });

        const groupedCards = { 'New': [] };
        FSRS_GRADES.forEach(g => {
            groupedCards[g.label] = [];
        });
        const fallbackGroup = 'Studied';
        groupedCards[fallbackGroup] = [];

        filteredCards.forEach(card => {
            if (!card.lastReviewed) {
                groupedCards['New'].push(card);
                return;
            }
            
            if (card.lastGrade) {
                const gradeInfo = FSRS_GRADES.find(g => g.grade === card.lastGrade);
                if (gradeInfo) {
                    groupedCards[gradeInfo.label].push(card);
                    return;
                }
            }
            
            groupedCards[fallbackGroup].push(card);
        });

        const groupOrder = [...FSRS_GRADES.map(g => g.label), fallbackGroup, 'New'];
        
        // Find the first group with cards to expand it by default
        const firstGroupWithCards = groupOrder.find(groupName => groupedCards[groupName].length > 0);

        return (
            <div className="flashcards-view">
                <div className="view-header">
                    <div>
                        <h2>{currentSet.title}</h2>
                        <p className="set-meta">{currentSet.flashcards.length} cards</p>
                    </div>
                    <div className="view-actions">
                        <button onClick={async () => { await loadSet(currentSet._id); setViewMode('edit'); }}>
                            <Edit2 size={18} /> Edit
                        </button>
                        <button onClick={async () => { await loadSet(currentSet._id); setStudyAction('start'); }}>
                            <Play size={18} /> Study
                        </button>
                        <button onClick={() => setViewMode('sets')}>
                            <X size={18} /> Close
                        </button>
                    </div>
                </div>
                
                {currentSet.description && (
                    <p className="set-description">{currentSet.description}</p>
                )}
                
                <div className="view-search-container">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search cards..."
                        className="view-search-input"
                        value={viewSearchTerm}
                        onChange={(e) => setViewSearchTerm(e.target.value)}
                    />
                </div>

                {filteredCards.length === 0 ? (
                    <p className="status-message">
                        {currentSet.flashcards.length > 0 ? 'No matching cards found.' : 'No flashcards in this set.'}
                    </p>
                ) : (
                    <div className="grouped-cards-container">
                        {groupOrder.map(groupName => {
                            const cardsInGroup = groupedCards[groupName];
                            if (cardsInGroup.length === 0) {
                                return null;
                            }
                            return (
                                <CollapsibleSection 
                                    key={groupName} 
                                    title={`${groupName} (${cardsInGroup.length})`} 
                                    initialCollapsed={groupName !== firstGroupWithCards}
                                >
                                    <div className="cards-list-view">
                                        {cardsInGroup.map((card, index) => (
                                            <div key={index} className="card-item-view">
                                                <div className="card-side card-term">
                                                    {card.starred && <Star size={16} color="#ffdc62" fill="#ffdc62" />}
                                                    <span>{card.term}</span>
                                                    {card.term && card.termLanguage && (
                                                        <button onClick={() => playTTS(card.term, card.termLanguage)} className="tts-button-small">
                                                            <Volume2 size={16} color="var(--color-green)" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="card-side card-definition">
                                                    <span>{card.definition}</span>
                                                    {card.definition && card.definitionLanguage && (
                                                        <button onClick={() => playTTS(card.definition, card.definitionLanguage)} className="tts-button-small">
                                                            <Volume2 size={16} color="var(--color-green)" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleSection>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // Render study mode
    const renderStudy = () => {
        if (!currentSet || (cardsToStudy.length === 0 && !isRoundComplete)) {
            return (
                <div className="initial-state-container">
                    <p className="status-message">No cards to study. Going back to set view.</p>
                    <button onClick={() => setViewMode('view')}>Back</button>
                </div>
            );
        }

        if (isRoundComplete) {
            return (
                <div className="round-complete-container">
                    <h2>Round Complete!</h2>
                    <p>You've finished this round.</p>
                    <div className="round-complete-actions">
                        <button onClick={handleStopStudying}>Stop Studying</button>
                        <button className="generate-button" onClick={handleKeepStudying}>
                            Keep Studying
                        </button>
                    </div>
                </div>
            );
        }
        
        const currentCard = cardsToStudy[currentCardIndex];
        const cardStatus = getCardStatus(currentCard);
        const showTerm = studyOptions.questionFormat === 'term';
        const question = showTerm ? currentCard.definition : currentCard.term;
        const answer = showTerm ? currentCard.term : currentCard.definition;
        const questionLang = showTerm ? currentCard.definitionLanguage : currentCard.termLanguage;
        const answerLang = showTerm ? currentCard.termLanguage : currentCard.definitionLanguage;
        
        const handleWrittenAnswerSubmit = (e) => {
            e.preventDefault();
            const isCorrect = writtenAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
            setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
            setShowAnswer(true);
            if (isCorrect) {
                playSuccessSound();
            } else {
                playErrorSound();
                setIsRetypeCorrect(false);
            }
        };

        const handleMcqAnswer = (selectedOption) => {
            setWrittenAnswer(selectedOption); // Re-use writtenAnswer state for the selected option
            const isCorrect = selectedOption.trim() === answer.trim();
            setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
            setShowAnswer(true);
            if (isCorrect) {
                playSuccessSound();
            } else {
                playErrorSound();
            }
        };

        const handleTrueFalseAnswer = (userAnswer) => {
            const currentCard = cardsToStudy[currentCardIndex];
            const isCorrect = userAnswer === currentCard.isTrueFalseCorrect;
            setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
            setShowAnswer(true);
            if (isCorrect) {
                playSuccessSound();
            } else {
                playErrorSound();
            }
        };

        const gradeIcons = {
            [Grade.Forgot]: <X size={24} />,
            [Grade.Hard]: <AlertTriangle size={24} />,
            [Grade.Good]: <Check size={24} />,
            [Grade.Easy]: <Crown size={24} />,
        };

        const handleAnswer = () => {
            handleReviewDecision(Grade.Forgot);
        };

        return (
            <div className="flashcards-study">
                <div className="study-header">
                    <h2>Studying: {currentSet.title}</h2>
                    <div className="study-header-actions">
                        <button onClick={() => setShowStudyOptionsModal(true)}>
                            <Settings size={18} /> Options
                        </button>
                        <button onClick={() => setViewMode('view')}>
                            <X size={18} /> Exit Study
                        </button>
                    </div>
                </div>
                
                <div className="study-progress">
                    {cardsToStudy.length} cards remaining
                </div>

                {currentQuestionType === 'flashcards' ? (
                    <div className="study-card-container">
                        <div 
                            className={`study-card-flipper ${showAnswer ? 'is-flipped' : ''}`}
                            onClick={() => {
                                if (!showAnswer) {
                                    setHasFlippedOnce(true);
                                }
                                setShowAnswer(prev => !prev);
                            }}
                        >
                            <div className="study-card study-card-front">
                                <div className="card-header-row">
                                    <div className={`card-status-label ${cardStatus.className}`}>{cardStatus.label}</div>
                                    <div className="card-type-label">{showTerm ? 'Definition' : 'Term'}</div>
                                    <button
                                        className="edit-card-button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCardToEdit(currentCard);
                                            setIsEditCardModalOpen(true);
                                        }}
                                        title="Edit this card"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                                <div className="study-question">
                                    <div className="question-text">
                                        {question}
                                        {question && questionLang && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); playTTS(question, questionLang); }} 
                                                className="tts-button-large"
                                            >
                                                <Volume2 size={24} color="var(--color-green)" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="study-card study-card-back">
                                <div className="card-header-row">
                                    <div className={`card-status-label ${cardStatus.className}`}>{cardStatus.label}</div>
                                    <div className="card-type-label">{showTerm ? 'Term' : 'Definition'}</div>
                                    <button
                                        className="edit-card-button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCardToEdit(currentCard);
                                            setIsEditCardModalOpen(true);
                                        }}
                                        title="Edit this card"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                                <div className="study-answer">
                                    <div className={`answer-text`}>
                                        {answer}
                                        {answer && answerLang && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); playTTS(answer, answerLang); }} 
                                                className="tts-button-large"
                                            >
                                                <Volume2 size={24} color="var(--color-green)" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="study-card">
                        <div className="card-header-row">
                            <div className={`card-status-label ${cardStatus.className}`}>{cardStatus.label}</div>
                            <div className="card-type-label">{showTerm ? 'Definition' : 'Term'}</div>
                            <button 
                                className="edit-card-button" 
                                onClick={() => {
                                    setCardToEdit(currentCard);
                                    setIsEditCardModalOpen(true);
                                }}
                                title="Edit this card"
                            >
                                <Edit2 size={18} />
                            </button>
                        </div>
                        <div className="study-question">
                            <div className="question-text">
                                {question}
                                {question && questionLang && (
                                    <button onClick={() => playTTS(question, questionLang)} className="tts-button-large">
                                        <Volume2 size={24} color="var(--color-green)" />
                                    </button>
                                )}
                            </div>
    
                            {currentQuestionType === 'written' && !showAnswer && !showDontKnowAnswer && (
                                <form onSubmit={handleWrittenAnswerSubmit} className="written-answer-form">
                                    <input
                                        type="text"
                                        value={writtenAnswer}
                                        onChange={(e) => setWrittenAnswer(e.target.value)}
                                        placeholder={showTerm ? "Type the term..." : "Type the definition..."}
                                        className={`written-answer-input ${answerFeedback ? (answerFeedback === 'correct' ? 'correct' : 'incorrect') : ''}`}
                                        autoFocus
                                    />
                                    <div className="written-answer-actions">
                                        <button type="button" className="skip-button" onClick={handleSkip}>Don't know</button>
                                        <button type="submit" className="generate-button">Answer</button>
                                    </div>
                                </form>
                            )}

                            {currentQuestionType === 'written' && showDontKnowAnswer && (
                                <div className="retype-answer-form">
                                    <div className="feedback-group">
                                        <p className="feedback-label correct">Correct answer:</p>
                                        <div className="answer-container correct">
                                            {answer}
                                            {answer && answerLang && (
                                                <button onClick={() => playTTS(answer, answerLang)} className="tts-button-large">
                                                    <Volume2 size={24} color="var(--color-green)" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p>Type the correct answer to continue:</p>
                                    <textarea
                                        value={dontKnowInputValue}
                                        onChange={(e) => {
                                            setDontKnowInputValue(e.target.value);
                                            if (e.target.value.trim().toLowerCase() === answer.trim().toLowerCase()) {
                                                setIsDontKnowRetypeCorrect(true);
                                            } else {
                                                setIsDontKnowRetypeCorrect(false);
                                            }
                                        }}
                                        onInput={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                        }}
                                        placeholder={showTerm ? "Retype the term..." : "Retype the definition..."}
                                        className={`retype-answer-input ${isDontKnowRetypeCorrect ? 'correct' : ''}`}
                                        autoFocus
                                        rows={1}
                                    />
                                </div>
                            )}
    
                            {currentQuestionType === 'multipleChoice' && (
                                <div className="mcq-options">
                                    {mcqOptions.map((option, index) => {
                                        const isCorrect = option === answer;
                                        let buttonClass = 'mcq-option';
                                        if (showAnswer) {
                                            if (isCorrect) {
                                                buttonClass += ' correct';
                                            } else if (option === writtenAnswer) {
                                                buttonClass += ' incorrect';
                                            }
                                        }
                                        return (
                                            <button
                                                key={index}
                                                className={buttonClass}
                                                onClick={() => !showAnswer && handleMcqAnswer(option)}
                                                disabled={showAnswer}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {currentQuestionType === 'trueFalse' && !showAnswer && (
                                <div className="true-false-container">
                                    <div className="true-false-proposed-answer">
                                        { currentCard.isTrueFalseCorrect 
                                            ? answer 
                                            : (showTerm ? currentCard.falsePair.term : currentCard.falsePair.definition)
                                        }
                                    </div>
                                    <div className="true-false-actions">
                                        <button onClick={() => handleTrueFalseAnswer(true)} className="tf-button true">True</button>
                                        <button onClick={() => handleTrueFalseAnswer(false)} className="tf-button false">False</button>
                                    </div>
                                </div>
                            )}
                            
                            {showAnswer && (
                                <div className="study-answer">
                                    <hr />
                                    {currentQuestionType === 'trueFalse' ? (
                                        <div className={`answer-feedback ${answerFeedback}`}>
                                            <p>{answerFeedback === 'correct' ? 'Correct!' : 'Incorrect.'} The statement was <strong>{currentCard.isTrueFalseCorrect ? 'True' : 'False'}</strong>.</p>
                                            <div className="correct-pair">
                                                <span>{showTerm ? currentCard.definition : currentCard.term}</span>
                                                <span className="separator">is</span>
                                                <span>{showTerm ? currentCard.term : currentCard.definition}</span>
                                            </div>
                                        </div>
                                    ) : currentQuestionType === 'written' ? (
                                        <div className="written-answer-feedback">
                                            {answerFeedback === 'correct' ? (
                                                <div className="feedback-group">
                                                    <p className="feedback-label correct">You got it right!</p>
                                                    <div className="answer-container correct">
                                                        {answer}
                                                        {answer && answerLang && (
                                                            <button onClick={() => playTTS(answer, answerLang)} className="tts-button-large">
                                                                <Volume2 size={24} color="var(--color-green)" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="feedback-group">
                                                        <p className="feedback-label incorrect">Incorrect answer</p>
                                                        <div className="answer-container incorrect">
                                                            {writtenAnswer}
                                                        </div>
                                                    </div>
                                                    <div className="feedback-group">
                                                        <p className="feedback-label correct">Correct answer</p>
                                                        <div className="answer-container correct">
                                                            {answer}
                                                            {answer && answerLang && (
                                                                <button onClick={() => playTTS(answer, answerLang)} className="tts-button-large">
                                                                    <Volume2 size={24} color="var(--color-green)" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {studyOptions.learningOptions.retypeAnswer && (
                                                        <div className="retype-answer-form">
                                                            <p>Type the correct answer to continue:</p>
                                                            <textarea
                                                                value={retypeInputValue}
                                                                onChange={(e) => {
                                                                    setRetypeInputValue(e.target.value);
                                                                    if (e.target.value.trim().toLowerCase() === answer.trim().toLowerCase()) {
                                                                        setIsRetypeCorrect(true);
                                                                    } else {
                                                                        setIsRetypeCorrect(false);
                                                                    }
                                                                }}
                                                                onInput={(e) => {
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                                                }}
                                                                placeholder={showTerm ? "Retype the term..." : "Retype the definition..."}
                                                                className={`retype-answer-input ${isRetypeCorrect ? 'correct' : ''}`}
                                                                autoFocus
                                                                rows={1}
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`answer-text ${answerFeedback ? (answerFeedback === 'correct' ? 'correct' : 'incorrect') : ''}`}>
                                            {answer}
                                            {answer && (showTerm ? currentCard.termLanguage : currentCard.definitionLanguage) && (
                                                <button onClick={() => playTTS(answer, showTerm ? currentCard.termLanguage : currentCard.definitionLanguage)} className="tts-button-large">
                                                    <Volume2 size={24} color="var(--color-green)" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <div className="study-actions">
                            {!showAnswer && currentQuestionType !== 'written' && currentQuestionType !== 'trueFalse' && (
                                <button className="show-answer-button" onClick={() => setShowAnswer(true)}>
                                    Show Answer
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="study-bottom-actions">
                    {(showAnswer || (currentQuestionType === 'flashcards' && hasFlippedOnce)) || showDontKnowAnswer ? (
                        <div className="grading-container">
                            <div className="grade-buttons">
                                {FSRS_GRADES.map(item => {
                                    const gradeName = Object.keys(Grade).find(key => Grade[key] === item.grade)?.toLowerCase();
                                    const isRetypeRequired = showDontKnowAnswer
                                        ? !isDontKnowRetypeCorrect
                                        : (currentQuestionType === 'written' && 
                                            answerFeedback === 'incorrect' && 
                                            studyOptions.learningOptions.retypeAnswer && 
                                            !isRetypeCorrect);
                                    return (
                                        <button
                                            key={item.grade}
                                            className={`decision-button ${gradeName}`}
                                            onClick={() => handleReviewDecision(item.grade)}
                                            disabled={isProcessingReview || isRetypeRequired}
                                            title={isRetypeRequired ? 'Please type the correct answer above to continue' : ''}
                                        >
                                            <div className="grade-icon">{gradeIcons[item.grade]}</div>
                                            <div className="grade-label">{item.label}</div>
                                        </button>
                                    );
                                })}
                            </div>
                            {showDontKnowAnswer && (
                                <button className="generate-button" onClick={handleRealSkip} disabled={isProcessingReview}>
                                    Skip
                                </button>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };

    if (!isSignedIn) {
        return (
            <div className="initial-state-container">
                <p className="status-message">Please sign in to use Flashcards</p>
            </div>
        );
    }

    return (
        <div className="flashcards-container">
            {error && <div className="error-banner">{error}</div>}
            
            {viewMode === 'study' && showStudyOptionsModal && renderStudyOptionsModal()}
            <EditCardModal 
                isOpen={isEditCardModalOpen}
                onClose={() => {
                    setIsEditCardModalOpen(false);
                    setCardToEdit(null);
                }}
                onSave={handleSaveCardEdit}
                card={cardToEdit}
                loading={loading}
            />
            
            {viewMode === 'sets' && renderSetsList()}
            {(viewMode === 'create' || viewMode === 'edit') && renderCreateEdit()}
            {viewMode === 'view' && renderView()}
            {viewMode === 'study' && renderStudy()}
        </div>
    );
}

export default Flashcards;
