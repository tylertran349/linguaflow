// src/components/LoadingSettings.jsx
import { useState, useEffect } from 'react';
import '../styles/LoadingSettings.css';

function LoadingSettings() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '') return '.';
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '';
      });
    }, 500); // Change every 500ms

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-settings-container">
      <div className="loading-settings-content">
        <div className="loading-spinner">
          <div className="spinner-circle"></div>
        </div>
        <h2 className="loading-title">Loading settings</h2>
        <p className="loading-subtitle">
          Please wait while we load your preferences from the database
          <span className="loading-dots">{dots}</span>
        </p>
      </div>
    </div>
  );
}

export default LoadingSettings;
