// src/components/SentenceDisplay.jsx
import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { fetchSentencesFromGemini } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/SentenceDisplay.css';

// A custom hook for interacting with LocalStorage.
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  };

  return [storedValue, setValue];
}

// Helper to find language code from language name
const getLanguageCode = (langName) => {
    const lang = supportedLanguages.find(l => l.name === langName);
    return lang ? lang.code : null;
};

// Helper function to escape special characters for use in a RegExp
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};


function SentenceDisplay({ settings, geminiApiKey, topic, onApiKeyMissing }) {
  // --- STATE FOR REVIEW MODE ---
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [mode, setMode] = useState('learn'); // 'learn' or 'review'
  const [reviewSentences, setReviewSentences] = useState([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Existing State
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  const [sentenceHistory, setSentenceHistory] = useLocalStorage('sentenceHistory', []);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Generating sentences, please wait...');

  // Effect for the animated ellipsis during loading
  useEffect(() => {
    let intervalId;
    if (isLoading || reviewLoading) {
      let dotCount = 0;
      const baseMessage = isLoading ? 'Generating sentences, please wait' : 'Fetching review sentences, please wait';
      setLoadingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setLoadingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isLoading, reviewLoading]);

  useEffect(() => {
    // Identify the sentence that is currently being displayed.
    const currentSentence = sentences[currentSentenceIndex];

    // If there is a sentence on screen, save it for review.
    if (currentSentence) {
      saveSentenceForReview(currentSentence);
    }
    // The dependency array ensures this runs only when the view changes.
  }, [sentences, currentSentenceIndex]);
  
  // --- FUNCTION: FETCH SENTENCES FOR REVIEW ---
  const handleFetchReviewSentences = async () => {
    setReviewLoading(true);
    setReviewError(null);
    setShowTranslation(false);
    try {
        const token = await getToken();
        const response = await fetch('http://localhost:3001/api/sentences/review', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch review sentences.');
        
        const data = await response.json();
        setReviewSentences(data);
        setCurrentReviewIndex(0);
    } catch (err) {
        setReviewError(err.message);
    } finally {
        setReviewLoading(false);
    }
  };

  // --- FUNCTION: SAVE SENTENCE FOR REVIEW ---
  const saveSentenceForReview = async (sentenceToSave) => {
    if (!isSignedIn) return; // Only save if logged in

    try {
        const token = await getToken();
        await fetch('http://localhost:3001/api/sentences/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sentence: sentenceToSave })
        });
    } catch (err) {
        console.error("Failed to save sentence for review:", err);
        // Non-critical error, so we don't need to show it to the user
    }
  };

  const handleReviewDecision = async (sentenceId, decision) => {
    try {
        const token = await getToken();
        await fetch('http://localhost:3001/api/sentences/update-review', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sentenceId, decision })
        });

        // After successfully updating in the DB, remove the sentence from the current session's review list
        // This provides immediate feedback and moves to the next card.
        setReviewSentences(prevSentences =>
            prevSentences.filter(s => s._id !== sentenceId)
        );

    } catch (err) {
        console.error("Failed to update review:", err);
        // Optionally set an error state to show the user
    }
  };

  const addCurrentSentenceToHistory = () => {
    const sentenceToAddToHistory = sentences[currentSentenceIndex];
    if (sentenceToAddToHistory) {
      setSentenceHistory(prev => 
        // Prevent duplicates in history
        [...new Set([...prev, sentenceToAddToHistory.targetSentence])]
        .slice(-settings.sentenceDisplayHistorySize)
      );
    }
  };

  const handleGenerateSentences = async () => {
    if (!geminiApiKey) {
      onApiKeyMissing();
      return;
    }

    addCurrentSentenceToHistory();

    setIsLoading(true);
    setError(null);
    setShowTranslation(false); // Hide translation for new sentences

    try {
      const newSentences = await fetchSentencesFromGemini(geminiApiKey, settings, topic, sentenceHistory);
      setSentences(newSentences);
      
      setCurrentSentenceIndex(0);

    } catch (err)      {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBack = () => {
    addCurrentSentenceToHistory();

    const newIndex = currentSentenceIndex - 1;
    if (newIndex >= 0) {
        setCurrentSentenceIndex(newIndex);
        setShowTranslation(false);
    }
  };
  
  const handleNext = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      addCurrentSentenceToHistory();

      setCurrentSentenceIndex(prev => prev + 1);
      setShowTranslation(false);
    }
  };

  const handleWordSpeak = (word) => {
    const langCode = getLanguageCode(settings.targetLanguage);
    if (langCode) {
      speakText(word, langCode, settings);
    } else {
      console.error(`Language code not found for ${settings.targetLanguage}`);
    }
  };

  const handleSentenceSpeak = (sentence) => {
    const langCode = getLanguageCode(settings.targetLanguage);
    if (langCode) {
      speakText(sentence, langCode, settings);
    } else {
      console.error(`Language code not found for ${settings.targetLanguage}`);
    }
  };

  const renderTargetSentence = (fullSentence, colorMap) => {
    if (!fullSentence || !colorMap) return null;

    const targetToInfoMap = new Map(
      colorMap.filter(item => item.target && item.target.trim() !== '').map(item => [item.target.trim().toLowerCase(), item])
    );

    const phrasesToFind = Array.from(targetToInfoMap.keys()).sort((a, b) => b.length - a.length);

    if (phrasesToFind.length === 0) return <span>{fullSentence}</span>;

    const regex = new RegExp(`(${phrasesToFind.map(escapeRegExp).join('|')})`, 'gi');
    const matches = [...fullSentence.matchAll(regex)];
    const result = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index > lastIndex) {
        result.push(fullSentence.substring(lastIndex, match.index));
      }

      const matchedText = match[0];
      const lookupKey = matchedText.trim().toLowerCase();
      const info = targetToInfoMap.get(lookupKey);

      result.push(
        <span
          key={`match-${match.index}`}
          className="word"
          onClick={() => handleWordSpeak(info.target)}
          style={{ color: info.color }}
        >
          {matchedText}
        </span>
      );
      lastIndex = match.index + matchedText.length;
    }

    if (lastIndex < fullSentence.length) {
      result.push(fullSentence.substring(lastIndex));
    }

    return result.map((part, index) => <span key={index}>{part}</span>);
  };

  const renderNativeSentence = (fullSentence, colorMap) => {
    if (!fullSentence || !colorMap) return null;
    const nativeToColorMap = new Map(
      colorMap.filter(item => item.native && item.native.trim() !== '').map(item => [item.native.trim().toLowerCase(), item.color])
    );
    const phrasesToFind = Array.from(nativeToColorMap.keys()).sort((a, b) => b.length - a.length);

    if (phrasesToFind.length === 0) return <span>{fullSentence}</span>;

    const regex = new RegExp(`(${phrasesToFind.map(escapeRegExp).join('|')})`, 'gi');
    const matches = [...fullSentence.matchAll(regex)];
    const result = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index > lastIndex) {
        result.push(fullSentence.substring(lastIndex, match.index));
      }
      const matchedText = match[0];
      const lookupKey = matchedText.trim().toLowerCase();
      const color = nativeToColorMap.get(lookupKey);
      result.push(<span key={`match-${match.index}`} style={{ color }}>{matchedText}</span>);
      lastIndex = match.index + matchedText.length;
    }

    if (lastIndex < fullSentence.length) {
      result.push(fullSentence.substring(lastIndex));
    }
    return result.map((part, index) => <span key={index}>{part}</span>);
  };
  
  const renderModeToggle = () => {
    if (!isSignedIn) return null; // Only show for logged-in users

    return (
        <div className="mode-toggle">
            <button 
                className={mode === 'learn' ? 'active' : ''}
                onClick={() => setMode('learn')}
            >
                Learn New
            </button>
            <button 
              className={mode === 'review' ? 'active' : ''}
              onClick={() => {
                  addCurrentSentenceToHistory();
                  setMode('review');
                  handleFetchReviewSentences();
              }}
            >
                Review Due
            </button>
        </div>
    );
  };
  
  const renderReviewMode = () => {
    if (reviewLoading) return <p className="status-message">{loadingMessage}</p>;
    if (reviewError) return <p className="status-message error">Error: {reviewError}</p>;
    if (reviewSentences.length === 0) {
        return (
            <div className="initial-state-container">
                <p className="status-message">All done! You have no more sentences due for review today.</p>
            </div>
        );
    }

    const currentReview = reviewSentences[currentReviewIndex];

    return (
        <div className="sentence-card">
            <article className="sentence-container">
                <section className="target-sentence">
                    <span className="sentence-text-wrapper">
                        <span>{renderTargetSentence(currentReview.targetSentence, currentReview.colorMapping)}</span>
                    </span>
                    <button onClick={() => handleSentenceSpeak(currentReview.targetSentence)} className="speak-button" title="Pronounce Sentence">🔊</button>
                </section>
                {showTranslation && (
                    <section className="native-sentence">
                        {renderNativeSentence(currentReview.nativeSentence, currentReview.colorMapping)}
                    </section>
                )}
            </article>
            <div className="actions">
                <button onClick={() => setShowTranslation(prev => !prev)}>
                    {showTranslation ? 'Hide' : 'Show'} Translation
                </button>
            </div>
            
            {/* --- START: MODIFIED SECTION --- */}
            {/* Show the decision buttons only after the user reveals the translation */}
            {showTranslation && (
                <div className="review-decision">
                    <button
                        className="decision-button forgot"
                        onClick={() => handleReviewDecision(currentReview._id, 'incorrect')}
                    >
                        Forgot
                    </button>
                    <button
                        className="decision-button knew-it"
                        onClick={() => handleReviewDecision(currentReview._id, 'correct')}
                    >
                        Knew it
                    </button>
                </div>
            )}
            {/* --- END: MODIFIED SECTION --- */}

            <div className="navigation">
                {/* The Back/Next buttons are no longer needed in review mode, as decisions drive navigation */}
                <span>Reviewing: {currentReviewIndex + 1} of {reviewSentences.length}</span>
            </div>
        </div>
    );
  };

  const renderLearnMode = () => {
    if (isLoading) return <p className="status-message">{loadingMessage}</p>;
    if (sentences.length === 0) {
        return (
          <div className="initial-state-container">
            {error && <p className="status-message error">Error: {error}</p>}
            <p className="status-message">
              Click the button to generate contextual sentences and start learning new vocabulary.
            </p>
            <button className="generate-button" onClick={handleGenerateSentences}>
              Generate Sentences
            </button>
          </div>
        );
    }

    const currentSentence = sentences[currentSentenceIndex];
    return (
        <div className="sentence-card">
            {error && <p className="status-message error small">Error: {error}</p>}
            <article className="sentence-container">
                <section className="target-sentence">
                    <span className="sentence-text-wrapper">
                        <span>{renderTargetSentence(currentSentence.targetSentence, currentSentence.colorMapping)}</span>
                    </span>
                    <button onClick={() => handleSentenceSpeak(currentSentence.targetSentence)} className="speak-button" title="Pronounce Sentence">🔊</button>
                </section>
                {showTranslation && (
                    <section className="native-sentence">
                        {renderNativeSentence(currentSentence.nativeSentence, currentSentence.colorMapping)}
                    </section>
                )}
            </article>
            <div className="actions">
                <button onClick={() => setShowTranslation(prev => !prev)}>
                    {showTranslation ? 'Hide' : 'Show'} Translation
                </button>
                <button onClick={handleGenerateSentences}>Generate New Sentences</button>
            </div>
            <div className="navigation">
                <button onClick={handleBack} disabled={currentSentenceIndex === 0}>Back</button>
                <span>{currentSentenceIndex + 1} / {sentences.length}</span>
                <button onClick={handleNext} disabled={currentSentenceIndex === sentences.length - 1}>Next</button>
            </div>
        </div>
    );
  };

  return (
    <div className="sentence-display-container">
        {renderModeToggle()}
        {mode === 'learn' ? renderLearnMode() : renderReviewMode()}
    </div>
  );
}

export default SentenceDisplay;