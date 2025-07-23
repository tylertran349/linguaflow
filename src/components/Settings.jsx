// src/components/Settings.jsx
import '../styles/Settings.css';
import { supportedLanguages } from '../utils/languages';

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

// Add the new onOpenTopicModal prop
function Settings({ settings, setSettings, onGenerate, onOpenApiKeyModal, onOpenTopicModal }) {
  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  return (
    <section className="settings-panel">
      <h2>Settings</h2>
      
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
            <option key={level} value={level}>{level}</option>
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

      <button onClick={onGenerate}>Generate New Sentences</button>
      {/* Add the new button here */}
      <button onClick={onOpenTopicModal}>Set Topic</button>
      <button onClick={onOpenApiKeyModal}>Set API Key</button>
    </section>
  );
}

export default Settings;