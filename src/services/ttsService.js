// src/services/ttsService.js

const speakWithWebSpeech = (text, langCode) => {
  if ('speechSynthesis' in window) {
    const synth = window.speechSynthesis;
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

// --- UPDATED to use the reliable local proxy ---
const speakWithGoogleTranslateProxy = (text, langCode) => {
  // Construct the URL to our *local* proxy endpoint
  const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${langCode}`;

  // This will now work reliably during local development
  const audio = new Audio(url);
  audio.play().catch(e => console.error("Proxy TTS playback failed:", e));
};

export const speakText = (text, langCode, engine) => {
  if (!text || !langCode) {
    console.error("speakText: Text or language code is missing.");
    return;
  }
  if (engine === 'web-speech') {
    speakWithWebSpeech(text, langCode);
  } else if (engine === 'google-translate') {
    // We now call the proxy function
    speakWithGoogleTranslateProxy(text, langCode);
  } else {
    console.error(`Unknown TTS engine selected: ${engine}`);
  }
};