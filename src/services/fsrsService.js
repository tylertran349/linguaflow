// src/services/fsrsService.js
// FSRS (Free Spaced Repetition Scheduler) implementation
// Based on the algorithm described in the FSRS documentation

// FSRS parameters (learned from Anki review data)
const W = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
    1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

// Constants for retrievability calculation
const F = 19.0 / 81.0;
const C = -0.5;

// Grade enumeration
export const Grade = {
    FORGOT: 1,
    HARD: 2,
    GOOD: 3,
    EASY: 4
};

/**
 * Calculate retrievability at time t given stability S
 * R(t) = (1 + F * (t / S))^C
 */
export function retrievability(t, s) {
    // Handle edge cases
    if (s <= 0) return 0; // Invalid stability
    if (t < 0) return 1; // Future time (shouldn't happen)
    if (t === 0) return 1; // Just reviewed
    
    const base = 1.0 + F * (t / s);
    if (base <= 0) return 0; // Invalid base for power function
    
    return Math.pow(base, C);
}

/**
 * Calculate review interval given desired retention and stability
 * I(Rd) = (S / F) * (Rd^(1/C) - 1)
 */
export function interval(r_d, s) {
    // Handle edge cases
    if (s <= 0) return 1; // Invalid stability, return minimum interval
    if (r_d <= 0 || r_d >= 1) return 1; // Invalid retention rate
    
    const retentionPower = Math.pow(r_d, 1.0 / C);
    if (!isFinite(retentionPower)) return 1; // Invalid power calculation
    
    const interval = (s / F) * (retentionPower - 1.0);
    return Math.max(0.0104, interval); // Ensure minimum interval of 0.0104 days (15 minutes)
}

/**
 * Get initial stability based on first review grade
 * S0(G) = w[G-1]
 */
export function s_0(grade) {
    // Validate grade
    if (!grade || ![1, 2, 3, 4].includes(grade)) {
        console.warn(`Invalid grade: ${grade}, defaulting to GOOD`);
        return W[2];
    }
    
    switch (grade) {
        case Grade.FORGOT: return W[0];
        case Grade.HARD: return W[1];
        case Grade.GOOD: return W[2];
        case Grade.EASY: return W[3];
        default: return W[2]; // Default to GOOD
    }
}

/**
 * Calculate stability on successful recall
 * S' = S * α where α = 1 + td * ts * tr * h * b * e^w8
 */
export function s_success(d, s, r, grade) {
    // Validate inputs
    if (s <= 0 || d < 1 || d > 10 || r < 0 || r > 1) {
        console.warn(`Invalid inputs to s_success: d=${d}, s=${s}, r=${r}`);
        return Math.max(0.1, s); // Return minimum stability
    }
    
    const t_d = Math.max(0, 11.0 - d); // Difficulty penalty, ensure non-negative
    const t_s = Math.pow(Math.max(0.1, s), -W[9]); // Stability saturation, ensure positive base
    const t_r = Math.max(0, Math.exp(W[10] * (1.0 - r)) - 1.0); // Retrievability saturation
    const h = grade === Grade.HARD ? W[15] : 1.0; // Hard penalty
    const b = grade === Grade.EASY ? W[16] : 1.0; // Easy bonus
    const c = Math.exp(W[8]); // Learned parameter
    const alpha = 1.0 + t_d * t_s * t_r * h * b * c;
    
    const newStability = s * alpha;
    return Math.max(0.1, newStability); // Ensure minimum stability
}

/**
 * Calculate stability on failure
 * S' = min(Sf, S) where Sf = df * sf * rf * w11
 */
export function s_fail(d, s, r) {
    // Validate inputs
    if (s <= 0 || d < 1 || d > 10 || r < 0 || r > 1) {
        console.warn(`Invalid inputs to s_fail: d=${d}, s=${s}, r=${r}`);
        return Math.max(0.1, s * 0.5); // Return reduced stability
    }
    
    const d_f = Math.pow(Math.max(1, d), -W[12]); // Difficulty factor, ensure positive base
    const s_f = Math.max(0, Math.pow(s + 1.0, W[13]) - 1.0); // Stability factor
    const r_f = Math.exp(W[14] * (1.0 - r)); // Retrievability factor
    const c_f = W[11]; // Learned parameter
    const s_final = d_f * s_f * r_f * c_f;
    
    return Math.max(0.1, Math.min(s_final, s)); // Ensure minimum stability
}

/**
 * Update stability based on grade
 */
export function updateStability(d, s, r, grade) {
    if (grade === Grade.FORGOT) {
        return s_fail(d, s, r);
    } else {
        return s_success(d, s, r, grade);
    }
}

/**
 * Clamp difficulty to valid range [1, 10]
 */
export function clampDifficulty(d) {
    return Math.max(1.0, Math.min(10.0, d));
}

/**
 * Get initial difficulty based on first review grade
 * D0(G) = w4 - e^(w5 * (G-1)) + 1
 */
