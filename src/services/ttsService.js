// src/services/ttsService.js

// This function now calls our own reliable proxy server.
export const speakText = (text, langCode) => {
  if (!text || !langCode) {
    console.error("speakText: Text or language code is missing.");
    return;
  }

  // Construct the URL to our *local* proxy endpoint
  const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${langCode}`;

  // Create an audio element and play the sound.
  // This will now work without any CORS issues.
  const audio = new Audio(url);
  audio.play().catch(e => console.error("Audio playback failed:", e));
};