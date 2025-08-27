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

    try {
      const newSentences = await fetchSentencesFromGemini(geminiApiKey, settings, topic, sentenceHistory);
      setSentences(newSentences);

      // Update history with a sliding window of 100
      const newHistory = [...sentenceHistory, ...newSentences.map(s => s.targetSentence)].slice(-100);
      setSentenceHistory(newHistory);
      
      setCurrentSentenceIndex(0);
      setShowTranslation(false);

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

  // Renders the TARGET sentence directly from the color map (word order is correct)
  const renderTargetSentence = (colorMap) => {
    const punctuationRegex = /([.,;?!:"()\[\]{}])$/;

    if (!colorMap) return null;

    return colorMap.map((item, index) => {
      const text = item.target || '';
      let word = text;
      let punc = '';

      const match = text.match(punctuationRegex);
      if (match) {
        word = text.substring(0, match.index);
        punc = match[1];
      }

      const letters = word.split('').map((char, i) => (
        <span key={i} style={{ color: item.color }}>{char}</span>
      ));

      const wordElement = word ? (
        <span className="clickable-word" onClick={() => handleWordSpeak(word)}>
          {letters}
        </span>
      ) : null;

      return (
        <span key={index} className="word-segment">
          {wordElement}
          {punc && <span className="punctuation">{punc}</span>}
        </span>
      );
    });
  };

    // Renders the NATIVE sentence using a robust method that preserves all spacing and punctuation.
  const renderNativeSentence = (fullSentence, colorMap) => {
    if (!fullSentence || !colorMap) return null;

    // Create a lookup map from the LOWERCASE and TRIMMED native word to its color
    const nativeToColorMap = new Map(
      colorMap.filter(item => item.native && item.native.trim() !== '').map(item => [item.native.trim().toLowerCase(), item.color])
    );
    
    // Get all phrases we need to find (now clean) and sort them to match longest first
    const phrasesToFind = Array.from(nativeToColorMap.keys()).sort((a, b) => b.length - a.length);

    if (phrasesToFind.length === 0) {
      return <span>{fullSentence}</span>;
    }

    // Create a case-insensitive regex ('i' flag) to find all occurrences of our words
    const regex = new RegExp(`(${phrasesToFind.map(escapeRegExp).join('|')})`, 'gi');
    
    // Use matchAll to get all matches with their indices
    const matches = [...fullSentence.matchAll(regex)];
    const result = [];
    let lastIndex = 0;

    // Iterate through matches and build the output array
    for (const match of matches) {
      // 1. Add the plain text that comes BEFORE the current match
      if (match.index > lastIndex) {
        result.push(fullSentence.substring(lastIndex, match.index));
      }

      // 2. Add the colored matched word
      const matchedText = match[0];
      const lookupKey = matchedText.trim().toLowerCase();
      const color = nativeToColorMap.get(lookupKey);
      
      const letters = matchedText.split('').map((char, i) => (
        <span key={i} style={{ color }}>{char}</span>
      ));
      result.push(<span key={`match-${match.index}`} className="word-segment">{letters}</span>);
      
      lastIndex = match.index + matchedText.length;
    }

    // 3. Add any remaining plain text after the very last match
    if (lastIndex < fullSentence.length) {
      result.push(fullSentence.substring(lastIndex));
    }

    // Map the final array to React elements
    return result.map((part, index) => <span key={index}>{part}</span>);
  };

  const currentSentence = sentences[currentSentenceIndex];

  return (
    <div className="sentence-display-container">
      {isLoading && <div className="status-message">{loadingMessage}</div>}
      {error && <div className="status-message error-message">{error}</div>}
      
      {!isLoading && !error && sentences.length === 0 && (
        <div className="initial-state">
          <h2>Welcome to the Sentence Generator</h2>
          <p>Click the button to generate contextual sentences and start learning new vocabulary.</p>
          <button onClick={handleGenerateSentences} className="action-button">
            Generate Sentences
          </button>
        </div>
      )}

      {!isLoading && !error && sentences.length > 0 && currentSentence && (
        <div className="sentence-view">
          <div className="sentence-counter">
            {currentSentenceIndex + 1} / {sentences.length}
          </div>

          <div className="sentence-content">
            <div className="sentence target-sentence">
              {renderTargetSentence(currentSentence.colorMapping)}
              <button 
                className="speak-button" 
                onClick={() => handleSentenceSpeak(currentSentence.targetSentence)}
                title="Speak sentence"
              >
                🔊
              </button>
            </div>
            
            {showTranslation && (
              <div className="sentence native-sentence">
                {renderNativeSentence(currentSentence.nativeSentence, currentSentence.colorMapping)}
              </div>
            )}
          </div>

          <div className="sentence-nav">
            <button onClick={() => handleNavigate(-1)} disabled={currentSentenceIndex === 0}>
              Back
            </button>
            <button onClick={() => handleNavigate(1)} disabled={currentSentenceIndex === sentences.length - 1}>
              Next
            </button>
          </div>
          
          <div className="sentence-actions">
            <button onClick={() => setShowTranslation(!showTranslation)}>
              {showTranslation ? 'Hide' : 'Show'} Translation
            </button>
            <button onClick={handleGenerateSentences}>
              Generate New Sentences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SentenceDisplay;