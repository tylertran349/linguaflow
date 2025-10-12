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

// Helper function to validate sentence length based on user settings
const validateSentenceLength = (wordCount, settings) => {
  const minLength = settings.minSentenceLength || 6;
  const maxLength = settings.maxSentenceLength || 12;
  
  // Ensure valid range
  if (minLength < 1 || maxLength < 1 || minLength > maxLength) {
    return true; // If settings are invalid, don't restrict
  }
  
  // Allow some flexibility - consider appropriate if within 20% of range
  // For very small ranges, use a minimum flexibility of 1 word
  const flexibility = 0.2;
  const range = maxLength - minLength;
  const minFlexibility = range <= 2 ? 1 : Math.floor(minLength * flexibility);
  const maxFlexibility = range <= 2 ? 1 : Math.floor(maxLength * flexibility);
  
  const minFlexible = Math.max(1, minLength - minFlexibility);
  const maxFlexible = maxLength + maxFlexibility;
  
  return wordCount >= minFlexible && wordCount <= maxFlexible;
};

// Helper to get common words for target language
const getTargetLanguageCommonWords = (targetLanguage) => {
  if (!targetLanguage) return [];
  
  const commonWordsByLanguage = {
    'Arabic': [
      // Articles
      'ال',
      // Conjunctions
      'و', 'أو', 'لكن',
      // Prepositions
      'في', 'على', 'من', 'إلى',
      // Auxiliary verbs
      'كان', 'أصبح',
      // Modal verbs
      'يجب', 'يمكن',
      // Demonstratives
      'هذا', 'هذه', 'ذلك',
      // Pronouns
      'أنا', 'أنت', 'هو', 'هي',
      // Possessives
      '-ي', '-ك', '-ه', '-ها'
    ],
    'Bengali': [
      // Articles
      'একটি', 'একজন',
      // Conjunctions
      'এবং', 'ও', 'বা', 'কিন্তু',
      // Prepositions
      'এ', 'তে', 'থেকে', 'এর',
      // Auxiliary verbs
      'হচ্ছে', 'হচ্ছো', 'হচ্ছেন',
      // Modal verbs
      'পারা', 'উচিত',
      // Demonstratives
      'এই', 'ঐ', 'সেই',
      // Pronouns
      'আমি', 'তুমি', 'সে', 'আমরা', 'তোমরা', 'তারা',
      // Possessives
      'আমার', 'তোমার', 'তার', 'আমাদের', 'তোমাদের', 'তাদের'
    ],
    'Bulgarian': [
      // Articles (as suffixes)
      '-ът', '-та', '-то', '-те',
      // Conjunctions
      'и', 'или', 'но', 'обаче',
      // Prepositions
      'в', 'на', 'от', 'до',
      // Auxiliary verbs
      'съм', 'си', 'е', 'сме', 'сте', 'са',
      // Modal verbs
      'мога', 'трябва',
      // Demonstratives
      'този', 'тази', 'това', 'тези',
      // Pronouns
      'аз', 'ти', 'той', 'тя', 'то', 'ние', 'вие', 'те',
      // Possessives
      'мой', 'твой', 'негов', 'неин', 'наш', 'ваш', 'техен'
    ],
    'Chinese (Simplified)': [
      // Articles (none)
      // Conjunctions
      '和', '或', '但是',
      // Prepositions
      '在', '从', '到', '向',
      // Auxiliary verbs
      '是', '有', '在',
      // Modal verbs
      '能', '会', '可以', '应该',
      // Demonstratives
      '这', '那', '这些', '那些',
      // Pronouns
      '我', '你', '他', '她', '它', '我们', '你们', '他们',
      // Possessives
      '的'
    ],
    'Chinese (Traditional)': [
      // Articles (none)
      // Conjunctions
      '和', '或', '但是',
      // Prepositions
      '在', '從', '到', '向',
      // Auxiliary verbs
      '是', '有', '在',
      // Modal verbs
      '能', '會', '可以', '應該',
      // Demonstratives
      '這', '那', '這些', '那些',
      // Pronouns
      '我', '你', '他', '她', '它', '我們', '您', '他們',
      // Possessives
      '的'
    ],
    'Croatian': [
      // Articles (none)
      // Conjunctions
      'i', 'ili', 'ali', 'nego', 'već',
      // Prepositions
      'u', 'na', 'o', 'po', 's', 'k', 'od', 'do', 'za', 'pod', 'nad', 'pred',
      // Auxiliary verbs
      'jesam', 'jesi', 'je', 'jesmo', 'jeste', 'jesu', 'ću', 'ćeš', 'će', 'ćemo', 'ćete',
      // Modal verbs
      'moći', 'htjeti', 'smjeti', 'morati', 'trebati', 'željeti',
      // Demonstratives
      'ovaj', 'ova', 'ovo', 'taj', 'ta', 'to', 'onaj', 'ona', 'ono',
      // Pronouns
      'ja', 'ti', 'on', 'ona', 'ono', 'mi', 'vi', 'oni', 'one',
      // Possessives
      'moj', 'tvoj', 'njegov', 'njezin', 'naš', 'vaš', 'njihov'
    ],
    'Czech': [
      // Articles (none)
      // Conjunctions
      'a', 'i', 'nebo', 'ale', 'však',
      // Prepositions
      'v', 'na', 'o', 'po', 's', 'k', 'od', 'do', 'za', 'pod', 'nad', 'před',
      // Auxiliary verbs
      'jsem', 'jsi', 'je', 'jsme', 'jste', 'jsou', 'bývat',
      // Modal verbs
      'moci', 'muset', 'smět', 'chtít', 'mít',
      // Demonstratives
      'ten', 'ta', 'to', 'tento', 'tato', 'toto', 'onen', 'ona', 'ono',
      // Pronouns
      'já', 'ty', 'on', 'ona', 'ono', 'my', 'vy', 'oni', 'ony',
      // Possessives
      'můj', 'tvůj', 'jeho', 'její', 'náš', 'váš', 'jejich'
    ],
    'Danish': [
      // Articles
      'en', 'et', 'den', 'det', 'de',
      // Conjunctions
      'og', 'eller', 'men', 'for',
      // Prepositions
      'i', 'på', 'af', 'til', 'med', 'om', 'under', 'over', 'ved',
      // Auxiliary verbs
      'være', 'have', 'blive',
      // Modal verbs
      'kunne', 'skulle', 'ville', 'måtte', 'burde', 'turde',
      // Demonstratives
      'den', 'det', 'de', 'denne', 'dette', 'disse',
      // Pronouns
      'jeg', 'du', 'han', 'hun', 'vi', 'I',
      // Possessives
      'min', 'din', 'sin', 'vores', 'jeres', 'deres'
    ],
    'Dutch': [
      // Articles
      'de', 'het', 'een',
      // Conjunctions
      'en', 'of', 'maar',
      // Prepositions
      'in', 'op', 'naar', 'van',
      // Auxiliary verbs
      'zijn', 'hebben',
      // Modal verbs
      'kunnen', 'moeten', 'mogen',
      // Demonstratives
      'deze', 'die', 'dit', 'dat',
      // Pronouns
      'ik', 'jij', 'hij', 'zij',
      // Possessives
      'mijn', 'jouw', 'zijn', 'haar'
    ],
    'Estonian': [
      // Articles (none)
      // Conjunctions
      'ja', 'ning', 'ehk', 'või', 'aga', 'kuid',
      // Prepositions (uses postpositions and case endings)
      // Auxiliary verbs
      'olema', 'pidama',
      // Modal verbs
      'võima', 'saama', 'tohtima',
      // Demonstratives
      'see', 'too', 'need', 'nood',
      // Pronouns
      'mina', 'ma', 'sina', 'sa', 'tema', 'ta', 'meie', 'me', 'teie', 'te', 'nemad', 'nad',
      // Possessives
      'minu', 'mu', 'sinu', 'su', 'tema', 'meie', 'teie', 'nende'
    ],
    'Finnish': [
      // Articles (none)
      // Conjunctions
      'ja', 'tai', 'mutta', 'koska', 'jos',
      // Prepositions (uses postpositions and case endings)
      // Auxiliary verbs
      'olla', 'ei',
      // Modal verbs
      'voida', 'pitää', 'täytyä', 'saattaa',
      // Demonstratives
      'tämä', 'tuo', 'se', 'nämä', 'nuo', 'ne',
      // Pronouns
      'minä', 'sinä', 'hän', 'me', 'te', 'he',
      // Possessives (as suffixes)
      '-ni', '-si', '-nsa', '-nsä', '-mme', '-nne'
    ],
    'Greek': [
      // Articles
      'ο', 'η', 'το', 'οι', 'αι', 'τα', 'ένας', 'μια', 'ένα',
      // Conjunctions
      'και', 'ή', 'αλλά', 'όμως', 'αν',
      // Prepositions
      'σε', 'με', 'για', 'από', 'προς', 'χωρίς', 'κατά', 'μετά', 'παρά',
      // Auxiliary verbs
      'είμαι', 'έχω',
      // Modal verbs
      'πρέπει', 'μπορώ', 'θέλω',
      // Demonstratives
      'αυτός', 'αυτή', 'αυτό', 'εκείνος', 'εκείνη', 'εκείνο',
      // Pronouns
      'εγώ', 'εσύ', 'αυτός', 'αυτή', 'αυτό', 'εμείς', 'εσείς', 'αυτοί', 'αυτές', 'αυτά',
      // Possessives
      'μου', 'σου', 'του', 'της', 'μας', 'σας', 'τους'
    ],
    'Gujarati': [
      // Articles (none)
      // Conjunctions
      'અને', 'કે', 'પણ', 'પરંતુ',
      // Prepositions
      'માં', 'પર', 'થી', 'માટે',
      // Auxiliary verbs
      'છે', 'છો', 'છું', 'છીએ', 'હતો', 'હતી', 'હતું', 'હતા',
      // Modal verbs
      'શકે', 'જોઈએ',
      // Demonstratives
      'આ', 'તે', 'પેલું',
      // Pronouns
      'હું', 'તું', 'તે', 'અમે', 'તેઓ',
      // Possessives
      'મારું', 'તારું', 'તેનું', 'અમારું', 'તમારું', 'તેમનું'
    ],
    'Hebrew': [
      // Articles
      'ה',
      // Conjunctions
      'ו', 'או', 'אבל', 'כי',
      // Prepositions
      'ב', 'ל', 'מ', 'על', 'עם', 'את',
      // Auxiliary verbs (mostly none)
      // Modal verbs
      'יכול', 'צריך', 'חייב', 'אפשר',
      // Demonstratives
      'זה', 'זאת', 'אלה', 'הללו',
      // Pronouns
      'אני', 'אתה', 'את', 'הוא', 'היא', 'אנחנו', 'אתם', 'אתן', 'הם', 'הן',
      // Possessives
      'שלי', 'שלך', 'שלו', 'שלה', 'שלנו', 'שלכם', 'שלכן', 'שלהם', 'שלהן'
    ],
    'Hindi': [
      // Articles (none)
      // Conjunctions
      'और', 'या', 'लेकिन', 'पर', 'कि',
      // Prepositions
      'में', 'पर', 'से', 'को', 'का', 'के', 'की', 'लिए', 'साथ',
      // Auxiliary verbs
      'है', 'हैं', 'हूँ', 'हो', 'था', 'थे', 'थी', 'थीं',
      // Modal verbs
      'सकना', 'चाहिए', 'पाना',
      // Demonstratives
      'यह', 'वह', 'ये', 'वे', 'इस', 'उस',
      // Pronouns
      'मैं', 'तुम', 'आप', 'यह', 'वह', 'हम', 'वे',
      // Possessives
      'मेरा', 'तुम्हारा', 'आपका', 'इसका', 'उसका', 'हमारा', 'उनका'
    ],
    'Hungarian': [
      // Articles
      'a', 'az', 'egy',
      // Conjunctions
      'és', 'vagy', 'de', 'hogy', 'ha',
      // Prepositions (mostly postpositions and case suffixes)
      // Auxiliary verbs
      'van', 'volt', 'lesz',
      // Modal verbs
      'kell', 'lehet', 'tud', 'akar', 'szabad',
      // Demonstratives
      'ez', 'az', 'ezek', 'azok', 'ilyen', 'olyan',
      // Pronouns
      'én', 'te', 'ő', 'mi', 'ti', 'ők',
      // Possessives (as suffixes)
      '-m', '-d', '-a', '-e', '-ja', '-je', '-unk', '-ünk', '-tok', '-tek', '-tök', '-uk', '-ük'
    ],
    'Indonesian': [
      // Articles (none)
      // Conjunctions
      'dan', 'atau', 'tetapi', 'tapi', 'jika',
      // Prepositions
      'di', 'ke', 'dari', 'pada', 'untuk', 'dengan',
      // Auxiliary verbs
      'adalah', 'ialah',
      // Modal verbs
      'bisa', 'dapat', 'harus', 'perlu', 'mungkin', 'boleh',
      // Demonstratives
      'ini', 'itu',
      // Pronouns
      'saya', 'aku', 'kamu', 'anda', 'dia', 'ia', 'beliau', 'kami', 'kita', 'kalian', 'mereka',
      // Possessives
      '-ku', '-mu', '-nya'
    ],
    'Italian': [
      // Articles
      'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
      // Conjunctions
      'e', 'o', 'ma', 'però', 'se',
      // Prepositions
      'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
      // Auxiliary verbs
      'essere', 'avere',
      // Modal verbs
      'potere', 'dovere', 'volere',
      // Demonstratives
      'questo', 'quello', 'codesto',
      // Pronouns
      'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro',
      // Possessives
      'mio', 'tuo', 'suo', 'nostro', 'vostro', 'loro'
    ],
    'Japanese': [
      // Articles (none)
      // Conjunctions (particles)
      'と', 'や', 'か', 'でも', 'しかし',
      // Prepositions (particles)
      'は', 'が', 'を', 'に', 'へ', 'で', 'の', 'も',
      // Auxiliary verbs
      'です', 'ます', 'だ',
      // Modal verbs (auxiliary verbs)
      'たい', 'ない', 'れる', 'られる', 'させる',
      // Demonstratives
      'これ', 'それ', 'あれ', 'この', 'その', 'あの',
      // Pronouns
      '私', 'あなた', '彼', '彼女', '私たち', '彼ら',
      // Possessives (particle)
      'の'
    ],
    'Kannada': [
      // Articles (none)
      // Conjunctions
      'ಮತ್ತು', 'ಅಥವಾ', 'ಆದರೆ',
      // Prepositions (postpositions)
      'ದಲ್ಲಿ', 'ಗೆ', 'ಇಂದ', 'ની', 'ಗಾಗಿ',
      // Auxiliary verbs
      'ಇದೆ', 'ಇಲ್ಲ', 'ಆಗು', 'ಮಾಡು',
      // Modal verbs
      'ಬಹುದು', 'ಬೇಕು', 'ಬಲ್ಲ',
      // Demonstratives
      'ಇದು', 'ಅದು', 'ಈ', 'ಆ',
      // Pronouns
      'ನಾನು', 'ನೀನು', 'ಅವನು', 'ಅವಳು', 'ಅದು', 'ನಾವು', 'ನೀವು', 'ಅವರು',
      // Possessives
      'ನನ್ನ', 'ನಿನ್ನ', 'ಅವನ', 'ಅವಳ', 'ಅದರ', 'ನಮ್ಮ', 'ನಿಮ್ಮ', 'ಅವರ'
    ],
    'Vietnamese': [
      // Articles (Vietnamese doesn't have articles like English, but has classifiers)
      'cái', 'con', 'người', 'bài', 'câu', 'chuyện',
      // Conjunctions
      'và', 'hoặc', 'nhưng', 'mà', 'nên', 'để',
      // Prepositions
      'trong', 'trên', 'dưới', 'ở', 'tại', 'với', 'bằng', 'cho', 'về', 'từ',
      // Auxiliary verbs
      'là', 'có', 'đã', 'sẽ', 'đang', 'được', 'bị',
      // Modal verbs
      'có thể', 'phải', 'nên', 'cần', 'muốn', 'thích',
      // Demonstratives
      'này', 'đó', 'kia', 'đây',
      // Pronouns
      'tôi', 'bạn', 'anh', 'chị', 'em', 'chúng tôi', 'các bạn', 'họ', 'nó', 'chúng nó',
      // Possessives
      'của tôi', 'của bạn', 'của anh', 'của chị', 'của em', 'của chúng tôi', 'của các bạn', 'của họ'
    ],
    'Spanish': [
      // Articles
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
      // Conjunctions
      'y', 'o', 'pero', 'que', 'porque', 'aunque', 'si',
      // Prepositions
      'en', 'de', 'a', 'con', 'por', 'para', 'sobre', 'bajo', 'entre', 'hasta',
      // Auxiliary verbs
      'es', 'son', 'era', 'eran', 'fue', 'fueron', 'ha', 'han', 'había', 'habían',
      // Modal verbs
      'puede', 'pueden', 'debe', 'deben', 'quiere', 'quieren', 'necesita', 'necesitan',
      // Demonstratives
      'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas',
      // Pronouns
      'yo', 'tú', 'él', 'ella', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'me', 'te', 'lo', 'la', 'nos', 'os', 'los', 'las',
      // Possessives
      'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras'
    ],
    'French': [
      // Articles
      'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
      // Conjunctions
      'et', 'ou', 'mais', 'que', 'parce que', 'bien que', 'si',
      // Prepositions
      'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'de', 'à', 'en',
      // Auxiliary verbs
      'est', 'sont', 'était', 'étaient', 'a', 'ont', 'avait', 'avaient',
      // Modal verbs
      'peut', 'peuvent', 'doit', 'doivent', 'veut', 'veulent', 'faut',
      // Demonstratives
      'ce', 'cet', 'cette', 'ces', 'celui', 'celle', 'ceux', 'celles',
      // Pronouns
      'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'le', 'la', 'nous', 'vous', 'les',
      // Possessives
      'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs'
    ],
    'German': [
      // Articles
      'der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
      // Conjunctions
      'und', 'oder', 'aber', 'dass', 'weil', 'obwohl', 'wenn',
      // Prepositions
      'in', 'auf', 'unter', 'mit', 'ohne', 'für', 'von', 'zu', 'bei', 'nach',
      // Auxiliary verbs
      'ist', 'sind', 'war', 'waren', 'hat', 'haben', 'hatte', 'hatten',
      // Modal verbs
      'kann', 'können', 'muss', 'müssen', 'will', 'wollen', 'soll', 'sollen',
      // Demonstratives
      'dieser', 'diese', 'dieses', 'jener', 'jene', 'jenes', 'der', 'die', 'das',
      // Pronouns
      'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'mich', 'dich', 'ihn', 'sie', 'uns', 'euch', 'sie',
      // Possessives
      'mein', 'meine', 'mein', 'dein', 'deine', 'dein', 'sein', 'seine', 'sein', 'ihr', 'ihre', 'ihr', 'unser', 'unsere', 'unser', 'euer', 'eure', 'euer', 'ihr', 'ihre', 'ihr'
    ],
    'Korean': [
      // Articles (none)
      // Conjunctions
      '그리고', '그래서', '그러나', '또는',
      // Prepositions (particles)
      '에', '에서', '으로', '로', '의',
      // Auxiliary verbs
      '이다', '아니다', '되다', '있다', '없다',
      // Modal verbs
      '수 있다', '야 하다', '도 되다',
      // Demonstratives
      '이', '그', '저', '이것', '그것', '저것',
      // Pronouns
      '나', '저', '너', '당신', '그', '그녀', '우리', '저희', '너희', '그들',
      // Possessives
      '의'
    ],
    'Latvian': [
      // Articles (none)
      // Conjunctions
      'un', 'vai', 'bet', 'ka',
      // Prepositions
      'uz', 'no', 'ar', 'par', 'pie',
      // Auxiliary verbs
      'būt', 'esmu', 'esi', 'ir', 'esam', 'esat',
      // Modal verbs
      'varēt', 'vajadzēt', 'drīkstēt',
      // Demonstratives
      'šis', 'šī', 'tas', 'tā',
      // Pronouns
      'es', 'tu', 'viņš', 'viņa', 'mēs', 'jūs', 'viņi', 'viņas',
      // Possessives
      'mans', 'tavs', 'viņa', 'viņas', 'mūsu', 'jūsu', 'viņu'
    ],
    'Lithuanian': [
      // Articles (none)
      // Conjunctions
      'ir', 'arba', 'bet', 'kad',
      // Prepositions
      'į', 'iš', 'su', 'ant', 'prie',
      // Auxiliary verbs
      'būti', 'esu', 'esi', 'yra', 'esame', 'esate',
      // Modal verbs
      'galėti', 'turėti', 'privalėti',
      // Demonstratives
      'šis', 'ši', 'tas', 'ta',
      // Pronouns
      'aš', 'tu', 'jis', 'ji', 'mes', 'jūs', 'jie', 'jos',
      // Possessives
      'mano', 'tavo', 'jo', 'jos', 'mūsų', 'jūsų', 'jų'
    ],
    'Malayalam': [
      // Articles (none)
      // Conjunctions
      'ഉം', 'അല്ലെങ്കിൽ', 'പക്ഷെ',
      // Prepositions (postpositions)
      '-ൽ', '-ക്ക്', '-നിന്ന്', '-ന്റെ',
      // Auxiliary verbs
      'ആണ്', 'അല്ല', 'ഉണ്ട്', 'ഇല്ല',
      // Modal verbs
      'കഴിയും', 'വേണം',
      // Demonstratives
      'ഇത്', 'അത്', 'ഈ', 'ആ',
      // Pronouns
      'ഞാൻ', 'നീ', 'അവൻ', 'അവൾ', 'ഞങ്ങൾ', 'നിങ്ങൾ', 'അവർ',
      // Possessives
      'എന്റെ', 'നിന്റെ', 'അവന്റെ', 'അവളുടെ', 'ഞങ്ങളുടെ', 'നിങ്ങളുടെ', 'അവരുടെ'
    ],
    'Marathi': [
      // Articles (none)
      // Conjunctions
      'आणि', 'किंवा', 'पण',
      // Prepositions (postpositions)
      '-मध्ये', '-वर', '-ला', '-चा', '-ची', '-चे',
      // Auxiliary verbs
      'आहे', 'नाही', 'होता', 'होती',
      // Modal verbs
      'शकतो', 'पाहिजे',
      // Demonstratives
      'हा', 'ही', 'हे', 'तो', 'ती', 'ते',
      // Pronouns
      'मी', 'तू', 'तो', 'ती', 'ते', 'आम्ही', 'तुम्ही',
      // Possessives
      'माझा', 'तुझा', 'त्याचा', 'तिचा', 'आमचा', 'तुमचा', 'त्यांचा'
    ],
    'Norwegian': [
      // Articles
      'en', 'et', 'ei', 'den', 'det', 'de',
      // Conjunctions
      'og', 'eller', 'men', 'for',
      // Prepositions
      'i', 'på', 'til', 'fra', 'med',
      // Auxiliary verbs
      'være', 'ha', 'bli',
      // Modal verbs
      'kunne', 'skulle', 'ville', 'måtte', 'burde',
      // Demonstratives
      'den', 'det', 'de', 'denne', 'dette', 'disse',
      // Pronouns
      'jeg', 'du', 'han', 'hun', 'vi', 'dere',
      // Possessives
      'min', 'din', 'sin', 'vår', 'deres'
    ],
    'Polish': [
      // Articles (none)
      // Conjunctions
      'i', 'oraz', 'albo', 'lub', 'ale', 'lecz',
      // Prepositions
      'w', 'na', 'z', 'do', 'o', 'od',
      // Auxiliary verbs
      'być', 'jestem', 'jesteś', 'jest', 'jesteśmy', 'jesteście', 'są',
      // Modal verbs
      'móc', 'musieć', 'chcieć', 'woleć',
      // Demonstratives
      'ten', 'ta', 'to', 'tamten', 'tamta', 'tamto',
      // Pronouns
      'ja', 'ty', 'on', 'ona', 'ono', 'my', 'wy', 'oni', 'one',
      // Possessives
      'mój', 'twój', 'jego', 'jej', 'nasz', 'wasz', 'ich'
    ],
    'Portuguese': [
      // Articles
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
      // Conjunctions
      'e', 'ou', 'mas', 'que', 'porque',
      // Prepositions
      'em', 'de', 'com', 'por', 'para',
      // Auxiliary verbs
      'ser', 'estar', 'ter', 'haver',
      // Modal verbs
      'poder', 'dever', 'querer',
      // Demonstratives
      'este', 'esta', 'esse', 'essa', 'aquele', 'aquela',
      // Pronouns
      'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas',
      // Possessives
      'meu', 'minha', 'teu', 'tua', 'seu', 'sua', 'nosso', 'vosso'
    ],
    'Romanian': [
      // Articles
      'un', 'o', 'niște', '-ul', '-a', '-lui', '-i', '-le', '-lor',
      // Conjunctions
      'și', 'sau', 'dar', 'însă', 'că',
      // Prepositions
      'în', 'pe', 'la', 'cu', 'de', 'pentru',
      // Auxiliary verbs
      'a fi', 'sunt', 'ești', 'este', 'suntem', 'sunteți',
      'a avea',
      // Modal verbs
      'a putea', 'a trebui', 'a vrea',
      // Demonstratives
      'acest', 'această', 'acel', 'acea',
      // Pronouns
      'eu', 'tu', 'el', 'ea', 'noi', 'voi', 'ei', 'ele',
      // Possessives
      'meu', 'mea', 'tău', 'ta', 'său', 'sa', 'nostru', 'nostră', 'vostru', 'voastră'
    ],
    'Russian': [
      // Articles (none)
      // Conjunctions
      'и', 'а', 'но', 'или', 'что', 'чтобы',
      // Prepositions
      'в', 'на', 'с', 'к', 'от', 'для', 'о',
      // Auxiliary verbs
      'быть', 'есть',
      // Modal verbs
      'мочь', 'хотеть', 'должен',
      // Demonstratives
      'этот', 'эта', 'это', 'эти', 'тот', 'та', 'то', 'те',
      // Pronouns
      'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они',
      // Possessives
      'мой', 'моя', 'моё', 'твой', 'твоя', 'твоё', 'его', 'её', 'наш', 'наша', 'наше', 'ваш', 'ваша', 'ваше', 'их'
    ],
    'Serbian': [
      // Articles (none)
      // Conjunctions
      'i', 'ali', 'ili', 'da', 'jer',
      // Prepositions
      'u', 'na', 'od', 'do', 'sa', 'za',
      // Auxiliary verbs
      'sam', 'si', 'je', 'smo', 'ste', 'su', 'biti', 'jesam',
      // Modal verbs
      'moći', 'hteti', 'smeti', 'morati', 'trebati',
      // Demonstratives
      'ovaj', 'taj', 'onaj',
      // Pronouns
      'ja', 'ti', 'on', 'ona', 'ono', 'mi', 'vi', 'oni', 'one', 'ona',
      // Possessives
      'moj', 'tvoj', 'njegov', 'njen', 'naš', 'vaš', 'njihov'
    ],
    'Slovak': [
      // Articles (none)
      // Conjunctions
      'a', 'i', 'aj', 'ale', 'alebo', 'že',
      // Prepositions
      'v', 'na', 'z', 'do', 'o', 's', 'k',
      // Auxiliary verbs
      'som', 'si', 'je', 'sme', 'ste', 'sú', 'byť',
      // Modal verbs
      'môcť', 'musieť', 'chcieť', 'smieť',
      // Demonstratives
      'ten', 'tá', 'to', 'tento', 'táto', 'toto',
      // Pronouns
      'ja', 'ty', 'on', 'ona', 'ono', 'my', 'vy', 'oni', 'ony',
      // Possessives
      'môj', 'tvoj', 'jeho', 'jej', 'náš', 'váš', 'ich'
    ],
    'Slovenian': [
      // Articles (none)
      // Conjunctions
      'in', 'pa', 'ali', 'da', 'ker',
      // Prepositions
      'v', 'na', 'z', 's', 'do', 'o', 'od',
      // Auxiliary verbs
      'sem', 'si', 'je', 'smo', 'ste', 'so', 'biti',
      // Modal verbs
      'moči', 'morati', 'hoteti', 'smeti',
      // Demonstratives
      'ta', 'tisti',
      // Pronouns
      'jaz', 'ti', 'on', 'ona', 'ono', 'mi', 'vi', 'oni', 'one', 'ona',
      // Possessives
      'moj', 'tvoj', 'njegov', 'njen', 'najin', 'vajin', 'njihov'
    ],
    'Swahili': [
      // Articles (none)
      // Conjunctions
      'na', 'lakini', 'au', 'kwa sababu', 'ikiwa',
      // Prepositions
      'katika', 'juu ya', 'na', 'kwa', 'kuhusu',
      // Auxiliary verbs
      'kuwa',
      // Modal verbs
      'weza', 'lazima', 'taka',
      // Demonstratives
      'hii', 'hiyo', 'hizi', 'hizo',
      // Pronouns
      'mimi', 'wewe', 'yeye', 'sisi', 'ninyi', 'wao',
      // Possessives
      'yangu', 'yako', 'yake', 'yetu', 'yenu', 'yao'
    ],
    'Swedish': [
      // Articles
      'en', 'ett', 'den', 'det', 'de',
      // Conjunctions
      'och', 'men', 'eller', 'för', 'så', 'att',
      // Prepositions
      'i', 'på', 'av', 'för', 'med', 'till',
      // Auxiliary verbs
      'har', 'hade', 'är', 'var', 'blir', 'blev',
      // Modal verbs
      'kan', 'kunde', 'ska', 'skulle', 'måste', 'får',
      // Demonstratives
      'den', 'det', 'de', 'denna', 'detta', 'dessa',
      // Pronouns
      'jag', 'du', 'han', 'hon', 'vi', 'ni', 'de',
      // Possessives
      'min', 'din', 'hans', 'hennes', 'vår', 'er', 'deras'
    ],
    'Tamil': [
      // Articles (none)
      // Conjunctions
      'மற்றும்', 'ஆனால்', 'அல்லது',
      // Prepositions
      'இல்', 'மீது', 'இருந்து',
      // Auxiliary verbs
      'இரு', 'உள்',
      // Modal verbs
      'முடியும்', 'வேண்டும்',
      // Demonstratives
      'இந்த', 'அந்த',
      // Pronouns
      'நான்', 'நீ', 'அவன்', 'அவள்', 'நாங்கள்', 'நீங்கள்', 'அவர்கள்',
      // Possessives
      'என்', 'உன்', 'அவன்', 'அவள்', 'எங்கள்', 'உங்கள்', 'அவர்கள்'
    ],
    'Telugu': [
      // Articles (none)
      // Conjunctions
      'మరియు', 'కానీ', 'లేదా',
      // Prepositions
      'లో', 'మీద', 'నుండి',
      // Auxiliary verbs
      'ఉండు',
      // Modal verbs
      'గల', 'వలయు',
      // Demonstratives
      'ఈ', 'ఆ',
      // Pronouns
      'నేను', 'నీవు', 'అతడు', 'ఆమె', 'మేము', 'మీరు', 'వారు',
      // Possessives
      'నా', 'నీ', 'అతని', 'ఆమె', 'మా', 'మీ', 'వారి'
    ],
    'Thai': [
      // Articles (none)
      // Conjunctions
      'และ', 'แต่', 'หรือ',
      // Prepositions
      'ใน', 'บน', 'ที่',
      // Auxiliary verbs
      'เป็น', 'อยู่', 'คือ',
      // Modal verbs
      'ได้', 'ต้อง', 'อยาก',
      // Demonstratives
      'นี่', 'นั่น', 'โน่น',
      // Pronouns
      'ฉัน', 'คุณ', 'เขา', 'เรา', 'พวกเขา',
      // Possessives
      'ของฉัน', 'ของคุณ', 'ของเขา'
    ],
    'Turkish': [
      // Articles
      'bir',
      // Conjunctions
      've', 'ama', 'veya', 'çünkü', 'eğer',
      // Prepositions
      'için', 'ile', 'gibi', 'kadar', 'sonra', 'önce',
      // Auxiliary verbs
      'olmak', 'etmek',
      // Modal verbs
      '-ebilmek', '-meli', '-malı',
      // Demonstratives
      'bu', 'şu', 'o',
      // Pronouns
      'ben', 'sen', 'o', 'biz', 'siz', 'onlar',
      // Possessives
      'benim', 'senin', 'onun', 'bizim', 'sizin', 'onların'
    ],
    'Ukrainian': [
      // Articles (none)
      // Conjunctions
      'і', 'й', 'та', 'але', 'чи', 'що', 'як',
      // Prepositions
      'в', 'у', 'на', 'з', 'із', 'зі', 'до', 'від', 'по', 'при', 'про',
      // Auxiliary verbs
      'бути', 'є',
      // Modal verbs
      'могти', 'хотіти', 'мусити',
      // Demonstratives
      'цей', 'той', 'такий',
      // Pronouns
      'я', 'ти', 'він', 'вона', 'воно', 'ми', 'ви', 'вони',
      // Possessives
      'мій', 'твій', 'його', 'її', 'наш', 'ваш', 'їх'
    ],
    'Urdu': [
      // Articles (none)
      // Conjunctions
      'اور', 'یا', 'لیکن', 'کہ', 'تو', 'بھی', 'اگر',
      // Prepositions
      'میں', 'پر', 'سے', 'کو', 'کا', 'کے', 'کی', 'تک', 'ساتھ',
      // Auxiliary verbs
      'ہے', 'ہیں', 'ہوں', 'تھا', 'تھے', 'تھی', 'تھیں', 'گا', 'گے', 'گی',
      // Modal verbs
      'سکتا', 'چاہئے', 'پایا',
      // Demonstratives
      'یہ', 'وہ', 'اس', 'ان',
      // Pronouns
      'میں', 'تم', 'آپ', 'وہ', 'ہم',
      // Possessives
      'میرا', 'تمہارا', 'آپکا', 'اسکا', 'ہمارا', 'انکا'
    ],
    'English': [
      // Articles
      'a', 'an', 'the',
      // Conjunctions
      'and', 'or', 'but', 'so', 'yet', 'for', 'nor',
      // Prepositions
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'across', 'around', 'near', 'far', 'inside', 'outside', 'within', 'without', 'beyond', 'behind', 'beside', 'beneath', 'upon', 'toward', 'towards', 'against', 'along', 'amid', 'amidst', 'amongst', 'beneath', 'besides', 'concerning', 'considering', 'despite', 'except', 'excluding', 'following', 'including', 'regarding', 'respecting', 'throughout', 'underneath', 'unlike', 'versus', 'via', 'within', 'without',
      // Auxiliary verbs
      'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'ought',
      // Modal verbs
      'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought', 'need', 'dare', 'used',
      // Demonstratives
      'this', 'that', 'these', 'those', 'such', 'same',
      // Pronouns
      'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves', 'themself',
      // Possessives
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'
    ]
  };
  
  return commonWordsByLanguage[targetLanguage] || [];
};

