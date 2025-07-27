// src/components/SentenceDisplay.jsx

import { useState, useEffect } from 'react'; // Removed useImperativeHandle, forwardRef
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchSentencesFromGemini } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/SentenceDisplay.css';

// The component is no longer wrapped in forwardRef
function SentenceDisplay({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);

  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  useEffect(() => {
    setCurrentSentenceIndex(0);
    setIsTranslationVisible(false);
  }, [sentences]);

  // The generate function is now a standard async function within the component
  const generate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set.");
      // If the parent provided a way to open the settings, call it.
      if (onApiKeyMissing) {
        onApiKeyMissing();
      }
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
    speakText(currentSentence.target, targetLangCode, settings.ttsEngine);
  };
  
  const handleWordClick = (word) => {
    if (!word) return;
    speakText(word, targetLangCode, settings.ttsEngine);
  };

  // Status Messages
  if (isLoading) return <p className="status-message">Generating sentences, please wait...</p>;
  
  // The initial state now contains the button
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

  // Main Game UI
  return (
    <div className="sentence-card">
      {error && <p className="status-message error small">Error: {error}</p>}
      <article className="sentence-container">
        {/* ... existing sentence rendering logic ... */}
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
        {/* Add a button to generate a new set directly from the card */}
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