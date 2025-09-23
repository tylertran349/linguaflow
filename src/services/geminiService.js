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

// Helper function to validate sentence length appropriateness for CEFR levels
const validateSentenceLength = (wordCount, difficulty) => {
  const lengthRanges = {
    'A1': { min: 4, max: 8 },
    'A2': { min: 6, max: 12 },
    'B1': { min: 10, max: 18 },
    'B2': { min: 12, max: 22 },
    'C1': { min: 15, max: 25 },
    'C2': { min: 15, max: 30 }
  };
  
  const range = lengthRanges[difficulty];
  if (!range) return true; // If difficulty not found, assume appropriate
  
  // Allow some flexibility - consider appropriate if within 20% of range
  const flexibility = 0.2;
  const minFlexible = Math.max(1, range.min - Math.floor(range.min * flexibility));
  const maxFlexible = range.max + Math.floor(range.max * flexibility);
  
  return wordCount >= minFlexible && wordCount <= maxFlexible;
};

// Helper to create the history instruction for the prompt.
const createHistoryInstruction = (history) => {
  if (!history || history.length === 0) {
    return '';
  }
  const historySample = history.slice(-50); 
  return `
    **Vocabulary History (for avoidance):** To ensure the user learns new words, please AVOID using any nouns, verbs, adjectives, adverbs, and other vocabulary words from this list of previously generated sentences. You may reuse common grammatical words like "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "must", "this", "that", "these", "those", "I", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "her", "its", "our", "their", "mine", "yours", "hers", "ours", "theirs" (or their respective equivalents in the target language if the target language is not English).
    
    Previously generated sentences to avoid vocabulary from:
    ${JSON.stringify(historySample)}
  `;
};

// --- PRIVATE CORE FUNCTION FOR JSON-BASED API CALLS ---
// This function is not exported; it's a private helper for this module.
const _callGeminiModel = async (apiKey, settings, topic, history, specificInstructions, errorMessage) => {
  // Input validation
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key provided');
  }
  
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid settings object provided');
  }
  
  if (!settings.model || typeof settings.model !== 'string') {
    throw new Error('Invalid model specified in settings');
  }
  
  if (!settings.nativeLanguage || typeof settings.nativeLanguage !== 'string') {
    throw new Error('Invalid native language specified in settings');
  }
  
  if (!settings.targetLanguage || typeof settings.targetLanguage !== 'string') {
    throw new Error('Invalid target language specified in settings');
  }
  
  if (!settings.difficulty || typeof settings.difficulty !== 'string') {
    throw new Error('Invalid difficulty level specified in settings');
  }
  
  if (!settings.sentenceCount || typeof settings.sentenceCount !== 'number' || settings.sentenceCount <= 0) {
    throw new Error('Invalid sentence count specified in settings');
  }
  
  if (history && !Array.isArray(history)) {
    throw new Error('History must be an array');
  }
  
  if (!specificInstructions || typeof specificInstructions !== 'string') {
    throw new Error('Specific instructions must be provided');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: settings.model,
    generationConfig: {
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 1,
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

    **Vocabulary Goal:** To maximize the learning opportunity, ensure the items use a wide variety of vocabulary. Actively avoid repeating the same key words (nouns, verbs, adjectives, adverbs) across the different items in THIS new set. Additionally, avoid using any vocabulary words that have appeared in the user's previous sentence history.
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
    
    // Clean up the response text and extract JSON
    let jsonString = text.trim();
    
    // Remove various markdown code block formats
    jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    
    // Remove any leading/trailing whitespace or quotes
    jsonString = jsonString.trim();
    
    // Handle cases where the response might be wrapped in quotes
    if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
      try {
        jsonString = JSON.parse(jsonString);
      } catch (e) {
        // If parsing as string fails, continue with original
      }
    }
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Raw response:', text);
      console.error('Cleaned JSON string:', jsonString);
      throw new Error(`Failed to parse API response as JSON. Please check the console for details. Response: ${text.substring(0, 200)}...`);
    }

    if (!Array.isArray(parsedData)) {
      console.error('API response was not an array:', parsedData);
      throw new Error("API response was not a valid JSON array. Expected array format.");
    }
    
    return parsedData;

  } catch (error) {
    console.error(`Error calling Gemini: ${errorMessage}`, error);
    throw new Error(`${errorMessage} Please check your API key and network connection. The model may also have returned an invalid format. Check the console for more details.`);
  }
};

