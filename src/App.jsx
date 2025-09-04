import { useState, useEffect } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';

// --- Component Imports ---
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import SentenceDisplay from './components/SentenceDisplay';
import UnscrambleWords from './components/UnscrambleWords';
import ReadAndRespond from './components/ReadAndRespond';
import WriteAResponse from './components/WriteAResponse';

// Define the breakpoint once to avoid magic numbers
const MOBILE_BREAKPOINT = 1024;

function App() {
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('geminiApiKey', '');
  const [settings, setSettings] = useLocalStorage('settings', {
    nativeLanguage: "English",
    targetLanguage: "Vietnamese",
    difficulty: "B2",
    model: "gemini-2.5-flash", // Updated model name as gemini-2.5-flash is not a valid model
    ttsEngine: "web-speech",
    sentenceCount: 20,
    webSpeechRate: 0.6,
    googleTranslateRate: 1,
    sentenceDisplayHistorySize: 100,
    readAndRespondHistorySize: 100,
    writeAResponseHistorySize: 100,
  });
  const [topic, setTopic] = useLocalStorage('linguaflowTopic', '');
  
  // --- MODIFICATION 1: Set initial state based on window width ---
  // This prevents the overlay from flashing on mobile on initial load.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeModule, setActiveModule] = useState(null);

  // --- MODIFICATION 2: Add an effect to handle window resizing ---
  useEffect(() => {
    const handleResize = () => {
      // Automatically open the sidebar on wide screens and close it on narrow screens
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // This is a crucial cleanup function to prevent memory leaks
    return () => window.removeEventListener('resize', handleResize);
  }, []); // The empty dependency array ensures this effect runs only once on mount

  useEffect(() => {
    if (!geminiApiKey) {
      setIsSettingsModalOpen(true);
    }
  }, [geminiApiKey]); // Added dependency to follow best practices

  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true);
    // On mobile, also ensure the sidebar closes
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setIsSidebarOpen(false);
    }
  };

  const handleSaveSettings = (data) => {
    setGeminiApiKey(data.apiKey);
    setSettings(data.settings);
    setTopic(data.topic);
    setIsSettingsModalOpen(false);
  };
  
  const handleNavigate = (gameId) => {
    setActiveModule(gameId);
    // Your existing logic here is already perfect for mobile navigation
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setIsSidebarOpen(false);
    }
  };

  const renderActiveModule = () => {
    // This function is already correct and doesn't need changes.
    switch (activeModule) {
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
      case 'read-and-respond':
        return (
          <ReadAndRespond
            geminiApiKey={geminiApiKey}
            settings={settings}
            topic={topic}
            onApiKeyMissing={handleOpenSettings}
          />
        );
      case 'write-a-response':
        return (
          <WriteAResponse
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
            <p>Select an exercise from the menu to begin.</p>
          </div>
        );
    }
  };

  return (
    <div className="app-layout">
      {/* --- MODIFICATION 3: Conditionally render overlay based on a more specific check --- */}
      {/* This ensures the overlay only shows on mobile screens when the sidebar is open */}
      {isSidebarOpen && window.innerWidth < MOBILE_BREAKPOINT && (
        <div className="overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <Sidebar 
        isOpen={isSidebarOpen}
        activeModule={activeModule}
        onNavigate={handleNavigate}
        onOpenSettings={handleOpenSettings}
      />

      <div className="main-content">
        <header className="app-header">
          {/* Your button is perfect. No changes needed. */}
          <button className="hamburger-menu" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
        </header>

        <main className="learning-container">
          {renderActiveModule()}
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