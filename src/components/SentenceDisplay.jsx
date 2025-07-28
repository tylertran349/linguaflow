// 1. Removed useRef from the import
import { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchSentencesFromGemini } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/SentenceDisplay.css';

function SentenceDisplay({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);

  // The useRef hook is no longer needed.

  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  // 2. The entire problematic useEffect hook has been REMOVED.
  // No more automatic resets on page load.

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
    // We can also remove setSentences([]) here to prevent a brief flicker of the "Initial State" message.
    try {
      const fetchedSentences = await fetchSentencesFromGemini(geminiApiKey, settings, topic);
      setSentences(fetchedSentences);
      
      // 3. Explicitly reset the index and visibility here.
      // This logic now ONLY runs when a new set is successfully generated.
      setCurrentSentenceIndex(0);
      setIsTranslationVisible(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    // We can safely update the index without side effects.
    setCurrentSentenceIndex(prev => Math.min(prev + 1, sentences.length - 1));
    setIsTranslationVisible(false);
  };

  const handleBack = () => {
    // We can safely update the index without side effects.
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

  // --- The rest of the component's JSX is unchanged and correct. ---
  if (isLoading) return <p className="status-message">Generating sentences, please wait...</p>;
  
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

  return (
    <div className="sentence-card">
      {error && <p className="status-message error small">Error: {error}</p>}
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