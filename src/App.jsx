// src/App.jsx

import { useState, useEffect } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';

// --- Component Imports ---
import Sidebar from './components/Sidebar'; // Import the new Sidebar
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open on desktop
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // --- New state to manage the active game view ---
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    if (!geminiApiKey) {
      setIsSettingsModalOpen(true);
    }
  }, []); 

  // --- Handlers ---
  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true);
    setIsSidebarOpen(false); // Close sidebar when settings open
  };

  const handleSaveSettings = (data) => {
    setGeminiApiKey(data.apiKey);
    setSettings(data.settings);
    setTopic(data.topic);
    setIsSettingsModalOpen(false);
  };
  
  // New handler to set the active game from the sidebar
  const handleNavigate = (gameId) => {
    setActiveGame(gameId);
    // Auto-close sidebar on navigation, especially useful on mobile
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
      // case 'flashcards': // Example for a future game
      //   return <FlashcardsComponent />;
      default:
        return (
          <div className="initial-state-container">
            <h2>Welcome to LinguaFlow!</h2>
            <p>Select a game from the menu to begin.</p>
          </div>
        );
    }
  };

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
          {/* The title can now be more dynamic or removed if redundant */}
        </header>

        {/* The main content area now renders based on the activeGame state */}
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