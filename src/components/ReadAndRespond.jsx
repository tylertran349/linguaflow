// src/components/ReadAndRespond.jsx

import { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchComprehensionPassages } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/ReadAndRespond.css';

const MAX_HISTORY_SIZE = 50; // Keep a history of passages to avoid repeats

function ReadAndRespond({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  // --- State Management ---
  const [passages, setPassages] = useLocalStorage('comprehensionPassages', []);
  const [currentPassageIndex, setCurrentPassageIndex] = useLocalStorage('comprehensionPassageIndex', 0);
  const [passageHistory, setPassageHistory] = useLocalStorage('comprehensionHistory', []);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // State for the current question
  const [userAnswer, setUserAnswer] = useState(null); // Stores the selected option text
  const [isAnswered, setIsAnswered] = useState(false); // Locks the question once answered

  // --- Derived State ---
  const currentPassageData = passages[currentPassageIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  // --- Core Functions ---
  const generate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set.");
      if (onApiKeyMissing) onApiKeyMissing();
      return;
    }
    setIsLoading(true);
    setError('');
    
    try {
      const fetchedData = await fetchComprehensionPassages(geminiApiKey, settings, topic, passageHistory);
      setPassages(fetchedData);

      // Update history with the text of the new passages
      if (fetchedData?.length > 0) {
        const newPassageTexts = fetchedData.map(p => p.passage);
        const combinedHistory = [...passageHistory, ...newPassageTexts];
        setPassageHistory(combinedHistory.slice(-settings.readAndRespondHistorySize));
      }
      
      // Reset state for the new set
      setCurrentPassageIndex(0);
      setUserAnswer(null);
      setIsAnswered(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (currentPassageIndex < passages.length - 1) {
      setCurrentPassageIndex(prev => prev + 1);
      setUserAnswer(null);
      setIsAnswered(false);
    } else {
      // Optional: Handle end of the set, e.g., show a completion message or offer to generate more
      alert("You've completed this set! Generate new passages to continue.");
    }
  };

  // --- Event Handlers ---
  const handleOptionSelect = (option) => {
    if (isAnswered) return; // Prevent changing answer
    setUserAnswer(option);
    setIsAnswered(true);
  };

  const handleSpeakPassage = () => {
    if (!currentPassageData?.passage) return;
    speakText(currentPassageData.passage, targetLangCode, settings.ttsEngine);
  };
  
  const handleWordClick = (word) => {
    if (!word) return;
    const cleanedWord = word.replace(/[.,!?;:"]$/, '');
    // BEFORE (Incorrect): speakText(cleanedWord, targetLangCode, settings.ttsEngine);
    // AFTER (Correct):
    speakText(cleanedWord, targetLangCode, settings);
  };
  
  // --- Helper for styling options ---
  const getOptionClassName = (option) => {
    if (!isAnswered) return 'mcq-option';
    
    const isCorrect = option === currentPassageData.correctAnswer;
    if (isCorrect) return 'mcq-option correct';
    
    const isSelectedIncorrect = option === userAnswer;
    if (isSelectedIncorrect) return 'mcq-option incorrect';
    
    return 'mcq-option';
  };

  // --- Render Logic ---
  if (isLoading) return <p className="status-message">Generating passages, please wait...</p>;
  
  if (passages.length === 0) {
    return (
      <div className="initial-state-container">
        {error && <p className="status-message error">Error: {error}</p>}
        <p className="status-message">
          Test your reading comprehension. Click the button to generate passages and questions.
        </p>
        <button className="generate-button" onClick={generate}>
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
      {error && <p className="status-message error small">Error: {error}</p>}

      <article className="passage-card">
        <div className="passage-header">
            <h3>Read the passage</h3>
            <button onClick={handleSpeakPassage} className="speak-button" title="Pronounce entire passage">🔊</button>
        </div>
        <p className="passage-text">
          {currentPassageData.passage.split(/(\s+)/).map((word, index) => (
             word.trim() ? <span key={index} onClick={() => handleWordClick(word)} className="passage-word">{word}</span> : word
          ))}
        </p>
      </article>

      <section className="question-card">
        <h3 className="comprehension-question">{currentPassageData.question}</h3>
        <div className="mcq-options">
          {currentPassageData.options.map((option, index) => (
            <button
              key={index}
              className={getOptionClassName(option)}
              onClick={() => handleOptionSelect(option)}
              disabled={isAnswered}
            >
              {option}
            </button>
          ))}
        </div>
      </section>
      
      {/* --- THIS IS THE MODIFIED LOGIC --- */}
      {isAnswered && (
        <div className="feedback-and-navigation">
            {/* This part only shows if the answer was wrong */}
            {userAnswer !== currentPassageData.correctAnswer && (
                 <p className="correct-answer-feedback">
                    Correct answer: "{currentPassageData.correctAnswer}"
                </p>
            )}

            {/* Check if we are on the last card */}
            {currentPassageIndex < passages.length - 1 ? (
                // If NOT the last question, show "Continue"
                <button className="continue-button" onClick={handleContinue}>
                    Continue
                </button>
            ) : (
                // If it IS the last question, show the "Generate New" button
                <button className="generate-new-button" onClick={generate}>
                    {isLoading ? 'Generating...' : 'Generate New Passages'}
                </button>
            )}
        </div>
      )}
      {/* --- END OF MODIFICATION --- */}


       <div className="navigation">
            <span>{currentPassageIndex + 1} / {passages.length}</span>
       </div>
    </div>
  );
}

export default ReadAndRespond;