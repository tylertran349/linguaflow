// src/services/geminiService.js

import { GoogleGenerativeAI } from "@google/generative-ai";

// A curated list of vibrant, high-contrast colors.
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

// Helper to convert HEX to HSL for generating color shades.
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

// Helper to create the history instruction for the prompt.
const createHistoryInstruction = (history) => {
  if (!history || history.length === 0) {
    return '';
  }
  const historySample = history.slice(-50); 
  return `
    **Vocabulary History (for avoidance):** To ensure the user learns new words, please AVOID using the primary nouns, verbs, and adjectives from this list of previously generated sentences:
    ${JSON.stringify(historySample)}
  `;
};

// --- PRIVATE CORE FUNCTION FOR JSON-BASED API CALLS ---
// This function is not exported; it's a private helper for this module.
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
    You are an expert language tutor. Generate ${settings.sentenceCount} unique items for a language learner.
    The user's native language is ${settings.nativeLanguage}.
    The user wants to learn ${settings.targetLanguage}.
    The difficulty level should be ${settings.difficulty} (CEFR).
    ${topicInstruction}

    **Vocabulary Goal:** To maximize the learning opportunity, ensure the items use a wide variety of vocabulary. Actively avoid repeating the same key words (nouns, verbs, adjectives) across the different items in THIS new set.
    ${historyInstruction}

    ---

    ${specificInstructions}

    ---

    Now, generate the ${settings.sentenceCount} items based on my request. Remember to only output the JSON array and nothing else.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonString = text.trim().replace(/^```json\n/, '').replace(/\n```$/, '');
    
    const parsedData = JSON.parse(jsonString);

    if (!Array.isArray(parsedData)) {
      throw new Error("API response was not a valid JSON array.");
    }
    
    return parsedData;

  } catch (error) {
    console.error(`Error calling Gemini: ${errorMessage}`, error);
    throw new Error(`${errorMessage} Please check your API key and network connection. The model may also have returned an invalid format. Check the console for more details.`);
  }
};


// --- PUBLIC EXPORTED FUNCTIONS ---

export const fetchSentencesFromGemini = async (apiKey, settings, topic, history = []) => {
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Return the data as a single valid JSON array. Each element should be an object with "target", "native", and "chunks" keys.
    "chunks" must be an array of objects, where each object has "target_chunk", "native_chunk", and "color" keys.
    Example: { "target": "J'aime apprendre.", "native": "I like to learn.", "chunks": [{ "target_chunk": "J'aime", "native_chunk": "I like", "color": "#f80c12" }, { "target_chunk": "apprendre", "native_chunk": "to learn", "color": "#008000" }] }
  `;
  const sentences = await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate chunked sentences.");

  // Post-processing for colors
  let shadeColorIndex = 0;
  sentences.forEach(sentence => {
    if (!sentence || !Array.isArray(sentence.chunks) || sentence.chunks.length === 0) return;
    const numChunks = sentence.chunks.length;
    const paletteSize = RAINBOW_HEX_PALETTE.length;
    if (numChunks <= paletteSize) {
      sentence.chunks.forEach((chunk, index) => { chunk.color = RAINBOW_HEX_PALETTE[index]; });
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


export const fetchUnscrambleSentences = async (apiKey, settings, topic, history = []) => {
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Provide the output as a single, valid JSON array of objects. Each object must have "target" and "native" keys.
    Example: [{ "target": "Un exemple de phrase.", "native": "An example sentence." }]
  `;
  return await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate unscramble sentences.");
};


export const fetchComprehensionPassages = async (apiKey, settings, topic, history = []) => {
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to create a reading comprehension exercise. Generate a JSON array of objects.
    Each object must contain "passage", "question", "options" (an array of strings), and "correctAnswer" (the correct string from options).
    Example: [{ "passage": "Hier, je suis allé au marché.", "question": "Où suis-je allé hier ?", "options": ["Au parc", "Au marché", "À l'école"], "correctAnswer": "Au marché" }]
  `;
  return await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate comprehension passages.");
};


export const fetchPracticeQuestions = async (apiKey, settings, topic, history = []) => {
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to act as a conversation starter. Generate a JSON array of unique and engaging questions.
    The questions should encourage a response of 1-3 sentences, not just "yes" or "no".
    The output must be a single, valid JSON array of strings.
    Example: ["Quels sont tes passe-temps préférés ?", "Décris ton repas idéal."]
  `;
  return await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate practice questions.");
};


export const fetchResponseFeedback = async (apiKey, settings, question, userResponse) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: settings.model });

  const prompt = `
    You are a friendly and encouraging language tutor.
    A user learning ${settings.targetLanguage} was asked the following question:
    **Question:** "${question}"

    They provided this response:
    **User's Response:** "${userResponse}"

    Your task is to provide constructive feedback on their response in ${settings.nativeLanguage}.
    Keep the feedback concise, positive, and focused on helping them improve.
    - Point out one or two grammar mistakes if they exist, and suggest the correction.
    - Suggest a more natural-sounding vocabulary word or phrasing if applicable.
    - If the response is perfect, praise them and maybe offer an alternative way to phrase it to expand their knowledge.
    
    Address the user directly. Start with something like "Great job!" or "Good attempt!".
    Do NOT return JSON. Return only a single string of plain text with your feedback.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error fetching feedback from Gemini:", error);
    throw new Error("Failed to get feedback. The model may be unavailable or the content may have been blocked.");
  }
};