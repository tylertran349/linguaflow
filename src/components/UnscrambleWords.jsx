// src/components/UnscrambleWords.jsx

import React, { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchUnscrambleSentences } from '../services/geminiService';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import '../styles/UnscrambleWords.css';

const CORRECT_ADVANCE_DELAY = 1500; // 1.5 seconds

const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

function UnscrambleWords({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  const [sentences, setSentences] = useLocalStorage('unscrambleSentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('unscrambleCurrentIndex', 0);
  const [userOrder, setUserOrder] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  // --- New state to track if the solution was revealed by the user ---
  const [isRevealed, setIsRevealed] = useState(false);
  const [incorrectIndices, setIncorrectIndices] = useState([]);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const currentSentence = sentences[currentSentenceIndex];

  useEffect(() => {
    if (currentSentence) {
      const correctWords = currentSentence.target.split(' ');
      setUserOrder(shuffleArray(correctWords));
      resetStateForNewSentence();
    }
  }, [currentSentence]);
  
  useEffect(() => {
    // --- Auto-advance ONLY if the user solved it, NOT if the solution was revealed ---
    if (isCorrect && !isRevealed) {
      const timer = setTimeout(() => {
        handleNav(1); // Move to next sentence
      }, CORRECT_ADVANCE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isCorrect, isRevealed]); // Add isRevealed to dependency array

  const resetStateForNewSentence = () => {
    setIsCorrect(null);
    setIncorrectIndices([]);
    setIsHintVisible(false);
    setIsRevealed(false); // Also reset the revealed state
  };

  const generate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set.");
      if (onApiKeyMissing) onApiKeyMissing();
      return;
    }
    setIsLoading(true);
    setError('');
    setSentences([]);
    try {
      const fetched = await fetchUnscrambleSentences(geminiApiKey, settings, topic);
      setSentences(fetched);
      setCurrentSentenceIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOrder = (currentWordOrder) => {
    const correctWords = currentSentence.target.split(' ');
    const newIncorrectIndices = [];
    let allCorrect = true;
    
    currentWordOrder.forEach((word, index) => {
      if (word !== correctWords[index]) {
        allCorrect = false;
        newIncorrectIndices.push(index);
      }
    });

    setIsCorrect(allCorrect);
    setIncorrectIndices(newIncorrectIndices);
  };

  const handleOnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(userOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setUserOrder(items);
    checkOrder(items);
  };

  const showSolution = () => {
    setUserOrder(currentSentence.target.split(' '));
    setIsCorrect(true); // Mark as correct for positive UI feedback
    setIsRevealed(true); // Set the flag to prevent auto-advancing
    setIncorrectIndices([]);
    // --- The automatic timeout to advance has been REMOVED ---
  };

  const handleNav = (direction) => {
    const newIndex = currentSentenceIndex + direction;
    if (newIndex >= 0 && newIndex < sentences.length) {
      setCurrentSentenceIndex(newIndex);
    }
  };
  
  // (The rest of the component's JSX rendering logic remains the same)
  // ...
  // --- The only change in the JSX is the `disabled` property on the "Next" button ---
  if (isLoading) {
    return <p className="status-message">Generating sentences, please wait...</p>;
  }
  if (sentences.length === 0) {
    return (
      <div className="initial-state-container">
        {error && <p className="status-message error">{error}</p>}
        <h2>Unscramble Words</h2>
        <p>Drag and drop the words to form a correct sentence.</p>
        <button className="generate-button" onClick={generate}>
          Start Game
        </button>
      </div>
    );
  }
  const dropzoneClassName = `word-bank ${isCorrect === true ? 'correct-dropzone' : isCorrect === false ? 'incorrect-dropzone' : ''}`;
  return (
    <div className="unscramble-container">
      <div className="sentence-counter">Sentence {currentSentenceIndex + 1} / {sentences.length}</div>
      <DragDropContext onDragEnd={handleOnDragEnd}>
        <Droppable droppableId="words" direction="horizontal">
          {(provided) => (
            <div className={dropzoneClassName} {...provided.droppableProps} ref={provided.innerRef}>
              {userOrder.map((word, index) => (
                <Draggable key={`${word}-${index}`} draggableId={`${word}-${index}`} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`word-tile ${snapshot.isDragging ? 'dragging' : ''} ${isCorrect === false && incorrectIndices.includes(index) ? 'incorrect' : ''}`}
                    >
                      {word}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {isCorrect === true && (<div className="feedback-message correct">Correct! 🎉</div>)}
      <div className="actions-panel">
        <button className="action-button" onClick={() => setIsHintVisible(!isHintVisible)}>{isHintVisible ? 'Hide Hint' : 'Show Hint'}</button>
        <button className="action-button" onClick={showSolution}>Show Solution</button>
        <button className="action-button" onClick={generate}>Generate New Set</button>
      </div>
      {isHintVisible && (
        <div className="hint-box">
          <span className="hint-label">{settings.nativeLanguage} translation:</span>{currentSentence.native}
        </div>
      )}
      <div className="navigation">
        <button onClick={() => handleNav(-1)} disabled={currentSentenceIndex === 0}>Back</button>
        <button 
          onClick={() => handleNav(1)} 
          // Disable "Next" only if it's the last sentence OR if the user solved it and the auto-advance is in progress.
          disabled={currentSentenceIndex === sentences.length - 1 || (isCorrect && !isRevealed)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default UnscrambleWords;