// src/components/UnscrambleWords.jsx

import React, { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchUnscrambleSentences } from '../services/geminiService';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import '../styles/UnscrambleWords.css'; // We will create this CSS file

// Helper function to shuffle an array
const shuffleArray = (array) => {
  return [...array].sort(() => Math.random() - 0.5);
};

function UnscrambleWords({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  const [sentences, setSentences] = useLocalStorage('unscrambleSentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('unscrambleCurrentIndex', 0);
  const [userOrder, setUserOrder] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [incorrectIndices, setIncorrectIndices] = useState([]);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isSolutionVisible, setIsSolutionVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const currentSentence = sentences[currentSentenceIndex];

  // Effect to set up a new sentence whenever the index or data changes
  useEffect(() => {
    if (currentSentence) {
      const correctWords = currentSentence.target.split(' ');
      setUserOrder(shuffleArray(correctWords));
      resetStateForNewSentence();
    }
  }, [currentSentence]);

  const resetStateForNewSentence = () => {
    setIsCorrect(null);
    setIncorrectIndices([]);
    setIsHintVisible(false);
    setIsSolutionVisible(false);
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
      setCurrentSentenceIndex(0); // Start from the first sentence
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOrder = (currentWordOrder) => {
    const correctWords = currentSentence.target.split(' ');
    let allCorrect = true;
    const newIncorrectIndices = [];
    
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
    checkOrder(items); // Check the new order after every drag
  };

  const showSolution = () => {
    setUserOrder(currentSentence.target.split(' '));
    setIsSolutionVisible(true);
    setIsCorrect(true);
    setIncorrectIndices([]);
  };

  const handleNav = (direction) => {
    const newIndex = currentSentenceIndex + direction;
    if (newIndex >= 0 && newIndex < sentences.length) {
      setCurrentSentenceIndex(newIndex);
    }
  };

  // --- Render Logic ---
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

  return (
    <div className="unscramble-container">
      <div className="sentence-counter">
        Sentence {currentSentenceIndex + 1} / {sentences.length}
      </div>

      <DragDropContext onDragEnd={handleOnDragEnd}>
        <Droppable droppableId="words" direction="horizontal">
          {(provided) => (
            <div className="word-bank" {...provided.droppableProps} ref={provided.innerRef}>
              {userOrder.map((word, index) => (
                <Draggable key={`${word}-${index}`} draggableId={`${word}-${index}`} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`word-tile ${snapshot.isDragging ? 'dragging' : ''} ${
                        !isCorrect && incorrectIndices.includes(index) ? 'incorrect' : ''
                      }`}
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
      
      {isCorrect === true && (
        <div className="feedback-message correct">Correct! 🎉</div>
      )}

      <div className="actions-panel">
        <button className="action-button" onClick={() => setIsHintVisible(!isHintVisible)}>
          {isHintVisible ? 'Hide Hint' : 'Show Hint'}
        </button>
        <button className="action-button" onClick={showSolution}>
          Show Solution
        </button>
      </div>
      
      {isHintVisible && <div className="hint-box">{currentSentence.native}</div>}
      {isSolutionVisible && <div className="solution-box">Correct sentence: "{currentSentence.target}"</div>}

      <div className="navigation">
        <button onClick={() => handleNav(-1)} disabled={currentSentenceIndex === 0}>
          Back
        </button>
        <button onClick={() => handleNav(1)} disabled={currentSentenceIndex === sentences.length - 1}>
          Next
        </button>
      </div>
    </div>
  );
}

export default UnscrambleWords;