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

// Helper to create the history instruction for the prompt
const createHistoryInstruction = (history) => {
  if (!history || history.length === 0) {
    return '';
  }
  // We only send a sample of the history to keep the prompt size reasonable
  const historySample = history.slice(-50); 
  return `
    **Vocabulary History (for avoidance):** To ensure the user learns new words, please AVOID using the primary nouns, verbs, and adjectives from this list of previously generated sentences:
    ${JSON.stringify(historySample)}
  `;
};


const _callGeminiModel = async (apiKey, settings, topic, history, specificInstructions, errorMessage) => {
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
  
  const historyInstruction = createHistoryInstruction(history);

  const prompt = `
    You are an expert language tutor. Generate ${settings.sentenceCount} unique sentences for a language learner.
    The user's native language is ${settings.nativeLanguage}.
    The user wants to learn ${settings.targetLanguage}.
    The difficulty level should be ${settings.difficulty} (CEFR).
    ${topicInstruction}

    **Vocabulary Goal:** To maximize the learning opportunity, ensure the sentences use a wide variety of vocabulary. Actively avoid repeating the same key words (nouns, verbs, adjectives) across the different sentences in THIS new set.
    ${historyInstruction}

    ---

    ${specificInstructions}

    ---

    Now, generate the ${settings.sentenceCount} sentences based on my request. Remember to only output the JSON array.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Standard cleanup for JSON response
    const jsonString = text.trim().replace(/^```json\n/, '').replace(/\n```$/, '');
    
    const parsedData = JSON.parse(jsonString);

    if (!Array.isArray(parsedData)) {
      throw new Error("API response was not a valid JSON array.");
    }
    
    return parsedData;

  } catch (error) {
    console.error(`Error calling Gemini: ${errorMessage}`, error);
    // Use the specific error message passed to the function
    throw new Error(`${errorMessage} Please check your API key and network connection. The model may also have returned an invalid format. Check the console for more details.`);
  }
};


// --- REFACTORED: `fetchSentencesFromGemini` ---
export const fetchSentencesFromGemini = async (apiKey, settings, topic, history = []) => {
  // 1. Define instructions specific to this function's task
  const specificInstructions = `
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

    Example: { "target": "J'aime apprendre.", "native": "I like to learn.", "chunks": [{ "target_chunk": "J'aime", "native_chunk": "I like", "color": "#f80c12" }, { "target_chunk": "apprendre", "native_chunk": "to learn", "color": "#008000" }] }
  `;

  // 2. Call the core function
  const sentences = await _callGeminiModel(
    apiKey, 
    settings, 
    topic, 
    history, 
    specificInstructions, 
    "Failed to generate chunked sentences."
  );

  // 3. Perform post-processing specific to this function (color assignment)
  let shadeColorIndex = 0;
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
    } else {
      const baseHexColor = RAINBOW_HEX_PALETTE[shadeColorIndex];
      const baseHslColor = hexToHsl(baseHexColor);
      const { h, s } = baseHslColor;
      const minLightness = 45;
      const maxLightness = 85;
      const lightnessStep = (maxLightness - minLightness) / (numChunks - 1 || 1);
      sentence.chunks.forEach((chunk, index) => {
        const lightness = Math.round(minLightness + (index * lightnessStep));
        chunk.color = `hsl(${h}, ${s}%, ${lightness}%)`;
      });
      shadeColorIndex = (shadeColorIndex + 1) % paletteSize;
    }
  });

  return sentences;
};


// --- REFACTORED: `fetchUnscrambleSentences` ---
export const fetchUnscrambleSentences = async (apiKey, settings, topic, history = []) => {
  // 1. Define instructions specific to this function's task
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Provide the output as a single, valid JSON array of objects.
    Each object in the array must have exactly two keys:
    1. "target": The full, correct sentence in ${settings.targetLanguage}.
    2. "native": The accurate, natural-sounding translation of the sentence in ${settings.nativeLanguage}.

    DO NOT include 'chunks', 'color', or any other keys.

    Example format:
    [
      {
        "target": "Un exemple de phrase dans la langue cible.",
        "native": "An example sentence in the target language."
      }
    ]
  `;
  
  // 2. Call the core function and return the result directly
  // No special post-processing is needed for this function.
  return await _callGeminiModel(
    apiKey, 
    settings, 
    topic, 
    history, 
    specificInstructions, 
    "Failed to generate unscramble sentences."
  );
};

export const fetchComprehensionPassages = async (apiKey, settings, topic, history = []) => {
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to create a reading comprehension exercise.
    Generate a JSON array of objects. Each object must contain:
    1. "passage": A short paragraph (2-4 sentences) in ${settings.targetLanguage}.
    2. "question": A multiple-choice question about the passage, written in ${settings.targetLanguage}.
    3. "options": An array of 3-4 possible answers (strings), also in ${settings.targetLanguage}. One must be correct.
    4. "correctAnswer": The exact string of the correct answer from the "options" array.

    The question should test understanding of the passage content, not just vocabulary.
    Ensure the "options" include plausible but incorrect distractors.

    **Example of the desired JSON structure:**
    [
      {
        "passage": "Hier, je suis allé au marché avec ma mère. Nous avons acheté des pommes, des oranges et des bananes. C'était une belle journée ensoleillée et le marché était très animé.",
        "question": "Qu'est-ce qui n'a pas été acheté au marché ?",
        "options": ["Des pommes", "Des bananes", "Des fraises", "Des oranges"],
        "correctAnswer": "Des fraises"
      }
    ]

    Now, generate ${settings.sentenceCount} unique passage/question sets based on my request. Output only the raw JSON array.
  `;

  return await _callGeminiModel(
    apiKey,
    settings,
    topic,
    history,
    specificInstructions,
    "Failed to generate comprehension passages."
  );
};