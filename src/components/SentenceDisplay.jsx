// src/components/SentenceDisplay.jsx
import { useState, useEffect } from 'react';
import { fetchSentencesFromGemini } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages'; // Assuming this path
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
    if (isLoading) {
      let dotCount = 1;
      setLoadingMessage('Generating sentences, please wait.');
      intervalId = setInterval(() => {
        dotCount = (dotCount % 3) + 1;
        setLoadingMessage(`Generating sentences, please wait${'.'.repeat(dotCount)}`);
      }, 400);
    }
    return () => clearInterval(intervalId);
  }, [isLoading]);
  
  const handleGenerateSentences = async () => {
    if (!geminiApiKey) {
      onApiKeyMissing();
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowTranslation(false); // Hide translation for new sentences

    try {
      const newSentences = await fetchSentencesFromGemini(geminiApiKey, settings, topic, sentenceHistory);
      setSentences(newSentences);

      // In beta, the history stores the target sentence string.
      const newHistory = [...sentenceHistory, ...newSentences.map(s => s.targetSentence)].slice(-100);
      setSentenceHistory(newHistory);
      
      setCurrentSentenceIndex(0);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (direction) => {
    const newIndex = currentSentenceIndex + direction;
    if (newIndex >= 0 && newIndex < sentences.length) {
      setCurrentSentenceIndex(newIndex);
      setShowTranslation(false); // Hide translation when navigating
    }
  };
  
  const handleBack = () => handleNavigate(-1);
  const handleNext = () => handleNavigate(1);

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

    // --- MODIFIED FUNCTION ---
  // Renders the TARGET sentence, now with corrected spacing around punctuation.
  const renderTargetSentence = (colorMap) => {
    if (!colorMap) return null;

    const punctuationRegex = /([.,;?!:"()\[\]{}])$/;
    // Regex to check if a string consists ONLY of punctuation
    const punctuationOnlyRegex = /^[.,;?!:"()\[\]{}]+$/;

    return colorMap.map((item, index) => {
      const text = item.target || '';
      let word = text;
      let punc = '';

      const match = text.match(punctuationRegex);
      if (match) {
        word = text.substring(0, match.index);
        punc = match[1];
      }

      // Determine if a trailing space is needed
      const isLastItem = index === colorMap.length - 1;
      let trailingSpace = null;
      if (!isLastItem) {
        const nextItem = colorMap[index + 1];
        // Only add a space if the next item is NOT exclusively punctuation
        if (!punctuationOnlyRegex.test(nextItem.target.trim())) {
          trailingSpace = ' ';
        }
      }

      return (
        // Use React.Fragment to group elements without adding an extra DOM node
        <span key={index}>
          {word && (
            <span className="word" onClick={() => handleWordSpeak(word)}>
              <span style={{ color: item.color }}>{word}</span>
            </span>
          )}
          {punc && <span className="punctuation">{punc}</span>}
          {trailingSpace}
        </span>
      );
    });
  };

  // Renders the NATIVE sentence using a robust method that preserves all spacing and punctuation.
  const renderNativeSentence = (fullSentence, colorMap) => {
    if (!fullSentence || !colorMap) return null;
    
    const nativeToColorMap = new Map();
    const blackColor = '#000000';

    for (const item of colorMap) {
      if (!item.native || item.native.trim() === '') {
        continue;
      }
      const key = item.native.trim().toLowerCase();
      const existingColor = nativeToColorMap.get(key);

      // This logic prioritizes "real" colored mappings.
      // It will only set a color if the key is new, or if the new color isn't black.
      // This prevents a valid colored word from being overwritten by a duplicate, black-colored entry.
      if (!existingColor || item.color !== blackColor) {
        nativeToColorMap.set(key, item.color);
      }
    }

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
  
  const currentSentence = sentences[currentSentenceIndex];
  
  // --- START OF JSX RESTRUCTURING ---

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

  return (
    <div className="sentence-card">
      {error && <p className="status-message error small">Error: {error}</p>}
      <article className="sentence-container">
        <section className="target-sentence">
          <span className="sentence-text-wrapper">
             <span>{renderTargetSentence(currentSentence.colorMapping)}</span>
          </span>
          <button 
            onClick={() => handleSentenceSpeak(currentSentence.targetSentence)} 
            className="speak-button" 
            title="Pronounce Sentence"
          >
            🔊
          </button>
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
  // --- END OF JSX RESTRUCTURING ---
}

export default SentenceDisplay;