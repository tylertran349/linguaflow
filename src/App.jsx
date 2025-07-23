// src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchSentencesFromGemini } from './services/geminiService';
import { speakText } from './services/ttsService';
import { supportedLanguages } from './utils/languages';

import Settings from './components/Settings';
import SentenceDisplay from './components/SentenceDisplay';
import ApiKeyModal from './components/ApiKeyModal';
import TopicModal from './components/TopicModal';

function App() {
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('geminiApiKey', '');
  // REMOVED the ttsApiKey state

  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  
  // UPDATED the settings object to use the new engine value
  const [settings, setSettings] = useLocalStorage('settings', {
    nativeLanguage: "English",
    targetLanguage: "Vietnamese",
    difficulty: "B2",
    model: "gemini-2.5-pro",
    ttsEngine: "web-speech" // Default remains the same
  });

  const [topic, setTopic] = useLocalStorage('linguaflowTopic', '');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  
  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  useEffect(() => {
    setCurrentSentenceIndex(0);
  }, [sentences]);
  
  useEffect(() => {
    if (!geminiApiKey) setIsApiKeyModalOpen(true);
  }, []); 

  const handleGenerate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set. Please set it first.");
      setIsApiKeyModalOpen(true);
      return;
    }
    setIsLoading(true);
    setError('');
    setSentences([]);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    try {
      const fetchedSentences = await fetchSentencesFromGemini(geminiApiKey, settings, topic);
      setSentences(fetchedSentences);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    setCurrentSentenceIndex(prev => Math.min(prev + 1, sentences.length - 1));
    setIsTranslationVisible(false);
  };

  const handleBack = () => {
    setCurrentSentenceIndex(prev => Math.max(prev - 1, 0));
    setIsTranslationVisible(false);
  };

  // UPDATED to no longer pass the API key
  const handleSpeakSentence = () => {
    if (currentSentence) {
      speakText(
        currentSentence.target, 
        targetLangCode, 
        settings.ttsEngine
      );
    }
  };

  // SIMPLIFIED to handle only the Gemini key
  const handleSaveApiKey = (key) => {
    setGeminiApiKey(key);
    setIsApiKeyModalOpen(false);
  };

  const handleSaveTopic = (newTopic) => {
    setTopic(newTopic);
    setIsTopicModalOpen(false);
  }

  return (
    <div className="app-layout">
      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Settings</h2>
        </div>
        <Settings 
          settings={settings}
          setSettings={setSettings}
          onGenerate={handleGenerate}
          onOpenApiKeyModal={() => { setIsApiKeyModalOpen(true); setIsSidebarOpen(false); }}
          onOpenTopicModal={() => { setIsTopicModalOpen(true); setIsSidebarOpen(false); }}
        />
      </aside>

      <div className="main-content">
        <header className="app-header">
          <button className="hamburger-menu" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
          <div className="title-group">
            <h1>LinguaFlow</h1>
            <p>Master languages, one sentence at a time.</p>
          </div>
        </header>

        <main className="learning-container">
          {isLoading && <p className="status-message">Generating sentences, please wait...</p>}
          {error && <p className="status-message error">Error: {error}</p>}

          {sentences.length > 0 && !isLoading && (
            <div className="sentence-card">
              <SentenceDisplay 
                sentence={currentSentence}
                isTranslationVisible={isTranslationVisible}
                targetLanguageName={settings.targetLanguage}
                ttsEngine={settings.ttsEngine} // Still need to pass the engine choice
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
            <p className="status-message">Click "Generate New Sentences" in the settings to start.</p>
          )}
        </main>
      </div>

      {isApiKeyModalOpen && 
        <ApiKeyModal 
          onSave={handleSaveApiKey} 
          onClose={() => setIsApiKeyModalOpen(false)}
          currentGeminiKey={geminiApiKey}
        />
      }
      {isTopicModalOpen && <TopicModal onSave={handleSaveTopic} onClose={() => setIsTopicModalOpen(false)} currentTopic={topic} />}
    </div>
  );
}

export default App;