// Helper to determine if a language uses space-separated words
const isSpaceSeparatedLanguage = (language) => {
  const spaceSeparatedLanguages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Swedish', 'Norwegian', 'Danish',
    'Finnish', 'Polish', 'Czech', 'Slovak', 'Hungarian', 'Romanian', 'Bulgarian', 'Croatian', 'Serbian', 'Slovenian',
    'Russian', 'Ukrainian', 'Latvian', 'Lithuanian', 'Estonian', 'Greek', 'Turkish', 'Arabic', 'Hebrew', 'Persian',
    'Hindi', 'Bengali', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Urdu', 'Punjabi',
    'Indonesian', 'Malay', 'Thai', 'Vietnamese', 'Swahili'
  ];
  return spaceSeparatedLanguages.includes(language);
};

// Helper to extract words from text based on language writing system
const extractWordsFromText = (text, language) => {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  if (isSpaceSeparatedLanguage(language)) {
    // For space-separated languages, split on whitespace
    return text.split(/\s+/).filter(word => word.length > 0);
  } else {
    // For character-based languages (Chinese, Japanese, Korean, etc.), use more sophisticated tokenization
    const characters = Array.from(text);
    const words = [];
    let currentWord = '';
    
    for (const char of characters) {
      // Check if character is a letter, number, or common punctuation that might be part of a word
      if (/[\p{L}\p{N}_\-']/u.test(char)) {
        currentWord += char;
      } else {
        // Non-word character found, add current word if it exists
        if (currentWord.length > 0) {
          words.push(currentWord);
          currentWord = '';
        }
        // For character-based languages, single characters can be meaningful words
        // But only if they're actual letters, not punctuation or numbers
        if (/[\p{L}]/u.test(char) && char.length > 0) {
          words.push(char);
        }
      }
    }
    
    // Add the last word if it exists
    if (currentWord.length > 0) {
      words.push(currentWord);
    }
    
    // Filter out very short words that are likely noise (except for single-character languages)
    return words.filter(word => {
      if (word.length === 0) return false;
      // For character-based languages, allow single characters but filter out very short sequences
      if (!isSpaceSeparatedLanguage(language)) {
        return word.length >= 1; // Allow single characters for CJK languages
      }
      // For space-separated languages, require at least 2 characters to avoid noise
      return word.length >= 2;
    });
  }
};

// Helper to count words in text based on language writing system
const countWordsInText = (text, language) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  if (isSpaceSeparatedLanguage(language)) {
    // For space-separated languages, count space-separated words
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  } else {
    // For character-based languages, count meaningful characters/units
    // This is a simplified approach - in practice, you might want more sophisticated tokenization
    const characters = Array.from(text);
    return characters.filter(char => /[\p{L}\p{N}]/u.test(char)).length;
  }
};

