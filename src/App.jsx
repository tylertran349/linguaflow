import { useState, useEffect } from 'react';
import './styles/App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchSentencesFromGemini } from './services/geminiService';
import { speakText } from './services/ttsService';
import { supportedLanguages } from './utils/languages';

// Import your two main components
import SentenceDisplay from './components/SentenceDisplay';
import SettingsModal from './components/SettingsModal';

function App() {
  // State for API keys and core content
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('geminiApiKey', '');
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  
  // Consolidated settings state
  const [settings, setSettings] = useLocalStorage('settings', {
    nativeLanguage: "English",
    targetLanguage: "Vietnamese",
    difficulty: "B2",
    model: "gemini-2.5-pro",
    ttsEngine: "web-speech",
    sentenceCount: 20
  });

  const [topic, setTopic] = useLocalStorage('linguaflowTopic', '');
  
  // State for UI elements and processes
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  
  // Derived state for convenience
  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  // Effects
  useEffect(() => {
    // When a new set of sentences is loaded, reset to the first sentence
    setCurrentSentenceIndex(0);
    setIsTranslationVisible(false); // Also hide translation for the new sentence
  }, [sentences, setCurrentSentenceIndex]);
  
  useEffect(() => {
    // On first load, if no API key is present, open the settings modal to prompt the user
    if (!geminiApiKey) {
      setIsSettingsModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs only once on initial component mount

  // Event Handlers
  const handleGenerate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set. Please add it in Settings.");
      setIsSettingsModalOpen(true);
      return;
    }
    setIsLoading(true);
    setError('');
    setSentences([]); // Clear old sentences
    try {
      const fetchedSentences = await fetchSentencesFromGemini(geminiApiKey, settings, topic);
      setSentences(fetchedSentences);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // New handler to save all settings from the modal at once
  const handleSaveSettings = (newConfig) => {
    setSettings(newConfig.settings);
    setTopic(newConfig.topic);
    setGeminiApiKey(newConfig.geminiKey);
    // The modal's internal logic will call the onClose function passed to it.
  };

  const handleNext = () => {
    setCurrentSentenceIndex(prev => Math.min(prev + 1, sentences.length - 1));
    setIsTranslationVisible(false);
  };

  const handleBack = () => {
    setCurrentSentenceIndex(prev => Math.max(prev - 1, 0));
    setIsTranslationVisible(false);
  };

  const handleSpeakSentence = () => {
    if (!currentSentence) return;
    speakText(
      currentSentence.target,
      targetLangCode,
      settings.ttsEngine
    );
  };

  return (
    <div className="main-content">
      <header className="app-header">
        <div className="title-group">
          <h1>LinguaFlow</h1>
          <p>Master languages, one sentence at a time.</p>
        </div>
        <button className="settings-button" onClick={() => setIsSettingsModalOpen(true)}>
          Settings
        </button>
      </header>

      <main className="learning-container">
        <div className="main-controls">
          <button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Sentences'}
          </button>
        </div>

        {isLoading && <p className="status-message">Generating sentences, please wait...</p>}
        {error && <p className="status-message error">Error: {error}</p>}

        {sentences.length > 0 && !isLoading && (
          <div className="sentence-card">
            <SentenceDisplay 
              sentence={currentSentence}
              isTranslationVisible={isTranslationVisible}
              targetLanguageName={settings.targetLanguage}
              ttsEngine={settings.ttsEngine}
            />
            
            <div className="actions">
              <button onClick={() => setIsTranslationVisible(prev => !prev)}>
                {isTranslationVisible ? 'Hide' : 'Show'} Translation
              </button>
              <button onClick={handleSpeakSentence} disabled={!currentSentence}>
                Pronounce Sentence
              </button>
            </div>

            <div className="navigation">
              <button onClick={handleBack} disabled={currentSentenceIndex === 0}>Back</button>
              <span>{currentSentenceIndex + 1} / {sentences.length}</span>
              <button onClick={handleNext} disabled={currentSentenceIndex === sentences.length - 1}>Next</button>
            </div>
          </div>
        )}

        {!isLoading && sentences.length === 0 && !error && (
          <p className="status-message">Click "Generate Sentences" to begin, or open Settings to customize.</p>
        )}
      </main>

      {isSettingsModalOpen && 
        <SettingsModal 
          onSave={handleSaveSettings} 
          onClose={() => setIsSettingsModalOpen(false)}
          currentSettings={settings}
          currentTopic={topic}
          currentGeminiKey={geminiApiKey}
        />
      }
    </div>
  );
}

export default App;