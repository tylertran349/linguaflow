import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

import { useLocalStorage } from '../hooks/useLocalStorage';
import { fetchUnscrambleSentences } from '../services/geminiService';
import { SortableWord } from './SortableWord';
import '../styles/UnscrambleWords.css';

const CORRECT_ADVANCE_DELAY = 1500;

function UnscrambleWords({ geminiApiKey, settings, topic, onApiKeyMissing }) {
  const [sentences, setSentences] = useLocalStorage('unscrambleSentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('unscrambleCurrentIndex', 0);
  const [userOrder, setUserOrder] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [incorrectIndices, setIncorrectIndices] = useState([]);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const currentSentence = sentences[currentSentenceIndex];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

  useEffect(() => {
    if (currentSentence) {
      const correctWords = currentSentence.target.split(' ').map((word, index) => ({
        id: `${currentSentence.target}-${index}`,
        word,
      }));
      setUserOrder(shuffleArray(correctWords));
      resetStateForNewSentence();
    }
  }, [currentSentence]);

  useEffect(() => {
    if (isCorrect && !isRevealed) {
      const timer = setTimeout(() => {
        handleNav(1);
      }, CORRECT_ADVANCE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isCorrect, isRevealed]);

  const resetStateForNewSentence = () => {
    setIsCorrect(null);
    setIncorrectIndices([]);
    setIsHintVisible(false);
    setIsRevealed(false);
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

    currentWordOrder.forEach((item, index) => {
      if (item.word !== correctWords[index]) {
        allCorrect = false;
        newIncorrectIndices.push(index);
      }
    });

    setIsCorrect(allCorrect);
    setIncorrectIndices(newIncorrectIndices);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = userOrder.findIndex((item) => item.id === active.id);
      const newIndex = userOrder.findIndex((item) => item.id === over.id);
      
      const newUserOrder = arrayMove(userOrder, oldIndex, newIndex);
      setUserOrder(newUserOrder);
      checkOrder(newUserOrder);
    }
  };

  const showSolution = () => {
    const correctWords = currentSentence.target.split(' ').map((word, index) => ({
      id: `${currentSentence.target}-${index}`,
      word,
    }));
    setUserOrder(correctWords);
    setIsCorrect(true);
    setIsRevealed(true);
    setIncorrectIndices([]);
  };

  const handleNav = (direction) => {
    const newIndex = currentSentenceIndex + direction;
    if (newIndex >= 0 && newIndex < sentences.length) {
      setCurrentSentenceIndex(newIndex);
    }
  };

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={userOrder} strategy={horizontalListSortingStrategy}>
          <div className={dropzoneClassName}>
            {userOrder.map((item, index) => (
              <SortableWord
                key={item.id}
                id={item.id}
                word={item.word}
                isIncorrect={isCorrect === false && incorrectIndices.includes(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
          disabled={currentSentenceIndex === sentences.length - 1 || (isCorrect && !isRevealed)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default UnscrambleWords;