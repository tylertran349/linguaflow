// src/components/ReadAndRespond.jsx

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, Trophy, Target } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchComprehensionPassages } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/ReadAndRespond.css';

function ReadAndRespond({ geminiApiKey, settings, topic, onApiKeyMissing, isSavingSettings, isRetryingSave }) {
  // --- State Management ---
  const [passages, setPassages] = useLocalStorage('comprehensionPassages', []);
  const [currentPassageIndex, setCurrentPassageIndex] = useLocalStorage('comprehensionPassageIndex', 0);
  const [passageHistory, setPassageHistory] = useLocalStorage('comprehensionHistory', []);
  const [score, setScore] = useLocalStorage('comprehensionScore', { correct: 0, total: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Generating passages, please wait...');
  const [savingMessage, setSavingMessage] = useState('Saving your settings, please wait');
  const [loadingSettingsMessage, setLoadingSettingsMessage] = useState('Loading settings');
  
  // State for the current question
  const [userAnswer, setUserAnswer] = useState(null); // Stores the selected option text
  const [isAnswered, setIsAnswered] = useState(false); // Locks the question once answered
  const [showFeedback, setShowFeedback] = useState(false); // Controls feedback animation

  // --- Derived State ---
  const currentPassageData = passages[currentPassageIndex];
  const progressPercentage = passages.length > 0 ? ((currentPassageIndex + 1) / passages.length) * 100 : 0;
  const accuracyPercentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  // Effect for animated ellipsis during loading
  useEffect(() => {
    let intervalId;
    if (isLoading) {
      let dotCount = 0;
      const baseMessage = 'Generating passages, please wait';
      setLoadingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setLoadingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    } else {
      setLoadingMessage('Generating passages, please wait...');
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading]);

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
    } else {
      setSavingMessage('Saving your settings, please wait');
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
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
    } else {
      setLoadingSettingsMessage('Loading settings');
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRetryingSave]);

  // Effect for confetti animation
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // --- Core Functions ---
  const generate = async () => {
    if (isSavingSettings || isRetryingSave) {
      return; // Prevent generation while settings are being saved or loaded
    }

    if (!geminiApiKey) {
      setError("Gemini API Key is not set.");
      if (onApiKeyMissing) onApiKeyMissing();
      return;
    }

    const lastViewedPassage = passages[currentPassageIndex];
    if (lastViewedPassage?.passage) {
        setPassageHistory(prev => [...prev, lastViewedPassage.passage].slice(-settings.readAndRespondHistorySize));
    }

    setIsLoading(true);
    setError('');
    
    try {
      const fetchedData = await fetchComprehensionPassages(geminiApiKey, settings, topic, passageHistory);
      
      // Validate the fetched data
      if (!fetchedData || !Array.isArray(fetchedData) || fetchedData.length === 0) {
        throw new Error('No passages were generated. Please try again.');
      }
      
      // Validate each passage has required properties
      const validPassages = fetchedData.filter(passage => 
        passage && 
        passage.passage && 
        passage.question && 
        passage.options && 
        Array.isArray(passage.options) && 
        passage.options.length > 0 &&
        passage.correctAnswer
      );
      
      if (validPassages.length === 0) {
        throw new Error('Generated passages are missing required data. Please try again.');
      }
      
      setPassages(validPassages);
      
      // Reset state for the new set
      setCurrentPassageIndex(0);
      setUserAnswer(null);
      setIsAnswered(false);
      setShowFeedback(false);
      setScore({ correct: 0, total: 0 });

    } catch (err) {
      console.error('Error generating passages:', err);
      setError(err.message || 'An error occurred while generating passages. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (currentPassageIndex < passages.length - 1 && passages.length > 0) {
      // Add the passage we are leaving to the history
      const passageToAdd = passages[currentPassageIndex];
      if (passageToAdd?.passage) {
          setPassageHistory(prev => [...prev, passageToAdd.passage].slice(-settings.readAndRespondHistorySize));
      }

      // Now, navigate to the next passage
      setCurrentPassageIndex(prev => prev + 1);
      setUserAnswer(null);
      setIsAnswered(false);
      setShowFeedback(false);
    }
  };

  // --- Event Handlers ---
  const handleOptionSelect = (option) => {
    if (isAnswered || !currentPassageData) return; // Prevent changing answer and ensure data exists
    setUserAnswer(option);
    setIsAnswered(true);
    setShowFeedback(true);
    
    // Update score
    const isCorrect = option === currentPassageData.correctAnswer;
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
    
    // Show confetti for correct answers
    if (isCorrect) {
      setShowConfetti(true);
    }
  };

  
  const handleWordClick = (word) => {
    if (!word) return;
    const cleanedWord = word.replace(/[.,!?;:"]$/, '');
    
    if (!settings?.targetLanguage) {
      console.error('Target language not available for word:', cleanedWord);
      return;
    }
    
    const langCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;
    if (langCode) {
      console.log(`TTS: Speaking word "${cleanedWord}" in language ${settings.targetLanguage} (${langCode})`);
      speakText(cleanedWord, langCode, settings);
    } else {
      console.error(`Language code not found for ${settings.targetLanguage}`);
    }
  };


  const handleRetry = () => {
    setError('');
    generate();
  };
  
  // --- Helper for styling options ---
  const getOptionClassName = (option) => {
    if (!isAnswered || !currentPassageData) return 'mcq-option';
    
    const isCorrect = option === currentPassageData.correctAnswer;
    if (isCorrect) return 'mcq-option correct';
    
    const isSelectedIncorrect = option === userAnswer;
    if (isSelectedIncorrect) return 'mcq-option incorrect';
    
    return 'mcq-option';
  };

  // --- Render Logic ---
  if (isLoading) return <p className="status-message">{loadingMessage}</p>;
  
  if (isSavingSettings) return <p className="status-message">{savingMessage}</p>;
  
  if (isRetryingSave) return <p className="status-message">{loadingSettingsMessage}</p>;
  
  if (passages.length === 0) {
    return (
      <div className="initial-state-container">
        {error && (
          <div className="error-container">
            <p className="status-message error">Error: {error}</p>
            <button className="retry-button" onClick={handleRetry}>
              <RotateCcw size={16} />
              Try Again
            </button>
          </div>
        )}
        <p className="status-message">
          Test your reading comprehension. Click the button to generate passages and questions.
        </p>
        <button 
          className="generate-button" 
          onClick={generate}
          disabled={isSavingSettings || isRetryingSave}
        >
          Generate Passages
        </button>
      </div>
    );
  }

  if (!currentPassageData) {
     return <p className="status-message error">Error: Could not load the current passage.</p>
  }

  // --- REPLACEMENT STARTS HERE ---
  return (
    <div className="comprehension-container">
      {error && (
        <div className="error-container">
          <p className="status-message error small">Error: {error}</p>
          <button className="retry-button" onClick={handleRetry}>
            <RotateCcw size={16} />
            Try Again
          </button>
        </div>
      )}

      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="progress-text">
          <span className="progress-current">{currentPassageIndex + 1}</span>
          <span className="progress-separator">/</span>
          <span className="progress-total">{passages.length}</span>
        </div>
      </div>

      {/* Score Display */}
      {score.total > 0 && (
        <div className="score-container">
          <div className="score-item">
            <Trophy size={20} color="var(--color-green)" />
            <span className="score-label">Score:</span>
            <span className="score-value">{score.correct}/{score.total}</span>
          </div>
          <div className="score-item">
            <Target size={20} color="var(--color-green)" />
            <span className="score-label">Accuracy:</span>
            <span className="score-value">{accuracyPercentage}%</span>
          </div>
        </div>
      )}

      <article className="passage-card">
        <div className="passage-header">
            <h3>Read the passage</h3>
        </div>
        <p className="passage-text">
          {currentPassageData.passage?.split(/(\s+)/).map((word, index) => (
             word.trim() ? <span key={index} onClick={() => handleWordClick(word)} className="passage-word">{word}</span> : word
          )) || 'No passage text available.'}
        </p>
      </article>

      <section className="question-card">
        <h3 className="comprehension-question">{currentPassageData.question || 'No question available.'}</h3>
        <div className="mcq-options" role="radiogroup" aria-label="Multiple choice options">
          {currentPassageData.options?.length > 0 ? (
            currentPassageData.options.map((option, index) => (
              <button
                key={index}
                className={getOptionClassName(option)}
                onClick={() => handleOptionSelect(option)}
                disabled={isAnswered}
                role="radio"
                aria-checked={userAnswer === option}
                aria-label={`Option ${index + 1}: ${option}`}
                tabIndex={isAnswered ? -1 : 0}
              >
                <span className="option-text">{option}</span>
                {isAnswered && option === currentPassageData.correctAnswer && (
                  <CheckCircle size={20} className="correct-icon" />
                )}
                {isAnswered && option === userAnswer && option !== currentPassageData.correctAnswer && (
                  <XCircle size={20} className="incorrect-icon" />
                )}
              </button>
            ))
          ) : (
            <p className="no-options-message">No answer options available for this question.</p>
          )}
        </div>
      </section>
      
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="confetti" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'][Math.floor(Math.random() * 5)]
            }} />
          ))}
        </div>
      )}
      
      {/* --- THIS IS THE MODIFIED LOGIC --- */}
      {isAnswered && showFeedback && (
        <div className="feedback-and-navigation">
            {/* Check if we are on the last card */}
            {currentPassageIndex < passages.length - 1 ? (
                // If NOT the last question, show "Continue"
                <button className="continue-button" onClick={handleContinue}>
                    Continue
                </button>
            ) : (
                // If it IS the last question, show completion message
                <div className="completion-message">
                  <Trophy size={24} color="var(--color-green)" />
                  <span>All passages completed!</span>
                </div>
            )}
        </div>
      )}

      {/* Always visible Generate button */}
      <div className="generate-section">
        <button 
          className="generate-new-button" 
          onClick={generate}
          disabled={isSavingSettings || isRetryingSave}
        >
          {isSavingSettings ? savingMessage : isRetryingSave ? loadingSettingsMessage : (isLoading ? 'Generating...' : 'Generate New Passages')}
        </button>
      </div>
      {/* --- END OF MODIFICATION --- */}
    </div>
  );
}

export default ReadAndRespond;