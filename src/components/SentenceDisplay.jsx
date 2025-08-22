import React, { useState, useEffect, useMemo } from 'react';
import { fetchColorCodedSentences } from '../services/geminiService';
import '../styles/SentenceDisplay.css';

// Custom hook for LocalStorage (unchanged)
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

const RAINBOW_HEX_PALETTE = [
    '#f80c12', '#C11C84', '#ff9933', '#008000', '#1296a5ff', '#0000FF',
];

// Helper to split sentence into words and punctuation
const splitSentence = (sentence) => {
    if (!sentence) return [];
    // Unicode-aware regex to correctly split words in languages with diacritics
    return sentence.match(/[\p{L}'-]+|[.,?!;:"]/gu) || [];
};

const SentenceDisplay = ({ settings, topic, geminiApiKey, onApiKeyMissing, ttsService }) => {
    const [sentences, setSentences] = useLocalStorage('sentences', []);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
    const [sentenceHistory, setSentenceHistory] = useLocalStorage('sentenceHistory', []);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showTranslation, setShowTranslation] = useState(false);
    const [loadingEllipsis, setLoadingEllipsis] = useState('.');

    useEffect(() => {
        if (isLoading) {
            const interval = setInterval(() => {
                setLoadingEllipsis(prev => prev.length < 3 ? prev + '.' : '.');
            }, 400);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    const handleGenerateSentences = async () => {
        if (!geminiApiKey) { onApiKeyMissing(); return; }
        setIsLoading(true);
        setError(null);
        setShowTranslation(false);
        try {
            const newSentences = await fetchColorCodedSentences(geminiApiKey, settings, topic, sentenceHistory);
            setSentences(newSentences);
            const newHistory = newSentences.map(s => s.target_sentence);
            const updatedHistory = [...sentenceHistory, ...newHistory].slice(-100);
            setSentenceHistory(updatedHistory);
            setCurrentSentenceIndex(0);
        } catch (err) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => currentSentenceIndex < sentences.length - 1 && setCurrentSentenceIndex(currentSentenceIndex + 1);
    const handleBack = () => currentSentenceIndex > 0 && setCurrentSentenceIndex(currentSentenceIndex - 1);
    const handleSpeakWord = (word) => ttsService.speak(word, settings.targetLanguage, settings);
    const handleSpeakSentence = (sentence) => ttsService.speak(sentence, settings.targetLanguage, settings);

    const { colorMap, nativeToTargetMap } = useMemo(() => {
        if (!sentences || sentences.length === 0 || !sentences[currentSentenceIndex]) {
            return { colorMap: new Map(), nativeToTargetMap: new Map() };
        }
        const currentSentence = sentences[currentSentenceIndex];
        const wordMap = currentSentence.word_map || [];
        
        const newColorMap = new Map();
        const newNativeToTargetMap = new Map();
        
        wordMap.forEach((pair, index) => {
            const color = RAINBOW_HEX_PALETTE[index % RAINBOW_HEX_PALETTE.length];
            // Handle cases where the API might return multi-word chunks despite instructions
            const targetKeys = pair.target_word.split(' ');
            targetKeys.forEach(key => {
                if(key) newColorMap.set(key, color);
            });
            
            const nativeKeys = pair.native_word.split(' ');
            nativeKeys.forEach(key => {
                if(key) newNativeToTargetMap.set(key, pair.target_word.split(' ')[0]); // Map back to the first target word
            });
        });

        return { colorMap: newColorMap, nativeToTargetMap: newNativeToTargetMap };
    }, [sentences, currentSentenceIndex]);


    const renderContent = () => {
        if (isLoading) return <div className="loading-state">Generating sentences, please wait{loadingEllipsis}</div>;
        if (error) return <div className="error-state"><p><strong>Error:</strong> {error}</p><button onClick={handleGenerateSentences} className="btn-primary">Try Again</button></div>;
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
        if (!currentSentence || !currentSentence.target_sentence || !currentSentence.native_sentence) {
            return <div className="error-state"><p><strong>Error:</strong> The loaded sentence data is invalid.</p><button onClick={() => { setSentences([]); setCurrentSentenceIndex(0); }} className="btn-secondary">Clear and Start Over</button></div>;
        }

        const targetWords = splitSentence(currentSentence.target_sentence);
        const nativeWords = splitSentence(currentSentence.native_sentence);

        return (
            <div className="sentence-view">
                <div className="sentence-nav">
                    <button onClick={handleBack} disabled={currentSentenceIndex === 0}>Back</button>
                    <span>{currentSentenceIndex + 1} / {sentences.length}</span>
                    <button onClick={handleNext} disabled={currentSentenceIndex >= sentences.length - 1}>Next</button>
                </div>

                <div className="sentence-container target-sentence">
                    {targetWords.map((word, index) => {
                        const isPunctuation = /[.,?!;:"]/.test(word);
                        return isPunctuation ? (
                            <span key={index} className="punctuation">{word}</span>
                        ) : (
                            <span
                                key={index}
                                className="word-chunk"
                                style={{ color: colorMap.get(word) || '#000000' }}
                                onClick={() => handleSpeakWord(word)}
                            >
                                {word}
                            </span>
                        );
                    })}
                     <button className="speak-btn" title="Speak sentence" onClick={() => handleSpeakSentence(currentSentence.target_sentence)}>🔊</button>
                </div>
                
                {showTranslation && (
                    <div className="sentence-container native-sentence">
                       {nativeWords.map((word, index) => {
                            const isPunctuation = /[.,?!;:"]/.test(word);
                            const correspondingTarget = nativeToTargetMap.get(word);
                            const color = colorMap.get(correspondingTarget) || '#000000';
                            
                            return (
                             <span 
                                key={index} 
                                className={isPunctuation ? 'punctuation' : 'word-chunk-native'} 
                                style={{ color }}
                             >
                                 {word}
                             </span>
                           );
                       })}
                    </div>
                )}

                <div className="action-buttons">
                    <button onClick={() => setShowTranslation(!showTranslation)}>{showTranslation ? 'Hide' : 'Show'} Translation</button>
                    <button onClick={handleGenerateSentences} className="btn-secondary">Generate New Sentences</button>
                </div>
            </div>
        );
    };

    return <div className="sentence-display-container">{renderContent()}</div>;
};

// --- THIS LINE IS THE FIX ---
// It makes the component available for default imports in other files.
export default SentenceDisplay;