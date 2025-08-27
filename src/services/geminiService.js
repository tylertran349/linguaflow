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
];

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

  const apiVersion = 'v1beta'; // This is the version the SDK currently uses
  const constructedUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${settings.model}:generateContent`;
  console.log(`Calling Gemini API. Constructed URL: ${constructedUrl}`);

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

export const fetchSentencesFromGemini = async (apiKey, settings, topic, history = []) => {
  // --- MODIFIED: The instructions are now much more nuanced to handle complex linguistic cases. ---
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to break down sentences into the smallest logical and semantic learning units for a language learner.
    Return a single valid JSON array. Each element is an object representing a sentence with "target", "native", and "chunks" keys.

    **Rules for Creating "chunks":**
    1. **Granular Target Chunks:** Break down the \`target\` sentence into small, logical parts. Always separate nouns from adjectives, and verbs from objects. Make sure that for any adjective modifying a noun, it is in its own chunk, separated from the noun it is modifying.
    2. **Natural Native Translation:** The \`native_chunk\`s, when read in order, MUST form the grammatically correct and natural \`native\` sentence. Word order is often different between languages. To solve this, you must rearrange the native language translation within the chunks.
    3. Punctuation should be attached to the appropriate final word in the sequence of native chunks.

    **Primary Example (Follow this structure precisely):**
    For the sentence: "Việc sử dụng phương tiện giao thông công cộng thường xuyên có thể giúp bạn tiết kiệm thời gian và tiền bạc."
    (English: "Using public transportation regularly can help you save time and money.")

    The JSON output must be:
    [{
      "target": "Việc sử dụng phương tiện giao thông công cộng thường xuyên có thể giúp bạn tiết kiệm thời gian và tiền bạc.",
      "native": "Using public transportation regularly can help you save time and money.",
      "chunks": [
        { "target_chunk": "Việc sử dụng", "native_chunk": "Using", "color": "..."},
        { "target_chunk": "phương tiện giao thông", "native_chunk": "transportation", "color": "..."},
        { "target_chunk": "công cộng", "native_chunk": "public", "color": "..."},
        { "target_chunk": "thường xuyên", "native_chunk": "regularly", "color": "..."},
        { "target_chunk": "có thể", "native_chunk": "can", "color": "..."},
        { "target_chunk": "giúp", "native_chunk": "help", "color": "..."},
        { "target_chunk": "bạn", "native_chunk": "you", "color": "..."},
        { "target_chunk": "tiết kiệm", "native_chunk": "save", "color": "..."},
        { "target_chunk": "thời gian", "native_chunk": "time", "color": "..."},
        { "target_chunk": "và", "native_chunk": "and", "color": "..."},
        { "target_chunk": "tiền bạc", "native_chunk": "money", "color": "..."}
      ]
    }]

    Another JSON output example:
    [{
      "target": "Dù có nhiều quan điểm trái chiều đề xuất về cơ chế phân phối công bằng vẫn được đưa ra thảo luận.",
      "native": "Despite many opposing viewpoints, proposals for a fair distribution mechanism are still being put up for discussion.",
      "chunks": [
        { "target_chunk": "Dù", "native_chunk": "Despite", "color": "..."},
        { "target_chunk": "có nhiều", "native_chunk": "many", "color": "..."},
        { "target_chunk": "quan điểm", "native_chunk": "viewpoints,", "color": "..."},
        { "target_chunk": "trái chiều", "native_chunk": "opposing", "color": "..."},
        { "target_chunk": "đề xuất", "native_chunk": "proposals", "color": "..."},
        { "target_chunk": "về", "native_chunk": "for", "color": "..."},
        { "target_chunk": "cơ chế phân phối", "native_chunk": "a distribution mechanism", "color": "..."},
        { "target_chunk": "công bằng", "native_chunk": "fair", "color": "..."},
        { "target_chunk": "vẫn được", "native_chunk": "are still being", "color": "..."},
        { "target_chunk": "đưa ra", "native_chunk": "put up", "color": "..."},
        { "target_chunk": "thảo luận", "native_chunk": "for discussion.", "color": "..."}
      ]
    }]

    You can change the word order in the native language translated sentence if needed to make the native language translation sound natural in the native language. Punctuation should be attached to the appropriate final word in the sequence of native chunks.
  `;
  const sentences = await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate chunked sentences.");

  // This color logic remains correct and does not need to be changed.
  sentences.forEach(sentence => {
    if (!sentence || !Array.isArray(sentence.chunks)) return;
    const paletteSize = RAINBOW_HEX_PALETTE.length;
    sentence.chunks.forEach((chunk, index) => {
      chunk.color = RAINBOW_HEX_PALETTE[index % paletteSize];
    });
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