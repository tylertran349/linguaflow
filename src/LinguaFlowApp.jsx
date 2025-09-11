// src/LinguaFlowApp.jsx
import { useState, useEffect } from 'react';
import './App.css';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAuth, useUser } from '@clerk/clerk-react';

// --- Component Imports ---
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import SentenceDisplay from './components/SentenceDisplay';
import UnscrambleWords from './components/UnscrambleWords';
import ReadAndRespond from './components/ReadAndRespond';
import WriteAResponse from './components/WriteAResponse';

// Define the breakpoint once to avoid magic numbers
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';
const MOBILE_BREAKPOINT = 1024;

// Change the function name from App to LinguaFlowApp
function LinguaFlowApp() { 
  const [geminiApiKey, setGeminiApiKey] = useLocalStorage('geminiApiKey', '');
   const [settings, setSettings] = useState({
    nativeLanguage: "English",
    targetLanguage: "Vietnamese",
    difficulty: "B2",
    model: "gemini-2.5-flash", 
    ttsEngine: "web-speech",
    sentenceCount: 20,
    webSpeechRate: 0.6,
    googleTranslateRate: 1,
    sentenceDisplayHistorySize: 100,
    readAndRespondHistorySize: 100,
    writeAResponseHistorySize: 100,
  });
  const [topic, setTopic] = useState('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeModule, setActiveModule] = useState(null);

  const { getToken } = useAuth();
  const { isSignedIn } = useUser();

  useEffect(() => {
    const fetchUserSettings = async () => {
      if (isSignedIn) {
        try {
          const token = await getToken();
          const response = await fetch(`${API_BASE_URL}/api/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) {
            throw new Error('Could not fetch user settings.');
          }
          const data = await response.json();
          // Only update state if the fetched settings are not null/undefined
          if (data.settings) {
            setSettings(data.settings);
          }
          if (data.topic) {
            setTopic(data.topic);
          }
        } catch (error) {
          console.error("Failed to fetch settings from DB:", error);
          // Keep default settings if fetch fails
        }
      }
    };

    fetchUserSettings();
  }, [isSignedIn, getToken]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); 

  useEffect(() => {
    if (!geminiApiKey) {
      setIsSettingsModalOpen(true);
    }
  }, [geminiApiKey]);

  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true);
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setIsSidebarOpen(false);
    }
  };

  const handleSaveSettings = async (data) => {
    // The API key is still saved to local storage
    setGeminiApiKey(data.apiKey);

    // --- REPLACE THE OLD LOGIC ---
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: data.settings,
          topic: data.topic
        })
      });
      // Update local state only after successful API call for immediate UI feedback
      setSettings(data.settings);
      setTopic(data.topic);
    } catch (error) {
      console.error("Failed to save settings to DB:", error);
      // Optionally, show an error message to the user
    }
    // --- END REPLACEMENT ---

    setIsSettingsModalOpen(false);
  };
  
  const handleNavigate = (gameId) => {
    setActiveModule(gameId);
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setIsSidebarOpen(false);
    }
  };

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'sentence-generator':
        return <SentenceDisplay geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings}/>;
      case 'unscramble-words':
        return <UnscrambleWords geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings}/>;
      case 'read-and-respond':
        return <ReadAndRespond geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings}/>;
      case 'write-a-response':
        return <WriteAResponse geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings}/>;
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

// Make sure to export the function
export default LinguaFlowApp;