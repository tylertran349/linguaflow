// src/hooks/useLanguageHistoryCleanup.js

import { useEffect, useRef } from 'react';
import { cleanHistoryForLanguage } from '../services/geminiService';

/**
 * Hook to automatically clean up history when the target language changes
 * @param {Array} history - The history array to clean
 * @param {string} targetLanguage - The current target language
 * @param {Function} setHistory - Function to update the history
 * @param {string} historyName - Name for logging purposes
 */
export const useLanguageHistoryCleanup = (history, targetLanguage, setHistory, historyName = 'history') => {
  const previousLanguageRef = useRef(targetLanguage);
  
  useEffect(() => {
    // Only clean if language has actually changed and we have history
    if (previousLanguageRef.current !== targetLanguage && history && history.length > 0) {
      console.log(`🔄 Language changed from ${previousLanguageRef.current} to ${targetLanguage}, cleaning ${historyName}`);
      
      const cleanedHistory = cleanHistoryForLanguage(history, targetLanguage);
      
      if (cleanedHistory.length !== history.length) {
        console.log(`🧹 ${historyName} cleaned: ${history.length} → ${cleanedHistory.length} entries`);
        setHistory(cleanedHistory);
      } else {
        console.log(`✅ ${historyName} already clean for language ${targetLanguage}`);
      }
    }
    
    // Update the previous language reference
    previousLanguageRef.current = targetLanguage;
  }, [targetLanguage, history, setHistory, historyName]);
};
