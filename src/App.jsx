// src/App.jsx

import { useState, useEffect, useRef } from 'react'; // Added useRef
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
// No longer needs fetchSentencesFromGemini or speakText
// import { fetchSentencesFromGemini } from './services/geminiService';
// import { speakText } from './services/ttsService';
// No longer needs supportedLanguages
// import { supportedLanguages } from './utils/languages';

// --- Component Imports ---
import SentenceDisplay from './components/SentenceDisplay';
import SettingsModal from './components/SettingsModal';

function App() {
  // --- App-level state (global settings) ---
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('geminiApiKey', '');
  const [settings, setSettings] = useLocalStorage('settings', {
    nativeLanguage: "English",
    targetLanguage: "Vietnamese",
    difficulty: "B2",
    model: "gemini-2.5-pro",
    ttsEngine: "web-speech",
    sentenceCount: 20
  });
  const [topic, setTopic] = useLocalStorage('linguaflowTopic', '');
  
  // --- App-level UI state ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // --- All sentence-related state has been REMOVED ---
  // const [sentences, setSentences] = ...
  // const [currentSentenceIndex, setCurrentSentenceIndex] = ...
  // const [isLoading, setIsLoading] = ...
  // const [error, setError] = ...
  // const [isTranslationVisible, setIsTranslationVisible] = ...

  // Create a ref to access the SentenceDisplay component's imperative methods
  const sentenceDisplayRef = useRef();

  // Open settings modal on first load if no API key exists.
  useEffect(() => {
    if (!geminiApiKey) {
      setIsSettingsModalOpen(true);
    }
  }, []); 

  // --- Handlers are now much simpler ---

  const handleGenerate = () => {
    // Call the 'generate' function inside SentenceDisplay using the ref
    if (sentenceDisplayRef.current) {
      sentenceDisplayRef.current.generate();
    }
    if (window.innerWidth < 1024) setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true);
    setIsSidebarOpen(false);
  };

  const handleSaveSettings = (data) => {
    setGeminiApiKey(data.apiKey);
    setSettings(data.settings);
    setTopic(data.topic);
    setIsSettingsModalOpen(false);
  };

  return (
    <div className="app-layout">
      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>}

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

        {/* The main content area now just renders the self-contained game */}
        <main className="learning-container">
          <SentenceDisplay
            ref={sentenceDisplayRef}
            geminiApiKey={geminiApiKey}
            settings={settings}
            topic={topic}
          />
        </main>
      </div>

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