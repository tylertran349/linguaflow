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
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setTempSettings(currentSettings);
      setTempApiKey(currentApiKey || '');
      setTempTopic(currentTopic || '');
      setErrors({}); // Clear errors when modal opens
    }
  }, [isOpen, currentSettings, currentApiKey, currentTopic]);

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setTempSettings(prev => ({ ...prev, [name]: value }));

    // If there's an error for this specific field, clear it as the user types.
    if (errors[name]) {
      setErrors(prevErrors => {
        const newErrors = { ...prevErrors };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    const newErrors = {};

    // Parse rate values to numbers for validation
    const rates = {
      webSpeechRate: parseFloat(tempSettings.webSpeechRate),
      googleTranslateRate: parseFloat(tempSettings.googleTranslateRate),
    };
    
    // Validate each rate
    for (const key in rates) {
      const rate = rates[key];
      if (isNaN(rate) || rate < 0.1 || rate > 2.0) {
        newErrors[key] = "Value must be between 0.1 and 2.0";
      }
    }

    // If there are any errors, update the error state and stop.
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return; // Do not close the modal
    }
    
    // If validation passes, clear any old errors and proceed to save.
    setErrors({});
    
    onSave({
      settings: {
        ...tempSettings,
        webSpeechRate: rates.webSpeechRate,
        googleTranslateRate: rates.googleTranslateRate,
        sentenceCount: parseInt(tempSettings.sentenceCount, 10) || 10,
      },
      apiKey: tempApiKey,
      topic: tempTopic,
    });

    onClose(); // Only close if validation was successful
  };
  
  // --- NEW FUNCTION TO HANDLE CLICKING OUTSIDE THE MODAL ---
  const handleBackdropClick = (e) => {
    // This condition checks if the user clicked on the backdrop itself,
    // and not on any of its children (like the modal content).
    if (e.target.className === 'modal-backdrop') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    // --- ATTACH THE NEW ONCLICK HANDLER HERE ---
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-scroll-wrapper" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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
              <h3>Topic/Theme</h3>
              <p>Specify a topic or theme to guide the sentence generation. If left blank, random sentences will be generated.</p>
              <textarea value={tempTopic} onChange={(e) => setTempTopic(e.target.value)} placeholder="e.g., technology, travel, cooking..." rows="4" style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical' }}/>
          </div>

          <div className="settings-section">
              <h3>Voice Settings</h3>
              <p>Control the playback speed for each voice engine (0.1 to 2.0).</p>
              <div className="setting-item">
                  <label htmlFor="webSpeechRate">Web Speech API TTS Speed</label>
                  <input
                      type="number"
                      id="webSpeechRate"
                      name="webSpeechRate"
                      min="0" max="2" step="0.1"
                      value={tempSettings.webSpeechRate}
                      onChange={handleSettingChange}
                      className={errors.webSpeechRate ? 'input-error' : ''}
                  />
                  {errors.webSpeechRate && <p className="error-text">{errors.webSpeechRate}</p>}
              </div>
              <div className="setting-item">
                  <label htmlFor="googleTranslateRate">Google Translate TTS Speed</label>
                  <input
                      type="number"
                      id="googleTranslateRate"
                      name="googleTranslateRate"
                      min="0" max="2" step="0.1"
                      value={tempSettings.googleTranslateRate}
                      onChange={handleSettingChange}
                      className={errors.googleTranslateRate ? 'input-error' : ''}
                  />
                  {errors.googleTranslateRate && <p className="error-text">{errors.googleTranslateRate}</p>}
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
                  <input type="number" id="sentenceCount" name="sentenceCount" min="1" max="100" value={tempSettings.sentenceCount} onChange={handleSettingChange}/>
              </div>
          </div>

          <div className="modal-actions">
            <button onClick={onClose}>Close</button>
            <button onClick={handleSave}>Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;