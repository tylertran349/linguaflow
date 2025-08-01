// src/services/ttsService.js

let currentGoogleAudio = null;
let currentPuterAudio = null;

// The puterVoiceMap configuration remains unchanged.
const puterVoiceMap = {
  "ru":    { language: "ru-RU", voice: "Maxim",  engine: "standard" },
  "ro":    { language: "ro-RO", voice: "Carmen", engine: "standard" }, 
  "en":    { language: "en-US", voice: "Joanna", engine: "neural" },
  "fr":    { language: "fr-FR", voice: "Remi",   engine: "neural" },
  "es":    { language: "es-ES", voice: "Sergio", engine: "neural" },
  "de":    { language: "de-DE", voice: "Daniel", engine: "neural" },
  "it":    { language: "it-IT", voice: "Adriano",engine: "neural" },
  "ja":    { language: "ja-JP", voice: "Takumi", engine: "neural" },
  "ko":    { language: "ko-KR", voice: "Seoyeon",engine: "neural" },
  "zh-CN": { language: "cmn-CN",voice: "Zhiyu",  engine: "neural" },
  "ar":    { language: "ar-AE", voice: "Hala",   engine: "neural" },
  "pt":    { language: "pt-PT", voice: "Ines",   engine: "neural" },
  "hi":    { language: "hi-IN", voice: "Kajal",  engine: "neural" },
  "da":    { language: "da-DK", voice: "Sofie",   engine: "neural" },
  "nl":    { language: "nl-NL", voice: "Laura",  engine: "neural" },
  "fi":    { language: "fi-FI", voice: "Suvi",   engine: "neural" },
  "no":    { language: "nb-NO", voice: "Ida",    engine: "neural" },
  "pl":    { language: "pl-PL", voice: "Ola",    engine: "neural" },
  "sv":    { language: "sv-SE", voice: "Elin",  engine: "neural" },
  "tr":    { language: "tr-TR", voice: "Burcu",  engine: "neural" },
};


// --- NEW: Centralized function to stop all ongoing audio ---
// This function ensures that any active audio source is stopped.
const stopAllAudio = () => {
  // Stop Web Speech API if it's speaking
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  // Stop Google Translate audio if it's playing
  if (currentGoogleAudio) {
    currentGoogleAudio.pause();
    currentGoogleAudio = null;
  }
  
  // Stop Puter audio if it's playing
  if (currentPuterAudio) {
    currentPuterAudio.pause();
    currentPuterAudio = null;
  }
};

// --- MODIFIED: Removed redundant cancellation logic ---
const speakWithWebSpeech = (text, langCode, rate = 1) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = rate; // Use the provided rate
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } else {
    console.error("Sorry, your browser does not support the Web Speech API.");
  }
};

// --- MODIFIED: Removed redundant cancellation logic ---
const speakWithGoogleTranslateProxy = (text, langCode, rate = 1) => {
  const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${langCode}&speed=${rate}`;
  const audio = new Audio(url);
  currentGoogleAudio = audio;
  audio.onended = () => { currentGoogleAudio = null; };
  audio.play().catch(e => {
    console.error("Proxy TTS playback failed:", e);
    currentGoogleAudio = null;
  });
};

// --- MODIFIED: Removed redundant cancellation logic ---
const speakWithPuter = async (text, puterOptions) => {
  try {
    // The options object is now passed directly without a speed parameter
    const audio = await puter.ai.txt2speech(text, puterOptions);
    currentPuterAudio = audio;
    audio.onended = () => { currentPuterAudio = null; };
    await audio.play();
  } catch (error) {
    console.error("Puter TTS playback failed:", error);
    currentPuterAudio = null;
  }
};

export const speakText = (text, langCode, settings) => {
  if (!text || !langCode || !settings) {
    console.error("speakText: Text, language code, or settings object is missing.");
    return;
  }

  stopAllAudio();
  
  const { ttsEngine } = settings;

  if (ttsEngine === 'web-speech') {
    speakWithWebSpeech(text, langCode, settings.webSpeechRate);
  } else if (ttsEngine === 'google-translate') {
    speakWithGoogleTranslateProxy(text, langCode, settings.googleTranslateRate);
  } else if (ttsEngine === 'puter') {
    const optionsForPuter = puterVoiceMap[langCode];
    if (optionsForPuter) {
      speakWithPuter(text, optionsForPuter);
    } else {
      alert(`The language "${langCode}" is not supported by the Puter AI voice engine in this app.`);
    }
  } else {
    console.error(`Unknown TTS engine selected: ${ttsEngine}`);
  }
};