export function d_0(grade) {
    // Validate grade
    if (!grade || ![1, 2, 3, 4].includes(grade)) {
        console.warn(`Invalid grade: ${grade}, defaulting to GOOD`);
        grade = Grade.GOOD;
    }
    
    const g = grade;
    const difficulty = W[4] - Math.exp(W[5] * (g - 1.0)) + 1.0;
    return clampDifficulty(difficulty);
}

/**
 * Calculate difficulty delta
 * ΔD(G) = -w6 * (G - 3)
 */
export function deltaDifficulty(grade) {
    return -W[6] * (grade - 3.0);
}

/**
 * Calculate difficulty after review
 * D' = D + ΔD(G) * ((10 - D) / 9)
 */
export function dp(d, grade) {
    return d + deltaDifficulty(grade) * ((10.0 - d) / 9.0);
}

/**
 * Update difficulty based on grade
 * D'' = w7 * D0(4) + (1 - w7) * D'
 */
export function updateDifficulty(d, grade) {
    return clampDifficulty(W[7] * d_0(Grade.EASY) + (1.0 - W[7]) * dp(d, grade));
}

/**
 * Calculate next review date based on FSRS algorithm
 * @param {Object} card - Card object with current FSRS state
 * @param {number} grade - User's grade (1-4)
 * @param {number} desiredRetention - Desired retention rate (default 0.9)
 * @returns {Object} Updated card state with new review date
 */
export function calculateNextReview(card, grade, desiredRetention = 0.9) {
    // Validate inputs
    if (!card || typeof card !== 'object') {
        throw new Error('Invalid card object');
    }
    
    if (!grade || ![1, 2, 3, 4].includes(grade)) {
        throw new Error(`Invalid grade: ${grade}. Must be 1, 2, 3, or 4`);
    }
    
    if (desiredRetention <= 0 || desiredRetention >= 1) {
        console.warn(`Invalid desired retention: ${desiredRetention}, using 0.9`);
        desiredRetention = 0.9;
    }
    
    const now = new Date();
    let timeSinceLastReview = 0;
    
    if (card.lastReviewed) {
        const lastReviewed = new Date(card.lastReviewed);
        if (isNaN(lastReviewed.getTime())) {
            console.warn('Invalid lastReviewed date, treating as first review');
        } else {
            timeSinceLastReview = (now - lastReviewed) / (1000 * 60 * 60 * 24);
            // Handle edge case where time is negative (future date)
            if (timeSinceLastReview < 0) {
                console.warn('lastReviewed is in the future, treating as first review');
                timeSinceLastReview = 0;
            }
        }
    }
    
    let newStability, newDifficulty;
    
    // Check if this is a first review (no FSRS state or invalid state)
    if (!card.stability || !card.difficulty || card.stability <= 0 || card.difficulty < 1 || card.difficulty > 10) {
        // First review - initialize stability and difficulty
        newStability = s_0(grade);
        newDifficulty = d_0(grade);
    } else {
        // Calculate retrievability based on time since last review
        const r = retrievability(timeSinceLastReview, card.stability);
        
        // Update stability and difficulty
        newStability = updateStability(card.difficulty, card.stability, r, grade);
        newDifficulty = updateDifficulty(card.difficulty, grade);
    }
    
    // Calculate next interval
    const nextInterval = Math.max(0.0104, interval(desiredRetention, newStability)); // 15 minutes minimum
    const nextIntervalMinutes = Math.round(nextInterval * 24 * 60); // Convert to minutes
    const nextReviewDate = new Date(now.getTime() + nextIntervalMinutes * 60 * 1000);
    
    return {
        stability: newStability,
        difficulty: newDifficulty,
        lastReviewed: now,
        nextReviewDate: nextReviewDate,
        interval: nextIntervalMinutes // Return interval in minutes for clarity
    };
}

/**
 * Check if a card is due for review
 * @param {Object} card - Card object with FSRS state
 * @returns {boolean} True if card is due for review
 */
export function isCardDue(card) {
    if (!card || typeof card !== 'object') return true;
    
    // If no FSRS state, consider it due (first review)
    if (!card.stability || !card.difficulty || !card.nextReviewDate) return true;
    
    try {
        const nextReviewDate = new Date(card.nextReviewDate);
        if (isNaN(nextReviewDate.getTime())) {
            console.warn('Invalid nextReviewDate, considering card due');
            return true;
        }
        return new Date() >= nextReviewDate;
    } catch (error) {
        console.warn('Error checking if card is due:', error);
        return true;
    }
}

/**
 * Get retrievability for a card at current time
 * @param {Object} card - Card object with FSRS state
 * @returns {number} Current retrievability (0-1)
 */
export function getCurrentRetrievability(card) {
    if (!card || typeof card !== 'object') return 1.0;
    if (!card.stability || !card.lastReviewed) return 1.0;
    
    try {
        const lastReviewed = new Date(card.lastReviewed);
        if (isNaN(lastReviewed.getTime())) return 1.0;
        
        const timeSinceLastReview = (new Date() - lastReviewed) / (1000 * 60 * 60 * 24);
        return retrievability(timeSinceLastReview, card.stability);
    } catch (error) {
        console.warn('Error calculating retrievability:', error);
        return 1.0;
    }
}
