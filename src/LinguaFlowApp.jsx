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
import LoadingSettings from './components/LoadingSettings';

// Define the breakpoint once to avoid magic numbers
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';
const MOBILE_BREAKPOINT = 1024;

// Change the function name from App to LinguaFlowApp
function LinguaFlowApp() { 
  const [geminiApiKey, setGeminiApiKey] = useState(''); 
  const [settings, setSettings] = useState({
    nativeLanguage: "English",
    targetLanguage: "Spanish",
    difficulty: "B2",
    model: "gemini-2.5-flash", 
    ttsEngine: "google-translate",
    sentenceCount: 20,
    webSpeechRate: 0.6,
    googleTranslateRate: 1,
    sentenceDisplayHistorySize: 100,
    readAndRespondHistorySize: 100,
    writeAResponseHistorySize: 100,
    temperature: 1,
    minSentenceLength: 6,
    maxSentenceLength: 12,
  });
  const [topic, setTopic] = useState('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeModule, setActiveModule] = useState(null);
  const [isRetryingSettings, setIsRetryingSettings] = useState(false);
  const [settingsRetryInterval, setSettingsRetryInterval] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(null);
  const [isRetryingSave, setIsRetryingSave] = useState(false);
  const [saveRetryInterval, setSaveRetryInterval] = useState(null);
  const [pendingSaveData, setPendingSaveData] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const { getToken } = useAuth();
  const { isSignedIn } = useUser();

  const stopRetryingSettings = () => {
    if (isRetryingSettings) {
      console.log('Stopping settings retry - settings loaded successfully');
    }
    setIsRetryingSettings(false);
    if (settingsRetryInterval) {
      clearInterval(settingsRetryInterval);
      setSettingsRetryInterval(null);
    }
  };

  const stopRetryingSave = () => {
    if (isRetryingSave) {
      console.log('Stopping save retry - settings saved successfully');
    }
    setIsRetryingSave(false);
    setIsSavingSettings(false);
    if (saveRetryInterval) {
      clearInterval(saveRetryInterval);
      setSaveRetryInterval(null);
    }
    setPendingSaveData(null);
  };

  const attemptSaveSettings = async (data) => {
    setIsSavingSettings(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: data.settings,
          topic: data.topic,
          apiKey: data.apiKey
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update local state for immediate UI feedback
      setSettings(data.settings);
      setTopic(data.topic);
      setGeminiApiKey(data.apiKey);
      
      // Stop retrying since we successfully saved
      stopRetryingSave();
      
      // Clear loading timeout and hide initial loading screen
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
      setIsInitialLoading(false);
      
      console.log('Settings saved successfully');
      return true; // Success
    } catch (error) {
      console.error("Failed to save settings to DB:", error);
      // Only set isSavingSettings to false on failure, not on success
      // On success, stopRetryingSave() will handle setting it to false
      setIsSavingSettings(false);
      return false; // Failure
    }
  };

  const startRetryingSave = (data) => {
    if (isRetryingSave) return; // Already retrying
    
    console.log('Starting save retry - attempting to save settings to MongoDB');
    setIsRetryingSave(true);
    setIsSavingSettings(true);
    setPendingSaveData(data);
    
    // Try immediately first
    attemptSaveSettings(data).then(success => {
      if (!success) {
        console.log('Initial save attempt failed, starting interval retry every 2 seconds');
        // If immediate attempt failed, start interval retry
        const interval = setInterval(async () => {
          const success = await attemptSaveSettings(data);
          if (success) {
            clearInterval(interval);
            setSaveRetryInterval(null);
          }
        }, 2000); // Retry every 2 seconds
        
        setSaveRetryInterval(interval);
      }
    });
  };

  const fetchUserSettings = async () => {
    if (isSignedIn) {
      const startTime = Date.now();
      try {
        console.log('Fetching user settings...');
        const token = await getToken();
        const tokenTime = Date.now();
        console.log(`Token obtained in ${tokenTime - startTime}ms`);
        
        const response = await fetch(`${API_BASE_URL}/api/settings`, { // <-- Make sure this uses API_BASE_URL
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const fetchTime = Date.now();
        console.log(`API request completed in ${fetchTime - tokenTime}ms`);
        
        if (!response.ok) {
          throw new Error('Could not fetch user settings.');
        }
        const data = await response.json();
        
        // Update all state from the fetched data
        if (data.settings) setSettings(data.settings);
        if (data.topic) setTopic(data.topic);
        if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey); // <-- ADD THIS LINE

        // Always stop retrying when we successfully fetch settings (even if not currently retrying)
        // This includes when the response is empty (new user with no settings)
        stopRetryingSettings();
        
        // Clear loading timeout and hide initial loading screen
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
          setLoadingTimeout(null);
        }
        setIsInitialLoading(false);

        const totalTime = Date.now() - startTime;
        console.log(`Settings loaded successfully in ${totalTime}ms total (empty response for new user is normal)`);
        return true; // Success - even for empty responses
      } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`Failed to fetch settings from DB after ${totalTime}ms:`, error);
        return false; // Failure
      }
    }
    return false; // Not signed in
  };

  const startRetryingSettings = () => {
    if (isRetryingSettings) return; // Already retrying
    
    console.log('Starting settings retry - attempting to load settings from MongoDB');
    setIsRetryingSettings(true);
    
    // Try immediately first
    fetchUserSettings().then(success => {
      if (!success) {
        console.log('Initial settings fetch failed, starting interval retry every 2 seconds');
        // If immediate attempt failed, start interval retry
        const interval = setInterval(async () => {
          const success = await fetchUserSettings();
          if (success) {
            clearInterval(interval);
            setSettingsRetryInterval(null);
          }
        }, 2000); // Retry every 2 seconds
        
        setSettingsRetryInterval(interval);
      }
    });
  };

  useEffect(() => {
    if (isSignedIn) {
      console.log('Initial settings fetch triggered - user is signed in');
      fetchUserSettings();
      
      // Set a timeout to hide loading screen after 10 seconds as fallback
      const timeout = setTimeout(() => {
        console.log('Loading timeout reached, hiding loading screen');
        setIsInitialLoading(false);
      }, 10000);
      
      setLoadingTimeout(timeout);
    } else {
      // If user is not signed in, hide loading screen
      setIsInitialLoading(false);
    }
  }, [isSignedIn, getToken]);

  // Cleanup interval and timeout on unmount
  useEffect(() => {
    return () => {
      if (settingsRetryInterval) {
        clearInterval(settingsRetryInterval);
      }
      if (saveRetryInterval) {
        clearInterval(saveRetryInterval);
      }
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [settingsRetryInterval, saveRetryInterval, loadingTimeout]);

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
    if (!geminiApiKey && isSignedIn && !isRetryingSettings && !isSettingsModalOpen) {
      console.log('No API key detected, starting retry to fetch settings');
      // Only start retrying if we're not already fetching settings and not in settings modal
      startRetryingSettings();
    } else if (geminiApiKey) {
      console.log('API key detected, stopping any retry attempts');
      // If we have an API key, make sure we're not retrying
      stopRetryingSettings();
    }
  }, [geminiApiKey, isRetryingSettings, isSignedIn, isSettingsModalOpen]);

  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true);
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setIsSidebarOpen(false);
    }
    // Stop any ongoing retries when opening the modal to prevent rapid switching
    // between loading and default states
    stopRetryingSettings();
  };

  const handleSaveSettings = async (data) => {
    // Close the modal immediately for better UX
    setIsSettingsModalOpen(false);
    
    // Try to save settings, and if it fails, start retrying in background
    const success = await attemptSaveSettings(data);
    if (!success) {
      startRetryingSave(data);
    }
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
        return <SentenceDisplay geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings} isSavingSettings={isSavingSettings} isRetryingSave={isRetryingSave}/>;
      case 'unscramble-words':
        return <UnscrambleWords geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings} isSavingSettings={isSavingSettings} isRetryingSave={isRetryingSave}/>;
      case 'read-and-respond':
        return <ReadAndRespond geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings} isSavingSettings={isSavingSettings} isRetryingSave={isRetryingSave}/>;
      case 'write-a-response':
        return <WriteAResponse geminiApiKey={geminiApiKey} settings={settings} topic={topic} onApiKeyMissing={handleOpenSettings} isSavingSettings={isSavingSettings} isRetryingSave={isRetryingSave}/>;
      default:
        return (
          <div className="initial-state-container">
            <h2>Welcome to LinguaFlow!</h2>
            <p>Select an exercise from the menu to begin.</p>
          </div>
        );
    }
  };

  // Show loading screen if we're initially loading settings
  if (isInitialLoading) {
    return <LoadingSettings />;
  }

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
        <header className="main-header">
          <button className="hamburger-menu" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
          <h1 className="main-title">LinguaFlow</h1>
        </header>

        <main className="learning-container">
          {renderActiveModule()}
        </main>
      </div>

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          stopRetryingSettings();
          // Also stop any ongoing save retry when modal is closed
          stopRetryingSave();
        }}
        onSave={handleSaveSettings}
        currentSettings={settings}
        currentApiKey={geminiApiKey}
        currentTopic={topic}
        isRetrying={isRetryingSettings}
        isRetryingSave={isRetryingSave}
      />
    </div>
  );
}

// Make sure to export the function
export default LinguaFlowApp;