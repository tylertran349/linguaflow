import { useState, useEffect } from 'react';
import '../styles/SettingsModal.css';
import { supportedLanguages } from '../utils/languages';

// --- Constants ---
const CEFR_LEVELS = [{ value: "A1", label: "A1 (Beginner)" }, { value: "A2", label: "A2 (Upper Beginner)" }, { value: "B1", label: "B1 (Intermediate)" }, { value: "B2", label: "B2 (Upper Intermediate)" }, { value: "C1", label: "C1 (Advanced)" }, { value: "C2", label: "C2 (Native-like)" }];
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];
const TTS_ENGINES = [{ value: "web-speech", label: "Web Speech API (Default)" }, { value: "puter", label: "Puter AI (doesn't support some languages)" }, { value: "google-translate", label: "Google Translate Voice (local only)" }];

function SettingsModal({
  isOpen,
  onClose,
  onSave,
  currentSettings,
  currentApiKey,
  currentTopic
}) {
  const [tempSettings, setTempSettings] = useState(currentSettings);
  const [tempApiKey, setTempApiKey] = useState(currentApiKey);
  const [tempTopic, setTempTopic] = useState(currentTopic);

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
    const finalSettings = { ...tempSettings };

    finalSettings.webSpeechRate = parseFloat(finalSettings.webSpeechRate) || 1;
    finalSettings.googleTranslateRate = parseFloat(finalSettings.googleTranslateRate) || 1;
    finalSettings.puterRate = parseFloat(finalSettings.puterRate) || 1;

    finalSettings.webSpeechRate = Math.max(0.5, Math.min(2, finalSettings.webSpeechRate));
    finalSettings.googleTranslateRate = Math.max(0.5, Math.min(2, finalSettings.googleTranslateRate));
    finalSettings.puterRate = Math.max(0.5, Math.min(2, finalSettings.puterRate));
    
    finalSettings.sentenceCount = parseInt(finalSettings.sentenceCount, 10) || 10;

    onSave({
      settings: finalSettings,
      apiKey: tempApiKey,
      topic: tempTopic,
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>Settings</h2>

        <div className="settings-section">
            <h3>API Key</h3>
            <p>Your key is stored in your browser's local storage.</p>
            <div className="setting-item">
                <label htmlFor="gemini-key">Google Gemini API Key</label>
                <input id="gemini-key" type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="Enter your Gemini API Key"/>
            </div>
        </div>

        <div className="settings-section">
            <h3>Topic</h3>
            <p>Guide the sentence generation. Leave blank for random sentences.</p>
            <textarea value={tempTopic} onChange={(e) => setTempTopic(e.target.value)} placeholder="e.g., technology, travel, cooking..." rows="4" style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical' }}/>
        </div>

        <div className="settings-section">
            <h3>Voice Settings</h3>
            <p>Control the playback speed for each voice engine (0.5 to 2.0).</p>
            <div className="setting-item">
                <label htmlFor="webSpeechRate">Web Speech API Speed</label>
                <input type="number" id="webSpeechRate" name="webSpeechRate" min="0.1" max="2" step="0.1" value={tempSettings.webSpeechRate} onChange={handleSettingChange}/>
            </div>
            <div className="setting-item">
                <label htmlFor="googleTranslateRate">Google Translate Speed</label>
                <input type="number" id="googleTranslateRate" name="googleTranslateRate" min="0.1" max="2" step="0.1" value={tempSettings.googleTranslateRate} onChange={handleSettingChange}/>
            </div>
            <div className="setting-item">
                <label htmlFor="puterRate">Puter AI Speed</label>
                <input type="number" id="puterRate" name="puterRate" min="0.1" max="2" step="0.1" value={tempSettings.puterRate} onChange={handleSettingChange}/>
            </div>
        </div>

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
                <input type="number" id="sentenceCount" name="sentenceCount" min="1" max="50" value={tempSettings.sentenceCount} onChange={handleSettingChange}/>
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