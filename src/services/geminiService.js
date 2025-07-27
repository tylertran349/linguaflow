// src/services/geminiService.js

import { GoogleGenerativeAI } from "@google/generative-ai";

// A curated list of vibrant, high-contrast colors that look good on a dark background.
// We will use these instead of the random colors from Gemini.
const RAINBOW_HEX_PALETTE = [
  '#f80c12',
  '#C11C84',
  '#ff9933',
  '#008000',
  '#1296a5ff',
  '#0000FF',
  '#3b1e86ff',
  '#5C4033',
  '#575757',
];

function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = "0x" + hex[1] + hex[1];
    g = "0x" + hex[2] + hex[2];
    b = "0x" + hex[3] + hex[3];
  } else if (hex.length === 7) {
    r = "0x" + hex[1] + hex[2];
    g = "0x" + hex[3] + hex[4];
    b = "0x" + hex[5] + hex[6];
  }
  r /= 255;
  g /= 255;
  b /= 255;
  let cmin = Math.min(r,g,b),
      cmax = Math.max(r,g,b),
      delta = cmax - cmin,
      h = 0, s = 0, l = 0;

  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);
  return { h, s, l };
}


// --- THIS FUNCTION REMAINS UNCHANGED FOR SentenceDisplay.jsx ---
export const fetchSentencesFromGemini = async (apiKey, settings, topic) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: settings.model,
    generationConfig: {
      temperature: 1,
    }
  });
  
  const topicInstruction = (topic && topic.trim() !== '') 
    ? `The sentences must be related to the following topic/theme: "${topic}".`
    : '';

  const prompt = `
    You are an expert language tutor. Generate ${settings.sentenceCount} sentences for a language learner.
    The user's native language is ${settings.nativeLanguage}.
    The user wants to learn ${settings.targetLanguage}.
    The difficulty level should be ${settings.difficulty} (CEFR).
    ${topicInstruction}

    **IMPORTANT INSTRUCTIONS:**
    Return the data as a single valid JSON array. Do not include any text outside of the JSON array.
    Each element in the array should be an object with three keys: "target", "native", and "chunks".
    1.  "target": The full sentence in ${settings.targetLanguage}.
    2.  "native": The full sentence in ${settings.nativeLanguage}.
    3.  "chunks": An array of objects, where each object represents a corresponding word or phrase chunk. Each chunk object must have three keys: "target_chunk", "native_chunk", and "color".
        - "target_chunk": A word or small phrase from the target sentence.
        - "native_chunk": The corresponding translation of that chunk in the native language.
        - "color": A unique hex color code for this chunk.

    Make sure the chunks correctly cover the entire sentences. Group words into meaningful chunks where a direct one-to-one word translation is not accurate.

    --- EXAMPLES OF THE DESIRED JSON STRUCTURE ---

    Example 1 (Target: French, Native: English):
    {
      "target": "J'aime apprendre de nouvelles langues.",
      "native": "I like to learn new languages.",
      "chunks": [
        { "target_chunk": "J'aime", "native_chunk": "I like", "color": "#f80c12" },
        { "target_chunk": "apprendre", "native_chunk": "to learn", "color": "#008000" },
        { "target_chunk": "de nouvelles langues", "native_chunk": "new languages", "color": "#0000FF" }
      ]
    }

    Example 2 (Target: Vietnamese, Native: English). This shows how to group words like "đang học" and "tiếng Việt" into meaningful chunks.
    {
      "target": "Tôi đang học tiếng Việt.",
      "native": "I am learning Vietnamese.",
      "chunks": [
        { "target_chunk": "Tôi", "native_chunk": "I", "color": "#3b1e86ff" },
        { "target_chunk": "đang học", "native_chunk": "am learning", "color": "#1296a5ff" },
        { "target_chunk": "tiếng Việt", "native_chunk": "Vietnamese", "color": "#ff9933" }
      ]
    }

    Now, generate the ${settings.sentenceCount} sentences based on my request. Remember to only output the JSON array.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonString = text.trim().replace(/^```json\n/, '').replace(/\n```$/, '');
    
    let sentences = JSON.parse(jsonString);

    let shadeColorIndex = 0;

    if (Array.isArray(sentences)) {
      sentences.forEach(sentence => {
        if (!sentence || !Array.isArray(sentence.chunks) || sentence.chunks.length === 0) {
          return;
        }

        const numChunks = sentence.chunks.length;
        const paletteSize = RAINBOW_HEX_PALETTE.length;

        if (numChunks <= paletteSize) {
          sentence.chunks.forEach((chunk, index) => {
            chunk.color = RAINBOW_HEX_PALETTE[index];
          });
        }
        else {
          const baseHexColor = RAINBOW_HEX_PALETTE[shadeColorIndex];
          const baseHslColor = hexToHsl(baseHexColor);
          
          const hue = baseHslColor.h;
          const saturation = baseHslColor.s;

          const minLightness = 45;
          const maxLightness = 85;
          const lightnessStep = (maxLightness - minLightness) / (numChunks - 1 || 1);

          sentence.chunks.forEach((chunk, index) => {
            const lightness = Math.round(minLightness + (index * lightnessStep));
            chunk.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
          });

          shadeColorIndex = (shadeColorIndex + 1) % paletteSize;
        }
      });
    }

    return sentences;

  } catch (error) {
    console.error("Error fetching from Gemini:", error);
    throw new Error("Failed to generate sentences. Please check your API key and network connection. The model may also have returned an invalid format. Check the console for more details.");
  }
};


// --- NEW FUNCTION ADDED FOR UnscrambleWords.jsx ---
/**
 * Fetches sentences with a simpler structure for the unscramble game.
 * It only requests a 'target' and 'native' sentence pair.
 */
export const fetchUnscrambleSentences = async (apiKey, settings, topic) => {
  // We reuse the same AI and model setup
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: settings.model,
    generationConfig: {
      temperature: 0.8, // Slightly less random might be better for this game
    }
  });

  const topicInstruction = (topic && topic.trim() !== '')
    ? `The sentences should be related to the following topic: "${topic}".`
    : "The sentences can be about any common topic.";

  // A new, simpler prompt tailored for this game's needs
  const prompt = `
    You are an expert language teacher creating sentences for a word-unscramble game.
    Generate ${settings.sentenceCount} unique sentences for a language learner.
    The user's native language is ${settings.nativeLanguage}.
    The user is learning ${settings.targetLanguage}.
    The user's proficiency level is ${settings.difficulty} on the CEFR scale.
    ${topicInstruction}

    Please provide the output as a single, valid JSON array of objects.
    Each object in the array must have exactly two keys:
    1. "target": The full, correct sentence in ${settings.targetLanguage}.
    2. "native": The accurate, natural-sounding translation of the sentence in ${settings.nativeLanguage}.

    **IMPORTANT**: Do not include 'chunks', 'color', or any other keys.

    Example format:
    [
      {
        "target": "Un exemple de phrase dans la langue cible.",
        "native": "An example sentence in the target language."
      },
      {
        "target": "Voici une autre phrase.",
        "native": "Here is another sentence."
      }
    ]

    Now, generate the ${settings.sentenceCount} sentences. Output only the raw JSON array and nothing else.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Reuse the same robust JSON cleaning and parsing logic
    const jsonString = text.trim().replace(/^```json\n/, '').replace(/\n```$/, '');
    const parsedSentences = JSON.parse(jsonString);

    // Add a simple validation check
    if (!Array.isArray(parsedSentences)) {
      throw new Error("API response was not a valid JSON array.");
    }
    
    // No color processing is needed, so we just return the data.
    return parsedSentences;

  } catch (error) {
    console.error("Error fetching from Gemini for Unscramble game:", error);
    throw new Error("Failed to generate unscramble sentences. Please check the console for details.");
  }
};