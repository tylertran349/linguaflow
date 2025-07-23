// Add this new variable at the very top of the file.
// It will keep a reference to the currently playing Google Translate audio object.
let currentGoogleAudio = null;

// Find the speakWithWebSpeech function and simplify it by removing the callback.
// The synth.cancel() line already does exactly what we need.
const speakWithWebSpeech = (text, langCode) => {
  if ('speechSynthesis' in window) {
    const synth = window.speechSynthesis;
    // This command stops any currently playing speech before starting the new one.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 1;
    synth.speak(utterance);
  } else {
    alert("Sorry, your browser does not support the Web Speech API.");
  }
};

// Find the speakWithGoogleTranslateProxy function and update its logic.
const speakWithGoogleTranslateProxy = (text, langCode) => {
  // --- START OF CHANGED BLOCK ---
  // If an audio object is already playing, stop it and clear the reference.
  if (currentGoogleAudio) {
    currentGoogleAudio.pause();
    currentGoogleAudio = null;
  }

  const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${langCode}`;
  const audio = new Audio(url);

  // Store the new audio object in our global reference.
  currentGoogleAudio = audio;

  // When the audio finishes playing naturally, clear the reference.
  audio.onended = () => {
    currentGoogleAudio = null;
  };

  audio.play().catch(e => {
    console.error("Proxy TTS playback failed:", e);
    alert("The Google Translate voice failed to play. This can happen due to browser security restrictions (CORS).");
    // Also clear reference on error.
    currentGoogleAudio = null;
  });
  // --- END OF CHANGED BLOCK ---
};

// Find the main speakText function and simplify it by removing the callback.
export const speakText = (text, langCode, engine) => {
  if (!text || !langCode) {
    console.error("speakText: Text or language code is missing.");
    return;
  }
  if (engine === 'web-speech') {
    speakWithWebSpeech(text, langCode);
  } else if (engine === 'google-translate') {
    speakWithGoogleTranslateProxy(text, langCode);
  } else {
    console.error(`Unknown TTS engine selected: ${engine}`);
  }
};