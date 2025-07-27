// src/App.jsx

import { useState, useEffect } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';

// --- Component Imports ---
import Sidebar from './components/Sidebar';
import SentenceDisplay from './components/SentenceDisplay';
import SettingsModal from './components/SettingsModal';
import UnscrambleWords from './components/UnscrambleWords'; // <-- 1. IMPORT THE NEW COMPONENT

function App() {
  // ... all existing state remains the same ...
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeGame, setActiveGame] = useState(null);

  // ... all existing useEffect and handlers remain the same ...
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
  
  const handleNavigate = (gameId) => {
    setActiveGame(gameId);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const renderActiveGame = () => {
    switch (activeGame) {
      case 'sentence-generator':
        return (
          <SentenceDisplay
            geminiApiKey={geminiApiKey}
            settings={settings}
            topic={topic}
            onApiKeyMissing={handleOpenSettings}
          />
        );
      case 'unscramble-words':
        // FIX: Pass all the required props to the UnscrambleWords component
        return (
          <UnscrambleWords
            geminiApiKey={geminiApiKey}
            settings={settings}
            topic={topic}
            onApiKeyMissing={handleOpenSettings}
          />
        );
      default:
        return (
          <div className="initial-state-container">
            <h2>Welcome to LinguaFlow!</h2>
            <p>Select a game from the menu to begin.</p>
          </div>
        );
    }
  };

  // ... the return/JSX part of the component remains the same ...
  return (
    <div className="app-layout">
      {isSidebarOpen && <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      <Sidebar 
        isOpen={isSidebarOpen}
        activeGame={activeGame}
        onNavigate={handleNavigate}
        onOpenSettings={handleOpenSettings}
      />

      <div className="main-content">
        <header className="app-header">
          <button className="hamburger-menu" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
        </header>

        <main className="learning-container">
          {renderActiveGame()}
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