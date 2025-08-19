// src/components/SentenceDisplay.jsx

import { useState } from 'react';
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
  // --- NEW: State to store sentence history for generating varied vocabulary ---
  const [sentenceHistory, setSentenceHistory] = useLocalStorage('sentenceHistory', []);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);

  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  // --- MODIFIED: The generate function now uses and updates the history ---
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
      // Pass the sentenceHistory to the service function
      const fetchedSentences = await fetchSentencesFromGemini(
        geminiApiKey, 
        settings, 
        topic, 
        sentenceHistory
      );

      setSentences(fetchedSentences);

      // After a successful fetch, update the history
      if (fetchedSentences && fetchedSentences.length > 0) {
        // Get just the text of the new target sentences
        const newTargets = fetchedSentences.map(s => s.target);
        // Combine old and new, ensuring we don't exceed the max size
        const combinedHistory = [...sentenceHistory, ...newTargets];
        const updatedHistory = combinedHistory.slice(-MAX_HISTORY_SIZE);
        // Save the updated history for the next generation
        setSentenceHistory(updatedHistory);
      }
      
      // Explicitly reset the index and visibility for the new set
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
    // This now correctly passes the entire settings object
    speakText(currentSentence.target, targetLangCode, settings);
  };
  
  const handleWordClick = (word) => {
    if (!word) return;
    // BEFORE (Incorrect): speakText(word, targetLangCode, settings.ttsEngine);
    // AFTER (Correct):
    speakText(word, targetLangCode, settings);
  };

  // --- The component's JSX is unchanged and correct. ---
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
          <span className="sentence-text-wrapper">
            <span>
              {currentSentence.chunks.map((chunk, index) => {
                const isLastChunk = index === currentSentence.chunks.length - 1;
                const punctuation = isLastChunk ? (currentSentence.target.slice(-1).match(/[.?!]/) ? currentSentence.target.slice(-1) : '') : '';
                
                return (
                  <span key={index} style={{ color: chunk.color }}>
                    {chunk.target_chunk.split(' ').map((word, wordIndex, words) => (
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
            {(() => {
              const sortedChunks = [...currentSentence.chunks].sort((a, b) => a.native_display_order - b.native_display_order);
              return sortedChunks.map((chunk, index) => {
                const isLastChunk = index === sortedChunks.length - 1;
                const punctuation = isLastChunk ? (currentSentence.native.slice(-1).match(/[.?!]/) ? currentSentence.native.slice(-1) : '') : '';

                return (
                  <span key={index} style={{ color: chunk.color, marginRight: isLastChunk ? '0' : '5px' }}>
                    {chunk.native_chunk}{punctuation}
                  </span>
                );
              });
            })()}
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