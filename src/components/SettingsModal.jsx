// src/components/SettingsModal.jsx

import { useState, useEffect } from 'react';
import '../styles/ApiKeyModal.css'; // We can reuse the existing modal styles
import { supportedLanguages } from '../utils/languages';

// --- Constants moved here from Settings.jsx ---
const CEFR_LEVELS = [
  { value: "A1", label: "A1 (Beginner)" },
  { value: "A2", label: "A2 (Upper Beginner)" },
  { value: "B1", label: "B1 (Intermediate)" },
  { value: "B2", label: "B2 (Upper Intermediate)" },
  { value: "C1", label: "C1 (Advanced)" },
  { value: "C2", label: "C2 (Native-like)" }
];
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];
const TTS_ENGINES = [
  { value: "web-speech", label: "Web Speech API (Default)" },
  { value: "google-translate", label: "Google Translate Voice (local only)" }
];

function SettingsModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentSettings, 
  currentApiKey, 
  currentTopic 
}) {
  // --- Internal State Management ---
  // The modal holds temporary state. It only updates the main app on "Save".
  const [tempSettings, setTempSettings] = useState(currentSettings);
  const [tempApiKey, setTempApiKey] = useState(currentApiKey);
  const [tempTopic, setTempTopic] = useState(currentTopic);

  // When the modal opens, sync its internal state with the app's current state.
  useEffect(() => {
    if (isOpen) {
      setTempSettings(currentSettings);
      setTempApiKey(currentApiKey || '');
      setTempTopic(currentTopic || '');
    }
  }, [isOpen, currentSettings, currentApiKey, currentTopic]);

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setTempSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // Bundle up all the temp state and send it back to the App component.
    onSave({
      settings: tempSettings,
      apiKey: tempApiKey,
      topic: tempTopic,
    });
    onClose(); // The onSave handler in App.jsx will also call onClose. Redundant but safe.
  };
  
  // Don't render anything if the modal is not open.
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>Settings</h2>
        
        {/* --- API Key Section (from ApiKeyModal.jsx) --- */}
        <div className="settings-section">
            <h3>API Key</h3>
            <p>Your key is stored in your browser's local storage.</p>
            <div className="setting-item">
                <label htmlFor="gemini-key">Google Gemini API Key</label>
                <input
                    id="gemini-key"
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="Enter your Gemini API Key"
                />
            </div>
        </div>

        {/* --- Topic Section (from TopicModal.jsx) --- */}
        <div className="settings-section">
            <h3>Topic</h3>
            <p>Guide the sentence generation. Leave blank for random sentences.</p>
            <textarea
                value={tempTopic}
                onChange={(e) => setTempTopic(e.target.value)}
                placeholder="e.g., technology, travel, cooking..."
                rows="4"
                style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical' }}
            />
        </div>

        {/* --- General Settings Section (from Settings.jsx) --- */}
        <div className="settings-section">
            <h3>Generation Options</h3>
            <div className="setting-item">
                <label htmlFor="ttsEngine">Voice Engine</label>
                <select name="ttsEngine" id="ttsEngine" value={tempSettings.ttsEngine} onChange={handleSettingChange}>
                    {TTS_ENGINES.map(engine => ( <option key={engine.value} value={engine.value}>{engine.label}</option> ))}
                </select>
            </div>
            <div className="setting-item">
                <label htmlFor="nativeLanguage">Your Language:</label>
                <select name="nativeLanguage" id="nativeLanguage" value={tempSettings.nativeLanguage} onChange={handleSettingChange}>
                    {supportedLanguages.map(lang => ( <option key={lang.code} value={lang.name}>{lang.name}</option>))}
                </select>
            </div>
            <div className="setting-item">
                <label htmlFor="targetLanguage">Language to Learn:</label>
                <select name="targetLanguage" id="targetLanguage" value={tempSettings.targetLanguage} onChange={handleSettingChange}>
                    {supportedLanguages.map(lang => ( <option key={lang.code} value={lang.name}>{lang.name}</option>))}
                </select>
            </div>
            <div className="setting-item">
                <label htmlFor="difficulty">Difficulty (CEFR):</label>
                <select name="difficulty" id="difficulty" value={tempSettings.difficulty} onChange={handleSettingChange}>
                    {CEFR_LEVELS.map(level => ( <option key={level.value} value={level.value}>{level.label}</option>))}
                </select>
            </div>
            <div className="setting-item">
                <label htmlFor="model">Gemini Model:</label>
                <select name="model" id="model" value={tempSettings.model} onChange={handleSettingChange}>
                    {GEMINI_MODELS.map(model => ( <option key={model} value={model}>{model}</option>))}
                </select>
            </div>
            <div className="setting-item">
                <label htmlFor="sentenceCount">Number of Sentences</label>
                <input
                    type="number"
                    id="sentenceCount"
                    name="sentenceCount"
                    min="1"
                    max="50"
                    value={tempSettings.sentenceCount}
                    onChange={handleSettingChange}
                />
            </div>
        </div>
        
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;