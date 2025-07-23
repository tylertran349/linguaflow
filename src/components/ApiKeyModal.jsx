// src/components/ApiKeyModal.jsx
import { useState } from 'react';
import '../styles/ApiKeyModal.css';

function ApiKeyModal({ onSave, onClose }) {
  const [key, setKey] = useState('');

  const handleSave = () => {
    onSave(key);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Enter API Key</h2>
        <p>Please enter your Google Gemini API key to use the app.</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Your Gemini API Key"
          autoFocus
        />
        {/* ADD THIS WRAPPER DIV */}
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button onClick={handleSave}>Save Key</button>
        </div>
      </div>
    </div>
  );
}

export default ApiKeyModal;