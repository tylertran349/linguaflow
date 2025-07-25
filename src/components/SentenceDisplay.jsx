import React from 'react';
import '../styles/SentenceDisplay.css';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';

function SentenceDisplay({ sentence, isTranslationVisible, targetLanguageName, ttsEngine }) {
  if (!sentence) {
    return null;
  }

  const targetLangCode = supportedLanguages.find(l => l.name === targetLanguageName)?.code;

  const handleWordClick = (word) => {
    const cleanedWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");
    if (cleanedWord) {
      speakText(cleanedWord, targetLangCode, ttsEngine);
    }
  };

  return (
    <article className="sentence-container">
      <section className="target-sentence">
        {sentence.chunks.map((chunk, index) => (
          // --- FIX IS HERE ---
          // The marginRight style has been removed.
          <span key={index} style={{ color: chunk.color }}>
            {chunk.target_chunk.split(' ').map((word, wordIndex) => (
              <React.Fragment key={wordIndex}>
                <span 
                  onClick={() => handleWordClick(word)} 
                  className="word"
                >
                  {word}
                </span>
                {' '} 
              </React.Fragment>
            ))}
          </span>
          // --- END OF FIX ---
        ))}
      </section>

      {isTranslationVisible && (
        <section className="native-sentence">
          {/* We should also remove the margin from the native sentence for consistency */}
          {sentence.chunks.map((chunk, index) => (
            <span key={index} style={{ color: chunk.color }}>
              {chunk.native_chunk}{' '}
            </span>
          ))}
        </section>
      )}
    </article>
  );
}

export default SentenceDisplay;