export const fetchSentencesFromGemini = async (apiKey, settings, topic, history = []) => {
    // Additional validation specific to this function
    if (topic !== undefined && topic !== null && typeof topic !== 'string') {
      throw new Error('Topic must be a string if provided');
    }
    const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to generate sentences and a PRECISE, GRANULAR word map for color-coding. The map must show how individual words in the target language correspond to words in the native language.

    **CRITICAL LANGUAGE RULE:**
    Pay close attention to the languages defined earlier in the prompt.
    - The "targetSentence" field MUST be in ${settings.targetLanguage}.
    - The "nativeSentence" field MUST be in ${settings.nativeLanguage}.
    Do NOT reverse these roles.

    **SENTENCE LENGTH GUIDELINES FOR ${settings.difficulty} LEVEL:**
    Generate sentences with appropriate length and complexity for the ${settings.difficulty} CEFR level:
    ${settings.difficulty === 'A1' ? 'A1 (Beginner): 4-8 words per sentence. Use simple, basic sentences with common vocabulary and present tense.' : ''}
    ${settings.difficulty === 'A2' ? 'A2 (Elementary): 6-12 words per sentence. Use simple sentences with basic conjunctions and common phrases.' : ''}
    ${settings.difficulty === 'B1' ? 'B1 (Intermediate): 10-18 words per sentence. Use more complex sentences with subordinate clauses and varied vocabulary.' : ''}
    ${settings.difficulty === 'B2' ? 'B2 (Upper Intermediate): 12-22 words per sentence. Use complex sentences with multiple clauses and sophisticated vocabulary.' : ''}
    ${settings.difficulty === 'C1' ? 'C1 (Advanced): 15-25 words per sentence. Use very complex sentences with nuanced vocabulary and advanced grammatical structures.' : ''}
    ${settings.difficulty === 'C2' ? 'C2 (Proficient): 15-30+ words per sentence. Use highly sophisticated sentences with native-like complexity and precision.' : ''}
    
    **IMPORTANT:** Focus on complexity and appropriateness over strict word count. The sentence should feel natural and appropriately challenging for the ${settings.difficulty} level, even if it falls slightly outside the suggested range.

    **MANDATORY GRANULARITY RULE:**
    The "wordMap" must be broken down into the smallest possible meaningful units.
    1.  **SEPARATE NOUNS AND ADJECTIVES:** A noun and the adjective(s) that modify it MUST be in separate objects in the map.
    2.  **SEPARATE VERBS AND OBJECTS:** A verb and its object must be in separate map objects.
    3.  **AVOID GROUPING:** Do not group words into phrases unless absolutely necessary for meaning (e.g., compound lexemes or fixed expressions).

    **CRITICAL MAPPING RULE:**
    The "wordMap" MUST be a complete decomposition of the "nativeSentence". EVERY SINGLE WORD that appears in the "nativeSentence" must be present as a "native" value in one of the "wordMap" objects. There can be NO omissions. Grammatical words like "the", "a", "of" must be included.
    
    **BALANCING NATURAL TRANSLATION WITH WORD MAPPING:**
    When creating the word map for a natural translation:
    1. First, create the most natural, fluent native language translation
    2. Then, map the target language words to the native language words/phrases, even if the correspondence isn't 1:1
    3. Group target language words together when they correspond to a single native language phrase
    4. Use empty target strings ("") for native language words that don't have direct target language equivalents
    5. The goal is to maintain the natural flow of the native sentence while still providing meaningful color-coding

    **CRITICAL RULE FOR NATIVE LANGUAGE TRANSLATION:**
    The "nativeSentence" field MUST be a natural, fluent translation that sounds like it was written by a native speaker. This means:
    1. Use natural word order and phrasing that flows smoothly when read aloud
    2. Choose idiomatic expressions and natural vocabulary over literal word-for-word translations
    3. Adapt the sentence structure to match the natural patterns of the native language
    4. Prioritize meaning and naturalness over maintaining a strict word-by-word correspondence
    5. The translation should feel natural and conversational, not like a mechanical translation

    **OUTPUT FORMAT:**
    Provide the output as a single, valid JSON array of objects with "targetSentence", "nativeSentence", and "wordMap" keys.

    ---
    **EXAMPLES OF CORRECT GRANULAR MAPPING:**

    **EXAMPLE 1: Target = Vietnamese, Native = English**
    [{
      "targetSentence": "Tôi thích đi dạo trong công viên vào buổi sáng.",
      "nativeSentence": "I enjoy taking morning walks in the park.",
      "wordMap": [
        { "target": "Tôi", "native": "I" },
        { "target": "thích", "native": "enjoy" },
        { "target": "đi dạo", "native": "taking" },
        { "target": "trong", "native": "in" },
        { "target": "công viên", "native": "the park" },
        { "target": "vào", "native": "" },
        { "target": "buổi sáng", "native": "morning" },
        { "target": "", "native": "walks" }
      ]
    }]

    **EXAMPLE 2: Target = English, Native = Spanish**
    [{
      "targetSentence": "I can't wait to try the new restaurant downtown.",
      "nativeSentence": "Tengo muchas ganas de probar el nuevo restaurante del centro.",
      "wordMap": [
        { "target": "I", "native": "Tengo" },
        { "target": "can't wait to", "native": "muchas ganas de" },
        { "target": "try", "native": "probar" },
        { "target": "the", "native": "el" },
        { "target": "new", "native": "nuevo" },
        { "target": "restaurant", "native": "restaurante" },
        { "target": "downtown", "native": "del centro" }
      ]
    }]

    **EXAMPLE 3: Target = French, Native = English**
    [{
      "targetSentence": "Il fait un temps magnifique aujourd'hui.",
      "nativeSentence": "The weather is absolutely beautiful today.",
      "wordMap": [
        { "target": "Il", "native": "" },
        { "target": "fait", "native": "The weather is" },
        { "target": "un", "native": "" },
        { "target": "temps", "native": "" },
        { "target": "magnifique", "native": "absolutely beautiful" },
        { "target": "aujourd'hui", "native": "today" }
      ]
    }]

    **EXAMPLE 4: Target = Mandarin, Native = English**
    [{
      "targetSentence": "今天的工作特别忙，我累得不行。",
      "nativeSentence": "Work was incredibly busy today, and I'm completely exhausted.",
      "wordMap": [
        { "target": "今天", "native": "today" },
        { "target": "的", "native": "" },
        { "target": "工作", "native": "Work" },
        { "target": "特别", "native": "incredibly" },
        { "target": "忙", "native": "busy" },
        { "target": "，", "native": "," },
        { "target": "我", "native": "and I'm" },
        { "target": "累得不行", "native": "completely exhausted" }
      ]
    }]

    **EXAMPLE 5: Target = German, Native = English**
    [{
      "targetSentence": "Das Wetter wird morgen wahrscheinlich regnen.",
      "nativeSentence": "It looks like it's going to rain tomorrow.",
      "wordMap": [
        { "target": "Das", "native": "It" },
        { "target": "Wetter", "native": "looks like it's going" },
        { "target": "wird", "native": "" },
        { "target": "morgen", "native": "tomorrow" },
        { "target": "wahrscheinlich", "native": "" },
        { "target": "regnen", "native": "to rain" }
      ]
    }]
  `;

  console.log(specificInstructions);
  
  const result = await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate color-coded sentences.");

  // Post-process to add colors intelligently and validate sentence lengths
  result.forEach(sentence => {
    // Validate sentence structure
    if (!sentence || typeof sentence !== 'object') {
      console.warn('Invalid sentence object detected:', sentence);
      return;
    }
    
    if (!sentence.targetSentence || typeof sentence.targetSentence !== 'string') {
      console.warn('Invalid or missing targetSentence:', sentence);
      return;
    }
    
    if (!sentence.nativeSentence || typeof sentence.nativeSentence !== 'string') {
      console.warn('Invalid or missing nativeSentence:', sentence);
      return;
    }
    
    // Add targetLanguage to each sentence for TTS
    sentence.targetLanguage = settings.targetLanguage;
    
    if (sentence.wordMap && Array.isArray(sentence.wordMap)) {
      let colorIndex = 0; // Use a separate index for assigning rainbow colors
      sentence.colorMapping = sentence.wordMap.map((pair) => {
        // Validate each mapping pair
        if (!pair || typeof pair !== 'object') {
          console.warn('Invalid word mapping pair:', pair);
          return { target: '', native: '', color: '#000000' };
        }
        
        // Ensure target and native are strings
        const target = typeof pair.target === 'string' ? pair.target : '';
        const native = typeof pair.native === 'string' ? pair.native : '';
        
        let color;
        // If the target word exists, it's a direct translation, so give it a rainbow color
        if (target && target.trim() !== '') {
          color = RAINBOW_HEX_PALETTE[colorIndex % RAINBOW_HEX_PALETTE.length];
          colorIndex++; // Only increment the color index for "real" words
        } else {
          // If the target is empty, it's a grammatical insertion; make it black
          color = '#000000';
        }
        return { target, native, color };
      });
      delete sentence.wordMap; // Remove original map to save space
    } else {
      // If no valid wordMap, create a simple fallback mapping
      console.warn('No valid wordMap found for sentence, creating fallback:', sentence.targetSentence);
      sentence.colorMapping = [
        { target: sentence.targetSentence, native: sentence.nativeSentence, color: RAINBOW_HEX_PALETTE[0] }
      ];
    }
    
    // Add sentence length validation metadata
    if (sentence.targetSentence) {
      const wordCount = sentence.targetSentence.trim().split(/\s+/).length;
      sentence.wordCount = wordCount;
      sentence.lengthAppropriate = validateSentenceLength(wordCount, settings.difficulty);
    }
  });

  return result;
};


export const fetchUnscrambleSentences = async (apiKey, settings, topic, history = []) => {
  // Additional validation specific to this function
  if (topic !== undefined && topic !== null && typeof topic !== 'string') {
    throw new Error('Topic must be a string if provided');
  }
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
    - "Yesterday, I went to the store." vs "I went to the store yesterday."
    - "In the garden, flowers bloom beautifully." vs "Flowers bloom beautifully in the garden."
    
    **RULES FOR ALTERNATIVES:**
    1. All alternatives must be grammatically correct in the target language
    2. All alternatives must have the same meaning as the primary sentence
    3. Focus on different word orders, not just punctuation changes
    4. Include variations in:
       - Adverb placement (quickly, usually, often, etc.)
       - Adjective order (when multiple adjectives are present)
       - Phrase positioning (time phrases, location phrases)
       - Subject-verb-object variations
       - Prepositional phrase placement
    5. Do NOT include alternatives that change the meaning or are grammatically incorrect
    6. Consider natural speech patterns and common variations in the target language
    
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
  // Additional validation specific to this function
  if (topic !== undefined && topic !== null && typeof topic !== 'string') {
    throw new Error('Topic must be a string if provided');
  }
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to create a reading comprehension exercise. Generate a JSON array of objects.
    Each object must contain "passage", "question", "options" (an array of strings), and "correctAnswer" (the correct string from options).
    Example: [{ "passage": "Hier, je suis allé au marché.", "question": "Où suis-je allé hier ?", "options": ["Au parc", "Au marché", "À l'école"], "correctAnswer": "Au marché" }]
  `;
  return await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate comprehension passages.");
};


export const fetchPracticeQuestions = async (apiKey, settings, topic, history = []) => {
  // Additional validation specific to this function
  if (topic !== undefined && topic !== null && typeof topic !== 'string') {
    throw new Error('Topic must be a string if provided');
  }
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
  // Input validation
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key provided');
  }
  
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid settings object provided');
  }
  
  if (!settings.model || typeof settings.model !== 'string') {
    throw new Error('Invalid model specified in settings');
  }
  
  if (!settings.targetLanguage || typeof settings.targetLanguage !== 'string') {
    throw new Error('Invalid target language specified in settings');
  }
  
  if (!settings.nativeLanguage || typeof settings.nativeLanguage !== 'string') {
    throw new Error('Invalid native language specified in settings');
  }
  
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be provided as a string');
  }
  
  if (!userResponse || typeof userResponse !== 'string') {
    throw new Error('User response must be provided as a string');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: settings.model,
    generationConfig: {
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 1,
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