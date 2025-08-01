// src/components/WriteAResponse.jsx

import { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchPracticeQuestions, fetchResponseFeedback } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
// Renamed CSS import
import '../styles/WriteAResponse.css';

const MAX_HISTORY_SIZE = 100;

// Renamed component function
function WriteAResponse({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  const [questions, setQuestions] = useLocalStorage('practiceQuestions', []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useLocalStorage('practiceQuestionIndex', 0);
  const [questionHistory, setQuestionHistory] = useLocalStorage('practiceQuestionHistory', []);
  
  const [userResponse, setUserResponse] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const [error, setError] = useState('');

  const currentQuestion = questions[currentQuestionIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  const generateQuestions = async () => {
    if (!geminiApiKey) {
      if (onApiKeyMissing) onApiKeyMissing();
      return;
    }
    setIsLoadingQuestions(true);
    setError('');
    
    try {
      const fetchedData = await fetchPracticeQuestions(geminiApiKey, settings, topic, questionHistory);
      setQuestions(fetchedData);
      setQuestionHistory(prev => [...prev, ...fetchedData].slice(-MAX_HISTORY_SIZE));
      setCurrentQuestionIndex(0);
      setUserResponse('');
      setFeedback('');
      setIsSubmitted(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleSubmit = async () => {
    if (!userResponse.trim()) {
      setFeedback("Please enter a response before submitting.");
      return;
    }
    setIsFetchingFeedback(true);
    setError('');
    setFeedback('');

    try {
      const aiFeedback = await fetchResponseFeedback(geminiApiKey, settings, currentQuestion, userResponse);
      setFeedback(aiFeedback);
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsFetchingFeedback(false);
    }
  };
  
  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserResponse('');
      setFeedback('');
      setIsSubmitted(false);
    }
  };
  
  const handleSpeakQuestion = () => {
    if (!currentQuestion) return;
    speakText(currentQuestion, targetLangCode, settings.ttsEngine);
  };
  
    const handleWordClick = (word) => {
        if (!word) return;
        const cleanedWord = word.replace(/[.,!?;:"]$/, '');
        // BEFORE (Incorrect): speakText(cleanedWord, targetLangCode, settings.ttsEngine);
        // AFTER (Correct):
        speakText(cleanedWord, targetLangCode, settings);
    };
  
  if (isLoadingQuestions) return <p className="status-message">Generating questions...</p>;
  
  if (questions.length === 0) {
    return (
      <div className="initial-state-container">
        {error && <p className="status-message error">Error: {error}</p>}
        <p className="status-message">
          Practice your writing skills. Generate questions to get started.
        </p>
        <button className="generate-button" onClick={generateQuestions}>
          Generate Questions
        </button>
      </div>
    );
  }

  // Note the updated class names below
  return (
    <div className="write-a-response-container">
      {error && <p className="status-message error small">Error: {error}</p>}
      
      <div className="question-card-write">
        <div className="question-header">
            <h3 className="question-text">
              {currentQuestion.split(/(\s+)/).map((word, index) => (
                word.trim() ? <span key={index} onClick={() => handleWordClick(word)} className="question-word">{word}</span> : word
              ))}
            </h3>
            <button onClick={handleSpeakQuestion} className="speak-button" title="Pronounce question">🔊</button>
        </div>
      </div>

      <div className="response-area">
        <textarea
            value={userResponse}
            onChange={(e) => setUserResponse(e.target.value)}
            placeholder={`Type your answer in ${settings.targetLanguage}...`}
            rows="5"
            className="response-input"
            disabled={isSubmitted || isFetchingFeedback}
        />
        
        {!isSubmitted && (
            <button 
                className="submit-button" 
                onClick={handleSubmit}
                disabled={isFetchingFeedback}
            >
                {isFetchingFeedback ? 'Getting Feedback...' : 'Submit Response'}
            </button>
        )}
      </div>

      {feedback && (
        <div className="feedback-box">
            <h4>Feedback</h4>
            <p>{feedback}</p>
        </div>
      )}

      <div className="navigation-write">
        {currentQuestionIndex < questions.length - 1 && (
            <button className="nav-button skip" onClick={goToNextQuestion}>
                Skip
            </button>
        )}

        {isSubmitted && (
            currentQuestionIndex < questions.length - 1 ? (
                <button className="nav-button next" onClick={goToNextQuestion}>
                    Next Question
                </button>
            ) : (
                <button className="nav-button generate-new" onClick={generateQuestions}>
                    Generate New Questions
                </button>
            )
        )}
      </div>

      <div className="navigation">
        <span>Question {currentQuestionIndex + 1} / {questions.length}</span>
      </div>
    </div>
  );
}

// Renamed default export
export default WriteAResponse;