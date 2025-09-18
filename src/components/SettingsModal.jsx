import { useState, useEffect } from 'react';
import '../styles/SettingsModal.css';
import { supportedLanguages } from '../utils/languages';

// --- Constants ---
const CEFR_LEVELS = [{ value: "A1", label: "A1 (Beginner)" }, { value: "A2", label: "A2 (Upper Beginner)" }, { value: "B1", label: "B1 (Intermediate)" }, { value: "B2", label: "B2 (Upper Intermediate)" }, { value: "C1", label: "C1 (Advanced)" }, { value: "C2", label: "C2 (Native-like)" }];
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];

// TTS engines - available in all environments
const getTtsEngines = () => [
  { value: "google-translate", label: "Google Translate" },
  { value: "puter", label: "Puter AI (doesn't support some languages)" }, 
  { value: "web-speech", label: "Web Speech API" }
];

function SettingsModal({
  isOpen,
  onClose,
  onSave,
  currentSettings,
  currentApiKey,
  currentTopic,
  isRetrying = false,
  isRetryingSave = false
}) {
  const [tempSettings, setTempSettings] = useState(currentSettings);
  const [tempApiKey, setTempApiKey] = useState(currentApiKey);
  const [tempTopic, setTempTopic] = useState(currentTopic);
  const [errors, setErrors] = useState({});
  const [saveEllipses, setSaveEllipses] = useState('');
  const [loadingEllipses, setLoadingEllipses] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTempSettings(currentSettings);
      setTempApiKey(currentApiKey || '');
      setTempTopic(currentTopic || '');
      setErrors({}); // Clear errors when modal opens
    }
  }, [isOpen, currentSettings, currentApiKey, currentTopic]);


  // Animate ellipses when retrying save
  useEffect(() => {
    let interval;
    if (isRetryingSave) {
      let dotCount = 0;
      interval = setInterval(() => {
        setSaveEllipses('.'.repeat(dotCount));
        dotCount = (dotCount + 1) % 4; // Cycle through 0, 1, 2, 3 dots
      }, 500); // Change every 500ms
    } else {
      setSaveEllipses('');
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRetryingSave]);

  // Animate ellipses when loading settings (matching SentenceDisplay.jsx timing)
  useEffect(() => {
    let interval;
    if (isRetrying) {
      let dotCount = 0;
      interval = setInterval(() => {
        setLoadingEllipses('.'.repeat(dotCount));
        dotCount = (dotCount + 1) % 4; // Cycle through 0, 1, 2, 3 dots
      }, 400); // Change every 400ms to match SentenceDisplay.jsx
    } else {
      setLoadingEllipses('');
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRetrying]);

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
    
    // Parse temperature for validation
    const temperature = parseFloat(tempSettings.temperature);
    
    // Validate each rate
    for (const key in rates) {
      const rate = rates[key];
      if (isNaN(rate) || rate < 0.1 || rate > 2.0) {
        newErrors[key] = "Value must be between 0.1 and 2.0";
      }
    }
    
    // Validate temperature
    if (isNaN(temperature) || temperature < 0.0 || temperature > 2.0) {
      newErrors.temperature = "Temperature must be between 0.0 and 2.0";
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
        temperature: temperature,
        sentenceCount: parseInt(tempSettings.sentenceCount, 10) || 10,
        sentenceDisplayHistorySize: parseInt(tempSettings.sentenceDisplayHistorySize, 10) || 100,
        readAndRespondHistorySize: parseInt(tempSettings.readAndRespondHistorySize, 10) || 50,
        writeAResponseHistorySize: parseInt(tempSettings.writeAResponseHistorySize, 10) || 100,
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
      handleSave(); // Save settings when clicking outside
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
          <h2>Settings 
            {isRetryingSave && <span style={{ color: '#28a745', fontSize: '0.8em' }}>Saving settings{saveEllipses}</span>}
          </h2>

          <div className="settings-section">
              <h3>API Key</h3>
              <p>Your API key is encrypted and stored securely in the database.</p>
              <div className="setting-item">
                  <label htmlFor="gemini-key">Google Gemini API Key</label>
                  <input id="gemini-key" type="text" value={isRetrying ? `Loading${loadingEllipses}` : tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="Enter your Gemini API Key" disabled={isRetrying}/>
              </div>
          </div>

          <div className="settings-section">
              <h3>Topic/Theme</h3>
              <p>Specify a topic or theme to guide the sentence generation. If left blank, random sentences will be generated.</p>
              <textarea value={isRetrying ? `Loading${loadingEllipses}` : tempTopic} onChange={(e) => setTempTopic(e.target.value)} placeholder="Enter words or paragraphs here..." rows="10" style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', resize: 'none' }} disabled={isRetrying}/>
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
                      value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.webSpeechRate}
                      onChange={handleSettingChange}
                      className={errors.webSpeechRate ? 'input-error' : ''}
                      disabled={isRetrying}
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
                      value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.googleTranslateRate}
                      onChange={handleSettingChange}
                      className={errors.googleTranslateRate ? 'input-error' : ''}
                      disabled={isRetrying}
                  />
                  {errors.googleTranslateRate && <p className="error-text">{errors.googleTranslateRate}</p>}
              </div>
          </div>

          <div className="settings-section">
              <h3>Generation Options</h3>
              <div className="setting-item">
                  <label htmlFor="ttsEngine">Text-to-Speech Engine</label>
                  <select name="ttsEngine" id="ttsEngine" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.ttsEngine} onChange={handleSettingChange} disabled={isRetrying}>
                      {getTtsEngines().map(engine => ( <option key={engine.value} value={engine.value}>{engine.label}</option> ))}
                  </select>
              </div>
              <div className="setting-item">
                  <label htmlFor="nativeLanguage">Your Native Language:</label>
                  <select name="nativeLanguage" id="nativeLanguage" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.nativeLanguage} onChange={handleSettingChange} disabled={isRetrying}>
                      {supportedLanguages.map(lang => ( <option key={lang.code} value={lang.name}>{lang.name}</option>))}
                  </select>
              </div>
              <div className="setting-item">
                  <label htmlFor="targetLanguage">Language to Learn:</label>
                  <select name="targetLanguage" id="targetLanguage" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.targetLanguage} onChange={handleSettingChange} disabled={isRetrying}>
                      {supportedLanguages.map(lang => ( <option key={lang.code} value={lang.name}>{lang.name}</option>))}
                  </select>
              </div>
              <div className="setting-item">
                  <label htmlFor="difficulty">Difficulty (CEFR):</label>
                  <select name="difficulty" id="difficulty" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.difficulty} onChange={handleSettingChange} disabled={isRetrying}>
                      {CEFR_LEVELS.map(level => ( <option key={level.value} value={level.value}>{level.label}</option>))}
                  </select>
              </div>
              <div className="setting-item">
                  <label htmlFor="model">Gemini Model:</label>
                  <select name="model" id="model" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.model} onChange={handleSettingChange} disabled={isRetrying}>
                      {GEMINI_MODELS.map(model => ( <option key={model} value={model}>{model}</option>))}
                  </select>
              </div>
              <div className="setting-item">
                  <label htmlFor="temperature">Temperature (0.0 - 2.0):</label>
                  <input
                      type="number"
                      id="temperature"
                      name="temperature"
                      min="0" max="2" step="0.1"
                      value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.temperature}
                      onChange={handleSettingChange}
                      className={errors.temperature ? 'input-error' : ''}
                      disabled={isRetrying}
                  />
                  {errors.temperature && <p className="error-text">{errors.temperature}</p>}
                  <p style={{ fontSize: '0.9em', color: '#666', marginTop: '4px' }}>
                      Lower values (0.1-0.5) make responses more focused and deterministic. Higher values (0.7-2.0) make responses more creative and varied.
                  </p>
              </div>
              <div className="setting-item">
                  <label htmlFor="sentenceCount">Number of Sentences to Generate</label>
                  <input type="number" id="sentenceCount" name="sentenceCount" min="1" max="100" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.sentenceCount} onChange={handleSettingChange} disabled={isRetrying}/>
              </div>
              <div className="setting-item">
                  <label htmlFor="sentenceDisplayHistorySize">Sentence Display History Size</label>
                  <input type="number" id="sentenceDisplayHistorySize" name="sentenceDisplayHistorySize" min="0" max="1000" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.sentenceDisplayHistorySize} onChange={handleSettingChange} disabled={isRetrying}/>
              </div>
               <div className="setting-item">
                  <label htmlFor="readAndRespondHistorySize">Read & Respond History Size</label>
                  <input type="number" id="readAndRespondHistorySize" name="readAndRespondHistorySize" min="0" max="1000" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.readAndRespondHistorySize} onChange={handleSettingChange} disabled={isRetrying}/>
              </div>
               <div className="setting-item">
                  <label htmlFor="writeAResponseHistorySize">Write a Response History Size</label>
                  <input type="number" id="writeAResponseHistorySize" name="writeAResponseHistorySize" min="0" max="1000" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.writeAResponseHistorySize} onChange={handleSettingChange} disabled={isRetrying}/>
              </div>
          </div>

          <div className="modal-actions">
            <button onClick={handleSave}>Close and Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;