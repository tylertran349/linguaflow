// src/components/SentenceDisplay.jsx
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';
import '../styles/SentenceDisplay.css';

function SentenceDisplay({ sentence, isTranslationVisible, targetLanguageName }) {
  if (!sentence) {
    return <p>Generate sentences to get started!</p>;
  }

  const targetLangCode = supportedLanguages.find(l => l.name === targetLanguageName)?.code;

  const handleWordClick = (word) => {
    speakText(word, targetLangCode);
  };

  return (
    <article className="sentence-container">
      <section className="target-sentence">
        {sentence.chunks.map((chunk, index) => (
          <span key={index} style={{ color: chunk.color, marginRight: '5px' }}>
            {chunk.target_chunk.split(' ').map((word, wordIndex) => (
                <span 
                  key={wordIndex} 
                  onClick={() => handleWordClick(word)} 
                  className="word" // <-- ADD THIS CLASSNAME
                >
                    {word}
                </span>
            ))}
          </span>
        ))}
      </section>

      {isTranslationVisible && (
        <section className="native-sentence">
          {/* This part doesn't need changes */}
          {sentence.chunks.map((chunk, index) => (
            <span key={index} style={{ color: chunk.color, marginRight: '5px' }}>
              {chunk.native_chunk}
            </span>
          ))}
        </section>
      )}
    </article>
  );
}

export default SentenceDisplay;