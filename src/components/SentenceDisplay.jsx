// src/components/SentenceDisplay.jsx
import '../styles/SentenceDisplay.css';
import { speakText } from '../services/ttsService';
import { supportedLanguages } from '../utils/languages';

// The component no longer needs the ttsApiKey prop
function SentenceDisplay({ sentence, isTranslationVisible, targetLanguageName, ttsEngine }) {
  if (!sentence) {
    return null;
  }

  const targetLangCode = supportedLanguages.find(l => l.name === targetLanguageName)?.code;

  // The click handler no longer passes the API key
  const handleWordClick = (word) => {
    speakText(word, targetLangCode, ttsEngine);
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
                  className="word"
                >
                    {word}
                </span>
            ))}
          </span>
        ))}
      </section>

      {isTranslationVisible && (
        <section className="native-sentence">
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