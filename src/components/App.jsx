import { useState } from 'react';
import '../styles/App.css';
import Sidebar from './Sidebar';
import SentenceDisplay from './SentenceDisplay';
import SettingsModal from './SettingsModal';
// Assume you have some logic to generate sentences
import { mockSentence, mockSettings } from '../utils/mockData'; // Placeholder for your data

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Example state - you'll replace this with your actual logic
  const [currentActivity, setCurrentActivity] = useState('generator');
  const [settings, setSettings] = useState(mockSettings);
  const [topic, setTopic] = useState('travel');
  const [geminiKey, setGeminiKey] = useState('');

  const handleSaveSettings = (newConfig) => {
    setSettings(newConfig.settings);
    setTopic(newConfig.topic);
    setGeminiKey(newConfig.geminiKey);
    // You would probably trigger a new sentence generation here
  };

  return (
    <div className="app-container">
      <Sidebar 
        onSettingsClick={() => setIsSettingsOpen(true)} 
        onActivityChange={setCurrentActivity}
        currentActivity={currentActivity}
      />
      
      <main className="main-content">
        {/* Mobile header with settings button */}
        <header className="mobile-header">
            <h1 className="mobile-logo">LinguaFlow</h1>
            <button className="mobile-settings-btn" onClick={() => setIsSettingsOpen(true)}>
                Settings
            </button>
        </header>

        {/* Render content based on the current activity */}
        {currentActivity === 'generator' && (
          <SentenceDisplay
            sentence={mockSentence}
            isTranslationVisible={true}
            targetLanguageName={settings.targetLanguage}
            ttsEngine={settings.ttsEngine}
          />
        )}
        {currentActivity === 'unscramble' && (
           <div className="placeholder-content">
             <h2>Unscramble Sentences</h2>
             <p>This exercise will be implemented soon!</p>
           </div>
        )}
      </main>

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
          currentSettings={settings}
          currentTopic={topic}
          currentGeminiKey={geminiKey}
        />
      )}
    </div>
  );
}

export default App;