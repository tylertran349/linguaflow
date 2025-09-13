// src/components/ReadAndRespond.jsx

import { useState, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchComprehensionPassages } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/ReadAndRespond.css';

function ReadAndRespond({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  // --- State Management ---
  const [passages, setPassages] = useLocalStorage('comprehensionPassages', []);
  const [currentPassageIndex, setCurrentPassageIndex] = useLocalStorage('comprehensionPassageIndex', 0);
  const [passageHistory, setPassageHistory] = useLocalStorage('comprehensionHistory', []);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Generating passages, please wait...');
  
  // State for the current question
  const [userAnswer, setUserAnswer] = useState(null); // Stores the selected option text
  const [isAnswered, setIsAnswered] = useState(false); // Locks the question once answered

  // --- Derived State ---
  const currentPassageData = passages[currentPassageIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

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
    }
    return () => clearInterval(intervalId);
  }, [isLoading]);

  // --- Core Functions ---
  const generate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set.");
      if (onApiKeyMissing) onApiKeyMissing();
      return;
    }

    const lastViewedPassage = passages[currentPassageIndex];
    if (lastViewedPassage) {
        setPassageHistory(prev => [...prev, lastViewedPassage.passage].slice(-settings.readAndRespondHistorySize));
    }

    setIsLoading(true);
    setError('');
    
    try {
      const fetchedData = await fetchComprehensionPassages(geminiApiKey, settings, topic, passageHistory);
      setPassages(fetchedData);
      
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
      // Add the passage we are leaving to the history
      const passageToAdd = passages[currentPassageIndex];
      if (passageToAdd) {
          setPassageHistory(prev => [...prev, passageToAdd.passage].slice(-settings.readAndRespondHistorySize));
      }

      // Now, navigate to the next passage
      setCurrentPassageIndex(prev => prev + 1);
      setUserAnswer(null);
      setIsAnswered(false);
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
  if (isLoading) return <p className="status-message">{loadingMessage}</p>;
  
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
            <button onClick={handleSpeakPassage} className="speak-button" title="Pronounce entire passage">
              <Volume2 size={20} color="var(--color-green)" />
            </button>
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