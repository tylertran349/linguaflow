// src/components/WriteAResponse.jsx

import { useState, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchPracticeQuestions, fetchResponseFeedback } from '../services/geminiService';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
// Renamed CSS import
import '../styles/WriteAResponse.css';

// Renamed component function
function WriteAResponse({ geminiApiKey, settings, topic, onApiKeyMissing, isSavingSettings, isRetryingSave }) {
  const [questions, setQuestions] = useLocalStorage('practiceQuestions', []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useLocalStorage('practiceQuestionIndex', 0);
  const [questionHistory, setQuestionHistory] = useLocalStorage('practiceQuestionHistory', []);
  
  const [userResponse, setUserResponse] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Generating questions, please wait...');
  const [feedbackLoadingMessage, setFeedbackLoadingMessage] = useState('Getting feedback...');
  const [savingMessage, setSavingMessage] = useState('Saving your settings, please wait');
  const [loadingSettingsMessage, setLoadingSettingsMessage] = useState('Loading settings');

  const currentQuestion = questions[currentQuestionIndex];
  const questionText = currentQuestion?.text || currentQuestion; // Handle both old string format and new object format
  const questionTargetLanguage = currentQuestion?.targetLanguage || settings.targetLanguage; // Use saved target language or fallback to settings
  const targetLangCode = supportedLanguages.find(l => l.name === questionTargetLanguage)?.code;

  // Effect for animated ellipsis during loading
  useEffect(() => {
    let intervalId;
    if (isLoadingQuestions) {
      let dotCount = 0;
      const baseMessage = 'Generating questions, please wait';
      setLoadingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setLoadingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isLoadingQuestions]);

  // Effect for animated ellipsis during feedback loading
  useEffect(() => {
    let intervalId;
    if (isFetchingFeedback) {
      let dotCount = 0;
      const baseMessage = 'Getting feedback';
      setFeedbackLoadingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setFeedbackLoadingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isFetchingFeedback]);

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

  const generateQuestions = async () => {
    if (isSavingSettings || isRetryingSave) {
      return; // Prevent generation while settings are being saved or loaded
    }

    if (!geminiApiKey) {
      if (onApiKeyMissing) onApiKeyMissing();
      return;
    }

    // Add the last viewed question to history before generating new ones
    const lastViewedQuestion = questions[currentQuestionIndex];
    if (lastViewedQuestion) {
        // Convert to the format expected by the API (just the text)
        const questionForHistory = typeof lastViewedQuestion === 'string' ? lastViewedQuestion : lastViewedQuestion.text;
        setQuestionHistory(prev => [...prev, questionForHistory].slice(-settings.writeAResponseHistorySize));
    }

    setIsLoadingQuestions(true);
    setError('');
    
    try {
      const fetchedData = await fetchPracticeQuestions(geminiApiKey, settings, topic, questionHistory);
      setQuestions(fetchedData);
      // REMOVED: setQuestionHistory(prev => [...prev, ...fetchedData].slice(-settings.writeAResponseHistorySize));
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
      const aiFeedback = await fetchResponseFeedback(geminiApiKey, settings, questionText, userResponse);
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
      // Add the question we are leaving (or skipping) to the history
      const questionToAdd = questions[currentQuestionIndex];
      if (questionToAdd) {
        // Convert to the format expected by the API (just the text)
        const questionForHistory = typeof questionToAdd === 'string' ? questionToAdd : questionToAdd.text;
        setQuestionHistory(prev => [...prev, questionForHistory].slice(-settings.writeAResponseHistorySize));
      }

      // Now, navigate to the next question
      setCurrentQuestionIndex(prev => prev + 1);
      setUserResponse('');
      setFeedback('');
      setIsSubmitted(false);
    }
  };
  
  const handleSpeakQuestion = () => {
    if (!questionText) return;
    speakText(questionText, targetLangCode, settings);
  };
  
    const handleWordClick = (word) => {
        if (!word) return;
        const cleanedWord = word.replace(/[.,!?;:"]$/, '');
        // BEFORE (Incorrect): speakText(cleanedWord, targetLangCode, settings.ttsEngine);
        // AFTER (Correct):
        speakText(cleanedWord, targetLangCode, settings);
    };
  
  if (isLoadingQuestions) return <p className="status-message">{loadingMessage}</p>;
  
  if (isSavingSettings) return <p className="status-message">{savingMessage}</p>;
  
  if (isRetryingSave) return <p className="status-message">{loadingSettingsMessage}</p>;
  
  if (questions.length === 0) {
    return (
      <div className="write-a-response-container">
        <div className="write-a-response-card">
          <div className="initial-state-container">
            {error && <p className="status-message error">Error: {error}</p>}
            <p className="status-message">
              Practice your writing skills. Generate questions to get started.
            </p>
            <button 
              className="generate-button" 
              onClick={generateQuestions}
              disabled={isSavingSettings || isRetryingSave}
            >
              Generate Questions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="write-a-response-container">
      <div className="write-a-response-card">
        {error && <p className="status-message error small">Error: {error}</p>}
        
        <div className="question-card-write">
          <div className="question-header">
              <h3 className="question-text">
                {questionText.split(/(\s+)/).map((word, index) => (
                  word.trim() ? <span key={index} onClick={() => handleWordClick(word)} className="question-word">{word}</span> : word
                ))}
                <button onClick={handleSpeakQuestion} className="speak-button-inline" title="Pronounce question">
                  <Volume2 size={20} color="var(--color-green)" />
                </button>
              </h3>
          </div>
        </div>

        <div className="response-area">
          <textarea
              value={userResponse}
              onChange={(e) => setUserResponse(e.target.value)}
              placeholder={`Type your answer in ${questionTargetLanguage}...`}
              rows="5"
              className="response-input"
              disabled={isSubmitted || isFetchingFeedback}
          />
        </div>

        {feedback && (
          <div className="feedback-box">
              <h4>Feedback</h4>
              <p>{feedback}</p>
          </div>
        )}

        <div className="unified-button-row">
          <button 
            className="nav-button generate-new" 
            onClick={generateQuestions}
            disabled={isSavingSettings || isRetryingSave}
          >
            {isSavingSettings ? savingMessage : isRetryingSave ? loadingSettingsMessage : 'Generate New Questions'}
          </button>

          {currentQuestionIndex < questions.length - 1 && (
              <button className="nav-button skip" onClick={goToNextQuestion}>
                  Skip Question
              </button>
          )}

          {!isSubmitted && (
              <button 
                  className="nav-button submit" 
                  onClick={handleSubmit}
                  disabled={isFetchingFeedback}
              >
                  {isFetchingFeedback ? feedbackLoadingMessage : 'Submit Response'}
              </button>
          )}

          {isSubmitted && currentQuestionIndex < questions.length - 1 && (
              <button className="nav-button next" onClick={goToNextQuestion}>
                  Next Question
              </button>
          )}
        </div>

        <div className="navigation">
          <span>Question {currentQuestionIndex + 1} / {questions.length}</span>
        </div>
      </div>
    </div>
  );
}

// Renamed default export
export default WriteAResponse;