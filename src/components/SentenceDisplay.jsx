// src/components/SentenceDisplay.jsx
import { useState, useEffect } from 'react';
import { Volume2, Star, X, AlertTriangle, Check, Crown, AlertCircle } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { fetchSentencesFromGemini } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import { useLanguageHistoryCleanup } from '../hooks/useLanguageHistoryCleanup';
import '../styles/SentenceDisplay.css';

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

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


function SentenceDisplay({ settings, geminiApiKey, topic, onApiKeyMissing, isSavingSettings, isRetryingSave }) {
  // --- STATE FOR REVIEW MODE ---
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [mode, setMode] = useState('learn'); // 'learn' or 'review'
  const [reviewSentences, setReviewSentences] = useState([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [previousTranslationState, setPreviousTranslationState] = useState(false);
  const [isFirstReviewSentence, setIsFirstReviewSentence] = useState(true);
  const [totalReviewSentences, setTotalReviewSentences] = useState(0);
  const [currentReviewPosition, setCurrentReviewPosition] = useState(0);
  const [initialReviewCount, setInitialReviewCount] = useState(0); // Track initial count for accurate progress
  const [starredSentences, setStarredSentences] = useState(new Set()); // Track starred sentences
  const [isProcessingReview, setIsProcessingReview] = useState(false); // Prevent double-clicks

  // Existing State
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  const [sentenceHistory, setSentenceHistory] = useLocalStorage('sentenceHistory', []);
  
  // Automatically clean up history when language changes
  useLanguageHistoryCleanup(sentenceHistory, settings?.targetLanguage, setSentenceHistory, 'sentenceHistory');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Generating sentences, please wait...');
  const [savingMessage, setSavingMessage] = useState('Saving your settings, please wait');
  const [loadingSettingsMessage, setLoadingSettingsMessage] = useState('Loading settings');

  // Effect for the animated ellipsis during loading
  useEffect(() => {
    let intervalId;
    if (isLoading || reviewLoading) {
      let dotCount = 0;
      const baseMessage = isLoading ? 'Generating sentences, please wait' : 'Fetching sentences to review';
      setLoadingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setLoadingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isLoading, reviewLoading]);

  // Effect for animated ellipsis during settings saving
  useEffect(() => {
    let intervalId;
    if (isSavingSettings) {
      let dotCount = 0;
      const baseMessage = 'Saving your settings, please wait';
      setSavingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setSavingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isSavingSettings]);

  // Effect for animated ellipsis during settings loading
  useEffect(() => {
    let intervalId;
    if (isRetryingSave) {
      let dotCount = 0;
      const baseMessage = 'Saving your settings, please wait';
      setLoadingSettingsMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setLoadingSettingsMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isRetryingSave]);

  // Removed automatic saving - users now choose which sentences to star

  // Effect to handle translation state in review mode
  useEffect(() => {
    if (mode === 'review' && reviewSentences.length > 0) {
      // For the first sentence, hide translation by default
      // For subsequent sentences, set translation state to the opposite of the previous sentence's state
      setShowTranslation(isFirstReviewSentence ? false : !previousTranslationState);
    }
  }, [mode, previousTranslationState, isFirstReviewSentence]);

  // Effect to reset translation state when review sentences change
  useEffect(() => {
    if (mode === 'review' && reviewSentences.length > 0) {
      // Reset translation state when new sentences are loaded
      setShowTranslation(false);
    }
  }, [reviewSentences, mode]);
  
  // --- FUNCTION: FETCH SENTENCES FOR REVIEW ---
  // --- FUNCTION: MIGRATE EXISTING SENTENCES ---
  const migrateExistingSentences = async () => {
    if (!settings?.targetLanguage) {
      console.warn('Cannot migrate sentences: no target language in settings');
      return false;
    }

    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/sentences/migrate-target-language`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetLanguage: settings.targetLanguage })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to migrate sentences.`);
      }

      const data = await response.json();
      console.log(`Migration successful: ${data.message}`);
      return true;
    } catch (err) {
      console.error('Migration failed:', err);
      return false;
    }
  };

  const handleFetchReviewSentences = async () => {
    setReviewLoading(true);
    setReviewError(null);
    setShowTranslation(false);
    setPreviousTranslationState(false);
    setIsFirstReviewSentence(true);
    
    const maxRetries = 5;
    const timeoutDuration = 15000; // 15 seconds
    let retryCount = 0;
    let timeoutId;
    
    const attemptFetch = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/api/sentences/review`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch review sentences.`);
        }
        
        const data = await response.json();
        
        // Check if any sentences need migration (have null targetLanguage)
        const needsMigration = data.some(sentence => sentence.targetLanguage === null);
        if (needsMigration) {
          console.log('Found sentences without targetLanguage, attempting migration...');
          await migrateExistingSentences();
        }
        
        setReviewSentences(data);
        setCurrentReviewIndex(0);
        setTotalReviewSentences(data.length);
        setInitialReviewCount(data.length); // Store initial count for accurate progress tracking
        setCurrentReviewPosition(0);
        // Initialize starredSentences with review sentences since they are all starred by default
        setStarredSentences(new Set(data.map(sentence => sentence.targetSentence)));
        setReviewLoading(false);
        clearTimeout(timeoutId);
        return true; // Success
      } catch (err) {
        console.error(`Fetch attempt ${retryCount + 1} failed:`, err);
        
        if (retryCount < maxRetries) {
          retryCount++;
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 16000);
          setTimeout(attemptFetch, delay);
        } else {
          // All retries exhausted
          setReviewError("Error: Failed to fetch sentences. Please click on \"Review Due\" again to try again.");
          setReviewLoading(false);
          clearTimeout(timeoutId);
        }
        return false; // Failed
      }
    };
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      if (retryCount < maxRetries) {
        setReviewError("Error: Failed to fetch sentences. Please click on \"Review Due\" again to try again.");
        setReviewLoading(false);
      }
    }, timeoutDuration);
    
    // Start the first attempt
    attemptFetch();
  };

  // --- FUNCTION: STAR/UNSTAR SENTENCE ---
  const handleStarSentence = async (sentence, isStarred) => {
    if (!isSignedIn) return; // Only save if logged in

    // Ensure sentence has targetLanguage before saving
    const sentenceToSave = {
      ...sentence,
      targetLanguage: sentence.targetLanguage || settings?.targetLanguage
    };

    if (!sentence.targetLanguage && settings?.targetLanguage) {
      console.log(`Adding targetLanguage (${settings.targetLanguage}) to sentence before saving:`, sentence.targetSentence);
    }

    // Update local state immediately for instant visual feedback
    setStarredSentences(prev => {
        const newSet = new Set(prev);
        if (isStarred) {
            newSet.add(sentence.targetSentence);
        } else {
            newSet.delete(sentence.targetSentence);
        }
        return newSet;
    });

    // If we're in review mode and unstarring a sentence, remove it from the review list
    if (mode === 'review' && !isStarred) {
        setReviewSentences(prevSentences => {
            const filtered = prevSentences.filter(s => s.targetSentence !== sentence.targetSentence);
            // Update total count to reflect the actual number of sentences in review
            setTotalReviewSentences(filtered.length);
            // Reset currentReviewIndex if it's now out of bounds
            if (currentReviewIndex >= filtered.length && filtered.length > 0) {
                setCurrentReviewIndex(0);
            }
            return filtered;
        });
    }

    const maxRetries = 5;
    const baseDelay = 1000; // 1 second base delay
    let retryCount = 0;

    const attemptStarUpdate = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/api/sentences/star`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sentence: sentenceToSave, starred: isStarred })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to update star status`);
        }

        console.log(`Successfully ${isStarred ? 'starred' : 'unstarred'} sentence: ${sentence.targetSentence}`);
        return true; // Success

      } catch (err) {
        console.error(`Star update attempt ${retryCount + 1} failed:`, err);
        
        if (retryCount < maxRetries) {
          retryCount++;
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 16000);
          console.log(`Retrying star update in ${delay}ms...`);
          setTimeout(attemptStarUpdate, delay);
        } else {
          console.error(`Failed to ${isStarred ? 'star' : 'unstar'} sentence after ${maxRetries} attempts:`, sentence.targetSentence);
          // Revert the local state since the operation ultimately failed
          setStarredSentences(prev => {
              const newSet = new Set(prev);
              if (isStarred) {
                  newSet.delete(sentence.targetSentence);
              } else {
                  newSet.add(sentence.targetSentence);
              }
              return newSet;
          });
        }
        return false; // Failed
      }
    };

    // Start the first attempt
    attemptStarUpdate();
  };

  const handleReviewDecision = async (sentenceId, grade) => {
    // Prevent double-clicks
    if (isProcessingReview) return;
    
    setIsProcessingReview(true);
    try {
        const token = await getToken();
        const response = await fetch(`${API_BASE_URL}/api/sentences/update-review`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sentenceId, grade })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}: Failed to update review`);
        }

        // Store the current translation state for the next sentence
        setPreviousTranslationState(showTranslation);
        
        // Mark that we're no longer on the first review sentence
        setIsFirstReviewSentence(false);

        // Increment the position counter
        setCurrentReviewPosition(prev => prev + 1);

        // After successfully updating in the DB, remove the sentence from the current session's review list
        // This provides immediate feedback and moves to the next card.
        setReviewSentences(prevSentences => {
            const filtered = prevSentences.filter(s => s._id !== sentenceId);
            // Update total count to reflect the actual number of sentences remaining
            setTotalReviewSentences(filtered.length);
            // Reset currentReviewIndex if it's now out of bounds
            if (currentReviewIndex >= filtered.length && filtered.length > 0) {
                setCurrentReviewIndex(0);
            }
            return filtered;
        });

    } catch (err) {
        console.error("Failed to update review:", err);
        // Show error to user
        setReviewError(`Failed to update review: ${err.message}`);
        // Clear error after 5 seconds
        setTimeout(() => setReviewError(null), 5000);
    } finally {
        setIsProcessingReview(false);
    }
  };

  const addCurrentSentenceToHistory = () => {
    const sentenceToAddToHistory = sentences[currentSentenceIndex];
    if (sentenceToAddToHistory) {
      const historyEntry = {
        sentence: sentenceToAddToHistory.targetSentence,
        targetLanguage: settings.targetLanguage
      };
      
      setSentenceHistory(prev => {
        // Remove any existing entry with the same sentence and language to prevent duplicates
        const filtered = prev.filter(entry => 
          !(entry.sentence === historyEntry.sentence && entry.targetLanguage === historyEntry.targetLanguage)
        );
        
        // Add new entry and maintain size limit
        return [...filtered, historyEntry].slice(-settings.sentenceDisplayHistorySize);
      });
    }
  };

  const handleGenerateSentences = async () => {
    if (isSavingSettings || isRetryingSave) {
      return; // Prevent generation while settings are being saved or loaded
    }

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
      
      // Add the first sentence of the new set to history since it's automatically shown
      if (newSentences.length > 0) {
        const firstSentence = newSentences[0];
        const historyEntry = {
          sentence: firstSentence.targetSentence,
          targetLanguage: settings.targetLanguage
        };
        
        setSentenceHistory(prev => {
          // Remove any existing entry with the same sentence and language to prevent duplicates
          const filtered = prev.filter(entry => 
            !(entry.sentence === historyEntry.sentence && entry.targetLanguage === historyEntry.targetLanguage)
          );
          
          // Add new entry and maintain size limit
          return [...filtered, historyEntry].slice(-settings.sentenceDisplayHistorySize);
        });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBack = () => {
    const newIndex = currentSentenceIndex - 1;
    if (newIndex >= 0) {
        setCurrentSentenceIndex(newIndex);
        setShowTranslation(false);
    }
  };
  
  const handleNext = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      const nextIndex = currentSentenceIndex + 1;
      const nextSentence = sentences[nextIndex];
      
      // Add the next sentence to history before navigating to it
      if (nextSentence) {
        const historyEntry = {
          sentence: nextSentence.targetSentence,
          targetLanguage: settings.targetLanguage
        };
        
        setSentenceHistory(prev => {
          // Remove any existing entry with the same sentence and language to prevent duplicates
          const filtered = prev.filter(entry => 
            !(entry.sentence === historyEntry.sentence && entry.targetLanguage === historyEntry.targetLanguage)
          );
          
          // Add new entry and maintain size limit
          return [...filtered, historyEntry].slice(-settings.sentenceDisplayHistorySize);
        });
      }

      setCurrentSentenceIndex(nextIndex);
      setShowTranslation(false);
    }
  };

  const handleWordSpeak = (word, sentence = null) => {
    // Use sentence-specific target language if available and valid, otherwise fall back to settings
    let targetLanguage = sentence?.targetLanguage;
    
    // If sentence has no targetLanguage or it's null/undefined, use settings
    if (!targetLanguage) {
      targetLanguage = settings?.targetLanguage;
    }
    
    if (!targetLanguage) {
      console.error('Target language not available for word:', word);
      return;
    }
    
    const langCode = getLanguageCode(targetLanguage);
    if (langCode) {
      // Check if the word contains spaces (indicating it's a word chunk)
      if (word.includes(' ')) {
        // Split the word chunk into individual words and speak each one
        const individualWords = word.trim().split(/\s+/);
        console.log(`TTS: Word chunk "${word}" detected, splitting into individual words:`, individualWords);
        
        // Speak each individual word with a small delay between them
        individualWords.forEach((individualWord, index) => {
          setTimeout(() => {
            console.log(`TTS: Speaking individual word "${individualWord}" in language ${targetLanguage} (${langCode})`);
            speakText(individualWord, langCode, settings);
          }, index * 500); // 500ms delay between words
        });
      } else {
        // Single word, speak normally
        console.log(`TTS: Speaking word "${word}" in language ${targetLanguage} (${langCode})`);
        speakText(word, langCode, settings);
      }
    } else {
      console.error(`Language code not found for ${targetLanguage}`);
    }
  };

  const handleSentenceSpeak = (sentenceText, sentence = null) => {
    // Use sentence-specific target language if available and valid, otherwise fall back to settings
    let targetLanguage = sentence?.targetLanguage;
    
    // If sentence has no targetLanguage or it's null/undefined, use settings
    if (!targetLanguage) {
      targetLanguage = settings?.targetLanguage;
    }
    
    if (!targetLanguage) {
      console.error('Target language not available for sentence:', sentenceText);
      return;
    }
    
    const langCode = getLanguageCode(targetLanguage);
    if (langCode) {
      console.log(`TTS: Speaking sentence "${sentenceText}" in language ${targetLanguage} (${langCode})`);
      speakText(sentenceText, langCode, settings);
    } else {
      console.error(`Language code not found for ${targetLanguage}`);
    }
  };

  const renderTargetSentence = (fullSentence, colorMap, onSentenceSpeak, starButton, sentence = null) => {
    if (!fullSentence || typeof fullSentence !== 'string') return null;

    // Check if this sentence is using fallback language (no sentence-specific targetLanguage)
    const isUsingFallbackLanguage = !sentence?.targetLanguage;

    // If no colorMap or invalid colorMap, make the entire sentence clickable
    if (!colorMap || !Array.isArray(colorMap)) {
      return (
        <span>
          {starButton && (
            <span style={{ marginRight: '8px' }}>
              {starButton}
            </span>
          )}
          {isUsingFallbackLanguage && (
            <span style={{ 
              marginRight: '4px',
              display: 'inline-flex',
              alignItems: 'center'
            }} title="Using current settings language">
              <AlertCircle size={14} color="#ff4444" />
            </span>
          )}
          <span
            className="word"
            onClick={() => handleWordSpeak(fullSentence, sentence)}
            style={{ color: 'var(--color-dark-grey)' }}
          >
            {fullSentence}
          </span>
          {onSentenceSpeak && (
            <button onClick={onSentenceSpeak} className="inline-speak-button" title="Pronounce Sentence" style={{ marginLeft: '8px' }}>
              <Volume2 size={24} color="var(--color-green)" />
            </button>
          )}
        </span>
      );
    }

    const targetToInfoMap = new Map(
      colorMap.filter(item => item && typeof item === 'object' && item.target && typeof item.target === 'string' && item.target.trim() !== '').map(item => [item.target.trim().toLowerCase(), item])
    );

    const phrasesToFind = Array.from(targetToInfoMap.keys()).sort((a, b) => b.length - a.length);

    if (phrasesToFind.length === 0) {
      return (
        <span>
          {starButton && (
            <span style={{ marginRight: '8px' }}>
              {starButton}
            </span>
          )}
          {isUsingFallbackLanguage && (
            <span style={{ 
              marginRight: '4px',
              display: 'inline-flex',
              alignItems: 'center'
            }} title="Using current settings language">
              <AlertCircle size={14} color="#ff4444" />
            </span>
          )}
          <span
            className="word"
            onClick={() => handleWordSpeak(fullSentence, sentence)}
            style={{ color: 'var(--color-dark-grey)' }}
          >
            {fullSentence}
          </span>
          {onSentenceSpeak && (
            <button onClick={onSentenceSpeak} className="inline-speak-button" title="Pronounce Sentence" style={{ marginLeft: '8px' }}>
              <Volume2 size={24} color="var(--color-green)" />
            </button>
          )}
        </span>
      );
    }

    const regex = new RegExp(`(${phrasesToFind.map(escapeRegExp).join('|')})`, 'gi');
    const matches = [...fullSentence.matchAll(regex)];
    const result = [];
    let lastIndex = 0;

    for (const match of matches) {
      // Add any text before the match as clickable spans
      if (match.index > lastIndex) {
        const beforeText = fullSentence.substring(lastIndex, match.index);
        // Split by whitespace and make each word clickable
        const words = beforeText.split(/(\s+)/);
        words.forEach((word, wordIndex) => {
          if (word.trim()) {
            result.push(
              <span
                key={`before-${lastIndex}-${wordIndex}`}
                className="word"
                onClick={() => handleWordSpeak(word.trim(), sentence)}
                style={{ color: 'var(--color-dark-grey)' }}
              >
                {word}
              </span>
            );
          } else {
            result.push(word);
          }
        });
      }

      const matchedText = match[0];
      const lookupKey = matchedText.trim().toLowerCase();
      const info = targetToInfoMap.get(lookupKey);

      // Check if the matched text contains spaces (word chunk)
      if (matchedText.includes(' ')) {
        // Split the word chunk into individual words and make each clickable
        const individualWords = matchedText.split(/(\s+)/);
        individualWords.forEach((word, wordIndex) => {
          if (word.trim()) {
            result.push(
              <span
                key={`match-${match.index}-${wordIndex}`}
                className="word"
                onClick={() => handleWordSpeak(word.trim(), sentence)}
                style={{ color: info.color }}
              >
                {word}
              </span>
            );
          } else {
            result.push(word);
          }
        });
      } else {
        // Single word, render normally
        result.push(
          <span
            key={`match-${match.index}`}
            className="word"
            onClick={() => handleWordSpeak(info.target, sentence)}
            style={{ color: info.color }}
          >
            {matchedText}
          </span>
        );
      }
      lastIndex = match.index + matchedText.length;
    }

    // Add any remaining text as clickable spans
    if (lastIndex < fullSentence.length) {
      const remainingText = fullSentence.substring(lastIndex);
      const words = remainingText.split(/(\s+)/);
      words.forEach((word, wordIndex) => {
        if (word.trim()) {
          result.push(
            <span
              key={`after-${lastIndex}-${wordIndex}`}
              className="word"
              onClick={() => handleWordSpeak(word.trim(), sentence)}
              style={{ color: 'var(--color-dark-grey)' }}
            >
              {word}
            </span>
          );
        } else {
          result.push(word);
        }
      });
    }

    return (
      <span>
        {starButton && (
          <span style={{ marginRight: '8px' }}>
            {starButton}
          </span>
        )}
        {isUsingFallbackLanguage && (
          <span style={{ 
            fontSize: '12px', 
            color: 'var(--color-grey)', 
            marginRight: '4px',
            fontStyle: 'italic'
          }} title="Using current settings language">
            ⚠
          </span>
        )}
        {result}
        {onSentenceSpeak && (
          <button onClick={onSentenceSpeak} className="inline-speak-button" title="Pronounce Sentence" style={{ marginLeft: '8px' }}>
            <Volume2 size={24} color="var(--color-green)" />
          </button>
        )}
      </span>
    );
  };

  const renderNativeSentence = (fullSentence, colorMap) => {
    if (!fullSentence || typeof fullSentence !== 'string' || !colorMap || !Array.isArray(colorMap)) {
      return <span>{fullSentence}</span>;
    }
  
    const nativeToColorMap = new Map();
    const fullSentenceLower = fullSentence.toLowerCase();
  
    // Pass 1: Populate the map with original phrases from the colorMap.
    colorMap.forEach(item => {
      if (item && item.native && typeof item.native === 'string' && item.native.trim() !== '') {
        nativeToColorMap.set(item.native.trim().toLowerCase(), item.color);
      }
    });
  
    // Pass 2: Identify phrases that don't appear contiguously in the sentence.
    const phrasesToBreakdown = [];
    nativeToColorMap.forEach((color, phrase) => {
      if (phrase.includes(' ') && !fullSentenceLower.includes(phrase)) {
        phrasesToBreakdown.push(phrase);
      }
    });
  
    // Pass 3: For non-contiguous phrases, break them down and add individual words to the map.
    phrasesToBreakdown.forEach(phrase => {
      const color = nativeToColorMap.get(phrase);
      nativeToColorMap.delete(phrase); // Remove the original multi-word phrase.
  
      const words = phrase.split(/\s+/);
      words.forEach(word => {
        if (word && !nativeToColorMap.has(word)) { // Avoid overwriting colors of words that are part of other phrases.
          nativeToColorMap.set(word, color);
        }
      });
    });
  
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
                onClick={() => {
                    addCurrentSentenceToHistory();
                    setMode('learn');
                    // Reset review mode state when switching to learn mode
                    setShowTranslation(false);
                    setPreviousTranslationState(false);
                    setIsFirstReviewSentence(true);
                    // Reset review counters and state
                    setCurrentReviewPosition(0);
                    setTotalReviewSentences(0);
                    setInitialReviewCount(0);
                    setCurrentReviewIndex(0);
                }}
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
    if (isSavingSettings) return <p className="status-message">{savingMessage}</p>;
    if (isRetryingSave) return <p className="status-message">{loadingSettingsMessage}</p>;
    if (reviewError) return <p className="status-message error">Error: {reviewError}</p>;
    if (reviewSentences.length === 0) {
        return (
            <div className="initial-state-container">
                <p className="status-message">All done! You have no more sentences due for review today.</p>
            </div>
        );
    }

    const currentReview = reviewSentences[currentReviewIndex];

    // Safety check: if currentReviewIndex is out of bounds, reset it
    if (!currentReview && reviewSentences.length > 0) {
        setCurrentReviewIndex(0);
        return null; // This will cause a re-render with the correct index
    }

    const starButton = isSignedIn ? (
        <button 
            className={`star-button ${starredSentences.has(currentReview.targetSentence) ? 'starred' : ''}`}
            onClick={() => handleStarSentence(currentReview, !starredSentences.has(currentReview.targetSentence))}
            title={starredSentences.has(currentReview.targetSentence) ? 'Remove from review' : 'Add to review'}
        >
            <Star 
                size={24} 
                color="#ffdc62"
                fill={starredSentences.has(currentReview.targetSentence) ? "#ffdc62" : "none"}
            />
        </button>
    ) : null;

    return (
        <div className="sentence-card">
            <article className="sentence-container">
                <section className="target-sentence">
                    <span className="sentence-text-wrapper">
                        {renderTargetSentence(currentReview.targetSentence, currentReview.colorMapping, () => handleSentenceSpeak(currentReview.targetSentence, currentReview), starButton, currentReview)}
                    </span>
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
            
            {/* --- START: FSRS GRADE SYSTEM --- */}
            {/* Show the decision buttons only after the user reveals the translation */}
            {showTranslation && (
                <div className="review-decision">
                    <div className="grade-instructions">
                        <p>How well did you know this sentence?</p>
                    </div>
                    <div className="grade-buttons">
                        <button
                            className="decision-button forgot"
                            onClick={() => handleReviewDecision(currentReview._id, 1)}
                            disabled={isProcessingReview}
                        >
                            <div className="grade-icon"><X size={24} /></div>
                            <div className="grade-label">Forgot</div>
                            <div className="grade-description">Completely forgot it</div>
                        </button>
                        <button
                            className="decision-button hard"
                            onClick={() => handleReviewDecision(currentReview._id, 2)}
                            disabled={isProcessingReview}
                        >
                            <div className="grade-icon"><AlertTriangle size={24} /></div>
                            <div className="grade-label">Hard</div>
                            <div className="grade-description">It took a while to remember</div>
                        </button>
                        <button
                            className="decision-button good"
                            onClick={() => handleReviewDecision(currentReview._id, 3)}
                            disabled={isProcessingReview}
                        >
                            <div className="grade-icon"><Check size={24} /></div>
                            <div className="grade-label">Good</div>
                            <div className="grade-description">I knew it</div>
                        </button>
                        <button
                            className="decision-button easy"
                            onClick={() => handleReviewDecision(currentReview._id, 4)}
                            disabled={isProcessingReview}
                        >
                            <div className="grade-icon"><Crown size={24} /></div>
                            <div className="grade-label">Easy</div>
                            <div className="grade-description">I knew it immediately</div>
                        </button>
                    </div>
                </div>
            )}
            {/* --- END: FSRS GRADE SYSTEM --- */}

            <div className="navigation">
                {/* The Back/Next buttons are no longer needed in review mode, as decisions drive navigation */}
                <span className="review-counter">
                    Reviewing: {Math.min(currentReviewPosition + 1, initialReviewCount)} of {initialReviewCount}
                </span>
            </div>
        </div>
    );
  };

  const renderLearnMode = () => {
    if (isLoading) return <p className="status-message">{loadingMessage}</p>;
    if (isSavingSettings) return <p className="status-message">{savingMessage}</p>;
    if (isRetryingSave) return <p className="status-message">{loadingSettingsMessage}</p>;
    if (sentences.length === 0) {
        return (
          <div className="initial-state-container">
            {error && <p className="status-message error">Error: {error}</p>}
            <p className="status-message">
              Click the button to generate contextual sentences and start learning new vocabulary.
            </p>
            <button 
              className="generate-button" 
              onClick={handleGenerateSentences}
              disabled={isSavingSettings || isRetryingSave}
            >
              Generate Sentences
            </button>
          </div>
        );
    }

    const currentSentence = sentences && sentences.length > 0 ? sentences[currentSentenceIndex] : null;
    
    if (!currentSentence) {
      return (
        <div className="initial-state-container">
          {error && <p className="status-message error">Error: {error}</p>}
          <p className="status-message">
            No sentences available. Click the button to generate contextual sentences and start learning new vocabulary.
          </p>
          <button 
            className="generate-button" 
            onClick={handleGenerateSentences}
            disabled={isSavingSettings || isRetryingSave}
          >
            Generate Sentences
          </button>
        </div>
      );
    }
    const starButton = isSignedIn ? (
        <button 
            className={`star-button ${starredSentences.has(currentSentence.targetSentence) ? 'starred' : ''}`}
            onClick={() => handleStarSentence(currentSentence, !starredSentences.has(currentSentence.targetSentence))}
            title={starredSentences.has(currentSentence.targetSentence) ? 'Remove from review' : 'Add to review'}
        >
            <Star 
                size={24} 
                color="#ffdc62"
                fill={starredSentences.has(currentSentence.targetSentence) ? "#ffdc62" : "none"}
            />
        </button>
    ) : null;

    return (
        <div className="sentence-card">
            {error && <p className="status-message error small">Error: {error}</p>}
            <article className="sentence-container">
                <section className="target-sentence">
                    <span className="sentence-text-wrapper">
                        {renderTargetSentence(currentSentence.targetSentence, currentSentence.colorMapping, () => handleSentenceSpeak(currentSentence.targetSentence, currentSentence), starButton, currentSentence)}
                    </span>
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
                <button 
                  onClick={handleGenerateSentences}
                  disabled={isSavingSettings || isRetryingSave}
                >
                  {isSavingSettings ? savingMessage : isRetryingSave ? loadingSettingsMessage : 'Generate New Sentences'}
                </button>
            </div>
            <div className="navigation">
                <button onClick={handleBack} disabled={currentSentenceIndex === 0}>Back</button>
                <span>
                  <span className="counter-current">{currentSentenceIndex + 1}</span> / {sentences.length}
                </span>
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