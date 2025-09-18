import React, { useState, useEffect } from 'react';
import { PartyPopper } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay, // Import DragOverlay
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

function UnscrambleWords({ geminiApiKey, settings, topic, onApiKeyMissing, isSavingSettings }) {
  // ... (all other state remains the same)
  const [sentences, setSentences] = useLocalStorage('unscrambleSentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('unscrambleCurrentIndex', 0);
  const [userOrder, setUserOrder] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [incorrectIndices, setIncorrectIndices] = useState([]);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Generating sentences, please wait...');
  const [savingMessage, setSavingMessage] = useState('Saving your settings');
  const [matchedSolution, setMatchedSolution] = useState(null);
  const [hasUserMovedCards, setHasUserMovedCards] = useState(false);

  // --- NEW STATE for DragOverlay ---
  const [activeItem, setActiveItem] = useState(null);

  const currentSentence = sentences[currentSentenceIndex];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Effect for animated ellipsis during loading
  useEffect(() => {
    let intervalId;
    if (isLoading) {
      let dotCount = 0;
      const baseMessage = 'Generating sentences, please wait';
      setLoadingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setLoadingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isLoading]);

  // Effect for animated ellipsis during settings saving
  useEffect(() => {
    let intervalId;
    if (isSavingSettings) {
      let dotCount = 0;
      const baseMessage = 'Saving your settings';
      setSavingMessage(baseMessage);
      intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4; 
        setSavingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
      }, 400); 
    }
    return () => clearInterval(intervalId);
  }, [isSavingSettings]);

  // Function to split text into words and punctuation separately
  const splitIntoElements = (text) => {
    // Split by spaces and then separate punctuation from words
    const elements = [];
    const parts = text.split(' ');
    
    parts.forEach((part, partIndex) => {
      // Check if the part contains punctuation at the end
      const punctuationMatch = part.match(/^(.+?)([.,!?;:]+)$/);
      
      if (punctuationMatch) {
        const [, word, punctuation] = punctuationMatch;
        // Add the word
        if (word) {
          elements.push({
            id: `${text}-word-${partIndex}`,
            word: word,
            type: 'word'
          });
        }
        // Add each punctuation mark as a separate element
        punctuation.split('').forEach((punct, punctIndex) => {
          elements.push({
            id: `${text}-punct-${partIndex}-${punctIndex}`,
            word: punct,
            type: 'punctuation'
          });
        });
      } else {
        // No punctuation, just add the word
        elements.push({
          id: `${text}-word-${partIndex}`,
          word: part,
          type: 'word'
        });
      }
    });
    
    return elements;
  };

  const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

  useEffect(() => {
    if (currentSentence) {
      const correctElements = splitIntoElements(currentSentence.target);
      setUserOrder(shuffleArray(correctElements));
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
    setMatchedSolution(null);
    setHasUserMovedCards(false);
  };

  const generate = async () => {
    if (isSavingSettings) {
      return; // Prevent generation while settings are being saved
    }

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

  const checkOrder = (currentElementOrder) => {
    // Get all valid solutions (primary + alternatives)
    const allValidSolutions = [currentSentence.target];
    if (currentSentence.alternatives && Array.isArray(currentSentence.alternatives)) {
      allValidSolutions.push(...currentSentence.alternatives);
    }

    // Check if current order matches any valid solution
    let isCorrect = false;
    let incorrectIndices = [];
    let matchedSolution = null;

    for (const solution of allValidSolutions) {
      const correctElements = splitIntoElements(solution);
      let solutionIsCorrect = true;
      const solutionIncorrectIndices = [];

      // Check if current order matches this solution
      currentElementOrder.forEach((item, index) => {
        if (index >= correctElements.length || 
            item.word !== correctElements[index].word || 
            item.type !== correctElements[index].type) {
          solutionIsCorrect = false;
          solutionIncorrectIndices.push(index);
        }
      });

      // If this solution matches, we're done
      if (solutionIsCorrect && currentElementOrder.length === correctElements.length) {
        isCorrect = true;
        incorrectIndices = [];
        matchedSolution = solution;
        break;
      }

      // Keep track of incorrect indices for the primary solution
      if (solution === currentSentence.target) {
        incorrectIndices = solutionIncorrectIndices;
      }
    }

    setIsCorrect(isCorrect);
    // Only show incorrect indices if user has moved cards
    setIncorrectIndices(hasUserMovedCards ? incorrectIndices : []);
    
    // Store which solution was matched for better feedback
    if (isCorrect) {
      setMatchedSolution(matchedSolution);
    } else {
      setMatchedSolution(null);
    }
  };

  // --- UPDATED DRAG HANDLERS ---
  const handleDragStart = (event) => {
    const { active } = event;
    const item = userOrder.find((item) => item.id === active.id);
    setActiveItem(item);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = userOrder.findIndex((item) => item.id === active.id);
      const newIndex = userOrder.findIndex((item) => item.id === over.id);
      
      const newUserOrder = arrayMove(userOrder, oldIndex, newIndex);
      setUserOrder(newUserOrder);
      setHasUserMovedCards(true);
      checkOrder(newUserOrder);
    }

    setActiveItem(null); // Clear the active item
  };
  
  const showSolution = () => {
    // Show the primary solution (first valid arrangement)
    const correctElements = splitIntoElements(currentSentence.target);
    setUserOrder(correctElements);
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


  // --- JSX REMAINS LARGELY THE SAME ---
  if (isLoading) {
    return <p className="status-message">{loadingMessage}</p>;
  }

  if (isSavingSettings) {
    return <p className="status-message">{savingMessage}</p>;
  }

  // 2. Second Priority: Handle the initial state before any sentences have been generated.
  if (sentences.length === 0) {
    return (
      <div className="initial-state-container">
        {error && <p className="status-message error">{error}</p>}
        <h2>Unscramble Words</h2>
        <p>Drag and drop the words to form a correct sentence.</p>
        <button 
          className="generate-button" 
          onClick={generate}
          disabled={isSavingSettings}
        >
          Start Game
        </button>
      </div>
    );
  }

  // 3. If not loading and we have sentences, render the main game UI.
  const dropzoneClassName = `word-bank ${isCorrect === true ? 'correct-dropzone' : isCorrect === false ? 'incorrect-dropzone' : ''}`;

  return (
    <div className="unscramble-container">
      <div className="sentence-counter">Sentence {currentSentenceIndex + 1} / {sentences.length}</div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={userOrder} strategy={horizontalListSortingStrategy}>
          <div className={dropzoneClassName}>
            {userOrder.map((item, index) => (
              <SortableWord
                key={item.id}
                id={item.id}
                word={item.word}
                type={item.type}
                isIncorrect={isCorrect === false && incorrectIndices.includes(index)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <div className="word-tile dragging">{activeItem.word}</div>
          ) : null}
        </DragOverlay>

      </DndContext>

      {isCorrect === true && (
        <div className="feedback-message correct">
          Correct! <PartyPopper size={20} color="var(--color-green)" />
        </div>
      )}

      <div className="actions-panel">
        <button className="action-button" onClick={() => setIsHintVisible(!isHintVisible)}>{isHintVisible ? 'Hide Hint' : 'Show Hint'}</button>
        <button className="action-button" onClick={showSolution}>Show Solution</button>
        <button 
          className="action-button" 
          onClick={generate}
          disabled={isSavingSettings}
        >
          {isSavingSettings ? savingMessage : 'Generate New Set'}
        </button>
      </div>

      {isHintVisible && (
        <div className="hint-box">
          <span className="hint-label">{settings.nativeLanguage} translation:</span>{currentSentence.native}
          {currentSentence.alternatives && currentSentence.alternatives.length > 0 && (
            <div className="hint-note">
              <small>💡 Multiple grammatically correct arrangements are accepted! Try different word orders.</small>
            </div>
          )}
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