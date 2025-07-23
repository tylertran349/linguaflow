// src/App.jsx
import { useState, useEffect } from 'react';
// Import the new stylesheet path
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
  const [apiKey, setApiKey] = useLocalStorage('geminiApiKey', '');
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  
  const [settings, setSettings] = useLocalStorage('settings', {
    nativeLanguage: "English",
    targetLanguage: "Vietnamese",
    difficulty: "B2",
    model: "gemini-2.5-pro" 
  });

  const [topic, setTopic] = useLocalStorage('linguaflowTopic', '');
  
  // State to manage sidebar visibility on mobile
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
    if (!apiKey) setIsApiKeyModalOpen(true);
  }, [apiKey]);
  
  const handleGenerate = async () => {
    if (!apiKey) {
      setError("API Key is not set. Please set your API key first.");
      setIsApiKeyModalOpen(true);
      return;
    }
    setIsLoading(true);
    setError('');
    setSentences([]);
    // Close sidebar on mobile after clicking generate
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    try {
      const fetchedSentences = await fetchSentencesFromGemini(apiKey, settings, topic);
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

  const handleSpeakSentence = () => {
    if (currentSentence) speakText(currentSentence.target, targetLangCode);
  };

  const handleSaveApiKey = (key) => setApiKey(key);
  const handleSaveTopic = (newTopic) => setTopic(newTopic);

  // This is the new JSX structure for the entire app
  return (
    <div className="app-layout">
      {/* Mobile-only overlay */}
      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* The Sidebar for settings */}
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

      {/* The Main Content Area */}
      <div className="main-content">
        <header className="app-header">
          {/* Mobile-only Hamburger Menu Button */}
          <button className="hamburger-menu" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <span></span>
            <span></span>
            <span></span>
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

      {isApiKeyModalOpen && <ApiKeyModal onSave={handleSaveApiKey} onClose={() => setIsApiKeyModalOpen(false)} />}
      {isTopicModalOpen && <TopicModal onSave={handleSaveTopic} onClose={() => setIsTopicModalOpen(false)} currentTopic={topic} />}
    </div>
  );
}

export default App;