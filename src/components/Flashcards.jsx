// src/components/Flashcards.jsx
import { useState, useEffect } from 'react';
import { Volume2, Star, X, AlertTriangle, Check, Crown, Plus, Edit2, Trash2, Play, Settings, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/Flashcards.css';
import { FSRS, Grade, FSRS_GRADES } from '../services/fsrsService';

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

// Helper to find language code from language name
const getLanguageCode = (langName) => {
    const lang = supportedLanguages.find(l => l.name === langName);
    return lang ? lang.code : null;
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
    
    // Study state
    const [studyOptions, setStudyOptions] = useState({
        examDate: null,
        newCardsPerDay: 10,
        questionTypes: {
            flashcards: true,
            multipleChoice: false,
            written: false,
            trueFalse: false
        },
        questionFormat: 'term', // 'term' or 'definition'
        learningOptions: {
            studyStarredOnly: false,
            shuffle: false
        }
    });
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [cardsToStudy, setCardsToStudy] = useState([]);
    const [isProcessingReview, setIsProcessingReview] = useState(false);
    const [writtenAnswer, setWrittenAnswer] = useState('');
    const [answerFeedback, setAnswerFeedback] = useState(null); // 'correct' or 'incorrect'
    const [currentQuestionType, setCurrentQuestionType] = useState('flashcards');

    // Study options modal
    const [showStudyOptionsModal, setShowStudyOptionsModal] = useState(false);
    
    // View state
    const [showAllCards, setShowAllCards] = useState(false);

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
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSignedIn) {
            fetchSets();
        }
    }, [isSignedIn]);

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
            setStudyOptions(data.studyOptions || studyOptions);
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
        try {
            const token = await getToken();
            const url = currentSet 
                ? `${API_BASE_URL}/api/flashcards/sets/${currentSet._id}`
                : `${API_BASE_URL}/api/flashcards/sets`;
            
            const method = currentSet ? 'PUT' : 'POST';
            const body = currentSet 
                ? { title: setTitle, description: setDescription, isPublic, flashcards, studyOptions }
                : { title: setTitle, description: setDescription, isPublic, flashcards, studyOptions };
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save flashcard set');
            }
            
            if (fromStudyModal) {
                await loadSet(currentSet._id);
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

    // Delete set
    const handleDeleteSet = async (setId) => {
        if (!confirm('Are you sure you want to delete this set?')) return;
        
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/api/flashcards/sets/${setId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete flashcard set');
            }
            
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
        setFlashcards(prev => [...prev, {
            term: '',
            definition: '',
            termLanguage: settings?.targetLanguage ? getLanguageCode(settings.targetLanguage) : null,
            definitionLanguage: settings?.nativeLanguage ? getLanguageCode(settings.nativeLanguage) : null,
            starred: false
        }]);
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

    // Start studying
    const startStudy = () => {
        if (!currentSet) return;
        
        // Determine active question types
        const activeQuestionTypes = Object.entries(studyOptions.questionTypes)
            .filter(([, isActive]) => isActive)
            .map(([type]) => type);

        if (activeQuestionTypes.length === 0) {
            setError("Please select at least one question type in the study options.");
            return;
        }

        // Filter for due cards
        const now = new Date();
        const dueCards = currentSet.flashcards.filter(card => 
            !card.nextReviewDate || new Date(card.nextReviewDate) <= now
        );

        // Separate new cards from review cards
        const newCards = dueCards.filter(card => !card.lastReviewed);
        const reviewCards = dueCards.filter(card => card.lastReviewed);

        // Apply new cards per day limit
        const newCardsToday = newCards.slice(0, studyOptions.newCardsPerDay);

        let cards = [...reviewCards, ...newCardsToday];
        
        // Filter by starred only if option is enabled
        if (studyOptions.learningOptions.studyStarredOnly) {
            cards = cards.filter(card => card.starred);
        }
        
        // Shuffle if option is enabled
        if (studyOptions.learningOptions.shuffle) {
            cards = [...cards].sort(() => Math.random() - 0.5);
        }
        
        // Assign a random question type to each card for this session
        const cardsWithQuestionTypes = cards.map(card => ({
            ...card,
            questionType: activeQuestionTypes[Math.floor(Math.random() * activeQuestionTypes.length)]
        }));

        setCardsToStudy(cardsWithQuestionTypes);
        setCurrentCardIndex(0);
        setShowAnswer(false);
        setWrittenAnswer('');
        setAnswerFeedback(null);
        if (cardsWithQuestionTypes.length > 0) {
            setCurrentQuestionType(cardsWithQuestionTypes[0].questionType);
        }
        setViewMode('study');
    };

    // Handle review decision
    const handleReviewDecision = async (grade) => {
        if (isProcessingReview) return;
        if (!currentSet || cardsToStudy.length === 0) return;
        
        setIsProcessingReview(true);
        try {
            const token = await getToken();
            const card = cardsToStudy[currentCardIndex];
            const cardIndexInSet = currentSet.flashcards.findIndex(c => 
                c.term === card.term && c.definition === card.definition
            );
            
            if (cardIndexInSet === -1) {
                throw new Error('Card not found in set');
            }
            
            const response = await fetch(
                `${API_BASE_URL}/api/flashcards/cards/${currentSet._id}/${cardIndexInSet}/review`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ grade })
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to update review');
            }
            
            // Remove current card and move to next
            const newCards = cardsToStudy.filter((_, i) => i !== currentCardIndex);
            setCardsToStudy(newCards);
            
            if (newCards.length === 0) {
                setViewMode('view');
                setShowAnswer(false);
            } else {
                const nextIndex = currentCardIndex >= newCards.length ? 0 : currentCardIndex;
                setCurrentCardIndex(nextIndex);
                setShowAnswer(false);
                setWrittenAnswer('');
                setAnswerFeedback(null);
                setCurrentQuestionType(newCards[nextIndex].questionType);
            }
            
            // Reload set to get updated FSRS data
            await loadSet(currentSet._id);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessingReview(false);
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
        setStudyOptions({
            examDate: null,
            newCardsPerDay: 10,
            questionTypes: { flashcards: true, multipleChoice: false, written: false, trueFalse: false },
            questionFormat: 'term',
            learningOptions: { studyStarredOnly: false, shuffle: false }
        });
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
        const handleSave = async () => {
            await saveSet({ fromStudyModal: true });
            setShowStudyOptionsModal(false);
        };

        const handleCancel = () => {
            if (currentSet) {
                setStudyOptions(currentSet.studyOptions || {
                    examDate: null,
                    newCardsPerDay: 10,
                    questionTypes: { flashcards: true, multipleChoice: false, written: false, trueFalse: false },
                    questionFormat: 'term',
                    learningOptions: { studyStarredOnly: false, shuffle: false }
                });
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
                        {renderStudyOptionsForm()}
                    </div>
                    <div className="modal-actions">
                        <button className="generate-button" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Options'}
                        </button>
                        <button onClick={handleCancel}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    };

    // Render study options form
    const renderStudyOptionsForm = () => (
        <div className="study-options-section">
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
                <label>Question Types</label>
                <div className="checkbox-group">
                    <div className="toggle-switch-container">
                        <span>Flashcards</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.questionTypes.flashcards}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, questionTypes: { ...prev.questionTypes, flashcards: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Multiple Choice</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.questionTypes.multipleChoice}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, questionTypes: { ...prev.questionTypes, multipleChoice: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>Written</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.questionTypes.written}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, questionTypes: { ...prev.questionTypes, written: e.target.checked } }))}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="toggle-switch-container">
                        <span>True & False</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={studyOptions.questionTypes.trueFalse}
                                onChange={(e) => setStudyOptions(prev => ({ ...prev, questionTypes: { ...prev.questionTypes, trueFalse: e.target.checked } }))}
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
                </div>
            </div>
        </div>
    );

    // Render create/edit form
    const renderCreateEdit = () => {
        const isEdit = !!currentSet;
        
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
                        <label>
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                            />
                            Make this set public (default: public)
                        </label>
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
                                {flashcards.map((card, index) => (
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
                                ))}
                            </div>
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
        
        const cardsToShow = currentSet.flashcards.length > 50 && !showAllCards 
            ? currentSet.flashcards.slice(0, 10)
            : currentSet.flashcards;
        
        return (
            <div className="flashcards-view">
                <div className="view-header">
                    <div>
                        <h2>{currentSet.title}</h2>
                        <p className="set-meta">{currentSet.flashcards.length} cards</p>
                    </div>
                    <div className="view-actions">
                        <button onClick={() => { loadSet(currentSet._id); setViewMode('edit'); }}>
                            <Edit2 size={18} /> Edit
                        </button>
                        <button onClick={() => { loadSet(currentSet._id); setViewMode('study'); startStudy(); }}>
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
                
                {currentSet.flashcards.length === 0 ? (
                    <p className="status-message">No flashcards in this set.</p>
                ) : (
                    <>
                        <div className="cards-list-view">
                            {cardsToShow.map((card, index) => (
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
                        {currentSet.flashcards.length > 50 && !showAllCards && (
                            <button className="show-more-button" onClick={() => setShowAllCards(true)}>
                                Show All {currentSet.flashcards.length} Cards <ChevronDown size={18} />
                            </button>
                        )}
                        {showAllCards && (
                            <button className="show-more-button" onClick={() => setShowAllCards(false)}>
                                Show Less <ChevronUp size={18} />
                            </button>
                        )}
                    </>
                )}
            </div>
        );
    };

    // Render study mode
    const renderStudy = () => {
        if (!currentSet || cardsToStudy.length === 0) {
            return (
                <div className="initial-state-container">
                    <p className="status-message">No cards to study. Going back to set view.</p>
                    <button onClick={() => setViewMode('view')}>Back</button>
                </div>
            );
        }
        
        const currentCard = cardsToStudy[currentCardIndex];
        const showTerm = studyOptions.questionFormat === 'term';
        const question = showTerm ? currentCard.term : currentCard.definition;
        const answer = showTerm ? currentCard.definition : currentCard.term;
        const questionLang = showTerm ? currentCard.termLanguage : currentCard.definitionLanguage;
        
        const handleWrittenAnswerSubmit = (e) => {
            e.preventDefault();
            const isCorrect = writtenAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
            setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
            setShowAnswer(true);
        };

        const gradeIcons = {
            [Grade.Forgot]: <X size={24} />,
            [Grade.Hard]: <AlertTriangle size={24} />,
            [Grade.Good]: <Check size={24} />,
            [Grade.Easy]: <Crown size={24} />,
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
                
                <div className="study-card">
                    <div className="study-question">
                        <div className="question-text">
                            {question}
                            {question && questionLang && (
                                <button onClick={() => playTTS(question, questionLang)} className="tts-button-large">
                                    <Volume2 size={24} color="var(--color-green)" />
                                </button>
                            )}
                        </div>

                        {currentQuestionType === 'written' && !showAnswer && (
                            <form onSubmit={handleWrittenAnswerSubmit} className="written-answer-form">
                                <input
                                    type="text"
                                    value={writtenAnswer}
                                    onChange={(e) => setWrittenAnswer(e.target.value)}
                                    placeholder="Type your answer..."
                                    className={`written-answer-input ${answerFeedback ? (answerFeedback === 'correct' ? 'correct' : 'incorrect') : ''}`}
                                    autoFocus
                                />
                                <button type="submit" className="generate-button">Check</button>
                            </form>
                        )}
                        
                        {showAnswer && (
                            <div className="study-answer">
                                <hr />
                                <div className={`answer-text ${answerFeedback ? (answerFeedback === 'correct' ? 'correct' : 'incorrect') : ''}`}>
                                    {answer}
                                    {answer && (showTerm ? currentCard.definitionLanguage : currentCard.termLanguage) && (
                                        <button onClick={() => playTTS(answer, showTerm ? currentCard.definitionLanguage : currentCard.termLanguage)} className="tts-button-large">
                                            <Volume2 size={24} color="var(--color-green)" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="study-actions">
                        {!showAnswer && currentQuestionType !== 'written' ? (
                            <button className="show-answer-button" onClick={() => setShowAnswer(true)}>
                                Show Answer
                            </button>
                        ) : showAnswer ? (
                            <div className="grade-buttons">
                                {FSRS_GRADES.map(item => {
                                    const gradeName = Object.keys(Grade).find(key => Grade[key] === item.grade)?.toLowerCase();
                                    return (
                                        <button
                                            key={item.grade}
                                            className={`decision-button ${gradeName}`}
                                            onClick={() => handleReviewDecision(item.grade)}
                                            disabled={isProcessingReview}
                                        >
                                            <div className="grade-icon">{gradeIcons[item.grade]}</div>
                                            <div className="grade-label">{item.label}</div>
                                            <div className="grade-description">{item.description}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
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
            
            {viewMode === 'sets' && renderSetsList()}
            {(viewMode === 'create' || viewMode === 'edit') && renderCreateEdit()}
            {viewMode === 'view' && renderView()}
            {viewMode === 'study' && renderStudy()}
        </div>
    );
}

export default Flashcards;
