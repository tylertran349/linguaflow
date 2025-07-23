// src/components/Settings.jsx
import '../styles/Settings.css';
import { supportedLanguages } from '../utils/languages';

const CEFR_LEVELS = [
  { value: "A1", label: "A1 (Beginner)" },
  { value: "A2", label: "A2 (Upper Beginner)" },
  { value: "B1", label: "B1 (Intermediate)" },
  { value: "B2", label: "B2 (Upper Intermediate)" },
  { value: "C1", label: "C1 (Advanced)" },
  { value: "C2", label: "C2 (Native-like)" }
];
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

// --- UPDATED TTS OPTIONS ---
const TTS_ENGINES = [
  { value: "web-speech", label: "Web Speech API (Default)" },
  { value: "google-translate", label: "Google Translate Voice (only works when running locally)" } // Changed from Google Cloud
];

function Settings({ settings, setSettings, onGenerate, onOpenApiKeyModal, onOpenTopicModal }) {
  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="settings-panel">
      <div className="setting-item">
        <label htmlFor="ttsEngine">Voice Engine</label>
        <select name="ttsEngine" id="ttsEngine" value={settings.ttsEngine} onChange={handleSettingChange}>
          {TTS_ENGINES.map(engine => (
            <option key={engine.value} value={engine.value}>{engine.label}</option>
          ))}
        </select>
      </div>

      <div className="setting-item">
        <label htmlFor="nativeLanguage">Your Language:</label>
        <select name="nativeLanguage" id="nativeLanguage" value={settings.nativeLanguage} onChange={handleSettingChange}>
          {supportedLanguages.map(lang => (
            <option key={lang.code} value={lang.name}>{lang.name}</option>
          ))}
        </select>
      </div>

      <div className="setting-item">
        <label htmlFor="targetLanguage">Language to Learn:</label>
        <select name="targetLanguage" id="targetLanguage" value={settings.targetLanguage} onChange={handleSettingChange}>
          {supportedLanguages.map(lang => (
            <option key={lang.code} value={lang.name}>{lang.name}</option>
          ))}
        </select>
      </div>
      
      <div className="setting-item">
        <label htmlFor="difficulty">Difficulty (CEFR):</label>
        <select name="difficulty" id="difficulty" value={settings.difficulty} onChange={handleSettingChange}>
          {CEFR_LEVELS.map(level => (
            <option key={level.value} value={level.value}>{level.label}</option>
          ))}
        </select>
      </div>

      <div className="setting-item">
        <label htmlFor="model">Gemini Model:</label>
        <select name="model" id="model" value={settings.model} onChange={handleSettingChange}>
          {GEMINI_MODELS.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
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
          value={settings.sentenceCount}
          onChange={handleSettingChange}
          style={{ padding: '12px' }} // Added for consistent styling with selects
        />
      </div>
      
      <div style={{ marginTop: 'auto' }}>
        <button onClick={onGenerate} style={{ width: '100%', marginBottom: '1rem' }}>Generate New Sentences</button>
        <button onClick={onOpenTopicModal} style={{ width: '100%', marginBottom: '1rem' }}>Set Topic</button>
        <button onClick={onOpenApiKeyModal} style={{ width: '100%' }}>Set API Key</button>
      </div>
    </div>
  );
}

export default Settings;