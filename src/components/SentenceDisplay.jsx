// src/components/SentenceDisplay.jsx

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchSentencesFromGemini } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/SentenceDisplay.css';

// We wrap the component in forwardRef to allow the parent to call its functions.
const SentenceDisplay = forwardRef(({ geminiApiKey, settings, topic }, ref) => {
  // --- All state related to the sentence game is now here ---
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);

  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  // --- Logic for handling the game is now here ---
  useEffect(() => {
    // When a new set of sentences is generated, reset to the first one.
    setCurrentSentenceIndex(0);
    setIsTranslationVisible(false);
  }, [sentences]);

  // Expose a 'generate' function to the parent component (App.jsx) via the ref
  useImperativeHandle(ref, () => ({
    async generate() {
      // The API key check is now part of the component's own logic
      if (!geminiApiKey) {
        setError("Gemini API Key is not set. Please open settings to add it.");
        // Consider passing a function prop from App to open the modal, e.g., `onApiKeyMissing()`
        return;
      }
      setIsLoading(true);
      setError('');
      setSentences([]); 
      try {
        const fetchedSentences = await fetchSentencesFromGemini(geminiApiKey, settings, topic);
        setSentences(fetchedSentences);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  }));

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
    speakText(currentSentence.target, targetLangCode, settings.ttsEngine);
  };
  
  const handleWordClick = (word) => {
    if (!word) return;
    speakText(word, targetLangCode, settings.ttsEngine);
  };

  // --- The component now renders its own UI, including status messages and controls ---
  
  // Status Messages
  if (isLoading) return <p className="status-message">Generating sentences, please wait...</p>;
  if (error) return <p className="status-message error">Error: {error}</p>;
  if (sentences.length === 0) {
    return <p className="status-message">Click "Generate New Sentences" in the menu to start.</p>;
  }

  // Main Game UI
  return (
    <div className="sentence-card">
      <article className="sentence-container">
        <section className="target-sentence">
          {currentSentence.chunks.map((chunk, index) => (
            <span key={index} style={{ color: chunk.color, marginRight: '5px' }}>
              {chunk.target_chunk.split(' ').map((word, wordIndex) => (
                  <span key={wordIndex} onClick={() => handleWordClick(word)} className="word">{word}</span>
              ))}
            </span>
          ))}
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
        <button onClick={handleSpeakSentence}>
          Pronounce Sentence
        </button>
      </div>

      <div className="navigation">
        <button onClick={handleBack} disabled={currentSentenceIndex === 0}>Back</button>
        <span>{currentSentenceIndex + 1} / {sentences.length}</span>
        <button onClick={handleNext} disabled={currentSentenceIndex === sentences.length - 1}>Next</button>
      </div>
    </div>
  );
});

export default SentenceDisplay;