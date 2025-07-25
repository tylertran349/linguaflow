// src/components/SettingsModal.jsx
import { useState, useEffect } from 'react';
import '../styles/SettingsModal.css';
import { supportedLanguages } from '../utils/languages';

const CEFR_LEVELS = [
  { value: "A1", label: "A1 - Beginner" },
  { value: "A2", label: "A2 - Elementary" },
  { value: "B1", label: "B1 - Intermediate" },
  { value: "B2", label: "B2 - Upper-Intermediate" },
  { value: "C1", label: "C1 - Advanced" },
  { value: "C2", label: "C2 - Mastery/Native" }
];
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const TTS_ENGINES = [
  { value: "web-speech", label: "Web Speech API (Default)" },
  { value: "google-translate", label: "Google Translate (only works when running locally)" }
];

function SettingsModal({ onSave, onClose, currentSettings, currentTopic, currentGeminiKey }) {
  // Create local state to manage changes without affecting the app until "Save" is clicked
  const [localSettings, setLocalSettings] = useState(currentSettings);
  const [localTopic, setLocalTopic] = useState(currentTopic);
  const [localGeminiKey, setLocalGeminiKey] = useState(currentGeminiKey);

  const handleSettingChange = (e) => {
    const { name, value, type } = e.target;
    // Handle number inputs correctly
    const val = type === 'number' ? parseInt(value, 10) : value;
    setLocalSettings(prev => ({ ...prev, [name]: val }));
  };
  
  const handleSave = () => {
    // Pass all the local states back to the main app in one object
    onSave({
      settings: localSettings,
      topic: localTopic,
      geminiKey: localGeminiKey,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <div className="modal-body">
          <fieldset>
            <legend>Voice & Language</legend>
            <div className="setting-item">
              <label htmlFor="ttsEngine">Voice Engine</label>
              <select name="ttsEngine" value={localSettings.ttsEngine} onChange={handleSettingChange}>
                {TTS_ENGINES.map(engine => <option key={engine.value} value={engine.value}>{engine.label}</option>)}
              </select>
            </div>
            <div className="setting-item">
              <label htmlFor="nativeLanguage">Your Language</label>
              <select name="nativeLanguage" value={localSettings.nativeLanguage} onChange={handleSettingChange}>
                {supportedLanguages.map(lang => <option key={lang.code} value={lang.name}>{lang.name}</option>)}
              </select>
            </div>
            <div className="setting-item">
              <label htmlFor="targetLanguage">Language to Learn</label>
              <select name="targetLanguage" value={localSettings.targetLanguage} onChange={handleSettingChange}>
                {supportedLanguages.map(lang => <option key={lang.code} value={lang.name}>{lang.name}</option>)}
              </select>
            </div>
          </fieldset>

          <fieldset>
            <legend>Sentence Generation</legend>
            <div className="setting-item">
              <label>Topic</label>
              <textarea value={localTopic} onChange={(e) => setLocalTopic(e.target.value)} placeholder="e.g., travel, cooking..." rows="3" />
            </div>
             <div className="setting-item">
              <label htmlFor="difficulty">Difficulty</label>
              <select name="difficulty" value={localSettings.difficulty} onChange={handleSettingChange}>
                {CEFR_LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select>
            </div>
            <div className="setting-item">
              <label htmlFor="sentenceCount">Number of Sentences</label>
              <input type="number" name="sentenceCount" min="1" max="50" value={localSettings.sentenceCount} onChange={handleSettingChange} />
            </div>
            <div className="setting-item">
              <label htmlFor="model">Gemini Model</label>
              <select name="model" value={localSettings.model} onChange={handleSettingChange}>
                {GEMINI_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
              </select>
            </div>
          </fieldset>
          
          <fieldset>
            <legend>API Keys</legend>
            <div className="setting-item">
              <label htmlFor="gemini-key">Google Gemini API Key</label>
              <input id="gemini-key" type="password" value={localGeminiKey} onChange={(e) => setLocalGeminiKey(e.target.value)} />
            </div>
          </fieldset>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="button-secondary">Cancel</button>
          <button onClick={handleSave}>Save & Close</button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
