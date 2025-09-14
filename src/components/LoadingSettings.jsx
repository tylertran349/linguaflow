// src/components/LoadingSettings.jsx
import { useState, useEffect } from 'react';
import '../styles/LoadingSettings.css';

function LoadingSettings() {
  const [loadingMessage, setLoadingMessage] = useState('Please wait while we load your preferences from the database');

  useEffect(() => {
    let intervalId;
    let dotCount = 0;
    const baseMessage = 'Please wait while we load your preferences from the database';
    setLoadingMessage(baseMessage);
    
    intervalId = setInterval(() => {
      dotCount = (dotCount + 1) % 4; 
      setLoadingMessage(`${baseMessage}${'.'.repeat(dotCount)}`);
    }, 400); // Same timing as SentenceDisplay: 400ms

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="loading-settings-container">
      <div className="loading-settings-content">
        <div className="loading-spinner">
          <div className="spinner-circle"></div>
        </div>
        <h2 className="loading-title">Loading settings</h2>
        <p className="loading-subtitle">
          {loadingMessage}
        </p>
      </div>
    </div>
  );
}

export default LoadingSettings;
