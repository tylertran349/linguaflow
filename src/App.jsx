// src/App.jsx

import { useState, useEffect } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchSentencesFromGemini } from './services/geminiService';
import { speakText } from './services/ttsService';
import { supportedLanguages } from './utils/languages';

// --- Component Imports ---
import SentenceDisplay from './components/SentenceDisplay';
// Import the new all-in-one modal
import SettingsModal from './components/SettingsModal';

function App() {
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('geminiApiKey', '');
  const [sentences, setSentences] = useLocalStorage('sentences', []);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useLocalStorage('currentSentenceIndex', 0);
  
  const [settings, setSettings] = useLocalStorage('settings', {
    nativeLanguage: "English",
    targetLanguage: "Vietnamese",
    difficulty: "B2",
    model: "gemini-2.5-pro",
    ttsEngine: "web-speech",
    sentenceCount: 20
  });

  const [topic, setTopic] = useLocalStorage('linguaflowTopic', '');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);

  // --- State for the new unified modal ---
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const currentSentence = sentences[currentSentenceIndex];
  const targetLangCode = supportedLanguages.find(l => l.name === settings.targetLanguage)?.code;

  useEffect(() => {
    setCurrentSentenceIndex(0);
  }, [sentences]);
  
  // Open settings modal on first load if no API key exists.
  useEffect(() => {
    if (!geminiApiKey) {
      setIsSettingsModalOpen(true);
    }
  }, []); 

  const handleGenerate = async () => {
    if (!geminiApiKey) {
      setError("Gemini API Key is not set. Please open settings to add it.");
      setIsSettingsModalOpen(true);
      return;
    }
    setIsLoading(true);
    setError('');
    setSentences([]);
    if (window.innerWidth < 1024) setIsSidebarOpen(false); // Close sidebar on mobile
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

  const handleSpeakSentence = () => {
    if (!currentSentence) return;
    speakText(currentSentence.target, targetLangCode, settings.ttsEngine);
  };

  // --- New Handlers for the Settings Modal ---
  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true);
    setIsSidebarOpen(false); // Close sidebar when settings open
  };

  // One function to save everything from the modal
  const handleSaveSettings = (data) => {
    setGeminiApiKey(data.apiKey);
    setSettings(data.settings);
    setTopic(data.topic);
    setIsSettingsModalOpen(false); // Close modal on save
  };

  return (
    <div className="app-layout">
      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* --- The Sidebar is now much simpler --- */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
        </div>
        <div className="sidebar-controls">
          <button onClick={handleGenerate} style={{ width: '100%', marginBottom: '1rem' }}>Generate New Sentences</button>
          <button onClick={handleOpenSettings} style={{ width: '100%' }}>Open Settings</button>
        </div>
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
            <p className="status-message">Click "Generate New Sentences" in the menu to start.</p>
          )}
        </main>
      </div>

      {/* --- Render the single, unified modal --- */}
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
        currentSettings={settings}
        currentApiKey={geminiApiKey}
        currentTopic={topic}
      />
    </div>
  );
}

export default App;