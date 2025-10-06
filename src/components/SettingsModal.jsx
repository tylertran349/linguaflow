import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import '../styles/SettingsModal.css';
import { supportedLanguages } from '../utils/languages';

// --- Constants ---
const CEFR_LEVELS = [
  { value: "A1", label: "A1 - Beginner", description: "Basic words and simple sentences" },
  { value: "A2", label: "A2 - Elementary", description: "Common phrases and basic conversations" },
  { value: "B1", label: "B1 - Intermediate", description: "Clear text on familiar topics" },
  { value: "B2", label: "B2 - Upper Intermediate", description: "Complex text and detailed discussions" },
  { value: "C1", label: "C1 - Advanced", description: "Long, complex text with implicit meaning" },
  { value: "C2", label: "C2 - Proficient/Near-native", description: "Native-like understanding and expression" }
];

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Balances speed and accuracy (recommended)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Slowest but most accurate" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Fastest but least accurate" }
];

// TTS engines - available in all environments
const getTtsEngines = () => [
  { value: "google-translate", label: "Google Translate (recommended)" },
  { value: "puter", label: "Puter AI" }, 
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
  const [tempApiKey, setTempApiKey] = useState(currentApiKey || '');
  const [tempTopic, setTempTopic] = useState(currentTopic || '');
  const [errors, setErrors] = useState({});
  const [saveEllipses, setSaveEllipses] = useState('');
  const [loadingEllipses, setLoadingEllipses] = useState('');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTempSettings(currentSettings);
      setTempApiKey(currentApiKey || '');
      setTempTopic(currentTopic || '');
      setErrors({}); // Clear errors when modal opens
      setIsApiKeyVisible(false); // Reset visibility when modal opens
    } else {
      // Clear ellipses when modal closes
      setSaveEllipses('');
      setLoadingEllipses('');
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
      }, 400); // Change every 400ms to match other components
    } else {
      setSaveEllipses('');
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRetryingSave]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      // This cleanup will run on unmount
      setSaveEllipses('');
      setLoadingEllipses('');
    };
  }, []);

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
    // Prevent multiple save attempts
    if (isRetrying || isRetryingSave) {
      return;
    }

    const newErrors = {};

    // Parse rate values to numbers for validation
    const rates = {
      webSpeechRate: parseFloat(tempSettings.webSpeechRate),
      googleTranslateRate: parseFloat(tempSettings.googleTranslateRate),
    };
    
    // Parse temperature for validation
    const temperature = parseFloat(tempSettings.temperature);
    
    // Parse sentence length values for validation
    const minSentenceLength = tempSettings.minSentenceLength !== undefined && tempSettings.minSentenceLength !== '' 
      ? parseInt(tempSettings.minSentenceLength, 10) 
      : 6;
    const maxSentenceLength = tempSettings.maxSentenceLength !== undefined && tempSettings.maxSentenceLength !== '' 
      ? parseInt(tempSettings.maxSentenceLength, 10) 
      : 12;
    
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
    
    // Validate sentence length settings
    if (isNaN(minSentenceLength) || minSentenceLength < 1 || minSentenceLength > 50 || !Number.isInteger(minSentenceLength)) {
      newErrors.minSentenceLength = "Minimum sentence length must be a whole number between 1 and 50";
    }
    
    if (isNaN(maxSentenceLength) || maxSentenceLength < 1 || maxSentenceLength > 50 || !Number.isInteger(maxSentenceLength)) {
      newErrors.maxSentenceLength = "Maximum sentence length must be a whole number between 1 and 50";
    }
    
    // Validate that min is not greater than max
    if (!isNaN(minSentenceLength) && !isNaN(maxSentenceLength) && minSentenceLength > maxSentenceLength) {
      newErrors.maxSentenceLength = "Maximum sentence length must be greater than or equal to minimum sentence length";
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
        minSentenceLength: minSentenceLength,
        maxSentenceLength: maxSentenceLength,
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
      // If currently saving, just close the modal without saving
      if (isRetryingSave) {
        onClose();
        return;
      }
      // Only allow backdrop save if not currently loading
      if (!isRetrying) {
        handleSave(); // Save settings when clicking outside
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-scroll-wrapper" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="modal-header">
            <h2>Settings</h2>
            {isRetryingSave && <span className="saving-indicator">Saving settings{saveEllipses}</span>}
            <p className="modal-description">Customize your language learning experience</p>
            {/* Close button - always visible, even when saving */}
            <button 
              className="modal-close-button" 
              onClick={onClose}
              title="Close settings"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666',
                padding: '0.25rem',
                borderRadius: '4px'
              }}
            >
              ×
            </button>
          </div>

          {/* Essential Setup Section */}
          <div className="settings-section essential">
            <div className="section-header">
              <h3>Essential Setup</h3>
              <p>Required settings to get started</p>
            </div>
            
            <div className="setting-item">
              <label htmlFor="gemini-key">
                <span className="label-text">Google Gemini API Key</span>
                <span className="label-required">*Required</span>
              </label>
              <p className="setting-description">
                This key allows the app to generate sentences using Google's AI.
                <a href="https://github.com/tylertran349/linguaflow/blob/main/README.md#getting-your-google-gemini-api-key-required" target="_blank" rel="noopener noreferrer" className="help-link">
                  Click here for instructions on how to get a free Google Gemini API key
                </a>
              </p>
              <div className="api-key-container">
                <input 
                  id="gemini-key" 
                  type={isApiKeyVisible ? "text" : "password"} 
                  value={isRetrying ? `Loading${loadingEllipses}` : tempApiKey} 
                  onChange={(e) => setTempApiKey(e.target.value)} 
                  placeholder="Enter your API key here..." 
                  disabled={isRetrying || isRetryingSave}
                  className="api-key-input"
                />
                <button 
                  type="button" 
                  onClick={() => setIsApiKeyVisible(!isApiKeyVisible)} 
                  className="api-key-toggle"
                  title={isApiKeyVisible ? "Hide API Key" : "Show API Key"}
                  disabled={isRetrying || isRetryingSave}
                >
                  {isApiKeyVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="setting-item">
              <label htmlFor="nativeLanguage">
                <span className="label-text">Your Native Language</span>
                <span className="label-required">*Required</span>
              </label>
              <p className="setting-description">The language you speak best (for translations and explanations)</p>
              <select name="nativeLanguage" id="nativeLanguage" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.nativeLanguage} onChange={handleSettingChange} disabled={isRetrying || isRetryingSave}>
                {supportedLanguages.map(lang => ( 
                  <option key={lang.code} value={lang.name}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div className="setting-item">
              <label htmlFor="targetLanguage">
                <span className="label-text">Language You Want to Learn</span>
                <span className="label-required">*Required</span>
              </label>
              <p className="setting-description">The language you are learning</p>
              <select name="targetLanguage" id="targetLanguage" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.targetLanguage} onChange={handleSettingChange} disabled={isRetrying || isRetryingSave}>
                {supportedLanguages.map(lang => ( 
                  <option key={lang.code} value={lang.name}>{lang.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Learning Level Section */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Learning Level</h3>
              <p>Choose your current skill level</p>
            </div>
            
            <div className="setting-item">
              <label htmlFor="difficulty">
                <span className="label-text">Your Current Level</span>
                <span className="label-required">*Required</span>
              </label>
              <p className="setting-description">This helps generate sentences/exercises at the right difficulty for you</p>
              <select name="difficulty" id="difficulty" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.difficulty} onChange={handleSettingChange} disabled={isRetrying || isRetryingSave}>
                {CEFR_LEVELS.map(level => ( 
                  <option key={level.value} value={level.value}>
                    {level.label} - {level.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Voice & Audio Section */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Voice & Audio</h3>
              <p>Control how sentences are spoken</p>
            </div>
            
            <div className="setting-item">
              <label htmlFor="ttsEngine">
                <span className="label-text">Voice Engine</span>
              </label>
              <p className="setting-description">Choose which voice system to use for pronunciation</p>
              <select name="ttsEngine" id="ttsEngine" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.ttsEngine} onChange={handleSettingChange} disabled={isRetrying || isRetryingSave}>
                {getTtsEngines().map(engine => ( 
                  <option key={engine.value} value={engine.value}>
                    {engine.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-item">
              <label htmlFor="googleTranslateRate">
                <span className="label-text">Google Voice Speed</span>
              </label>
              <p className="setting-description">
                How fast the Google voice speaks<br/>
                Lower values are slower (minimum value is 0.1)<br/>
                Higher values are faster (maximum value is 2.0)<br/>
                The default value is 1.0
              </p>
              <input
                type="number"
                id="googleTranslateRate"
                name="googleTranslateRate"
                min="0.1" max="2.0" step="0.1"
                value={isRetrying ? '' : tempSettings.googleTranslateRate}
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''}
                onChange={handleSettingChange}
                className={errors.googleTranslateRate ? 'input-error' : ''}
                disabled={isRetrying || isRetryingSave}
              />
              {errors.googleTranslateRate && <p className="error-text">{errors.googleTranslateRate}</p>}
            </div>

            <div className="setting-item">
              <label htmlFor="webSpeechRate">
                <span className="label-text">Web Speech API Voice Speed</span>
              </label>
              <p className="setting-description">
                How fast the Web Speech API voice speaks<br/>
                Lower values are slower (minimum value is 0.1)<br/>
                Higher values are faster (maximum value is 2.0)<br/>
                The default value is 0.6
              </p>
              <input
                type="number"
                id="webSpeechRate"
                name="webSpeechRate"
                min="0.1" max="2.0" step="0.1"
                value={isRetrying ? '' : tempSettings.webSpeechRate}
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''}
                onChange={handleSettingChange}
                className={errors.webSpeechRate ? 'input-error' : ''}
                disabled={isRetrying || isRetryingSave}
              />
              {errors.webSpeechRate && <p className="error-text">{errors.webSpeechRate}</p>}
            </div>
          </div>

          {/* Content Generation Section */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Content Generation</h3>
              <p>Control what content is created for you</p>
            </div>
            
            <div className="setting-item">
              <label htmlFor="topic">
                <span className="label-text">Topic (Optional)</span>
              </label>
              <p className="setting-description">
                Write words or paragraphs about what you want to learn to guide the AI on what to generate. For example: "cooking, travel, work, family" or "I want to learn business English for meetings"
              </p>
              <textarea 
                id="topic"
                value={isRetrying ? `Loading${loadingEllipses}` : tempTopic} 
                onChange={(e) => setTempTopic(e.target.value)} 
                placeholder="Enter topics you want to learn about..." 
                rows="8" 
                disabled={isRetrying || isRetryingSave}
                className="topic-textarea"
                style={{ resize: 'none' }}
              />
            </div>

            <div className="setting-item">
              <label htmlFor="sentenceCount">
                <span className="label-text">Number of Sentences/Exercises to Generate</span>
              </label>
              <p className="setting-description">
                How many sentences/exercises to generate at once (1-100)<br/>
                Higher values will result in longer content generation times and could lead to more mistakes
              </p>
              <input 
                type="number" 
                id="sentenceCount" 
                name="sentenceCount" 
                min="1" max="100" 
                value={isRetrying ? '' : tempSettings.sentenceCount} 
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''}
                onChange={handleSettingChange} 
                disabled={isRetrying || isRetryingSave}
              />
            </div>

            <div className="setting-item">
              <label htmlFor="minSentenceLength">
                <span className="label-text">Minimum Sentence Length</span>
              </label>
              <p className="setting-description">
                The minimum number of words per sentence (1-50)<br/>
              </p>
              <input 
                type="number" 
                id="minSentenceLength" 
                name="minSentenceLength" 
                min="1" max="50" 
                value={isRetrying ? '' : tempSettings.minSentenceLength || 6} 
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''}
                onChange={handleSettingChange} 
                onKeyDown={(e) => {
                  // Prevent negative values
                  if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                  }
                }}
                disabled={isRetrying || isRetryingSave}
                className={errors.minSentenceLength ? 'input-error' : ''}
              />
              {errors.minSentenceLength && <p className="error-text">{errors.minSentenceLength}</p>}
            </div>

            <div className="setting-item">
              <label htmlFor="maxSentenceLength">
                <span className="label-text">Maximum Sentence Length</span>
              </label>
              <p className="setting-description">
                The maximum number of words per sentence (1-50)<br/>
              </p>
              <input 
                type="number" 
                id="maxSentenceLength" 
                name="maxSentenceLength" 
                min="1" max="50" 
                value={isRetrying ? '' : tempSettings.maxSentenceLength || 12} 
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''}
                onChange={handleSettingChange} 
                onKeyDown={(e) => {
                  // Prevent negative values
                  if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                  }
                }}
                disabled={isRetrying || isRetryingSave}
                className={errors.maxSentenceLength ? 'input-error' : ''}
              />
              {errors.maxSentenceLength && <p className="error-text">{errors.maxSentenceLength}</p>}
            </div>

            <div className="setting-item">
              <label htmlFor="googleSearchEnabled">
                <span className="label-text">Enable Google Search</span>
              </label>
              <p className="setting-description">
                When enabled, the AI can search the web for real-time information to generate more accurate and current content.<br/>
                This may increase response time and costs but provides more factual and up-to-date information.
              </p>
              <div className="toggle-container">
                <input
                  type="checkbox"
                  id="googleSearchEnabled"
                  name="googleSearchEnabled"
                  checked={isRetrying ? false : tempSettings.googleSearchEnabled || false}
                  onChange={(e) => setTempSettings(prev => ({ ...prev, googleSearchEnabled: e.target.checked }))}
                  disabled={isRetrying || isRetryingSave}
                  className="toggle-input"
                />
                <label htmlFor="googleSearchEnabled" className="toggle-label">
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-text">
                  {isRetrying ? `Loading${loadingEllipses}` : (tempSettings.googleSearchEnabled ? 'Enabled' : 'Disabled')}
                </span>
              </div>
            </div>

          </div>

          {/* Advanced Settings Section */}
          <div className="settings-section advanced">
            <div className="section-header">
              <h3>Advanced Settings</h3>
              <p>Fine-tune your experience</p>
            </div>
            
            <div className="setting-item">
              <label htmlFor="sentenceDisplayHistorySize">
                <span className="label-text">Sentence History Size</span>
              </label>
              <p className="setting-description">How many previous sentences to store in your browser to allow the AI to avoid using the same vocabulary in subsequent sentences (0-1000)</p>
              <input 
                type="number" 
                id="sentenceDisplayHistorySize" 
                name="sentenceDisplayHistorySize" 
                min="0" max="1000" 
                value={isRetrying ? '' : tempSettings.sentenceDisplayHistorySize}
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''} 
                onChange={handleSettingChange} 
                disabled={isRetrying || isRetryingSave}
              />
            </div>

            <div className="setting-item">
              <label htmlFor="readAndRespondHistorySize">
                <span className="label-text">Read & Respond History</span>
              </label>
              <p className="setting-description">How many previous conversations to store in your browser to allow the AI to avoid using the same vocabulary in subsequent questions (0-1000)</p>
              <input 
                type="number" 
                id="readAndRespondHistorySize" 
                name="readAndRespondHistorySize" 
                min="0" max="1000" 
                value={isRetrying ? '' : tempSettings.readAndRespondHistorySize}
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''} 
                onChange={handleSettingChange} 
                disabled={isRetrying || isRetryingSave}
              />
            </div>

            <div className="setting-item">
              <label htmlFor="writeAResponseHistorySize">
                <span className="label-text">Write Response History</span>
              </label>
              <p className="setting-description">How many previous writing exercises to store in your browser to allow the AI to avoid using the same vocabulary in subsequent exercises (0-1000)</p>
              <input 
                type="number" 
                id="writeAResponseHistorySize" 
                name="writeAResponseHistorySize" 
                min="0" max="1000" 
                value={isRetrying ? '' : tempSettings.writeAResponseHistorySize}
                placeholder={isRetrying ? `Loading${loadingEllipses}` : ''} 
                onChange={handleSettingChange} 
                disabled={isRetrying || isRetryingSave}
              />
            </div>

            <div className="setting-item">
              <label htmlFor="model">
                <span className="label-text">AI Model</span>
              </label>
              <p className="setting-description">Choose the AI model used for generating content</p>
              <select name="model" id="model" value={isRetrying ? `Loading${loadingEllipses}` : tempSettings.model} onChange={handleSettingChange} disabled={isRetrying || isRetryingSave}>
                {GEMINI_MODELS.map(model => ( 
                  <option key={model.value} value={model.value}>
                    {model.label} - {model.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-item">
              <label htmlFor="temperature">
                <span className="label-text">Temperature</span>
              </label>
              <p className="setting-description">
                Lower values = more predictable and focused content<br/>
                Higher values = more creative and varied content<br/>
                The default value is 1.0
              </p>
              <div className="input-with-unit">
                <input
                  type="number"
                  id="temperature"
                  name="temperature"
                  min="0.0" max="2.0" step="0.1"
                  value={isRetrying ? '' : tempSettings.temperature}
                  placeholder={isRetrying ? `Loading${loadingEllipses}` : ''}
                  onChange={handleSettingChange}
                  className={errors.temperature ? 'input-error' : ''}
                  disabled={isRetrying || isRetryingSave}
                />
              </div>
              {errors.temperature && <p className="error-text">{errors.temperature}</p>}
            </div>

          </div>

          <div className="modal-actions">
            <button onClick={handleSave} className="save-button" disabled={isRetrying || isRetryingSave}>Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;