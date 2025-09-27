// src/services/ttsService.js

let currentGoogleAudio = null;
let currentPuterAudio = null;

// Use the same API_BASE_URL pattern as the rest of the app
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

// Enhanced mapping from basic language codes to BCP 47 language tags for Web Speech API
// This mapping prioritizes the most commonly supported language variants
const languageCodeToBCP47 = {
  "ar": "ar-SA",      // Arabic - Saudi Arabia (more commonly supported)
  "bn": "bn-BD",      // Bengali - Bangladesh
  "bg": "bg-BG",      // Bulgarian - Bulgaria
  "hr": "hr-HR",      // Croatian - Croatia
  "cs": "cs-CZ",      // Czech - Czech Republic
  "da": "da-DK",      // Danish - Denmark
  "nl": "nl-NL",      // Dutch - Netherlands
  "en": "en-US",      // English - United States
  "et": "et-EE",      // Estonian - Estonia
  "fi": "fi-FI",      // Finnish - Finland
  "fr": "fr-FR",      // French - France
  "de": "de-DE",      // German - Germany
  "el": "el-GR",      // Greek - Greece
  "iw": "he-IL",      // Hebrew - Israel
  "hi": "hi-IN",      // Hindi - India
  "hu": "hu-HU",      // Hungarian - Hungary
  "id": "id-ID",      // Indonesian - Indonesia
  "it": "it-IT",      // Italian - Italy
  "ja": "ja-JP",      // Japanese - Japan
  "ko": "ko-KR",      // Korean - South Korea
  "lv": "lv-LV",      // Latvian - Latvia
  "lt": "lt-LT",      // Lithuanian - Lithuania
  "zh-CN": "zh-CN",   // Chinese Simplified - China
  "no": "nb-NO",      // Norwegian Bokmål - Norway
  "pl": "pl-PL",      // Polish - Poland
  "pt": "pt-BR",      // Portuguese - Brazil (more commonly supported)
  "ro": "ro-RO",      // Romanian - Romania
  "ru": "ru-RU",      // Russian - Russia
  "sr": "sr-RS",      // Serbian - Serbia
  "sk": "sk-SK",      // Slovak - Slovakia
  "sl": "sl-SI",      // Slovenian - Slovenia
  "es": "es-ES",      // Spanish - Spain
  "sw": "sw-KE",      // Swahili - Kenya
  "sv": "sv-SE",      // Swedish - Sweden
  "th": "th-TH",      // Thai - Thailand
  "tr": "tr-TR",      // Turkish - Turkey
  "uk": "uk-UA",      // Ukrainian - Ukraine
  "vi": "vi-VN"       // Vietnamese - Vietnam
};

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

// --- COMPLETELY REDESIGNED: Web Speech API with proper language handling ---
const speakWithWebSpeech = (text, langCode, rate = 1) => {
  if (!('speechSynthesis' in window)) {
    console.error("Sorry, your browser does not support the Web Speech API.");
    return;
  }

  // Convert basic language code to BCP 47 format
  const bcp47LangCode = languageCodeToBCP47[langCode] || langCode;
  
  // Create the utterance
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = bcp47LangCode;
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Function to find and set the best matching voice
  const setBestVoice = () => {
    const voices = speechSynthesis.getVoices();
    
    if (voices.length === 0) {
      console.warn("No voices available yet, will retry when voices are loaded");
      return false;
    }

    // First, try to find an exact language match
    let bestVoice = voices.find(voice => voice.lang === bcp47LangCode);
    
    // If no exact match, try to find a voice that starts with the language code
    if (!bestVoice) {
      bestVoice = voices.find(voice => 
        voice.lang.startsWith(langCode + '-') || 
        voice.lang.startsWith(langCode + '_')
      );
    }
    
    // If still no match, try to find any voice with the same base language
    if (!bestVoice) {
      const baseLang = langCode.split('-')[0];
      bestVoice = voices.find(voice => 
        voice.lang.startsWith(baseLang + '-') || 
        voice.lang.startsWith(baseLang + '_')
      );
    }
    
    // If we found a voice, use it
    if (bestVoice) {
      utterance.voice = bestVoice;
      console.log(`Using voice: ${bestVoice.name} (${bestVoice.lang}) for language: ${langCode}`);
      return true;
    } else {
      console.warn(`No suitable voice found for language: ${langCode} (${bcp47LangCode})`);
      console.log("Available voices:", voices.map(v => `${v.name} (${v.lang})`));
      return false;
    }
  };

  // Try to set the voice immediately
  const voiceSet = setBestVoice();
  
  if (voiceSet) {
    // Voice is set, speak immediately
    speechSynthesis.speak(utterance);
  } else {
    // Voices not loaded yet, wait for them
    const onVoicesChanged = () => {
      if (setBestVoice()) {
        speechSynthesis.speak(utterance);
      } else {
        // Fallback: speak with default voice but correct language
        console.warn(`Speaking with default voice for language: ${bcp47LangCode}`);
        speechSynthesis.speak(utterance);
      }
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    };
    
    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    
    // Fallback timeout in case voices never load
    setTimeout(() => {
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      if (!speechSynthesis.speaking) {
        console.warn(`Speaking with default voice after timeout for language: ${bcp47LangCode}`);
        speechSynthesis.speak(utterance);
      }
    }, 2000);
  }
};

// --- MODIFIED: Updated to work in both local and production environments ---
const speakWithGoogleTranslateProxy = (text, langCode, rate = 1) => {
  // Use the same API_BASE_URL pattern as the rest of the app
  const url = `${API_BASE_URL}/api/tts?text=${encodeURIComponent(text)}&lang=${langCode}&speed=${rate}`;
  
  const audio = new Audio(url);
  currentGoogleAudio = audio;
  audio.onended = () => { currentGoogleAudio = null; };
  audio.onerror = (e) => {
    console.error("Proxy TTS playback failed:", e);
    currentGoogleAudio = null;
    // Fallback to Web Speech API when proxy fails
    console.log("Falling back to Web Speech API...");
    speakWithWebSpeech(text, langCode, rate);
  };
  audio.play().catch(e => {
    console.error("Proxy TTS playback failed:", e);
    currentGoogleAudio = null;
    // Fallback to Web Speech API when proxy fails
    console.log("Falling back to Web Speech API...");
    speakWithWebSpeech(text, langCode, rate);
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

  // Debug logging for TTS calls
  console.log(`TTS Debug - Text: "${text}", Language: ${langCode}, Engine: ${ttsEngine}`);

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