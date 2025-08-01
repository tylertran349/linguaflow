import { useState, useEffect } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';

// --- Component Imports ---
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import SentenceDisplay from './components/SentenceDisplay';
import UnscrambleWords from './components/UnscrambleWords';
import ReadAndRespond from './components/ReadAndRespond'; // Already imported, which is great

function App() {
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('geminiApiKey', '');
  const [settings, setSettings] = useLocalStorage('settings', {
    nativeLanguage: "English",
    targetLanguage: "French",
    difficulty: "B1",
    model: "gemini-1.5-flash",
    ttsEngine: "web-speech",
    sentenceCount: 5
  });
  const [topic, setTopic] = useLocalStorage('linguaflowTopic', '');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeGame, setActiveGame] = useState(null);

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

  // --- THIS IS THE CORRECTED FUNCTION ---
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
        return (
          <UnscrambleWords
            geminiApiKey={geminiApiKey}
            settings={settings}
            topic={topic}
            onApiKeyMissing={handleOpenSettings}
          />
        );
      // --- THE MISSING PIECE ---
      // This case handles the 'read-and-respond' ID from the Sidebar
      case 'read-and-respond':
        return (
          <ReadAndRespond
            geminiApiKey={geminiApiKey}
            settings={settings}
            topic={topic}
            onApiKeyMissing={handleOpenSettings}
          />
        );
      // --- END OF THE FIX ---
      default:
        return (
          <div className="initial-state-container">
            <h2>Welcome to LinguaFlow!</h2>
            <p>Select an exercise from the menu to begin.</p>
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