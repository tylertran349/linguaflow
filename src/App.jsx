// src/App.jsx

import { useState, useEffect } from 'react'; // Removed useRef
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';

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

  // --- ref and handleGenerate have been REMOVED ---

  // Open settings modal on first load if no API key exists.
  useEffect(() => {
    if (!geminiApiKey) {
      setIsSettingsModalOpen(true);
    }
  }, []); 

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

      {/* The Sidebar now only contains the settings button */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
        </div>
        <div className="sidebar-controls">
          <button onClick={handleOpenSettings} style={{ width: '100%' }}>
            Settings
          </button>
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
          <SentenceDisplay
            geminiApiKey={geminiApiKey}
            settings={settings}
            topic={topic}
            onApiKeyMissing={handleOpenSettings} // Pass a way to open the settings modal
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