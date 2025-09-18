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
      temperature: settings.temperature || 1,
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
    const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to generate sentences and a PRECISE, GRANULAR word map for color-coding. The map must show how individual words in the target language correspond to words in the native language.

    **CRITICAL LANGUAGE RULE:**
    Pay close attention to the languages defined earlier in the prompt.
    - The "targetSentence" field MUST be in ${settings.targetLanguage}.
    - The "nativeSentence" field MUST be in ${settings.nativeLanguage}.
    Do NOT reverse these roles.

    **MANDATORY GRANULARITY RULE:**
    The "wordMap" must be broken down into the smallest possible meaningful units.
    1.  **SEPARATE NOUNS AND ADJECTIVES:** A noun and the adjective(s) that modify it MUST be in separate objects in the map.
    2.  **SEPARATE VERBS AND OBJECTS:** A verb and its object must be in separate map objects.
    3.  **AVOID GROUPING:** Do not group words into phrases unless absolutely necessary for meaning (e.g., compound lexemes or fixed expressions).

    **CRITICAL MAPPING RULE:**
    The "wordMap" MUST be a complete decomposition of the "nativeSentence". EVERY SINGLE WORD that appears in the "nativeSentence" must be present as a "native" value in one of the "wordMap" objects. There can be NO omissions. Grammatical words like "the", "a", "of" must be included.

    **CRITICAL RULE FOR NATIVE LANGUAGE TRANSLATION:**
    While the "wordMap" shows the direct, granular translation, the "nativeSentence" field MUST be grammatically perfect and sound natural in the native language. You will achieve this by reassembling the "native" values from the word map into the correct syntactic order for that language.

    **OUTPUT FORMAT:**
    Provide the output as a single, valid JSON array of objects with "targetSentence", "nativeSentence", and "wordMap" keys.

    ---
    **EXAMPLES OF CORRECT GRANULAR MAPPING:**

    **EXAMPLE 1: Target = Vietnamese, Native = English**
    [{
      "targetSentence": "Khái niệm về khối lượng là nền tảng của vật lý.",
      "nativeSentence": "The concept of mass is the foundation of physics.",
      "wordMap": [
        { "target": "", "native": "The" },
        { "target": "Khái niệm về", "native": "concept of" },
        { "target": "khối lượng", "native": "mass" },
        { "target": "là", "native": "is" },
        { "target": "", "native": "the" },
        { "target": "nền tảng", "native": "foundation" },
        { "target": "của", "native": "of" },
        { "target": "vật lý", "native": "physics" }
      ]
    }]

    **EXAMPLE 2: Target = English, Native = Vietnamese**
    [{
      "targetSentence": "I want to learn a new language.",
      "nativeSentence": "Tôi muốn học một ngôn ngữ mới.",
      "wordMap": [
        { "target": "I", "native": "Tôi" },
        { "target": "want to", "native": "muốn" },
        { "target": "learn", "native": "học" },
        { "target": "a", "native": "một" },
        { "target": "new", "native": "mới" },
        { "target": "language", "native": "ngôn ngữ" }
      ]
    }]

    **EXAMPLE 3: Target = French, Native = English**
    [{
      "targetSentence": "La grande maison rouge est au bout de la rue.",
      "nativeSentence": "The big red house is at the end of the street.",
      "wordMap": [
        { "target": "", "native": "The" },
        { "target": "grande", "native": "big" },
        { "target": "rouge", "native": "red" },
        { "target": "maison", "native": "house" },
        { "target": "est", "native": "is" },
        { "target": "au bout de", "native": "at the end of" },
        { "target": "", "native": "the" },
        { "target": "la rue", "native": "street" }
      ]
    }]
  `;

  console.log(specificInstructions);
  
  const result = await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate color-coded sentences.");

  // Post-process to add colors intelligently
  result.forEach(sentence => {
    if (sentence.wordMap) {
      let colorIndex = 0; // Use a separate index for assigning rainbow colors
      sentence.colorMapping = sentence.wordMap.map((pair) => {
        let color;
        // If the target word exists, it's a direct translation, so give it a rainbow color
        if (pair.target && pair.target.trim() !== '') {
          color = RAINBOW_HEX_PALETTE[colorIndex % RAINBOW_HEX_PALETTE.length];
          colorIndex++; // Only increment the color index for "real" words
        } else {
          // If the target is empty, it's a grammatical insertion; make it black
          color = '#000000';
        }
        return { ...pair, color };
      });
      delete sentence.wordMap; // Remove original map to save space
    }
  });

  return result;
};


export const fetchUnscrambleSentences = async (apiKey, settings, topic, history = []) => {
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Generate sentences for a word unscrambling game where multiple grammatically correct arrangements should be accepted.
    
    **OUTPUT FORMAT:**
    Provide the output as a single, valid JSON array of objects. Each object must have:
    - "target": The primary correct sentence (string)
    - "native": The native language translation (string)  
    - "alternatives": An array of alternative grammatically correct arrangements (array of strings)
    
    **ALTERNATIVE ARRANGEMENTS:**
    For each sentence, provide 2-4 alternative arrangements that are grammatically correct but have different word orders.
    Examples of valid alternatives:
    - "I usually sip coffee in the morning before work." vs "I usually sip coffee before work in the morning."
    - "She quickly ran to the store." vs "She ran quickly to the store."
    - "The big red house is beautiful." vs "The red big house is beautiful." (if both are grammatically acceptable)
    
    **RULES FOR ALTERNATIVES:**
    1. All alternatives must be grammatically correct
    2. All alternatives must have the same meaning as the primary sentence
    3. Focus on different word orders, not just punctuation changes
    4. Include variations in adverb placement, adjective order, and phrase positioning
    5. Do NOT include alternatives that change the meaning or are grammatically incorrect
    
    **EXAMPLE:**
    [{
      "target": "I usually sip coffee in the morning before work.",
      "native": "Je bois habituellement du café le matin avant le travail.",
      "alternatives": [
        "I usually sip coffee before work in the morning.",
        "In the morning, I usually sip coffee before work.",
        "Before work, I usually sip coffee in the morning."
      ]
    }]
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
  const model = genAI.getGenerativeModel({ 
    model: settings.model,
    generationConfig: {
      temperature: settings.temperature || 1,
    }
  });

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