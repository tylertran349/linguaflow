// src/utils/environment.js

/**
 * Determines if the app is running in a local development environment
 * @returns {boolean} true if running locally, false if in production
 */
export const isLocalEnvironment = () => {
  // Check if we're running on localhost or 127.0.0.1
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  // Check if we're running on a development port (common dev ports)
  const port = window.location.port;
  const isDevPort = port === '3000' || port === '3001' || port === '5173' || port === '8080';
  
  // Check if we're in development mode (Vite sets this)
  const isDevMode = import.meta.env.DEV;
  
  // Consider it local if any of these conditions are true
  return isLocalhost || isDevPort || isDevMode;
};

/**
 * Gets the current environment type
 * @returns {string} 'local' or 'production'
 */
export const getEnvironment = () => {
  return isLocalEnvironment() ? 'local' : 'production';
};