// Helper to extract words from sentence history and filter out common words
const extractWordsToAvoid = (history, settings, historySizeLimit = null) => {
  if (!history || history.length === 0) {
    console.log('🔍 extractWordsToAvoid - No history provided');
    return '';
  }
  
  const currentTargetLanguage = settings?.targetLanguage;
  if (!currentTargetLanguage) {
    console.log('🔍 extractWordsToAvoid - No target language specified');
    return '';
  }
  
  // Validate settings object
  if (!settings || typeof settings !== 'object') {
    console.log('🔍 extractWordsToAvoid - Invalid settings object');
    return '';
  }
  
  // Clean the history to remove entries from different languages
  const cleanedHistory = cleanHistoryForLanguage(history, currentTargetLanguage);
  
  // Apply history size limit based on parameter or settings
  let effectiveHistorySizeLimit;
  if (historySizeLimit !== null && historySizeLimit !== undefined) {
    effectiveHistorySizeLimit = historySizeLimit;
  } else {
    // Fallback: determine from settings with priority order
    effectiveHistorySizeLimit = settings.sentenceDisplayHistorySize || 
                               settings.readAndRespondHistorySize || 
                               settings.writeAResponseHistorySize || 
                               100; // fallback default
  }
  
  const limitedHistory = cleanedHistory.slice(-effectiveHistorySizeLimit);
  
  console.log('🔍 extractWordsToAvoid - History size limit applied:', effectiveHistorySizeLimit);
  console.log('🔍 extractWordsToAvoid - History after size limit:', limitedHistory.length);
  
  // Only use common words from the target language to keep the prompt short
  const targetLanguageCommonWords = getTargetLanguageCommonWords(currentTargetLanguage);
  const commonWords = new Set(targetLanguageCommonWords);
  
  // Extract all words from history sentences, but only from the current target language
  const allWords = new Set();
  
  // Debug logging to help identify the issue
  console.log('🔍 extractWordsToAvoid - Current target language:', currentTargetLanguage);
  console.log('🔍 extractWordsToAvoid - Original history entries:', history.length);
  console.log('🔍 extractWordsToAvoid - Cleaned history entries:', cleanedHistory.length);
  console.log('🔍 extractWordsToAvoid - Limited history entries:', limitedHistory.length);
  console.log('🔍 extractWordsToAvoid - Common words for language:', targetLanguageCommonWords.length);
  
  limitedHistory.forEach((entry, index) => {
    // Handle both old format (string) and new format (object with sentence and targetLanguage)
    let sentence, entryTargetLanguage;
    
    if (typeof entry === 'string') {
      // Legacy format - double-check with language detection
      sentence = entry;
      const detectedLanguage = detectLanguageFromText(sentence);
      
      if (detectedLanguage && detectedLanguage !== currentTargetLanguage) {
        console.log(`🔍 Skipping legacy entry ${index} - detected language ${detectedLanguage} !== ${currentTargetLanguage}`);
        return;
      }
      
      entryTargetLanguage = currentTargetLanguage;
      console.log(`🔍 Processing entry ${index} (legacy string): "${sentence.substring(0, 50)}..." - language: ${entryTargetLanguage}`);
    } else if (entry && typeof entry === 'object' && entry.sentence) {
      // New format - check if it matches current target language
      sentence = entry.sentence;
      entryTargetLanguage = entry.targetLanguage;
      
      if (entryTargetLanguage !== currentTargetLanguage) {
        console.log(`🔍 Skipping entry ${index} - language mismatch: ${entryTargetLanguage} !== ${currentTargetLanguage}`);
        return;
      }
      
      console.log(`🔍 Processing entry ${index} (object): "${sentence.substring(0, 50)}..." - language: ${entryTargetLanguage}`);
    } else {
      console.log(`🔍 Skipping entry ${index} (invalid format):`, entry);
      return; // Skip invalid entries
    }
    
    if (typeof sentence === 'string' && sentence.trim()) {
      // Extract words based on the language's writing system
      const words = extractWordsFromText(sentence, currentTargetLanguage);
      
      words.forEach(word => {
        // Remove punctuation but preserve diacritics/accents
        // For character-based languages, be more conservative with cleaning
        let cleanWord;
        if (isSpaceSeparatedLanguage(currentTargetLanguage)) {
          // For space-separated languages, remove punctuation and convert to lowercase
          cleanWord = word.replace(/[^\p{L}\p{N}_\-']/gu, '').toLowerCase();
        } else {
          // For character-based languages, only remove obvious punctuation, preserve case
          cleanWord = word.replace(/[^\p{L}\p{N}_\-']/gu, '');
          // Only convert to lowercase for languages where case doesn't matter
          const caseInsensitiveLanguages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Indonesian', 'Malay', 'Swahili'];
          if (caseInsensitiveLanguages.includes(currentTargetLanguage)) {
            cleanWord = cleanWord.toLowerCase();
          }
        }
        
        // Only add words that are meaningful and not too short
        if (cleanWord.length > 0 && !commonWords.has(cleanWord)) {
          // Additional filtering for very short words that are likely noise
          const minLength = isSpaceSeparatedLanguage(currentTargetLanguage) ? 2 : 1;
          if (cleanWord.length >= minLength) {
            allWords.add(cleanWord);
          }
        }
      });
    }
  });
  
  // Limit the number of words to avoid to prevent prompt from becoming too long
  const maxWordsToAvoid = 50; // Reasonable limit for prompt length
  const wordsArray = Array.from(allWords);
  const limitedWords = wordsArray.slice(0, maxWordsToAvoid);
  
  const result = limitedWords.join(', ');
  console.log('🔍 extractWordsToAvoid - Final words to avoid:', result.substring(0, 100) + (result.length > 100 ? '...' : ''));
  console.log('🔍 extractWordsToAvoid - Total unique words:', allWords.size);
  console.log('🔍 extractWordsToAvoid - Limited to:', limitedWords.length, 'words');
  
  // Convert to comma-separated string
  return result;
};

// Comprehensive language detection patterns with improved specificity
const LANGUAGE_PATTERNS = {
  'Vietnamese': /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/,
  'Spanish': /[ñÑáéíóúüÁÉÍÓÚÜ]/,
  'French': /[àâäéèêëïîôöùûüÿçÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ]/,
  'German': /[äöüßÄÖÜ]/,
  'Italian': /[àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]/,
  'Portuguese': /[àáâãéêíóôõúüçÀÁÂÃÉÊÍÓÔÕÚÜÇ]/,
  'Polish': /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/,
  'Czech': /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/,
  'Slovak': /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/,
  'Hungarian': /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/,
  'Romanian': /[ăâîșțĂÂÎȘȚ]/,
  'Turkish': /[çğıöşüÇĞIÖŞÜ]/,
  'Arabic': /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
  'Hebrew': /[\u0590-\u05FF\u200F\u202E\u202D]/,
  'Russian': /[а-яёА-ЯЁ]/,
  'Ukrainian': /[а-яіїєґА-ЯІЇЄҐ]/,
  'Bulgarian': /[а-яА-Я]/,
  'Greek': /[\u0370-\u03FF\u1F00-\u1FFF]/,
  'Chinese (Simplified)': /[\u4e00-\u9fff]/,
  'Chinese (Traditional)': /[\u4e00-\u9fff]/,
  'Japanese': /[\u3040-\u309F\u30A0-\u30FF\u4e00-\u9fff]/,
  'Korean': /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
  'Thai': /[\u0E00-\u0E7F]/,
  'Hindi': /[\u0900-\u097F]/,
  'Bengali': /[\u0980-\u09FF]/,
  'Tamil': /[\u0B80-\u0BFF]/,
  'Telugu': /[\u0C00-\u0C7F]/,
  'Kannada': /[\u0C80-\u0CFF]/,
  'Malayalam': /[\u0D00-\u0D7F]/,
  'Gujarati': /[\u0A80-\u0AFF]/,
  'Marathi': /[\u0900-\u097F]/,
  'Urdu': /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
  'Persian': /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
  'Indonesian': /[a-zA-Z]/,
  'Malay': /[a-zA-Z]/,
  'Swahili': /[a-zA-Z]/,
  'Finnish': /[a-zA-ZäöåÄÖÅ]/,
  'Swedish': /[a-zA-ZäöåÄÖÅ]/,
  'Norwegian': /[a-zA-ZæøåÆØÅ]/,
  'Danish': /[a-zA-ZæøåÆØÅ]/,
  'Dutch': /[a-zA-Z]/,
  'English': /[a-zA-Z]/
};

// Helper to detect language based on character patterns with improved conflict resolution
const detectLanguageFromText = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  // Count matches for each language pattern
  const languageScores = {};
  
  for (const [language, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      languageScores[language] = matches.length;
    }
  }
  
  // Find the language with the highest score
  let bestLanguage = null;
  let highestScore = 0;
  
  for (const [language, score] of Object.entries(languageScores)) {
    if (score > highestScore) {
      highestScore = score;
      bestLanguage = language;
    }
  }
  
  // Handle conflicts between similar languages
  if (bestLanguage) {
    // Resolve conflicts between similar languages
    const conflicts = {
      'Arabic': ['Urdu', 'Persian'],
      'Urdu': ['Arabic', 'Persian'],
      'Persian': ['Arabic', 'Urdu'],
      'Hindi': ['Marathi'],
      'Marathi': ['Hindi'],
      'Chinese (Simplified)': ['Chinese (Traditional)'],
      'Chinese (Traditional)': ['Chinese (Simplified)'],
      'Indonesian': ['Malay', 'Swahili'],
      'Malay': ['Indonesian', 'Swahili'],
      'Swahili': ['Indonesian', 'Malay']
    };
    
    // If there's a conflict, prefer the language with more distinctive characters
    const conflictingLanguages = conflicts[bestLanguage] || [];
    for (const conflictLang of conflictingLanguages) {
      if (languageScores[conflictLang] && languageScores[conflictLang] >= highestScore * 0.8) {
        // If scores are close, prefer the more distinctive one
        const distinctiveChars = {
          'Arabic': /[\u0600-\u06FF]/,
          'Urdu': /[\u0600-\u06FF]/,
          'Persian': /[\u0600-\u06FF]/,
          'Hindi': /[\u0900-\u097F]/,
          'Marathi': /[\u0900-\u097F]/,
          'Chinese (Simplified)': /[\u4e00-\u9fff]/,
          'Chinese (Traditional)': /[\u4e00-\u9fff]/,
          'Indonesian': /[a-zA-Z]/,
          'Malay': /[a-zA-Z]/,
          'Swahili': /[a-zA-Z]/
        };
        
        const bestDistinctive = distinctiveChars[bestLanguage];
        const conflictDistinctive = distinctiveChars[conflictLang];
        
        if (bestDistinctive && conflictDistinctive) {
          const bestDistinctiveCount = (text.match(bestDistinctive) || []).length;
          const conflictDistinctiveCount = (text.match(conflictDistinctive) || []).length;
          
          if (conflictDistinctiveCount > bestDistinctiveCount) {
            bestLanguage = conflictLang;
            highestScore = languageScores[conflictLang];
          }
        }
      }
    }
  }
  
  // Only return a language if we have a reasonable confidence (at least 2 matches)
  // For character-based languages, require fewer matches since each character counts
  const minMatches = isSpaceSeparatedLanguage(bestLanguage) ? 2 : 1;
  return highestScore >= minMatches ? bestLanguage : null;
};

// Helper to check if text is likely from a specific language
const isTextFromLanguage = (text, targetLanguage) => {
  const detectedLanguage = detectLanguageFromText(text);
  return detectedLanguage === targetLanguage;
};

// Utility function to clean up all history arrays when language changes
export const cleanAllHistoryForLanguage = (historyArrays, targetLanguage) => {
  const cleanedArrays = {};
  
  for (const [key, history] of Object.entries(historyArrays)) {
    if (Array.isArray(history)) {
      cleanedArrays[key] = cleanHistoryForLanguage(history, targetLanguage);
      console.log(`🧹 Cleaned ${key}: ${history.length} → ${cleanedArrays[key].length} entries`);
    } else {
      cleanedArrays[key] = history;
    }
  }
  
  return cleanedArrays;
};

// Helper to clean up history entries from different languages
export const cleanHistoryForLanguage = (history, targetLanguage) => {
  if (!history || !Array.isArray(history)) {
    return [];
  }
  
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    console.log('🧹 Invalid target language provided');
    return [];
  }
  
  console.log(`🧹 Cleaning history for language: ${targetLanguage}`);
  console.log(`🧹 Original history entries: ${history.length}`);
  
  const cleanedHistory = history.filter(entry => {
    // Handle null/undefined entries
    if (entry === null || entry === undefined) {
      console.log(`🧹 Removing null/undefined entry`);
      return false;
    }
    
    if (typeof entry === 'string') {
      // Legacy format - try to detect language from text
      const trimmedEntry = entry.trim();
      if (trimmedEntry.length === 0) {
        console.log(`🧹 Removing empty string entry`);
        return false;
      }
      
      const detectedLanguage = detectLanguageFromText(trimmedEntry);
      if (detectedLanguage && detectedLanguage !== targetLanguage) {
        console.log(`🧹 Removing legacy entry with detected language ${detectedLanguage} (current: ${targetLanguage}):`, trimmedEntry.substring(0, 50) + '...');
        return false;
      }
      // If we can't detect the language, be conservative and keep it
      // This prevents accidentally removing entries that might be valid
      console.log(`🧹 Keeping legacy entry (language detection inconclusive):`, trimmedEntry.substring(0, 50) + '...');
      return true;
    } else if (entry && typeof entry === 'object' && entry.sentence) {
      // New format - only keep entries from the current target language
      const trimmedSentence = entry.sentence?.trim();
      if (!trimmedSentence || trimmedSentence.length === 0) {
        console.log(`🧹 Removing entry with empty sentence`);
        return false;
      }
      
      if (entry.targetLanguage === targetLanguage) {
        console.log(`🧹 Keeping new format entry (matches target language):`, trimmedSentence.substring(0, 50) + '...');
        return true;
      } else {
        console.log(`🧹 Removing new format entry (language mismatch: ${entry.targetLanguage} !== ${targetLanguage}):`, trimmedSentence.substring(0, 50) + '...');
        return false;
      }
    } else {
      // Remove invalid entries
      console.log(`🧹 Removing invalid entry:`, entry);
      return false;
    }
  });
  
  console.log(`🧹 Cleaned history entries: ${cleanedHistory.length}`);
  return cleanedHistory;
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
  
  // Configure tools for Google Search grounding if enabled
  const tools = settings.googleSearchEnabled ? [{ googleSearch: {} }] : undefined;
  
  const model = genAI.getGenerativeModel({
    model: settings.model,
    generationConfig: {
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 1,
    },
    tools: tools
  });

  const topicInstruction = (topic && topic.trim() !== '') 
    ? `The sentences must be related to the following topic/theme: "${topic}".`
    : '';
  
  const wordsToAvoid = extractWordsToAvoid(history, settings);

  const prompt = `
    You are an expert language tutor. Generate ${settings.sentenceCount} unique items for a language learner.
    The user's native language is ${settings.nativeLanguage}.
    The user wants to learn ${settings.targetLanguage}.
    The difficulty level should be ${settings.difficulty} (CEFR).
    ${topicInstruction}

    **Vocabulary Goal:** To maximize the learning opportunity, ensure the items use a wide variety of vocabulary. Actively avoid repeating the same key words (nouns, verbs, adjectives, adverbs) across the different items in THIS new set. Additionally, avoid using any vocabulary words that have appeared in the user's previous sentence history.
    ${wordsToAvoid ? `**CRITICAL: Avoid these specific words in your generated sentences:** ${wordsToAvoid}` : ''}

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
    
    // Check for Google Search grounding metadata
    if (settings.googleSearchEnabled && result.response.candidates && result.response.candidates[0]) {
      const groundingMetadata = result.response.candidates[0].groundingMetadata;
      if (groundingMetadata) {
        console.log('🔍 Google Search was used for this request!');
        console.log('Search queries:', groundingMetadata.webSearchQueries);
        console.log('Sources found:', groundingMetadata.groundingChunks?.length || 0);
        console.log('Grounding metadata:', groundingMetadata);
      } else {
        console.log('ℹ️ Google Search was enabled but not used for this request');
      }
    }
    
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
    
    // Extract words to avoid from history
    const wordsToAvoid = extractWordsToAvoid(history, settings, settings.sentenceDisplayHistorySize);
    
    const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to generate sentences and a PRECISE, GRANULAR word map for color-coding. The map must show how individual words in the target language correspond to words in the native language.

    **CRITICAL LANGUAGE RULE:**
    Pay close attention to the languages defined earlier in the prompt.
    - The "targetSentence" field MUST be in ${settings.targetLanguage}.
    - The "nativeSentence" field MUST be in ${settings.nativeLanguage}.
    Do NOT reverse these roles.

    **SENTENCE LENGTH GUIDELINES:**
    Generate sentences with ${settings.minSentenceLength || 6} to ${settings.maxSentenceLength || 12} words per sentence.
    ${settings.minSentenceLength === settings.maxSentenceLength ? `Note: Since minimum and maximum are the same (${settings.minSentenceLength || 6} words), generate sentences with exactly ${settings.minSentenceLength || 6} words.` : ''}
    
    **IMPORTANT:** Focus on complexity and appropriateness over strict word count. The sentence should feel natural and appropriately challenging for the ${settings.difficulty} level, even if it falls slightly outside the suggested range.

    ${wordsToAvoid ? `**CRITICAL VOCABULARY AVOIDANCE:** You MUST avoid using any of these specific words in your generated sentences: ${wordsToAvoid}. This is essential to ensure the user learns new vocabulary and doesn't repeat words they've already seen.` : ''}

    **MANDATORY GRANULARITY RULE:**
    The "wordMap" must be broken down into the smallest possible meaningful units.
    1.  **SEPARATE NOUNS AND ADJECTIVES:** A noun and the adjective(s) that modify it MUST be in separate objects in the map.
    2.  **SEPARATE DEMONSTRATIVE PRONOUNS:** A noun and a demonstrative pronoun (e.g., this, that, these, those, and their equivalents in other languages) that modifies it MUST be in separate objects in the map. For example, for "this book", "this" and "book" should be in separate objects.
    3.  **SEPARATE VERBS AND OBJECTS:** A verb and its object must be in separate map objects.
    4.  **AVOID GROUPING:** Do not group words into phrases unless absolutely necessary for meaning (e.g., compound lexemes or fixed expressions).

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
      const wordCount = countWordsInText(sentence.targetSentence, settings.targetLanguage);
      sentence.wordCount = wordCount;
      sentence.lengthAppropriate = validateSentenceLength(wordCount, settings);
    }
  });

  return result;
};


export const fetchUnscrambleSentences = async (apiKey, settings, topic, history = []) => {
  // Additional validation specific to this function
  if (topic !== undefined && topic !== null && typeof topic !== 'string') {
    throw new Error('Topic must be a string if provided');
  }
  
  // Extract words to avoid from history
  const wordsToAvoid = extractWordsToAvoid(history, settings, settings.sentenceDisplayHistorySize);
  
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Generate sentences for a word unscrambling game where multiple grammatically correct arrangements should be accepted.
    
    ${wordsToAvoid ? `**CRITICAL VOCABULARY AVOIDANCE:** You MUST avoid using any of these specific words in your generated sentences: ${wordsToAvoid}. This is essential to ensure the user learns new vocabulary and doesn't repeat words they've already seen.` : ''}
    
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
  
  // Extract words to avoid from history
  const wordsToAvoid = extractWordsToAvoid(history, settings, settings.readAndRespondHistorySize);
  
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to create a reading comprehension exercise. Generate a JSON array of objects.
    Each object must contain "passage", "question", "options" (an array of strings), and "correctAnswer" (the correct string from options).
    Example: [{ "passage": "Hier, je suis allé au marché.", "question": "Où suis-je allé hier ?", "options": ["Au parc", "Au marché", "À l'école"], "correctAnswer": "Au marché" }]
    
    ${wordsToAvoid ? `**CRITICAL VOCABULARY AVOIDANCE:** You MUST avoid using any of these specific words in your generated passages and questions: ${wordsToAvoid}. This is essential to ensure the user learns new vocabulary and doesn't repeat words they've already seen.` : ''}
  `;
  return await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate comprehension passages.");
};


export const fetchPracticeQuestions = async (apiKey, settings, topic, history = []) => {
  // Additional validation specific to this function
  if (topic !== undefined && topic !== null && typeof topic !== 'string') {
    throw new Error('Topic must be a string if provided');
  }
  
  // Extract words to avoid from history
  const wordsToAvoid = extractWordsToAvoid(history, settings, settings.writeAResponseHistorySize);
  
  const specificInstructions = `
    **IMPORTANT INSTRUCTIONS:**
    Your goal is to act as a conversation starter. Generate a JSON array of unique and engaging questions.
    The questions should encourage a response of 1-3 sentences, not just "yes" or "no".
    The output must be a single, valid JSON array of strings.
    Example: ["Quels sont tes passe-temps préférés ?", "Décris ton repas idéal."]
    
    ${wordsToAvoid ? `**CRITICAL VOCABULARY AVOIDANCE:** You MUST avoid using any of these specific words in your generated questions: ${wordsToAvoid}. This is essential to ensure the user learns new vocabulary and doesn't repeat words they've already seen.` : ''}
  `;
  
  const questions = await _callGeminiModel(apiKey, settings, topic, history, specificInstructions, "Failed to generate practice questions.");
  
  // Transform the array of strings into objects with question text and target language
  return questions.map(question => ({
    text: question,
    targetLanguage: settings.targetLanguage
  }));
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
  
  // Configure tools for Google Search grounding if enabled
  const tools = settings.googleSearchEnabled ? [{ googleSearch: {} }] : undefined;
  
  const model = genAI.getGenerativeModel({ 
    model: settings.model,
    generationConfig: {
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 1,
    },
    tools: tools
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
    
    // Check for Google Search grounding metadata
    if (settings.googleSearchEnabled && result.response.candidates && result.response.candidates[0]) {
      const groundingMetadata = result.response.candidates[0].groundingMetadata;
      if (groundingMetadata) {
        console.log('🔍 Google Search was used for feedback generation!');
        console.log('Search queries:', groundingMetadata.webSearchQueries);
        console.log('Sources found:', groundingMetadata.groundingChunks?.length || 0);
      } else {
        console.log('ℹ️ Google Search was enabled but not used for feedback');
      }
    }
    
    return response.text();
  } catch (error) {
    console.error("Error fetching feedback from Gemini:", error);
    throw new Error("Failed to get feedback. The model may be unavailable or the content may have been blocked.");
  }
};