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


export const fetchSentencesFromGemini = async (apiKey, settings, topic) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: settings.model,
    // Add this generationConfig object to increase randomness
    generationConfig: {
      temperature: 0.9,
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
        { "target_chunk": "J'aime", "native_chunk": "I like", "color": "#ff5733" },
        { "target_chunk": "apprendre", "native_chunk": "to learn", "color": "#33ff57" },
        { "target_chunk": "de nouvelles langues", "native_chunk": "new languages", "color": "#3357ff" }
      ]
    }

    Example 2 (Target: Vietnamese, Native: English). This shows how to group words like "đang học" and "tiếng Việt" into meaningful chunks.
    {
      "target": "Tôi đang học tiếng Việt.",
      "native": "I am learning Vietnamese.",
      "chunks": [
        { "target_chunk": "Tôi", "native_chunk": "I", "color": "#8A2BE2" },
        { "target_chunk": "đang học", "native_chunk": "am learning", "color": "#008080" },
        { "target_chunk": "tiếng Việt", "native_chunk": "Vietnamese", "color": "#FF8C00" }
      ]
    }

    Now, generate the 20 sentences based on my request. Remember to only output the JSON array.
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

        // --- UPDATED COLOR LOGIC ---

        // MODE 1: Sentence is short enough for the direct rainbow palette.
        if (numChunks <= paletteSize) {
          sentence.chunks.forEach((chunk, index) => {
            // Simply assign the HEX code string directly. This works!
            chunk.color = RAINBOW_HEX_PALETTE[index];
          });
        }
        // MODE 2: Sentence is too long, so we generate shades.
        else {
          // Get the base color as a HEX string.
          const baseHexColor = RAINBOW_HEX_PALETTE[shadeColorIndex];
          // Use our helper to convert it to HSL on the fly.
          const baseHslColor = hexToHsl(baseHexColor);
          
          const hue = baseHslColor.h;
          const saturation = baseHslColor.s;

          const minLightness = 45;
          const maxLightness = 85;
          const lightnessStep = (maxLightness - minLightness) / (numChunks - 1 || 1);

          sentence.chunks.forEach((chunk, index) => {
            const lightness = Math.round(minLightness + (index * lightnessStep));
            // Now we can correctly construct the HSL color string.
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