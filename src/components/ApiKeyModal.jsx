// src/components/ApiKeyModal.jsx
import { useState, useEffect } from 'react';
import '../styles/ApiKeyModal.css';

// The component now only handles the Gemini key
function ApiKeyModal({ onSave, onClose, currentGeminiKey }) {
  const [key, setKey] = useState('');

  useEffect(() => {
    setKey(currentGeminiKey || '');
  }, [currentGeminiKey]);

  const handleSave = () => {
    onSave(key); // Pass back only the Gemini key string
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>API Key</h2>
        <p>Enter your Google Gemini API key below. It will be stored in your browser's local storage.</p>
        
        <div className="setting-item">
          <label htmlFor="gemini-key">Google Gemini API Key</label>
          <input
            id="gemini-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Gemini API Key (for sentences)"
          />
        </div>
        
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button onClick={handleSave}>Save Key</button>
        </div>
      </div>
    </div>
  );
}

export default ApiKeyModal;