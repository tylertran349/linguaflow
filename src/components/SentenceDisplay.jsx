import React, { useState, useEffect } from 'react';
import { fetchColorCodedSentences } from '../services/geminiService';
import '../styles/SentenceDisplay.css';

// Requirement 6: Custom hook for LocalStorage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// A curated list of vibrant, high-contrast colors.
const RAINBOW_HEX_PALETTE = [
    '#f80c12',
    '#C11C84',
    '#ff9933',
    '#008000',
    '#1296a5ff',
    '#0000FF',
];

const SentenceDisplay = ({ settings, topic, geminiApiKey, onApiKeyMissing, ttsService }) => {
    // State management
    const [sentences, setSentences] = useLocalStorage('sentences', []);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
    const [sentenceHistory, setSentenceHistory] = useLocalStorage('sentenceHistory', []);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showTranslation, setShowTranslation] = useState(false);
    const [loadingEllipsis, setLoadingEllipsis] = useState('.');

    // Effect for animated ellipsis
    useEffect(() => {
        if (isLoading) {
            const interval = setInterval(() => {
                setLoadingEllipsis(prev => prev.length < 3 ? prev + '.' : '.');
            }, 400);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    // Main function to fetch sentences
    const handleGenerateSentences = async () => {
        if (!geminiApiKey) {
            onApiKeyMissing();
            return;
        }

        setIsLoading(true);
        setError(null);
        setShowTranslation(false);

        try {
            const newSentences = await fetchColorCodedSentences(geminiApiKey, settings, topic, sentenceHistory);
            
            setSentences(newSentences);

            // Update history
            const newHistory = newSentences.map(s =>
                s.sentence_pair.map(p => p.target_word).join(' ')
            );
            const updatedHistory = [...sentenceHistory, ...newHistory].slice(-100);
            setSentenceHistory(updatedHistory);

            // Reset state
            setCurrentSentenceIndex(0);
            setShowTranslation(false);

        } catch (err) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    // Navigation handlers
    const handleNext = () => {
        if (currentSentenceIndex < sentences.length - 1) {
            setCurrentSentenceIndex(currentSentenceIndex + 1);
        }
    };

    const handleBack = () => {
        if (currentSentenceIndex > 0) {
            setCurrentSentenceIndex(currentSentenceIndex - 1);
        }
    };
    
    // TTS handlers
    const handleSpeakWord = (word) => {
        ttsService.speak(word, settings.targetLanguage, settings);
    };

    const handleSpeakSentence = (sentencePair) => {
        const fullSentence = sentencePair.map(chunk => chunk.target_word).join(' ');
        ttsService.speak(fullSentence, settings.targetLanguage, settings);
    };
    
    // UI rendering logic
    const renderContent = () => {
        if (isLoading) {
            return <div className="loading-state">Generating sentences, please wait{loadingEllipsis}</div>;
        }

        if (error) {
            return <div className="error-state">
                <p><strong>Error:</strong> {error}</p>
                <button onClick={handleGenerateSentences} className="btn-primary">Try Again</button>
            </div>;
        }

        if (!sentences || sentences.length === 0) {
            return (
                <div className="initial-state">
                    <h2>Welcome to the Sentence Generator!</h2>
                    <p>Click the button to generate contextual sentences and learn new vocabulary.</p>
                    <button onClick={handleGenerateSentences} className="btn-primary">Generate Sentences</button>
                </div>
            );
        }
        
        const currentSentence = sentences[currentSentenceIndex];
        if (!currentSentence || !currentSentence.sentence_pair) {
            return <div className="error-state">
                <p><strong>Error:</strong> The loaded sentence data is invalid.</p>
                <button onClick={() => { setSentences([]); setCurrentSentenceIndex(0); }} className="btn-secondary">Clear and Start Over</button>
            </div>;
        }

        return (
            <div className="sentence-view">
                <div className="sentence-nav">
                    <button onClick={handleBack} disabled={currentSentenceIndex === 0}>Back</button>
                    <span>{currentSentenceIndex + 1} / {sentences.length}</span>
                    <button onClick={handleNext} disabled={currentSentenceIndex >= sentences.length - 1}>Next</button>
                </div>

                <div className="sentence-container target-sentence">
                    {currentSentence.sentence_pair.map((chunk, index) => {
                        const color = RAINBOW_HEX_PALETTE[index % RAINBOW_HEX_PALETTE.length];
                        const isPunctuation = /^[.,?!;:]$/.test(chunk.target_word.trim());
                        
                        return isPunctuation ? (
                            <span key={index} className="punctuation">{chunk.target_word}</span>
                        ) : (
                            <span 
                                key={index} 
                                className="word-chunk" 
                                style={{ color }}
                                onClick={() => handleSpeakWord(chunk.target_word)}
                            >
                                {chunk.target_word}
                            </span>
                        );
                    })}
                    <button className="speak-btn" title="Speak sentence" onClick={() => handleSpeakSentence(currentSentence.sentence_pair)}>🔊</button>
                </div>
                
                {showTranslation && (
                    <div className="sentence-container native-sentence">
                       {currentSentence.sentence_pair.map((chunk, index) => {
                           const color = RAINBOW_HEX_PALETTE[index % RAINBOW_HEX_PALETTE.length];
                           const isPunctuation = /^[.,?!;:]$/.test(chunk.native_word.trim());
                           
                           return (
                             <span 
                                key={index} 
                                className={isPunctuation ? 'punctuation' : 'word-chunk-native'} 
                                style={{ color }}
                             >
                                 {chunk.native_word}
                             </span>
                           );
                       })}
                    </div>
                )}

                <div className="action-buttons">
                    <button onClick={() => setShowTranslation(!showTranslation)}>
                        {showTranslation ? 'Hide' : 'Show'} Translation
                    </button>
                    <button onClick={handleGenerateSentences} className="btn-secondary">
                        Generate New Sentences
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="sentence-display-container">
            {renderContent()}
        </div>
    );
};

export default SentenceDisplay;