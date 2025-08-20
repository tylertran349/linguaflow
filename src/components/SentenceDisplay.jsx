// src/components/SentenceDisplay.jsx

// --- MODIFIED: Import useEffect ---
import { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchSentencesFromGemini } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/SentenceDisplay.css';

// We'll keep a history of the last 100 sentences to ensure variety.
const MAX_HISTORY_SIZE = 100;

function SentenceDisplay({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  const [sentenceHistory, setSentenceHistory] = useLocalStorage('sentenceHistory', []);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  
  // --- NEW: State for the animated loading dots ---
  const [loadingDots, setLoadingDots] = useState('.');

  // --- NEW: useEffect to handle the animation ---
  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingDots(prevDots => {
          if (prevDots.length >= 3) {
            return '.';
          }
          return prevDots + '.';
        });
      }, 400); // Adjust speed here (in milliseconds)
    }

    // This is a crucial cleanup function. It runs when the effect re-runs or the component unmounts.
    // It prevents the interval from running forever in the background.
    return () => {
      clearInterval(interval);
    };
  }, [isLoading]); // This effect will only run when the `isLoading` state changes.

  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  const generate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set.");
      if (onApiKeyMissing) {
        onApiKeyMissing();
      }
      return;
    }
    setIsLoading(true);
    setError('');
    
    try {
      const fetchedSentences = await fetchSentencesFromGemini(
        geminiApiKey, 
        settings, 
        topic, 
        sentenceHistory
      );

      setSentences(fetchedSentences);

      if (fetchedSentences && fetchedSentences.length > 0) {
        const newTargets = fetchedSentences.map(s => s.target);
        const combinedHistory = [...sentenceHistory, ...newTargets];
        const updatedHistory = combinedHistory.slice(-MAX_HISTORY_SIZE);
        setSentenceHistory(updatedHistory);
      }
      
      setCurrentSentenceIndex(0);
      setIsTranslationVisible(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    setCurrentSentenceIndex(prev => Math.min(prev + 1, sentences.length - 1));
    setIsTranslationVisible(false);
  };

  const handleBack = () => {
    setCurrentSentenceIndex(prev => Math.max(prev - 1, 0));
    setIsTranslationVisible(false);
  };

  const handleSpeakSentence = () => {
    if (!currentSentence) return;
    speakText(currentSentence.target, targetLangCode, settings);
  };
  
  const handleWordClick = (word) => {
    if (!word) return;
    speakText(word, targetLangCode, settings);
  };

  // --- MODIFIED: The loading state now uses the animated dots ---
  if (isLoading) {
    return (
      <p className="status-message">
        Generating sentences, please wait{loadingDots}
      </p>
    );
  }
  
  if (sentences.length === 0) {
    return (
      <div className="initial-state-container">
        {error && <p className="status-message error">Error: {error}</p>}
        <p className="status-message">
          Ready to learn? Set your options in the menu and click the button to start.
        </p>
        <button className="generate-button" onClick={generate}>
          Generate Sentences
        </button>
      </div>
    );
  }

  // No changes to the main return JSX
  return (
    <div className="sentence-card">
      {error && <p className="status-message error small">Error: {error}</p>}
      <article className="sentence-container">
        <section className="target-sentence">
          <span className="sentence-text-wrapper">
            <span>
              {currentSentence.chunks.map((chunk, index) => {
                const isLastChunk = index === currentSentence.chunks.length - 1;
                const punctuation = isLastChunk ? (currentSentence.target.slice(-1).match(/[.?!]/) ? currentSentence.target.slice(-1) : '') : '';

                // Remove any punctuation from the chunk itself before rendering
                const cleanChunkText = chunk.target_chunk.replace(/[.?!]$/, '');
                
                return (
                  <span key={index} style={{ color: chunk.color }}>
                    {cleanChunkText.split(' ').map((word, wordIndex, words) => (
                      <span key={wordIndex} onClick={() => handleWordClick(word)} className="word">
                        {word}
                        {wordIndex < words.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                    {punctuation}
                    {!isLastChunk && ' '}
                  </span>
                );
              })}
            </span>
          </span>
          
          <button onClick={handleSpeakSentence} className="speak-button" title="Pronounce Sentence">
            🔊
          </button>
        </section>

        {isTranslationVisible && (
          <section className="native-sentence">
            {currentSentence.chunks.map((chunk, index) => (
              <span key={index} style={{ color: chunk.color, marginRight: '5px' }}>
                {chunk.native_chunk}
              </span>
            ))}
          </section>
        )}
      </article>
      
      <div className="actions">
        <button onClick={() => setIsTranslationVisible(prev => !prev)}>
          {isTranslationVisible ? 'Hide' : 'Show'} Translation
        </button>
        <button onClick={generate}>Generate New Sentences</button>
      </div>

      <div className="navigation">
        <button onClick={handleBack} disabled={currentSentenceIndex === 0}>Back</button>
        <span>{currentSentenceIndex + 1} / {sentences.length}</span>
        <button onClick={handleNext} disabled={currentSentenceIndex === sentences.length - 1}>Next</button>
      </div>
    </div>
  );
}

export default SentenceDisplay;