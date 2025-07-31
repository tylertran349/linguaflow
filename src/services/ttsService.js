// src/services/ttsService.js

let currentGoogleAudio = null;
let currentPuterAudio = null;

// --- START OF THE DEFINITIVE CONFIGURATION MAP ---
// This map now contains all the necessary options for each language,
// including the correct engine type to avoid errors.
const puterVoiceMap = {
  // --- Existing entries (unchanged as requested) ---
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

  // --- New entries for newly supported languages ---
  "da":    { language: "da-DK", voice: "Sofie",   engine: "neural" }, // Danish
  "nl":    { language: "nl-NL", voice: "Laura",  engine: "neural" }, // Dutch
  "fi":    { language: "fi-FI", voice: "Suvi",   engine: "neural" }, // Finnish
  "no":    { language: "nb-NO", voice: "Ida",    engine: "neural" }, // Norwegian
  "pl":    { language: "pl-PL", voice: "Ola",    engine: "neural" }, // Polish
  "sv":    { language: "sv-SE", voice: "Elin",  engine: "neural" }, // Swedish
  "tr":    { language: "tr-TR", voice: "Burcu",  engine: "neural" }, // Turkish
};
// --- END OF THE DEFINITIVE CONFIGURATION MAP ---


// These individual functions do not need to change.
const speakWithWebSpeech = (text, langCode) => {
  if ('speechSynthesis' in window) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.pitch = 1;
    utterance.rate = 0.6;
    utterance.volume = 1;
    synth.speak(utterance);
  } else {
    alert("Sorry, your browser does not support the Web Speech API.");
  }
};

const speakWithGoogleTranslateProxy = (text, langCode) => {
  if (currentGoogleAudio) { currentGoogleAudio.pause(); currentGoogleAudio = null; }
  if (currentPuterAudio) { currentPuterAudio.pause(); currentPuterAudio = null; }
  const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${langCode}`;
  const audio = new Audio(url);
  currentGoogleAudio = audio;
  audio.onended = () => { currentGoogleAudio = null; };
  audio.play().catch(e => {
    console.error("Proxy TTS playback failed:", e);
    alert("The Google Translate voice failed to play.");
    currentGoogleAudio = null;
  });
};

// --- START OF UPDATED speakWithPuter FUNCTION ---
// This function is now simpler. It just passes the configuration object.
const speakWithPuter = async (text, puterOptions) => {
  if (currentGoogleAudio) { currentGoogleAudio.pause(); currentGoogleAudio = null; }
  if (currentPuterAudio) { currentPuterAudio.pause(); currentPuterAudio = null; }
  try {
    // The `puterOptions` object from our map is passed directly.
    // It contains the correct language, voice, AND engine.
    const audio = await puter.ai.txt2speech(text, puterOptions);

    currentPuterAudio = audio;
    audio.onended = () => { currentPuterAudio = null; };
    await audio.play();
  } catch (error) {
    console.error("Puter TTS playback failed:", error);
    const errorMessage = error?.message || JSON.stringify(error) || "An unknown error occurred.";
    alert(`Puter AI TTS failed: ${errorMessage}`);
    currentPuterAudio = null;
  }
};
// --- END OF UPDATED speakWithPuter FUNCTION ---


// The main exported function uses the map and requires no changes.
export const speakText = (text, langCode, engine) => {
  if (!text || !langCode) {
    console.error("speakText: Text or language code is missing.");
    return;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if (engine === 'web-speech') {
    speakWithWebSpeech(text, langCode);
  } else if (engine === 'google-translate') {
    speakWithGoogleTranslateProxy(text, langCode);
  } else if (engine === 'puter') {
    const optionsForPuter = puterVoiceMap[langCode];
    if (optionsForPuter) {
      speakWithPuter(text, optionsForPuter);
    } else {
      alert(`The language "${langCode}" is not supported by the Puter AI voice engine in this app.`);
      console.warn(`Puter TTS: Language code "${langCode}" not found in voice map.`);
    }
  } else {
    console.error(`Unknown TTS engine selected: ${engine}`);
  }
};