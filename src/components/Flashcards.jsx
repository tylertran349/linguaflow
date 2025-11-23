// src/components/Flashcards.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, Star, X, AlertTriangle, Check, Crown, Plus, Edit2, Trash2, Play, Settings, Eye, EyeOff, ChevronDown, ChevronUp, Search, RotateCcw, Download } from 'lucide-react';
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
        flashcards: false,
        multipleChoice: false,
        written: true,
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
        soundEffects: true,
        autoAdvance: false
    }
};

function Flashcards({ settings, onApiKeyMissing, isSavingSettings, isRetryingSave }) {
    const { isSignedIn } = useUser();
    const { getToken } = useAuth();
    
    // Main state
    const [sets, setSets] = useState([]);
    const [currentSet, setCurrentSet] = useState(null);
    const [viewMode, setViewMode] = useState('sets'); // 'sets', 'create', 'edit', 'study', 'view', 'trash'
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
    const [importTermLanguage, setImportTermLanguage] = useState('');
    const [importDefinitionLanguage, setImportDefinitionLanguage] = useState('');
    const [duplicateHandling, setDuplicateHandling] = useState('keep-new'); // 'keep-existing', 'keep-new', 'keep-both'
    
    // Import confirmation state
    const [showDuplicateConfirmModal, setShowDuplicateConfirmModal] = useState(false);
    const [pendingImportData, setPendingImportData] = useState(null); // { parsed, duplicateCount, duplicateTerms, nonDuplicateCards, nonDuplicateCount }
    const [showAllDuplicates, setShowAllDuplicates] = useState(false);
    const [showAllNonDuplicates, setShowAllNonDuplicates] = useState(false);
    
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
    const handleReviewDecisionRef = useRef(null);

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

    // Trash state
    const [trashSets, setTrashSets] = useState([]);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
    const [setToDelete, setSetToDelete] = useState(null);

    // Card deletion confirmation state
    const [showDeleteCardConfirmModal, setShowDeleteCardConfirmModal] = useState(false);
    const [cardToDelete, setCardToDelete] = useState(null);

    // Export state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportTermDefSeparator, setExportTermDefSeparator] = useState('tab'); // 'tab', 'comma', 'custom'
    const [exportCustomTermDefSeparator, setExportCustomTermDefSeparator] = useState('');
    const [exportRowSeparator, setExportRowSeparator] = useState('newline'); // 'newline', 'semicolon', 'custom'
    const [exportCustomRowSeparator, setExportCustomRowSeparator] = useState('');
    const [exportAlphabeticalOrder, setExportAlphabeticalOrder] = useState(false);
    const [exportTextCopied, setExportTextCopied] = useState(false);

    // Batch keep state
    const [showBatchKeepModal, setShowBatchKeepModal] = useState(false);
    const [batchKeepTermsList, setBatchKeepTermsList] = useState(''); // Comma-separated list of terms to keep
    const [keepStudiedCardsNotInList, setKeepStudiedCardsNotInList] = useState(true); // Toggle to keep studied cards not in list
    const [cardsToRemove, setCardsToRemove] = useState([]); // Cards that will be removed
    const [showAllCardsToRemove, setShowAllCardsToRemove] = useState(false);

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

    // Fetch trash sets when trash view is opened
    useEffect(() => {
        if (viewMode === 'trash' && isSignedIn) {
            fetchTrashSets();
        }
    }, [viewMode, isSignedIn]);

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
            console.log('Loaded autoAdvance value:', loadedOptions.learningOptions?.autoAdvance);
            
            // Merge question types, but ensure at least one is enabled for each category
            const mergedNewCardTypes = {
                ...defaultStudyOptions.newCardQuestionTypes,
                ...(loadedOptions.newCardQuestionTypes || {}),
            };
            const mergedSeenCardTypes = {
                ...defaultStudyOptions.seenCardQuestionTypes,
                ...(loadedOptions.seenCardQuestionTypes || {}),
            };
            
            // If all new card types are disabled, fall back to defaults
            const hasActiveNewCardType = Object.values(mergedNewCardTypes).some(v => v === true);
            if (!hasActiveNewCardType) {
                Object.assign(mergedNewCardTypes, defaultStudyOptions.newCardQuestionTypes);
            }
            
            // If all seen card types are disabled, fall back to defaults
            const hasActiveSeenCardType = Object.values(mergedSeenCardTypes).some(v => v === true);
            if (!hasActiveSeenCardType) {
                Object.assign(mergedSeenCardTypes, defaultStudyOptions.seenCardQuestionTypes);
            }
            
            const mergedOptions = {
                ...defaultStudyOptions,
                ...loadedOptions,
                cardsPerRound: loadedOptions.cardsPerRound || defaultStudyOptions.cardsPerRound,
                newCardQuestionTypes: mergedNewCardTypes,
                seenCardQuestionTypes: mergedSeenCardTypes,
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
                    autoAdvance: loadedOptions.learningOptions?.autoAdvance !== undefined ? loadedOptions.learningOptions.autoAdvance : defaultStudyOptions.learningOptions.autoAdvance,
                },
            };
            console.log('Merged soundEffects value:', mergedOptions.learningOptions.soundEffects);
            setStudyOptions(mergedOptions);
            return data; // Return the loaded set data
        } catch (err) {
            setError(err.message);
            return null;
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
        const rows = text
            .split(rowSep)
            .map(row => row.replace(/\r/g, ''))
            .filter(row => row.trim());
        
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
            const rowContent = row;
            if (!rowContent.trim()) continue;

            // Split by term/definition separator
            const parts = rowContent.split(termDefSep);

            if (parts.length >= 2) {
                const term = parts[0];
                const definition = parts.slice(1).join(termDefSep); // Join back in case separator appears in definition

                if (term.trim() && definition.trim()) {
                    parsed.push({
                        term,
                        definition,
                        termLanguage: importTermLanguage || (settings?.targetLanguage ? getLanguageCode(settings.targetLanguage) : null),
                        definitionLanguage: importDefinitionLanguage || (settings?.nativeLanguage ? getLanguageCode(settings.nativeLanguage) : null)
                    });
                }
            }
        }
        
        return parsed;
    };

    // Handle import - checks for duplicates and shows confirmation if needed
    const handleImport = () => {
        if (!importText.trim()) return;
        
        const parsed = parseImportText(importText);
        if (parsed.length === 0) {
            setError('Could not parse any flashcards from the text. Try using tab, comma, dash, or colon separators.');
            return;
        }
        
        // If "keep-new" is selected, check for duplicates and show confirmation
        if (duplicateHandling === 'keep-new') {
            // Check for duplicates
            const existingTerms = new Map();
            flashcards.forEach((card, index) => {
                const normalizedTerm = card.term?.trim().toLowerCase() || '';
                if (normalizedTerm) {
                    if (!existingTerms.has(normalizedTerm)) {
                        existingTerms.set(normalizedTerm, []);
                    }
                    existingTerms.get(normalizedTerm).push(index);
                }
            });
            
            const duplicateTerms = [];
            const nonDuplicateCards = [];
            
            parsed.forEach(newCard => {
                const normalizedTerm = newCard.term?.trim().toLowerCase() || '';
                if (normalizedTerm && existingTerms.has(normalizedTerm)) {
                    const existingCard = flashcards[existingTerms.get(normalizedTerm)[0]];
                    if (existingCard && !duplicateTerms.find(dt => dt.term.toLowerCase() === normalizedTerm)) {
                        duplicateTerms.push({
                            term: existingCard.term,
                            existingDefinition: existingCard.definition,
                            newDefinition: newCard.definition
                        });
                    }
                } else if (normalizedTerm) {
                    // This is a non-duplicate card
                    nonDuplicateCards.push({
                        term: newCard.term,
                        definition: newCard.definition
                    });
                }
            });
            
            // If duplicates found, show confirmation modal
            if (duplicateTerms.length > 0) {
                setPendingImportData({
                    parsed,
                    duplicateCount: duplicateTerms.length,
                    duplicateTerms: duplicateTerms, // Store all duplicate terms
                    nonDuplicateCards: nonDuplicateCards, // Store all non-duplicate cards
                    nonDuplicateCount: nonDuplicateCards.length
                });
                setShowAllDuplicates(false);
                setShowAllNonDuplicates(false);
                setShowDuplicateConfirmModal(true);
                return;
            }
            
            // No duplicates but still show confirmation with non-duplicate cards if there are any
            if (nonDuplicateCards.length > 0) {
                setPendingImportData({
                    parsed,
                    duplicateCount: 0,
                    duplicateTerms: [],
                    nonDuplicateCards: nonDuplicateCards,
                    nonDuplicateCount: nonDuplicateCards.length
                });
                setShowAllDuplicates(false);
                setShowAllNonDuplicates(false);
                setShowDuplicateConfirmModal(true);
                return;
            }
        }
        
        // No duplicates or not "keep-new", proceed with import
        performImport(parsed);
    };

    // Confirm and proceed with import
    const confirmDuplicateImport = () => {
        if (pendingImportData) {
            performImport(pendingImportData.parsed);
            setShowDuplicateConfirmModal(false);
            setPendingImportData(null);
            setShowAllDuplicates(false);
            setShowAllNonDuplicates(false);
        }
    };

    // Cancel duplicate import
    const cancelDuplicateImport = () => {
        setShowDuplicateConfirmModal(false);
        setPendingImportData(null);
        setShowAllDuplicates(false);
        setShowAllNonDuplicates(false);
    };

    // Perform the actual import (called after confirmation or when no duplicates)
    const performImport = (parsed) => {
        setFlashcards(prev => {
            const newCards = [];
            const existingTerms = new Map(); // Map of normalized term -> array of indices (handles multiple cards with same term)
            const indicesToReplace = new Map(); // Map of index -> new card (for keep-new option, replaces in place)
            const indicesToRemove = new Set(); // Set of indices to remove (for keep-new when there are multiple duplicates)
            
            // Build a map of existing terms (case-insensitive)
            // Store arrays of indices to handle multiple cards with the same term
            prev.forEach((card, index) => {
                const normalizedTerm = card.term?.trim().toLowerCase() || '';
                if (normalizedTerm) {
                    if (!existingTerms.has(normalizedTerm)) {
                        existingTerms.set(normalizedTerm, []);
                    }
                    existingTerms.get(normalizedTerm).push(index);
                }
            });
            
            // Process each parsed card
            parsed.forEach(newCard => {
                const normalizedTerm = newCard.term?.trim().toLowerCase() || '';
                
                if (!normalizedTerm) {
                    // Skip cards without terms
                    return;
                }
                
                const existingIndices = existingTerms.get(normalizedTerm);
                
                if (existingIndices && existingIndices.length > 0) {
                    // Duplicate found - handle based on user's choice
                    if (duplicateHandling === 'keep-existing') {
                        // Skip the new card, keep all existing ones (preserve positions)
                        return;
                    } else if (duplicateHandling === 'keep-new') {
                        // Replace the first occurrence in place to preserve card numbering
                        const firstIndex = existingIndices[0];
                        indicesToReplace.set(firstIndex, newCard);
                        
                        // Mark remaining duplicates for removal (if there are multiple cards with same term)
                        if (existingIndices.length > 1) {
                            for (let i = 1; i < existingIndices.length; i++) {
                                indicesToRemove.add(existingIndices[i]);
                            }
                        }
                    } else if (duplicateHandling === 'keep-both') {
                        // Keep both - add the new card at the end (preserve existing positions)
                        newCards.push(newCard);
                    }
                } else {
                    // No duplicate - add the new card at the end
                    newCards.push(newCard);
                }
            });
            
            // If we need to replace cards in place, do so while preserving positions
            if (duplicateHandling === 'keep-new' && (indicesToReplace.size > 0 || indicesToRemove.size > 0)) {
                // Create new array with replacements in place
                const updatedPrev = prev.map((card, index) => {
                    // Replace in place if marked for replacement, but preserve study progress fields
                    if (indicesToReplace.has(index)) {
                        const newCard = indicesToReplace.get(index);
                        // Preserve study progress and other metadata from the existing card
                        return {
                            ...newCard,
                            // Preserve FSRS study progress fields
                            stability: card.stability,
                            difficulty: card.difficulty,
                            reps: card.reps,
                            lapses: card.lapses,
                            lastReviewed: card.lastReviewed,
                            nextReviewDate: card.nextReviewDate,
                            interval: card.interval,
                            lastGrade: card.lastGrade,
                            // Preserve starred status (user might want to keep it)
                            starred: card.starred
                        };
                    }
                    return card;
                });
                
                // Filter out cards marked for removal (duplicate cards after the first)
                const filtered = updatedPrev.filter((card, index) => {
                    return !indicesToRemove.has(index);
                });
                
                // Add new non-duplicate cards at the end
                return [...filtered, ...newCards];
            } else {
                // For 'keep-existing' or 'keep-both', just add new cards at the end (preserve existing positions)
                return [...prev, ...newCards];
            }
        });
        
        setImportText('');
        setShowImport(false);
        setImportTermLanguage('');
        setImportDefinitionLanguage('');
        setDuplicateHandling('keep-new'); // Reset to default
    };

    // Generate export text based on current options
    const generateExportText = () => {
        if (!currentSet || !currentSet.flashcards || currentSet.flashcards.length === 0) {
            return '';
        }

        // Determine term/definition separator
        let termDefSep;
        if (exportTermDefSeparator === 'tab') {
            termDefSep = '\t';
        } else if (exportTermDefSeparator === 'comma') {
            termDefSep = ',';
        } else { // custom
            termDefSep = exportCustomTermDefSeparator || '\t';
        }

        // Determine row separator
        let rowSep;
        if (exportRowSeparator === 'newline') {
            rowSep = '\n';
        } else if (exportRowSeparator === 'semicolon') {
            rowSep = ';';
        } else { // custom
            rowSep = exportCustomRowSeparator || '\n';
        }

        // Prepare cards for export
        let cardsToExport = [...currentSet.flashcards];

        // Sort alphabetically by term if option is enabled
        if (exportAlphabeticalOrder) {
            cardsToExport.sort((a, b) => {
                const termA = (a.term || '').trim().toLowerCase();
                const termB = (b.term || '').trim().toLowerCase();
                return termA.localeCompare(termB);
            });
        }

        // Generate export text
        return cardsToExport
            .map(card => {
                const term = (card.term || '').trim();
                const definition = (card.definition || '').trim();
                return `${term}${termDefSep}${definition}`;
            })
            .filter(line => line.trim()) // Remove empty lines
            .join(rowSep);
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
                    autoAdvance: studyOptions.learningOptions?.autoAdvance !== undefined ? studyOptions.learningOptions.autoAdvance : false,
                }
            };
            
            console.log('Saving study options - soundEffects value:', optionsToSave.learningOptions.soundEffects);
            console.log('Saving study options - autoAdvance value:', optionsToSave.learningOptions.autoAdvance);

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

    // Fetch trash sets
    const fetchTrashSets = async () => {
        if (!isSignedIn) return;
        
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/api/flashcards/trash`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch trashed flashcard sets');
            }
            
            const data = await response.json();
            setTrashSets(data);
            return true;
        } catch (err) {
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Delete set (move to trash)
    const handleDeleteSet = (setId) => {
        const set = sets.find(s => s._id === setId);
        setSetToDelete(set);
        setShowDeleteConfirmModal(true);
    };

    const confirmDeleteSet = async () => {
        if (!setToDelete) return;
        
        setLoading(true);
        setError(null);
        try {
            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${setToDelete._id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Failed to move flashcard set to trash');
                }
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });

            await fetchSets();
            if (currentSet && currentSet._id === setToDelete._id) {
                setViewMode('sets');
                resetCreateState();
            }
            setShowDeleteConfirmModal(false);
            setSetToDelete(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Restore set from trash
    const handleRestoreSet = async (setId) => {
        setLoading(true);
        setError(null);
        try {
            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${setId}/restore`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Failed to restore flashcard set');
                }
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });

            await fetchTrashSets();
            await fetchSets();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Permanently delete set from trash
    const handlePermanentDeleteSet = (setId) => {
        const set = trashSets.find(s => s._id === setId);
        setSetToDelete(set);
        setShowPermanentDeleteModal(true);
    };

    const confirmPermanentDeleteSet = async () => {
        if (!setToDelete) return;
        
        setLoading(true);
        setError(null);
        try {
            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/trash/${setToDelete._id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Failed to permanently delete flashcard set');
                }
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });

            await fetchTrashSets();
            setShowPermanentDeleteModal(false);
            setSetToDelete(null);
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
        
        const newIndex = flashcards.length;
        setFlashcards(prev => [...prev, newCard]);
        
        // When adding a new card, expand the list if it's collapsed
        if (!showAllCreateEdit) {
            setShowAllCreateEdit(true);
        }
        
        setEditingCardIndex(newIndex);
        
        // Scroll to the newly added card after it's rendered
        // Use requestAnimationFrame to wait for React to render, then try scrolling
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const cardElement = document.getElementById(`flashcard-${newIndex}`);
                if (cardElement) {
                    cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    // If card not found yet (due to progressive rendering), retry after a short delay
                    setTimeout(() => {
                        const retryElement = document.getElementById(`flashcard-${newIndex}`);
                        if (retryElement) {
                            retryElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 300);
                }
            });
        });
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
    const startStudy = useCallback((setToUse = null) => {
        const set = setToUse || currentSet;
        if (!set) return;
        
        setError(null);

        // Helper to check if a date is today (same day, ignoring time)
        const isToday = (date) => {
            if (!date) return false;
            const d = new Date(date);
            const today = new Date();
            return d.getFullYear() === today.getFullYear() &&
                   d.getMonth() === today.getMonth() &&
                   d.getDate() === today.getDate();
        };

        // Count how many new cards have been reviewed today
        // A card was "new" when reviewed if it was its first review (reps === 1) and reviewed today
        const newCardsReviewedToday = set.flashcards.filter(card => 
            card.lastReviewed && 
            isToday(card.lastReviewed) && 
            card.reps === 1
        ).length;

        // Calculate how many new cards can still be shown today
        const newCardsPerDay = studyOptions.newCardsPerDay ?? 10;
        const remainingNewCardsToday = Math.max(0, newCardsPerDay - newCardsReviewedToday);

        const { studyRangeOnly, excludeRange } = studyOptions.learningOptions;
        let cards;

        const rangeStart = parseInt(studyRangeOnly?.start, 10);
        const rangeEnd = parseInt(studyRangeOnly?.end, 10);

        if (!isNaN(rangeStart) && !isNaN(rangeEnd) && rangeStart > 0 && rangeEnd >= rangeStart) {
            // "Study only" range is active, so we ignore due dates and other filters on the card pool.
            const rangeCards = set.flashcards.slice(rangeStart - 1, rangeEnd);
            
            // Still apply newCardsPerDay limit even in range mode
            const rangeReviewCards = rangeCards.filter(card => card.lastReviewed);
            const rangeNewCards = rangeCards.filter(card => !card.lastReviewed);
            
            // Shuffle if enabled
            if (studyOptions.learningOptions.shuffle) {
                rangeReviewCards.sort(() => Math.random() - 0.5);
                rangeNewCards.sort(() => Math.random() - 0.5);
            }
            
            // Prioritize review cards, then add new cards up to the limit
            const rangeCardsForRound = rangeReviewCards.slice(0, studyOptions.cardsPerRound);
            const rangeRemainingSlots = studyOptions.cardsPerRound - rangeCardsForRound.length;
            
            if (rangeRemainingSlots > 0 && remainingNewCardsToday > 0) {
                const rangeNewCardsToAdd = Math.min(rangeRemainingSlots, remainingNewCardsToday);
                rangeCardsForRound.push(...rangeNewCards.slice(0, rangeNewCardsToAdd));
            }
            
            cards = rangeCardsForRound;
        } else {
            // No "study only" range, so we start with all cards and filter them down.
            let cardPool = [...set.flashcards];

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
            // But limit new cards based on newCardsPerDay
            const cardsForRound = reviewCards.slice(0, studyOptions.cardsPerRound);
            const remainingSlots = studyOptions.cardsPerRound - cardsForRound.length;

            if (remainingSlots > 0 && remainingNewCardsToday > 0) {
                // Limit new cards to both remaining slots AND remaining new cards today
                const newCardsToAdd = Math.min(remainingSlots, remainingNewCardsToday);
                cardsForRound.push(...newCards.slice(0, newCardsToAdd));
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
                    const otherCards = set.flashcards.filter(c => c._id !== card._id);
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

    // Calculate which cards should be removed based on the comma-separated list
    const calculateCardsToRemove = useCallback(() => {
        if (!currentSet) {
            setCardsToRemove([]);
            return;
        }

        // If no terms list provided, don't remove anything
        if (!batchKeepTermsList.trim()) {
            setCardsToRemove([]);
            return;
        }

        // Parse the comma-separated list and normalize terms
        // Handle edge cases: empty strings, whitespace-only, duplicates
        const termsToKeep = batchKeepTermsList
            .split(',')
            .map(term => term.trim().toLowerCase())
            .filter(term => term.length > 0); // Remove empty strings after trimming

        // If no valid terms after parsing, don't remove anything (safety check)
        if (termsToKeep.length === 0) {
            setCardsToRemove([]);
            return;
        }

        // Find cards to remove:
        // - Cards that are NOT in the termsToKeep list
        // - If keepStudiedCardsNotInList is true, keep studied cards even if not in list
        // - If keepStudiedCardsNotInList is false, remove all cards not in list (studied or unstudied)
        const cardsToRemoveList = currentSet.flashcards.filter(card => {
            // Handle edge case: card with no term or empty term
            const cardTerm = (card.term || '').trim().toLowerCase();
            if (!cardTerm) {
                // Cards with empty terms should be kept (safety measure)
                return false;
            }
            
            // If card is in the keep list, don't remove it
            if (termsToKeep.includes(cardTerm)) {
                return false;
            }
            
            // Card is not in the keep list
            // If toggle is ON (keepStudiedCardsNotInList = true), keep studied cards
            if (keepStudiedCardsNotInList && card.lastReviewed) {
                return false;
            }
            
            // Remove card (either unstudied or studied with toggle OFF)
            return true;
        });

        setCardsToRemove(cardsToRemoveList);
    }, [currentSet, batchKeepTermsList, keepStudiedCardsNotInList]);

    // Recalculate cards to remove when the terms list, toggle, or current set changes
    useEffect(() => {
        if (showBatchKeepModal && currentSet) {
            calculateCardsToRemove();
        } else if (showBatchKeepModal && !currentSet) {
            // Set was deleted or unloaded, close the modal
            setShowBatchKeepModal(false);
            setBatchKeepTermsList('');
            setKeepStudiedCardsNotInList(true);
            setCardsToRemove([]);
        }
    }, [batchKeepTermsList, keepStudiedCardsNotInList, currentSet, showBatchKeepModal, calculateCardsToRemove]);

    const handleStopStudying = () => {
        setViewMode('view');
        setIsRoundComplete(false);
        setCardsToStudy([]);
    };

    const handleKeepStudying = async () => {
        if (!currentSet) return;
        // Reload the set to ensure we have the latest card data with updated grades
        const freshSet = await loadSet(currentSet._id);
        // Pass the fresh set data directly to startStudy to avoid stale state
        if (freshSet) {
            startStudy(freshSet);
        }
    };

    // Memoized handler for flashcard flip to prevent unnecessary re-renders
    const handleCardFlip = useCallback(() => {
        if (!showAnswer) {
            setHasFlippedOnce(true);
        }
        setShowAnswer(prev => !prev);
    }, [showAnswer]);

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
            
            // Await loadSet to ensure currentSet is updated with the new grade before any new study round starts
            await loadSet(currentSet._id);
        } catch (err) {
            setError(err.message);
        } finally {
            isProcessingReviewRef.current = false;
            setIsProcessingReview(false);
        }
    };

    useEffect(() => {
        handleReviewDecisionRef.current = handleReviewDecision;
    }, [handleReviewDecision]);

    // Ensure inputs are cleared when moving to a different study card
    useEffect(() => {
        if (viewMode !== 'study' || cardsToStudy.length === 0) return;
        // Clear all text inputs specific to answering to avoid bleed-over between cards
        setWrittenAnswer('');
        setRetypeInputValue('');
        setIsRetypeCorrect(false);
        setDontKnowInputValue('');
        setIsDontKnowRetypeCorrect(false);
    }, [viewMode, currentCardIndex, cardsToStudy.length]);

    // Auto-advance after correct retype in "Don't know" scenario
    useEffect(() => {
        if (showDontKnowAnswer && isDontKnowRetypeCorrect && !isProcessingReview && studyOptions.learningOptions?.autoAdvance !== false) {
            const timer = setTimeout(() => {
                handleReviewDecisionRef.current?.(Grade.Forgot);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [showDontKnowAnswer, isDontKnowRetypeCorrect, isProcessingReview, studyOptions.learningOptions?.autoAdvance]);

    // Auto-advance after correct retype in incorrect answer scenario
    useEffect(() => {
        if (
            !showDontKnowAnswer &&
            currentQuestionType === 'written' &&
            answerFeedback === 'incorrect' &&
            showAnswer &&
            isRetypeCorrect &&
            studyOptions.learningOptions?.retypeAnswer &&
            studyOptions.learningOptions?.autoAdvance !== false &&
            !isProcessingReview
        ) {
            const timer = setTimeout(() => {
                handleReviewDecisionRef.current?.(Grade.Forgot);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [showDontKnowAnswer, currentQuestionType, answerFeedback, showAnswer, isRetypeCorrect, studyOptions, isProcessingReview]);

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

    const handleDeleteCardClick = (card) => {
        setCardToDelete(card);
        setShowDeleteCardConfirmModal(true);
    };

    const confirmDeleteCard = async () => {
        if (!cardToDelete) return;
        await handleDeleteCardFromSet(cardToDelete);
        setShowDeleteCardConfirmModal(false);
        setCardToDelete(null);
    };

    const handleDeleteCardFromSet = async (card) => {
        if (!currentSet || !card) return;
    
        setLoading(true);
        setError(null);
    
        try {
            const cardIndexInSet = currentSet.flashcards.findIndex(c => c._id === card._id);
    
            if (cardIndexInSet === -1) {
                throw new Error("Card not found in the current set.");
            }

            await retryUntilSuccess(async () => {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${currentSet._id}/cards/${cardIndexInSet}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    let message = 'Failed to delete flashcard.';
                    try {
                        const errorData = await response.json();
                        message = errorData.message || message;
                    } catch (_) {}
                    throw new Error(message);
                }
            }, { onError: (e) => setError(`Retrying in ${RETRY_DELAY_MS/1000}s: ${e.message}`) });
    
            // Reload the set to reflect the deletion
            await loadSet(currentSet._id);
    
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle batch keep of cards
    const handleBatchKeepCards = async () => {
        if (!currentSet || cardsToRemove.length === 0) return;
        
        // Prevent concurrent executions
        if (loading) return;

        setLoading(true);
        setError(null);

        try {
            // Pre-calculate all indices upfront to avoid issues with shifting indices
            // Map each card to its index in the original set
            const cardIndexMap = new Map();
            cardsToRemove.forEach(card => {
                const index = currentSet.flashcards.findIndex(c => c._id === card._id);
                if (index !== -1) {
                    cardIndexMap.set(card._id, index);
                }
            });

            // Sort cards by index in descending order (delete from highest index first)
            // This ensures that when we delete, indices below don't shift
            const sortedCards = [...cardsToRemove]
                .filter(card => cardIndexMap.has(card._id))
                .sort((a, b) => {
                    const indexA = cardIndexMap.get(a._id);
                    const indexB = cardIndexMap.get(b._id);
                    return indexB - indexA; // Delete from highest index first
                });

            if (sortedCards.length === 0) {
                setError('No valid cards found to delete. The set may have been modified.');
                return;
            }

            // Track successful and failed deletions
            let successCount = 0;
            let failCount = 0;
            const errors = [];

            // Delete each card using the original indices
            // Since we delete from highest to lowest, indices below don't shift
            for (const card of sortedCards) {
                const originalIndex = cardIndexMap.get(card._id);
                
                // Safety check: verify card still exists in the original set
                if (originalIndex === undefined || originalIndex >= currentSet.flashcards.length) {
                    failCount++;
                    errors.push(`Card "${card.term || 'card'}" no longer exists in the set.`);
                    continue;
                }

                // Verify it's the same card (safety check)
                const cardAtIndex = currentSet.flashcards[originalIndex];
                if (!cardAtIndex || cardAtIndex._id !== card._id) {
                    failCount++;
                    errors.push(`Card at index ${originalIndex} does not match expected card.`);
                    continue;
                }

                try {
                    await retryUntilSuccess(async () => {
                        const token = await getToken();
                        const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${currentSet._id}/cards/${originalIndex}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        if (!response.ok) {
                            let message = 'Failed to delete flashcard.';
                            try {
                                const errorData = await response.json();
                                message = errorData.message || message;
                            } catch (_) {}
                            throw new Error(message);
                        }
                    }, { 
                        onError: (e) => {
                            // Log error but continue with other deletions
                            console.warn(`Failed to delete card "${card.term}":`, e.message);
                        }
                    });
                    
                    successCount++;
                } catch (err) {
                    failCount++;
                    errors.push(`Failed to delete "${card.term || 'card'}": ${err.message}`);
                }
            }

            // Reload the set to reflect all deletions
            await loadSet(currentSet._id);
            
            // Show summary message
            if (failCount > 0) {
                // Some failures occurred
                setError(`${successCount} card(s) deleted successfully. ${failCount} card(s) failed to delete. ${errors.slice(0, 3).join(' ')}`);
            } else if (successCount > 0) {
                // All successful - clear any previous errors
                setError(null);
            }
            
            // Close modal and reset state only if all deletions succeeded
            // If there were failures, keep modal open so user can see the error
            if (failCount === 0) {
                setShowBatchKeepModal(false);
                setBatchKeepTermsList('');
                setKeepStudiedCardsNotInList(true);
                setCardsToRemove([]);
                setShowAllCardsToRemove(false);
            }
        } catch (err) {
            setError(err.message || 'An error occurred while deleting cards.');
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
                    <div className="sets-header-actions">
                        <button className="generate-button" onClick={() => setViewMode('trash')}>
                            <Trash2 size={18} /> Trash
                        </button>
                        <button className="generate-button" onClick={() => setViewMode('create')}>
                            <Plus size={20} /> Create New Set
                        </button>
                    </div>
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

    // Render trash view
    const renderTrash = () => {
        if (loading && trashSets.length === 0) {
            return <p className="status-message">Loading trashed sets...</p>;
        }
        
        if (error) {
            return <p className="status-message error">{error}</p>;
        }
        
        if (trashSets.length === 0) {
            return (
                <div className="initial-state-container">
                    <p className="status-message">Trash is empty.</p>
                    <button className="generate-button" onClick={() => setViewMode('sets')}>
                        Back to Sets
                    </button>
                </div>
            );
        }
        
        const formatDate = (date) => {
            if (!date) return 'Unknown';
            const d = new Date(date);
            const now = new Date();
            const daysDiff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
            if (daysDiff === 0) return 'Today';
            if (daysDiff === 1) return 'Yesterday';
            if (daysDiff < 30) return `${daysDiff} days ago`;
            return d.toLocaleDateString();
        };

        const getDaysUntilDeletion = (trashedAt) => {
            if (!trashedAt) return 30;
            const d = new Date(trashedAt);
            const now = new Date();
            const daysDiff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
            return Math.max(0, 30 - daysDiff);
        };
        
        return (
            <div className="flashcards-sets-list">
                <div className="sets-header">
                    <h2>Trash</h2>
                    <button className="generate-button" onClick={() => setViewMode('sets')}>
                        Back to Sets
                    </button>
                </div>
                <div className="sets-grid">
                    {trashSets.map(set => {
                        const daysLeft = getDaysUntilDeletion(set.trashedAt);
                        return (
                            <div key={set._id} className="set-card">
                                <div className="set-card-header">
                                    <h3>{set.title}</h3>
                                    <div className="set-card-actions">
                                        <button onClick={() => handleRestoreSet(set._id)} title="Restore">
                                            <RotateCcw size={18} />
                                        </button>
                                        <button onClick={() => handlePermanentDeleteSet(set._id)} title="Permanently delete">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <p className="set-description">{set.description || 'No description'}</p>
                                <p className="set-meta">{set.flashcards?.length || 0} cards</p>
                                <p className="trash-meta">
                                    Trashed: {formatDate(set.trashedAt)} • Auto-deletes in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Render delete confirmation modal
    const renderDeleteConfirmModal = () => {
        if (!showDeleteConfirmModal || !setToDelete) return null;
        
        const handleBackdropClick = (e) => {
            if (e.target === e.currentTarget) {
                setShowDeleteConfirmModal(false);
                setSetToDelete(null);
            }
        };
        
        return (
            <div className="modal-backdrop" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>Move to Trash</h3>
                        <button onClick={() => { setShowDeleteConfirmModal(false); setSetToDelete(null); }} className="close-button">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <p>Are you sure you want to move "{setToDelete.title}" to trash?</p>
                        <p className="modal-hint">Items in trash are automatically deleted after 30 days. You can restore them before then.</p>
                    </div>
                    <div className="modal-actions">
                        <button className="generate-button delete-button" onClick={confirmDeleteSet} disabled={loading}>
                            {loading ? 'Moving...' : 'Move to Trash'}
                        </button>
                        <button onClick={() => { setShowDeleteConfirmModal(false); setSetToDelete(null); }}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render permanent delete confirmation modal
    const renderPermanentDeleteModal = () => {
        if (!showPermanentDeleteModal || !setToDelete) return null;
        
        const handleBackdropClick = (e) => {
            if (e.target === e.currentTarget) {
                setShowPermanentDeleteModal(false);
                setSetToDelete(null);
            }
        };
        
        return (
            <div className="modal-backdrop" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>Permanently Delete</h3>
                        <button onClick={() => { setShowPermanentDeleteModal(false); setSetToDelete(null); }} className="close-button">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <p>Are you sure you want to permanently delete "{setToDelete.title}"?</p>
                        <p className="modal-hint" style={{ color: 'var(--color-red)' }}>This action cannot be undone. All cards in this set will be permanently deleted.</p>
                    </div>
                    <div className="modal-actions">
                        <button className="generate-button delete-button" onClick={confirmPermanentDeleteSet} disabled={loading}>
                            {loading ? 'Deleting...' : 'Permanently Delete'}
                        </button>
                        <button onClick={() => { setShowPermanentDeleteModal(false); setSetToDelete(null); }}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render card deletion confirmation modal
    const renderDeleteCardConfirmModal = () => {
        if (!showDeleteCardConfirmModal || !cardToDelete) return null;
        
        const handleBackdropClick = (e) => {
            if (e.target === e.currentTarget) {
                setShowDeleteCardConfirmModal(false);
                setCardToDelete(null);
            }
        };
        
        return (
            <div className="modal-backdrop" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>Delete Flashcard</h3>
                        <button onClick={() => { setShowDeleteCardConfirmModal(false); setCardToDelete(null); }} className="close-button">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <p>Are you sure you want to delete this flashcard?</p>
                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Term:</p>
                            <p style={{ margin: '0 0 12px 0' }}>{cardToDelete.term}</p>
                            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Definition:</p>
                            <p style={{ margin: 0 }}>{cardToDelete.definition}</p>
                        </div>
                        <p className="modal-hint" style={{ color: 'var(--color-red)', marginTop: '12px' }}>This action cannot be undone.</p>
                    </div>
                    <div className="modal-actions">
                        <button className="generate-button delete-button" onClick={confirmDeleteCard} disabled={loading}>
                            {loading ? 'Deleting...' : 'Delete'}
                        </button>
                        <button onClick={() => { setShowDeleteCardConfirmModal(false); setCardToDelete(null); }}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render duplicate confirmation modal
    const renderDuplicateConfirmModal = () => {
        if (!showDuplicateConfirmModal || !pendingImportData) return null;
        
        const handleBackdropClick = (e) => {
            if (e.target === e.currentTarget) {
                cancelDuplicateImport();
            }
        };
        
        return (
            <div className="modal-backdrop" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>{pendingImportData.duplicateCount > 0 ? 'Duplicate Terms Found' : 'Import Cards'}</h3>
                        <button onClick={cancelDuplicateImport} className="close-button">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        {pendingImportData.duplicateCount > 0 && (
                            <>
                                <p>
                                    {pendingImportData.duplicateCount === 1 
                                        ? '1 duplicate term was found.' 
                                        : `${pendingImportData.duplicateCount} duplicate terms were found.`}
                                </p>
                                <p className="modal-hint">
                                    The definitions for these terms will be replaced with the new definitions from your import.
                                </p>
                            </>
                        )}
                        {pendingImportData.duplicateTerms.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                <div style={{ 
                                    maxHeight: '300px', 
                                    overflowY: 'auto',
                                    padding: '12px', 
                                    backgroundColor: 'var(--color-bg-secondary)', 
                                    borderRadius: '4px',
                                    fontSize: '0.9rem'
                                }}>
                                    {(showAllDuplicates ? pendingImportData.duplicateTerms : pendingImportData.duplicateTerms.slice(0, 10)).map((dup, idx) => {
                                        const displayedDuplicates = showAllDuplicates ? pendingImportData.duplicateTerms : pendingImportData.duplicateTerms.slice(0, 10);
                                        return (
                                            <div key={idx} style={{ marginBottom: idx < displayedDuplicates.length - 1 ? '12px' : '0' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dup.term}</div>
                                                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '2px' }}>
                                                    Current: {dup.existingDefinition}
                                                </div>
                                                <div style={{ color: 'var(--color-green)', fontSize: '0.85rem' }}>
                                                    New: {dup.newDefinition}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {pendingImportData.duplicateCount > 10 && !showAllDuplicates && (
                                        <div style={{ 
                                            marginTop: '12px', 
                                            paddingTop: '12px', 
                                            borderTop: '1px solid var(--color-border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <div style={{ 
                                                color: 'var(--color-text-secondary)',
                                                fontSize: '0.85rem',
                                                fontStyle: 'italic'
                                            }}>
                                                ...and {pendingImportData.duplicateCount - 10} more duplicate term{pendingImportData.duplicateCount - 10 !== 1 ? 's' : ''}
                                            </div>
                                            <button
                                                onClick={() => setShowAllDuplicates(true)}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: 'var(--color-green)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Show All {pendingImportData.duplicateCount} Duplicate Terms
                                            </button>
                                        </div>
                                    )}
                                    {showAllDuplicates && pendingImportData.duplicateCount > 10 && (
                                        <div style={{ 
                                            marginTop: '12px', 
                                            paddingTop: '12px', 
                                            borderTop: '1px solid var(--color-border)',
                                            display: 'flex',
                                            justifyContent: 'center'
                                        }}>
                                            <button
                                                onClick={() => setShowAllDuplicates(false)}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: 'var(--color-bg-secondary)',
                                                    color: 'var(--color-text)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Show Less
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {pendingImportData.nonDuplicateCount > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <p style={{ marginBottom: '12px', fontWeight: 'bold' }}>
                                    {pendingImportData.nonDuplicateCount === 1 
                                        ? '1 new card will be added:' 
                                        : `${pendingImportData.nonDuplicateCount} new cards will be added:`}
                                </p>
                                <div style={{ 
                                    maxHeight: '300px', 
                                    overflowY: 'auto',
                                    padding: '12px', 
                                    backgroundColor: 'var(--color-bg-secondary)', 
                                    borderRadius: '4px',
                                    fontSize: '0.9rem'
                                }}>
                                    {(showAllNonDuplicates ? pendingImportData.nonDuplicateCards : pendingImportData.nonDuplicateCards.slice(0, 10)).map((card, idx) => {
                                        const displayedCards = showAllNonDuplicates ? pendingImportData.nonDuplicateCards : pendingImportData.nonDuplicateCards.slice(0, 10);
                                        return (
                                            <div key={idx} style={{ marginBottom: idx < displayedCards.length - 1 ? '12px' : '0' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{card.term}</div>
                                                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                                    {card.definition}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {pendingImportData.nonDuplicateCount > 10 && !showAllNonDuplicates && (
                                        <div style={{ 
                                            marginTop: '12px', 
                                            paddingTop: '12px', 
                                            borderTop: '1px solid var(--color-border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <div style={{ 
                                                color: 'var(--color-text-secondary)',
                                                fontSize: '0.85rem',
                                                fontStyle: 'italic'
                                            }}>
                                                ...and {pendingImportData.nonDuplicateCount - 10} more card{pendingImportData.nonDuplicateCount - 10 !== 1 ? 's' : ''}
                                            </div>
                                            <button
                                                onClick={() => setShowAllNonDuplicates(true)}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: 'var(--color-green)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Show All {pendingImportData.nonDuplicateCount} Cards
                                            </button>
                                        </div>
                                    )}
                                    {showAllNonDuplicates && pendingImportData.nonDuplicateCount > 10 && (
                                        <div style={{ 
                                            marginTop: '12px', 
                                            paddingTop: '12px', 
                                            borderTop: '1px solid var(--color-border)',
                                            display: 'flex',
                                            justifyContent: 'center'
                                        }}>
                                            <button
                                                onClick={() => setShowAllNonDuplicates(false)}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: 'var(--color-bg-secondary)',
                                                    color: 'var(--color-text)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Show Less
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-actions">
                        <button className="generate-button" onClick={confirmDuplicateImport}>
                            Confirm
                        </button>
                        <button onClick={cancelDuplicateImport}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render export modal
    const renderExportModal = () => {
        if (!showExportModal || !currentSet) return null;
        
        const handleBackdropClick = (e) => {
            if (e.target === e.currentTarget) {
                setShowExportModal(false);
                setExportTextCopied(false);
            }
        };

        const handleClose = () => {
            setShowExportModal(false);
            setExportTextCopied(false);
        };
        
        return (
            <div className="modal-backdrop" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>Export Flashcards</h3>
                        <button onClick={handleClose} className="close-button">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="export-options-section">
                            <div className="form-group">
                                <label>Between Term and Definition:</label>
                                <div className="radio-group">
                                    <label>
                                        <input
                                            type="radio"
                                            name="exportTermDefSep"
                                            value="tab"
                                            checked={exportTermDefSeparator === 'tab'}
                                            onChange={(e) => setExportTermDefSeparator(e.target.value)}
                                        />
                                        Tab
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="exportTermDefSep"
                                            value="comma"
                                            checked={exportTermDefSeparator === 'comma'}
                                            onChange={(e) => setExportTermDefSeparator(e.target.value)}
                                        />
                                        Comma
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="exportTermDefSep"
                                            value="custom"
                                            checked={exportTermDefSeparator === 'custom'}
                                            onChange={(e) => setExportTermDefSeparator(e.target.value)}
                                        />
                                        Custom:
                                        <input
                                            type="text"
                                            value={exportCustomTermDefSeparator}
                                            onChange={(e) => setExportCustomTermDefSeparator(e.target.value)}
                                            placeholder="Enter separator"
                                            className="custom-separator-input"
                                            disabled={exportTermDefSeparator !== 'custom'}
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Between Rows:</label>
                                <div className="radio-group">
                                    <label>
                                        <input
                                            type="radio"
                                            name="exportRowSep"
                                            value="newline"
                                            checked={exportRowSeparator === 'newline'}
                                            onChange={(e) => setExportRowSeparator(e.target.value)}
                                        />
                                        New Line
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="exportRowSep"
                                            value="semicolon"
                                            checked={exportRowSeparator === 'semicolon'}
                                            onChange={(e) => setExportRowSeparator(e.target.value)}
                                        />
                                        Semicolon
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="exportRowSep"
                                            value="custom"
                                            checked={exportRowSeparator === 'custom'}
                                            onChange={(e) => setExportRowSeparator(e.target.value)}
                                        />
                                        Custom:
                                        <input
                                            type="text"
                                            value={exportCustomRowSeparator}
                                            onChange={(e) => setExportCustomRowSeparator(e.target.value)}
                                            placeholder="Enter separator"
                                            className="custom-separator-input"
                                            disabled={exportRowSeparator !== 'custom'}
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="form-group">
                                <div className="toggle-switch-container">
                                    <span>List terms in alphabetical order</span>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={exportAlphabeticalOrder}
                                            onChange={(e) => setExportAlphabeticalOrder(e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label>Export Text (select all and copy):</label>
                                <button
                                    className="generate-button"
                                    onClick={async () => {
                                        const text = generateExportText();
                                        try {
                                            await navigator.clipboard.writeText(text);
                                            setExportTextCopied(true);
                                            setTimeout(() => setExportTextCopied(false), 2000);
                                        } catch (err) {
                                            // Fallback for older browsers
                                            const textarea = document.createElement('textarea');
                                            textarea.value = text;
                                            textarea.style.position = 'fixed';
                                            textarea.style.opacity = '0';
                                            document.body.appendChild(textarea);
                                            textarea.select();
                                            try {
                                                document.execCommand('copy');
                                                setExportTextCopied(true);
                                                setTimeout(() => setExportTextCopied(false), 2000);
                                            } catch (e) {
                                                setError('Failed to copy text');
                                            }
                                            document.body.removeChild(textarea);
                                        }
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    {exportTextCopied ? (
                                        <>
                                            <Check size={16} /> Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} /> Copy
                                        </>
                                    )}
                                </button>
                            </div>
                            <textarea
                                readOnly
                                value={generateExportText()}
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    padding: '12px',
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    resize: 'vertical'
                                }}
                                onClick={(e) => e.target.select()}
                            />
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button onClick={handleClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render batch keep modal
    const renderBatchKeepModal = () => {
        if (!showBatchKeepModal || !currentSet) return null;
        
        const handleBackdropClick = (e) => {
            // Prevent closing during deletion
            if (loading) return;
            if (e.target === e.currentTarget) {
                setShowBatchKeepModal(false);
                setBatchKeepTermsList('');
                setKeepStudiedCardsNotInList(true);
                setCardsToRemove([]);
                setShowAllCardsToRemove(false);
            }
        };

        const handleClose = () => {
            // Prevent closing during deletion
            if (loading) return;
            setShowBatchKeepModal(false);
            setBatchKeepTermsList('');
            setKeepStudiedCardsNotInList(true);
            setCardsToRemove([]);
            setShowAllCardsToRemove(false);
        };

        return (
            <div className="modal-backdrop" onClick={handleBackdropClick}>
                <div className="modal-content" style={{ maxWidth: '800px' }}>
                    <div className="modal-header">
                        <h3>Batch Keep Flashcards</h3>
                        <button onClick={handleClose} className="close-button">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>
                                <strong>Terms to Keep (comma-separated):</strong>
                            </label>
                            <p className="modal-hint" style={{ marginBottom: '12px', fontSize: '0.9rem' }}>
                                Enter a comma-separated list of terms you want to KEEP. Cards that are NOT in this list will be removed based on the setting below.
                            </p>
                            <textarea
                                value={batchKeepTermsList}
                                onChange={(e) => {
                                    setBatchKeepTermsList(e.target.value);
                                }}
                                placeholder="term1, term2, term3, ..."
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                        
                        <div className="form-group" style={{ marginTop: '20px' }}>
                            <label>
                                <strong>Keep studied cards not in list</strong>
                            </label>
                            <div className="toggle-switch-container" style={{ marginTop: '8px' }}>
                                <span style={{ flex: 1 }}>
                                    <p className="modal-hint" style={{ marginTop: '0', fontSize: '0.85rem', marginBottom: '8px' }}>
                                        {keepStudiedCardsNotInList 
                                            ? 'Studied cards that are not in your list will be kept. Only unstudied cards not in the list will be removed.'
                                            : 'All cards (studied and unstudied) that are not in your list will be removed.'}
                                    </p>
                                </span>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={keepStudiedCardsNotInList}
                                        onChange={(e) => {
                                            setKeepStudiedCardsNotInList(e.target.checked);
                                        }}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>
                        
                        {cardsToRemove.length > 0 && (
                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label>
                                    <strong>Cards to be Removed ({cardsToRemove.length}):</strong>
                                </label>
                                <div style={{ 
                                    marginTop: '12px', 
                                    maxHeight: '400px', 
                                    overflowY: 'auto',
                                    padding: '12px',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    borderRadius: '4px',
                                    border: '1px solid var(--color-border)'
                                }}>
                                    {(showAllCardsToRemove ? cardsToRemove : cardsToRemove.slice(0, 50)).map((card, index) => {
                                        const displayedCards = showAllCardsToRemove ? cardsToRemove : cardsToRemove.slice(0, 50);
                                        return (
                                            <div key={index} style={{ 
                                                marginBottom: index < displayedCards.length - 1 ? '12px' : '0',
                                                paddingBottom: index < displayedCards.length - 1 ? '12px' : '0',
                                                borderBottom: index < displayedCards.length - 1 ? '1px solid var(--color-border)' : 'none'
                                            }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{card.term}</div>
                                                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{card.definition}</div>
                                            </div>
                                        );
                                    })}
                                    {cardsToRemove.length > 50 && !showAllCardsToRemove && (
                                        <div style={{ 
                                            marginTop: '12px', 
                                            paddingTop: '12px', 
                                            borderTop: '1px solid var(--color-border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <div style={{ 
                                                color: 'var(--color-text-secondary)',
                                                fontSize: '0.9rem',
                                                fontStyle: 'italic'
                                            }}>
                                                ...and {cardsToRemove.length - 50} more cards
                                            </div>
                                            <button
                                                onClick={() => setShowAllCardsToRemove(true)}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: 'var(--color-green)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Show All {cardsToRemove.length} Cards
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {batchKeepTermsList.trim() && cardsToRemove.length === 0 && (
                            <div style={{ 
                                marginTop: '12px', 
                                padding: '12px', 
                                backgroundColor: 'var(--color-bg-secondary)', 
                                borderRadius: '4px',
                                color: 'var(--color-text-secondary)'
                            }}>
                                No cards will be removed. All cards match terms in your list.
                            </div>
                        )}

                        {!batchKeepTermsList.trim() && (
                            <div style={{ 
                                marginTop: '12px', 
                                padding: '12px', 
                                backgroundColor: 'var(--color-bg-secondary)', 
                                borderRadius: '4px',
                                color: 'var(--color-text-secondary)'
                            }}>
                                Enter a comma-separated list of terms above to see which cards will be removed.
                            </div>
                        )}
                    </div>
                    <div className="modal-actions">
                        <button 
                            className="generate-button delete-button" 
                            onClick={handleBatchKeepCards} 
                            disabled={loading || cardsToRemove.length === 0}
                        >
                            {loading ? 'Removing...' : `Remove ${cardsToRemove.length} Card${cardsToRemove.length !== 1 ? 's' : ''}`}
                        </button>
                        <button onClick={handleClose}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render study options modal
    const renderStudyOptionsModal = () => {
        const isCardsPerRoundInvalid = !studyOptions.cardsPerRound || studyOptions.cardsPerRound < 1;

        // Validate study range
        const studyRangeStart = studyOptions.learningOptions.studyRangeOnly?.start;
        const studyRangeEnd = studyOptions.learningOptions.studyRangeOnly?.end;
        const studyRangeStartNum = studyRangeStart ? parseInt(studyRangeStart, 10) : null;
        const studyRangeEndNum = studyRangeEnd ? parseInt(studyRangeEnd, 10) : null;
        
        const studyRangeStartInvalid = studyRangeStart && (isNaN(studyRangeStartNum) || studyRangeStartNum < 1);
        const studyRangeEndInvalid = studyRangeEnd && (isNaN(studyRangeEndNum) || studyRangeEndNum < 1);
        const studyRangeOrderInvalid = studyRangeStartNum && studyRangeEndNum && studyRangeEndNum < studyRangeStartNum;
        const isStudyRangeInvalid = studyRangeStartInvalid || studyRangeEndInvalid || studyRangeOrderInvalid;

        // Validate exclude range
        const excludeRangeStart = studyOptions.learningOptions.excludeRange?.start;
        const excludeRangeEnd = studyOptions.learningOptions.excludeRange?.end;
        const excludeRangeStartNum = excludeRangeStart ? parseInt(excludeRangeStart, 10) : null;
        const excludeRangeEndNum = excludeRangeEnd ? parseInt(excludeRangeEnd, 10) : null;
        
        const excludeRangeStartInvalid = excludeRangeStart && (isNaN(excludeRangeStartNum) || excludeRangeStartNum < 1);
        const excludeRangeEndInvalid = excludeRangeEnd && (isNaN(excludeRangeEndNum) || excludeRangeEndNum < 1);
        const excludeRangeOrderInvalid = excludeRangeStartNum && excludeRangeEndNum && excludeRangeEndNum < excludeRangeStartNum;
        const isExcludeRangeInvalid = excludeRangeStartInvalid || excludeRangeEndInvalid || excludeRangeOrderInvalid;

        const hasValidationErrors = isCardsPerRoundInvalid || isStudyRangeInvalid || isExcludeRangeInvalid;

        const handleSave = async () => {
            if (isCardsPerRoundInvalid) {
                setError('Cards Per Round must be at least 1.');
                return;
            }
            
            if (isStudyRangeInvalid) {
                if (studyRangeStartInvalid) {
                    setError('Study range start value must be at least 1.');
                } else if (studyRangeEndInvalid) {
                    setError('Study range end value must be at least 1.');
                } else if (studyRangeOrderInvalid) {
                    setError('Study range end value must be greater than or equal to start value.');
                }
                return;
            }
            
            if (isExcludeRangeInvalid) {
                if (excludeRangeStartInvalid) {
                    setError('Exclude range start value must be at least 1.');
                } else if (excludeRangeEndInvalid) {
                    setError('Exclude range end value must be at least 1.');
                } else if (excludeRangeOrderInvalid) {
                    setError('Exclude range end value must be greater than or equal to start value.');
                }
                return;
            }
            
            // Validate that at least one question type is selected for new cards
            const hasActiveNewCardType = Object.values(studyOptions.newCardQuestionTypes).some(v => v === true);
            if (!hasActiveNewCardType) {
                setError('Please select at least one question type for new cards.');
                return;
            }
            
            // Validate that at least one question type is selected for seen cards
            const hasActiveSeenCardType = Object.values(studyOptions.seenCardQuestionTypes).some(v => v === true);
            if (!hasActiveSeenCardType) {
                setError('Please select at least one question type for review cards.');
                return;
            }
            
            // Ensure newCardsPerDay is valid before saving
            if (!studyOptions.newCardsPerDay || studyOptions.newCardsPerDay < 1) {
                setStudyOptions(prev => ({ ...prev, newCardsPerDay: 10 }));
            }
            
            await saveStudyOptions();
            setShowStudyOptionsModal(false);
            setStudyAction('restart');
        };

        const handleCancel = () => {
            if (currentSet) {
                const loadedOptions = currentSet.studyOptions || {};
                
                // Merge question types, but ensure at least one is enabled for each category
                const mergedNewCardTypes = {
                    ...defaultStudyOptions.newCardQuestionTypes,
                    ...(loadedOptions.newCardQuestionTypes || {}),
                };
                const mergedSeenCardTypes = {
                    ...defaultStudyOptions.seenCardQuestionTypes,
                    ...(loadedOptions.seenCardQuestionTypes || {}),
                };
                
                // If all new card types are disabled, fall back to defaults
                const hasActiveNewCardType = Object.values(mergedNewCardTypes).some(v => v === true);
                if (!hasActiveNewCardType) {
                    Object.assign(mergedNewCardTypes, defaultStudyOptions.newCardQuestionTypes);
                }
                
                // If all seen card types are disabled, fall back to defaults
                const hasActiveSeenCardType = Object.values(mergedSeenCardTypes).some(v => v === true);
                if (!hasActiveSeenCardType) {
                    Object.assign(mergedSeenCardTypes, defaultStudyOptions.seenCardQuestionTypes);
                }
                
                const mergedOptions = {
                    ...defaultStudyOptions,
                    ...loadedOptions,
                    newCardQuestionTypes: mergedNewCardTypes,
                    seenCardQuestionTypes: mergedSeenCardTypes,
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
                        autoAdvance: loadedOptions.learningOptions?.autoAdvance !== undefined ? loadedOptions.learningOptions.autoAdvance : defaultStudyOptions.learningOptions.autoAdvance,
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
                        {renderStudyOptionsForm({
                            isCardsPerRoundInvalid,
                            studyRangeStartInvalid,
                            studyRangeEndInvalid,
                            studyRangeOrderInvalid,
                            excludeRangeStartInvalid,
                            excludeRangeEndInvalid,
                            excludeRangeOrderInvalid
                        })}
                    </div>
                    <div className="modal-actions">
                        <button className="generate-button" onClick={handleSave} disabled={loading || hasValidationErrors}>
                            {loading ? 'Saving...' : 'Save Options'}
                        </button>
                        <button onClick={handleCancel}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    };

    // Render study options form
    const renderStudyOptionsForm = (validation) => {
        const {
            isCardsPerRoundInvalid,
            studyRangeStartInvalid,
            studyRangeEndInvalid,
            studyRangeOrderInvalid,
            excludeRangeStartInvalid,
            excludeRangeEndInvalid,
            excludeRangeOrderInvalid
        } = validation;

        return (
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
                <label>Maximum Number of New Cards Per Day</label>
                <input
                    type="number"
                    min="1"
                    value={studyOptions.newCardsPerDay ?? ''}
                    onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                            setStudyOptions(prev => ({ ...prev, newCardsPerDay: null }));
                        } else {
                            const numValue = parseInt(value, 10);
                            if (!isNaN(numValue) && numValue >= 1) {
                                setStudyOptions(prev => ({ ...prev, newCardsPerDay: numValue }));
                            }
                        }
                    }}
                    onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || isNaN(parseInt(value, 10)) || parseInt(value, 10) < 1) {
                            setStudyOptions(prev => ({ ...prev, newCardsPerDay: 10 }));
                        }
                    }}
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
                    <div className="toggle-switch-container">
                        <span>Auto-advance after correct retype</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.learningOptions?.autoAdvance ?? false}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, autoAdvance: e.target.checked } }))}
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
                        className={studyRangeStartInvalid ? 'input-error' : ''}
                    />
                    <span>-</span>
                    <input
                        type="number"
                        min="1"
                        placeholder="End"
                        value={studyOptions.learningOptions.studyRangeOnly?.end || ''}
                        onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, studyRangeOnly: { ...prev.learningOptions.studyRangeOnly, end: e.target.value } } }))}
                        className={studyRangeEndInvalid || studyRangeOrderInvalid ? 'input-error' : ''}
                    />
                </div>
                {studyRangeStartInvalid && (
                    <p className="error-text" style={{ color: 'var(--color-red)', fontSize: '0.8rem', marginTop: '4px' }}>
                        Start must be at least 1.
                    </p>
                )}
                {!studyRangeStartInvalid && studyRangeEndInvalid && (
                    <p className="error-text" style={{ color: 'var(--color-red)', fontSize: '0.8rem', marginTop: '4px' }}>
                        End must be at least 1.
                    </p>
                )}
                {!studyRangeStartInvalid && !studyRangeEndInvalid && studyRangeOrderInvalid && (
                    <p className="error-text" style={{ color: 'var(--color-red)', fontSize: '0.8rem', marginTop: '4px' }}>
                        End must be greater than or equal to start.
                    </p>
                )}
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
                        className={excludeRangeStartInvalid ? 'input-error' : ''}
                    />
                    <span>-</span>
                    <input
                        type="number"
                        min="1"
                        placeholder="End"
                        value={studyOptions.learningOptions.excludeRange?.end || ''}
                        onChange={(e) => setStudyOptions(prev => ({ ...prev, learningOptions: { ...prev.learningOptions, excludeRange: { ...prev.learningOptions.excludeRange, end: e.target.value } } }))}
                        className={excludeRangeEndInvalid || excludeRangeOrderInvalid ? 'input-error' : ''}
                    />
                </div>
                {excludeRangeStartInvalid && (
                    <p className="error-text" style={{ color: 'var(--color-red)', fontSize: '0.8rem', marginTop: '4px' }}>
                        Start must be at least 1.
                    </p>
                )}
                {!excludeRangeStartInvalid && excludeRangeEndInvalid && (
                    <p className="error-text" style={{ color: 'var(--color-red)', fontSize: '0.8rem', marginTop: '4px' }}>
                        End must be at least 1.
                    </p>
                )}
                {!excludeRangeStartInvalid && !excludeRangeEndInvalid && excludeRangeOrderInvalid && (
                    <p className="error-text" style={{ color: 'var(--color-red)', fontSize: '0.8rem', marginTop: '4px' }}>
                        End must be greater than or equal to start.
                    </p>
                )}
            </div>
        </div>
        );
    };

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
                                    <div className="import-option-group">
                                        <label className="import-option-label">Term Language:</label>
                                        <select
                                            value={importTermLanguage}
                                            onChange={(e) => setImportTermLanguage(e.target.value)}
                                            className="import-language-select"
                                        >
                                            <option value="">Use default ({settings?.targetLanguage ? settings.targetLanguage : 'None'})</option>
                                            {supportedLanguages.map(lang => (
                                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="import-option-group">
                                        <label className="import-option-label">Definition Language:</label>
                                        <select
                                            value={importDefinitionLanguage}
                                            onChange={(e) => setImportDefinitionLanguage(e.target.value)}
                                            className="import-language-select"
                                        >
                                            <option value="">Use default ({settings?.nativeLanguage ? settings.nativeLanguage : 'None'})</option>
                                            {supportedLanguages.map(lang => (
                                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="import-option-group">
                                        <label className="import-option-label">For Duplicate Terms:</label>
                                        <div className="radio-group">
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="duplicateHandling"
                                                    value="keep-new"
                                                    checked={duplicateHandling === 'keep-new'}
                                                    onChange={(e) => setDuplicateHandling(e.target.value)}
                                                />
                                                Keep new definition
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="duplicateHandling"
                                                    value="keep-existing"
                                                    checked={duplicateHandling === 'keep-existing'}
                                                    onChange={(e) => setDuplicateHandling(e.target.value)}
                                                />
                                                Keep existing definition
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="duplicateHandling"
                                                    value="keep-both"
                                                    checked={duplicateHandling === 'keep-both'}
                                                    onChange={(e) => setDuplicateHandling(e.target.value)}
                                                />
                                                Keep both term/definition combos
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
                                        setImportTermLanguage('');
                                        setImportDefinitionLanguage('');
                                        setDuplicateHandling('keep-new');
                                    }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {flashcards.length === 0 ? (
                            <>
                                <p className="status-message">No flashcards yet. Add or import some cards.</p>
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                                    <button onClick={addCard}>
                                        <Plus size={18} /> Add Card
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="cards-list">
                                    {cardsToShow.map((card, index) => {
                                        return (
                                        <div key={index} id={`flashcard-${index}`} className={`card-item ${editingCardIndex === index ? 'editing' : ''}`}>
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
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                                    <button onClick={addCard}>
                                        <Plus size={18} /> Add Card
                                    </button>
                                </div>
                            </>
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
                    <div className="view-header-content">
                        <div className="view-title-section">
                            <h2>{currentSet.title}</h2>
                            <div className="view-meta-info">
                                <span className="card-count-badge">{currentSet.flashcards.length} {currentSet.flashcards.length === 1 ? 'card' : 'cards'}</span>
                                {currentSet.description && (
                                    <span className="view-description-preview">{currentSet.description}</span>
                                )}
                            </div>
                        </div>
                        <div className="view-actions">
                            <button 
                                className="view-action-btn view-action-primary"
                                onClick={async () => { await loadSet(currentSet._id); setStudyAction('start'); }}
                            >
                                <Play size={18} /> Study
                            </button>
                            <button 
                                className="view-action-btn view-action-secondary"
                                onClick={async () => { await loadSet(currentSet._id); setViewMode('edit'); }}
                            >
                                <Edit2 size={18} /> Edit
                            </button>
                            <button 
                                className="view-action-btn view-action-secondary"
                                onClick={() => setShowExportModal(true)}
                            >
                                <Download size={18} /> Export
                            </button>
                            <button 
                                className="view-action-btn view-action-secondary"
                                onClick={() => {
                                    setBatchKeepTermsList('');
                                    setKeepStudiedCardsNotInList(true);
                                    setCardsToRemove([]);
                                    setShowAllCardsToRemove(false);
                                    setShowBatchKeepModal(true);
                                }}
                                style={{ color: 'var(--color-red)' }}
                            >
                                <Trash2 size={18} /> Batch Keep
                            </button>
                            <button 
                                className="view-action-btn view-action-close"
                                onClick={() => setViewMode('sets')}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="view-search-container">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search cards by term or definition..."
                        className="view-search-input"
                        value={viewSearchTerm}
                        onChange={(e) => setViewSearchTerm(e.target.value)}
                    />
                    {viewSearchTerm && (
                        <button 
                            className="search-clear-btn"
                            onClick={() => setViewSearchTerm('')}
                            aria-label="Clear search"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="view-cards-scroll">
                    {filteredCards.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Search size={48} />
                            </div>
                            <p className="empty-state-message">
                                {currentSet.flashcards.length > 0 ? 'No matching cards found.' : 'No flashcards in this set.'}
                            </p>
                            {viewSearchTerm && (
                                <button 
                                    className="empty-state-action"
                                    onClick={() => setViewSearchTerm('')}
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
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
                                                    <div className="card-item-header">
                                                        {card.starred && (
                                                            <div className="card-star-indicator">
                                                                <Star size={20} color="#ffdc62" fill="#ffdc62" />
                                                            </div>
                                                        )}
                                                        <div className="card-item-actions">
                                                            <button
                                                                onClick={() => {
                                                                    setCardToEdit(card);
                                                                    setIsEditCardModalOpen(true);
                                                                }}
                                                                className="card-action-btn card-action-edit"
                                                                aria-label="Edit card"
                                                                title="Edit card"
                                                            >
                                                                <Edit2 size={20} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteCardClick(card)}
                                                                className="card-action-btn card-action-delete"
                                                                aria-label="Delete card"
                                                                title="Delete card"
                                                            >
                                                                <Trash2 size={20} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="card-item-content">
                                                        <div className="card-side card-term">
                                                            <div className="card-label">Term</div>
                                                            <div className="card-text-wrapper">
                                                                <span className="card-text">{card.term}</span>
                                                                {card.term && card.termLanguage && (
                                                                    <button 
                                                                        onClick={() => playTTS(card.term, card.termLanguage)} 
                                                                        className="card-action-btn card-action-tts card-action-tts-inline"
                                                                        aria-label="Play term audio"
                                                                        title="Play audio"
                                                                    >
                                                                        <Volume2 size={20} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="card-divider"></div>
                                                        <div className="card-side card-definition">
                                                            <div className="card-label">Definition</div>
                                                            <div className="card-text-wrapper">
                                                                <span className="card-text">{card.definition}</span>
                                                                {card.definition && card.definitionLanguage && (
                                                                    <button 
                                                                        onClick={() => playTTS(card.definition, card.definitionLanguage)} 
                                                                        className="card-action-btn card-action-tts card-action-tts-inline"
                                                                        aria-label="Play definition audio"
                                                                        title="Play audio"
                                                                    >
                                                                        <Volume2 size={20} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
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
        const isUnstudied = !currentCard.lastReviewed;
        const showTerm = studyOptions.questionFormat === 'term';
        const question = showTerm ? currentCard.definition : currentCard.term;
        const answer = showTerm ? currentCard.term : currentCard.definition;
        const questionLang = showTerm ? currentCard.definitionLanguage : currentCard.termLanguage;
        const answerLang = showTerm ? currentCard.termLanguage : currentCard.definitionLanguage;
        
        // Get all valid answers for the current question
        // If questionFormat is 'term', find all terms with the same definition
        // If questionFormat is 'definition', find all definitions with the same term
        const getValidAnswers = () => {
            if (!currentSet || !question) return [answer];
            
            const validAnswers = [];
            const normalizedQuestion = question.trim().toLowerCase();
            
            if (!normalizedQuestion) return [answer];
            
            currentSet.flashcards.forEach(card => {
                if (showTerm) {
                    // Question is definition, so find all terms with matching definition
                    const cardDefinition = card.definition?.trim().toLowerCase() || '';
                    if (cardDefinition === normalizedQuestion && card.term) {
                        validAnswers.push(card.term.trim());
                    }
                } else {
                    // Question is term, so find all definitions with matching term
                    const cardTerm = card.term?.trim().toLowerCase() || '';
                    if (cardTerm === normalizedQuestion && card.definition) {
                        validAnswers.push(card.definition.trim());
                    }
                }
            });
            
            // If no matches found, fall back to the original answer
            if (validAnswers.length === 0) return [answer];
            
            // Remove duplicates and return
            return [...new Set(validAnswers)];
        };
        
        // Compute valid answers once for this render
        const validAnswers = getValidAnswers();
        
        // Check if written answer matches for unstudied cards
        const isWrittenAnswerCorrect = isUnstudied && currentQuestionType === 'written' && writtenAnswer.trim() 
            ? validAnswers.some(validAnswer => 
                validAnswer.toLowerCase() === writtenAnswer.trim().toLowerCase()
            )
            : false;
        
        const handleWrittenAnswerSubmit = (e) => {
            e.preventDefault();
            const normalizedUserAnswer = writtenAnswer.trim().toLowerCase();
            const isCorrect = validAnswers.some(validAnswer => 
                validAnswer.toLowerCase() === normalizedUserAnswer
            );
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
                            onClick={handleCardFlip}
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
                            
                            {currentQuestionType === 'written' && isUnstudied && !showAnswer && !showDontKnowAnswer && (
                                <div style={{ marginTop: '16px', width: '100%' }}>
                                    <div className="feedback-group">
                                        <p className="feedback-label correct">{showTerm ? 'Term' : 'Definition'}:</p>
                                        <div className="answer-container correct" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                            {validAnswers.map((validAnswer, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: idx < validAnswers.length - 1 ? '8px' : '0' }}>
                                                    <span>{validAnswer}</span>
                                                    {validAnswer && answerLang && (
                                                        <button onClick={() => {
                                                            // Find the language for this specific answer
                                                            const cardWithAnswer = currentSet?.flashcards.find(card => 
                                                                showTerm ? card.term?.trim() === validAnswer : card.definition?.trim() === validAnswer
                                                            );
                                                            const langToUse = showTerm 
                                                                ? (cardWithAnswer?.termLanguage || answerLang)
                                                                : (cardWithAnswer?.definitionLanguage || answerLang);
                                                            playTTS(validAnswer, langToUse);
                                                        }} className="tts-button-large">
                                                            <Volume2 size={24} color="var(--color-green)" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="written-answer-form" style={{ marginTop: '16px' }}>
                                        <input
                                            type="text"
                                            value={writtenAnswer}
                                            onChange={(e) => setWrittenAnswer(e.target.value)}
                                            placeholder={showTerm ? "Type the term..." : "Type the definition..."}
                                            className={`written-answer-input ${(() => {
                                                if (!writtenAnswer.trim()) return '';
                                                const normalizedUserAnswer = writtenAnswer.trim().toLowerCase();
                                                const isCorrect = validAnswers.some(validAnswer => 
                                                    validAnswer.toLowerCase() === normalizedUserAnswer
                                                );
                                                return isCorrect ? 'correct' : '';
                                            })()}`}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            )}
    
                            {currentQuestionType === 'written' && !isUnstudied && !showAnswer && !showDontKnowAnswer && (
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
                                        <p className="feedback-label correct">You didn't know the answer, so here {validAnswers.length === 1 ? 'is the correct answer' : 'are the correct answers'}:</p>
                                        <div className="answer-container correct" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                            {validAnswers.map((validAnswer, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: idx < validAnswers.length - 1 ? '8px' : '0' }}>
                                                    <span>{validAnswer}</span>
                                                    {validAnswer && answerLang && (
                                                        <button onClick={() => {
                                                            // Find the language for this specific answer
                                                            const cardWithAnswer = currentSet?.flashcards.find(card => 
                                                                showTerm ? card.term?.trim() === validAnswer : card.definition?.trim() === validAnswer
                                                            );
                                                            const langToUse = showTerm 
                                                                ? (cardWithAnswer?.termLanguage || answerLang)
                                                                : (cardWithAnswer?.definitionLanguage || answerLang);
                                                            playTTS(validAnswer, langToUse);
                                                        }} className="tts-button-large">
                                                            <Volume2 size={24} color="var(--color-green)" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <p>Type the correct answer to continue:</p>
                                    <textarea
                                        value={dontKnowInputValue}
                                        onChange={(e) => {
                                            setDontKnowInputValue(e.target.value);
                                            const normalizedUserAnswer = e.target.value.trim().toLowerCase();
                                            const isCorrect = validAnswers.some(validAnswer => 
                                                validAnswer.toLowerCase() === normalizedUserAnswer
                                            );
                                            setIsDontKnowRetypeCorrect(isCorrect);
                                        }}
                                        onInput={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                        }}
                                        placeholder={showTerm ? "Retype the term..." : "Retype the definition..."}
                                        className={`retype-answer-input ${isDontKnowRetypeCorrect ? 'correct' : (dontKnowInputValue.trim() ? 'incorrect' : '')}`}
                                        autoFocus
                                        rows={1}
                                    />
                                    {isDontKnowRetypeCorrect && studyOptions.learningOptions?.autoAdvance === false && (
                                        <div className="retype-answer-actions" style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                                            <button 
                                                className="generate-button" 
                                                onClick={() => handleReviewDecision(Grade.Forgot)} 
                                                disabled={isProcessingReview}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
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
                            
                            {showAnswer && !(currentQuestionType === 'written' && isUnstudied) && (
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
                                                    {validAnswers.length > 1 && (
                                                        <p className="feedback-label" style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                                            All correct answers:
                                                        </p>
                                                    )}
                                                    <div className="answer-container correct" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                                        {validAnswers.map((validAnswer, idx) => (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: idx < validAnswers.length - 1 ? '8px' : '0' }}>
                                                                <span>{validAnswer}</span>
                                                                {validAnswer && answerLang && (
                                                                    <button onClick={() => {
                                                                        // Find the language for this specific answer
                                                                        const cardWithAnswer = currentSet?.flashcards.find(card => 
                                                                            showTerm ? card.term?.trim() === validAnswer : card.definition?.trim() === validAnswer
                                                                        );
                                                                        const langToUse = showTerm 
                                                                            ? (cardWithAnswer?.termLanguage || answerLang)
                                                                            : (cardWithAnswer?.definitionLanguage || answerLang);
                                                                        playTTS(validAnswer, langToUse);
                                                                    }} className="tts-button-large">
                                                                        <Volume2 size={24} color="var(--color-green)" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {writtenAnswer.trim() && (
                                                        <div className="feedback-group">
                                                            <p className="feedback-label incorrect">Incorrect answer</p>
                                                            <div className="answer-container incorrect">
                                                                {writtenAnswer}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="feedback-group">
                                                        <p className="feedback-label correct">
                                                            {writtenAnswer.trim() 
                                                                ? (validAnswers.length === 1 ? 'Correct answer' : 'Correct answers')
                                                                : `You skipped this, but here ${validAnswers.length === 1 ? 'is the correct answer' : 'are the correct answers'}:`}
                                                        </p>
                                                        <div className="answer-container correct" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                                            {validAnswers.map((validAnswer, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: idx < validAnswers.length - 1 ? '8px' : '0' }}>
                                                                    <span>{validAnswer}</span>
                                                                    {validAnswer && answerLang && (
                                                                        <button onClick={() => {
                                                                            // Find the language for this specific answer
                                                                            const cardWithAnswer = currentSet?.flashcards.find(card => 
                                                                                showTerm ? card.term?.trim() === validAnswer : card.definition?.trim() === validAnswer
                                                                            );
                                                                            const langToUse = showTerm 
                                                                                ? (cardWithAnswer?.termLanguage || answerLang)
                                                                                : (cardWithAnswer?.definitionLanguage || answerLang);
                                                                            playTTS(validAnswer, langToUse);
                                                                        }} className="tts-button-large">
                                                                            <Volume2 size={24} color="var(--color-green)" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {studyOptions.learningOptions.retypeAnswer && !isUnstudied && (
                                                        <div className="retype-answer-form">
                                                            <p>Type the correct answer to continue:</p>
                                                            <textarea
                                                                value={retypeInputValue}
                                                                onChange={(e) => {
                                                                    setRetypeInputValue(e.target.value);
                                                                    const normalizedUserAnswer = e.target.value.trim().toLowerCase();
                                                                    const isCorrect = validAnswers.some(validAnswer => 
                                                                        validAnswer.toLowerCase() === normalizedUserAnswer
                                                                    );
                                                                    setIsRetypeCorrect(isCorrect);
                                                                }}
                                                                onInput={(e) => {
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                                                }}
                                                                placeholder={showTerm ? "Retype the term..." : "Retype the definition..."}
                                                                className={`retype-answer-input ${isRetypeCorrect ? 'correct' : (retypeInputValue.trim() ? 'incorrect' : '')}`}
                                                                autoFocus
                                                                rows={1}
                                                            />
                                                            {isRetypeCorrect && studyOptions.learningOptions?.autoAdvance === false && (
                                                                <div className="retype-answer-actions" style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                                                                    <button 
                                                                        className="generate-button" 
                                                                        onClick={() => handleReviewDecision(Grade.Forgot)} 
                                                                        disabled={isProcessingReview}
                                                                    >
                                                                        Next
                                                                    </button>
                                                                </div>
                                                            )}
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
                    {(showAnswer || (currentQuestionType === 'flashcards' && hasFlippedOnce)) || showDontKnowAnswer || (currentQuestionType === 'written' && isUnstudied && isWrittenAnswerCorrect) || (currentQuestionType === 'written' && !isUnstudied && answerFeedback === 'correct' && showAnswer) ? (
                        <div className="grading-container">
                            {!showDontKnowAnswer && !(currentQuestionType === 'written' && answerFeedback === 'incorrect' && showAnswer && !isUnstudied) && (
                                <div className="grade-buttons">
                                    {FSRS_GRADES.map(item => {
                                        const gradeName = Object.keys(Grade).find(key => Grade[key] === item.grade)?.toLowerCase();
                                        const isRetypeRequired = currentQuestionType === 'written' && 
                                            answerFeedback === 'incorrect' && 
                                            !isUnstudied &&
                                            studyOptions.learningOptions.retypeAnswer && 
                                            !isRetypeCorrect;
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
                            )}
                            {(showDontKnowAnswer || (currentQuestionType === 'written' && answerFeedback === 'incorrect' && showAnswer && !isUnstudied)) && (
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
            {viewMode === 'trash' && renderTrash()}
            {(viewMode === 'create' || viewMode === 'edit') && renderCreateEdit()}
            {viewMode === 'view' && renderView()}
            {viewMode === 'study' && renderStudy()}
            
            {renderDeleteConfirmModal()}
            {renderPermanentDeleteModal()}
            {renderDeleteCardConfirmModal()}
            {renderDuplicateConfirmModal()}
            {renderExportModal()}
            {renderBatchKeepModal()}
        </div>
    );
}

export default Flashcards;
