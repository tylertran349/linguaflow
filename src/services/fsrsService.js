// FSRS-6 default parameters (21 parameters)
// These are the official FSRS-6 defaults from the algorithm specification
export const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
];

// Parameter meanings:
// w[0-3]: Initial stability for grades 1-4 (Again, Hard, Good, Easy) - in DAYS
// w[4]: Initial difficulty baseline
// w[5]: Difficulty decrease factor for initial grade
// w[6]: Difficulty change factor per grade difference from 3
// w[7]: Mean reversion weight toward Easy difficulty
// w[8]: Success stability increase constant (e^w[8])
// w[9]: Stability power factor for success
// w[10]: Retrievability bonus factor for success
// w[11]: Fail stability constant
// w[12]: Difficulty power factor for fail
// w[13]: Stability power factor for fail
// w[14]: Retrievability factor for fail
// w[15]: Hard penalty multiplier
// w[16]: Easy bonus multiplier
// w[17-19]: Same-day review parameters
// w[20]: Forgetting curve decay exponent

export const Grade = {
  Forgot: 1, // Again
  Hard: 2,
  Good: 3,
  Easy: 4,
};

export const FSRS_GRADES = [
    { grade: Grade.Forgot, label: 'Again', description: 'Completely forgot' },
    { grade: Grade.Hard, label: 'Hard', description: 'Took a long time to recall' },
    { grade: Grade.Good, label: 'Good', description: 'Recalled correctly' },
    { grade: Grade.Easy, label: 'Easy', description: 'Mastered' }
];

// Constants for numerical stability
const MIN_STABILITY = 0.001; // Minimum stability in days (~1.4 minutes) - prevents division issues
const MAX_STABILITY = 36500; // Maximum stability (100 years in days)
const MIN_INTERVAL_MINUTES = 1; // Absolute minimum interval (1 minute)
const FUZZ_FACTOR = 0.05; // ±5% randomization to prevent clustering

// FSRS-6 retrievability formula: R(t, S) = (1 + factor * t/S)^(-w[20])
// where factor = 0.9^(-1/w[20]) - 1 to ensure R(S, S) = 90%
// 
// Key property: When t = S (elapsed time equals stability), R = 90%
// This means stability represents the time until recall probability drops to 90%
export function retrievability(t, s) {
  if (!isFinite(s) || s <= 0) return 0;
  if (!isFinite(t) || t < 0) return 1; // No time elapsed = full recall
  
  const w20 = W[20];
  const factor = Math.pow(0.9, -1.0 / w20) - 1.0;
  const result = Math.pow(1.0 + factor * (t / s), -w20);
  
  return Math.max(0, Math.min(1, result)); // Clamp to [0, 1]
}

// Inverse of retrievability formula to calculate interval in DAYS
// Given target retrievability r_d and stability s, find t such that R(t,s) = r_d
// 
// Derivation:
// r_d = (1 + factor * t/S)^(-w[20])
// r_d^(-1/w[20]) = 1 + factor * t/S
// t = S * (r_d^(-1/w[20]) - 1) / factor
export function interval(r_d, s) {
  if (!isFinite(s) || s <= 0) return MIN_STABILITY;
  if (!isFinite(r_d) || r_d <= 0 || r_d >= 1) return s; // Fallback to stability
  
  const w20 = W[20];
  const factor = Math.pow(0.9, -1.0 / w20) - 1.0;
  
  // Guard against division by zero
  if (factor === 0) return s;
  
  const r_inv = Math.pow(r_d, -1.0 / w20);
  const rawInterval = (s / factor) * (r_inv - 1.0);
  
  // Ensure interval is valid
  if (!isFinite(rawInterval) || rawInterval <= 0) {
    return s; // Fallback to stability
  }
  
  return Math.min(rawInterval, MAX_STABILITY);
}

// Add fuzz to interval to prevent card clustering
// Only applied to intervals >= 1 day to avoid disrupting short-term reviews
export function fuzzInterval(intervalDays) {
  if (intervalDays < 1) return intervalDays; // Don't fuzz sub-day intervals
  const fuzz = intervalDays * FUZZ_FACTOR;
  const minI = intervalDays - fuzz;
  const maxI = intervalDays + fuzz;
  return minI + Math.random() * (maxI - minI);
}

// Initial stability for new cards based on first grade
// S_0(G) = w[G-1] for G in {1,2,3,4}
// Returns stability in DAYS
export function s_0(g) {
  switch (g) {
    case Grade.Forgot:
      return Math.max(W[0], MIN_STABILITY); // ~0.212 days (~5 hours)
    case Grade.Hard:
      return Math.max(W[1], MIN_STABILITY); // ~1.29 days
    case Grade.Good:
      return Math.max(W[2], MIN_STABILITY); // ~2.31 days
    case Grade.Easy:
      return Math.max(W[3], MIN_STABILITY); // ~8.30 days
    default:
      throw new Error("Invalid grade: must be 1, 2, 3, or 4");
  }
}

// FSRS-6: Stability update for same-day review (t < 1 day)
// Formula: S'(S,G) = S * e^(w[17] * (G - 3 + w[18]) * S^(-w[19]))
// 
// The exponent determines whether stability increases or decreases:
// - G=4 (Easy): exponent = w[17] * (1 + w[18]) * S^(-w[19]) > 0 → S increases
// - G=3 (Good): exponent = w[17] * w[18] * S^(-w[19]) > 0 → S increases
// - G=2 (Hard): exponent = w[17] * (-1 + w[18]) * S^(-w[19]), depends on w[18]
// - G=1 (Again): exponent = w[17] * (-2 + w[18]) * S^(-w[19]), typically < 0 → S decreases
//
// CRITICAL CONSTRAINT: S_Inc >= 1 when G >= 3 (stability must not decrease for correct answers)
function s_sameDay(s, g) {
  const safeS = Math.max(s, MIN_STABILITY);
  const w17 = W[17]; // 0.5425
  const w18 = W[18]; // 0.0912
  const w19 = W[19]; // 0.0658
  
  const exponent = w17 * (g - 3 + w18) * Math.pow(safeS, -w19);
  let newS = safeS * Math.exp(exponent);
  
  // FSRS-6 CONSTRAINT: Ensure S_Inc >= 1 when G >= 3 (Good or Easy)
  // This guarantees stability never decreases for correct answers on same-day reviews
  if (g >= Grade.Good && newS < safeS) {
    newS = safeS;
  }
  
  return clampStability(newS);
}

// Stability after successful recall (t >= 1 day, G in {2,3,4})
// Formula: S' = S * (1 + t_d * t_s * t_r * h * b * c)
// where:
//   t_d = 11 - D (difficulty term: lower difficulty → bigger increase)
//   t_s = S^(-w[9]) (stability term: higher stability → smaller increase)
//   t_r = e^(w[10] * (1-R)) - 1 (retrievability term: lower R → bigger bonus for harder recall)
//   h = w[15] for Hard, 1 otherwise (Hard penalty reduces stability gain)
//   b = w[16] for Easy, 1 otherwise (Easy bonus increases stability gain)
//   c = e^(w[8]) (constant multiplier)
function s_success(d, s, r, g) {
  const safeS = Math.max(s, MIN_STABILITY);
  const safeD = clampDifficulty(d);
  const safeR = Math.max(0.001, Math.min(0.999, r)); // Avoid R=0 or R=1 edge cases
  
  const t_d = 11.0 - safeD;
  const t_s = Math.pow(safeS, -W[9]);
  const t_r = Math.exp(W[10] * (1.0 - safeR)) - 1.0;
  const h = g === Grade.Hard ? W[15] : 1.0; // W[15] = 0.6014 (penalty)
  const b = g === Grade.Easy ? W[16] : 1.0; // W[16] = 1.8729 (bonus)
  const c = Math.exp(W[8]); // W[8] = 1.8722, so c ≈ 6.5
  
  // Calculate stability increase factor
  // Note: All terms are positive, so alpha >= 1 (stability always increases on success)
  const alpha = 1.0 + t_d * t_s * t_r * h * b * c;
  
  // Ensure alpha is at least 1 (numerical safety)
  const safeAlpha = Math.max(alpha, 1.0);
  let newS = safeS * safeAlpha;
  
  return clampStability(newS);
}

// Stability after forgetting (G = 1, Again)
// Formula: S' = c_f * d_f * s_f * r_f
// where:
//   c_f = w[11] (constant, ~1.48)
//   d_f = D^(-w[12]) (difficulty factor: harder cards lose less stability)
//   s_f = (S+1)^w[13] - 1 (stability factor: higher S → proportionally higher S')
//   r_f = e^(w[14] * (1-R)) (retrievability factor: lower R → higher S' to prevent collapse)
//
// Result is capped at current S (forgetting cannot increase stability)
function s_fail(d, s, r) {
  const safeS = Math.max(s, MIN_STABILITY);
  const safeD = clampDifficulty(d);
  const safeR = Math.max(0.001, Math.min(0.999, r));
  
  const c_f = W[11]; // 1.4835
  const d_f = Math.pow(safeD, -W[12]); // D^(-0.0614)
  const s_f = Math.pow(safeS + 1.0, W[13]) - 1.0; // (S+1)^0.2629 - 1
  const r_f = Math.exp(W[14] * (1.0 - safeR)); // e^(1.6483 * (1-R))
  
  let newS = c_f * d_f * s_f * r_f;
  
  // CRITICAL: Forgetting should never increase stability
  newS = Math.min(newS, safeS);
  
  // Ensure minimum stability
  return clampStability(newS);
}

// Main stability update function
// Selects appropriate formula based on elapsed time and grade
export function updateStability(d, s, r, g, t) {
  const safeS = Math.max(s, MIN_STABILITY);
  const safeT = Math.max(0, t);
  
  // FSRS-6: Use same-day review formula if t < 1 day
  if (safeT < 1.0) {
    return s_sameDay(safeS, g);
  }
  
  // For t >= 1 day, use standard formulas
  if (g === Grade.Forgot) {
    return s_fail(d, safeS, r);
  } else {
    return s_success(d, safeS, r, g);
  }
}

// Clamp stability to valid range
export function clampStability(s) {
  if (!isFinite(s)) return MIN_STABILITY;
  return Math.max(MIN_STABILITY, Math.min(s, MAX_STABILITY));
}

// Clamp difficulty to valid range [1, 10]
export function clampDifficulty(d) {
  if (!isFinite(d)) return 5.0; // Default to medium difficulty
  return Math.max(1.0, Math.min(d, 10.0));
}

// Initial difficulty for new cards based on first grade
// Formula: D_0(G) = w[4] - e^(w[5] * (G - 1)) + 1
// Higher grades (better recall) → lower initial difficulty
export function d_0(g) {
  const grade = g;
  return clampDifficulty(W[4] - Math.exp(W[5] * (grade - 1.0)) + 1.0);
}

// Difficulty change per review
// Formula: ΔD = -w[6] * (G - 3)
// G > 3 (Easy) → negative ΔD → difficulty decreases
// G < 3 (Hard/Again) → positive ΔD → difficulty increases
function deltaDifficulty(g) {
  return -W[6] * (g - 3.0);
}

// Difficulty prime (intermediate step for difficulty update)
// Formula: D' = D + ΔD * (10 - D) / 9
// The (10 - D) / 9 factor ensures changes are proportional to available "room"
// When D is high, there's less room to increase; when D is low, there's less room to decrease
function dp(d, g) {
  const safeD = clampDifficulty(d);
  return safeD + deltaDifficulty(g) * ((10.0 - safeD) / 9.0);
}

// Update difficulty after review
// Formula: D = w[7] * D_0(Easy) + (1 - w[7]) * D'
// This applies mean reversion: difficulty slowly drifts toward the baseline (D_0(Easy))
// w[7] controls the strength of mean reversion (higher = faster reversion)
export function updateDifficulty(d, g) {
  const safeD = clampDifficulty(d);
  const d0Easy = d_0(Grade.Easy);
  const dPrime = dp(safeD, g);
  return clampDifficulty(W[7] * d0Easy + (1.0 - W[7]) * dPrime);
}

// Card state enum (FSRS-6 doesn't have Anki-style learning steps)
// Cards are either New (never reviewed) or Review (has been reviewed)
// The algorithm handles "relearning" through stability updates, not separate states
export const CardState = {
  New: 0,      // Never reviewed - will use s_0() for initial stability
  Review: 1,   // Has been reviewed at least once - uses updateStability()
};

// Get card state based on its properties
export function getCardState(card) {
  if (!card.lastReviewed) {
    return CardState.New;
  }
  return CardState.Review;
}

// Check if a card is overdue (past its scheduled review date)
export function isOverdue(card) {
  if (!card.nextReviewDate) return false; // New cards aren't "overdue"
  return new Date() > new Date(card.nextReviewDate);
}

// Calculate how many days overdue a card is (negative if not yet due)
export function getOverdueDays(card) {
  if (!card.nextReviewDate) return 0;
  const now = new Date();
  const dueDate = new Date(card.nextReviewDate);
  return (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
}

export class FSRS {
    constructor(targetRetrievability = 0.9) {
        // Target retrievability - the probability of recall we're scheduling for
        // 90% is the FSRS default and is well-supported by research
        this.r_d = targetRetrievability;
    }

    // Calculate interval in DAYS based on stability
    // FSRS-6 uses a single formula for all grades - the stability already encodes
    // the grade's impact, so we just need to find when R drops to target
    calculateIntervalDays(s) {
        const intervalDays = interval(this.r_d, s);
        
        // Apply fuzz only to intervals >= 1 day
        if (intervalDays >= 1) {
            return fuzzInterval(intervalDays);
        }
        
        return intervalDays;
    }

    // Convert interval in days to a Date object
    intervalToDate(intervalDays, fromDate = new Date()) {
        const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
        
        // Enforce minimum interval
        const minIntervalMs = MIN_INTERVAL_MINUTES * 60 * 1000;
        const actualIntervalMs = Math.max(intervalMs, minIntervalMs);
        
        return new Date(fromDate.getTime() + actualIntervalMs);
    }

    schedule(card, grade) {
        const now = new Date();

        // Determine if this is a new card
        const isNewCard = !card.stability || 
                          !card.difficulty || 
                          !card.lastReviewed || 
                          isNaN(new Date(card.lastReviewed).getTime());
        
        let s, d;
        let elapsedDays = 0;
        let r = 1.0; // Retrievability at time of review
        
        if (isNewCard) {
            // First review of a new card
            s = s_0(grade);
            d = d_0(grade);
        } else {
            // Subsequent review
            elapsedDays = (now.getTime() - new Date(card.lastReviewed).getTime()) / (1000 * 60 * 60 * 24);
            elapsedDays = Math.max(0, elapsedDays);
            
            // Calculate retrievability at the time of this review
            r = retrievability(elapsedDays, card.stability);
            
            // Update stability and difficulty based on grade
            s = updateStability(card.difficulty, card.stability, r, grade, elapsedDays);
            d = updateDifficulty(card.difficulty, grade);
        }

        // Calculate next review interval using pure FSRS-6
        // The interval is derived directly from the new stability
        const intervalDays = this.calculateIntervalDays(s);
        const nextReview = this.intervalToDate(intervalDays, now);
        
        // Update statistics
        const lapses = (card.lapses || 0) + (grade === Grade.Forgot ? 1 : 0);
        const reps = (isNewCard ? 0 : card.reps || 0) + 1;

        return {
            stability: s,
            difficulty: d,
            reviewDate: nextReview,
            lastReviewed: now,
            lapses: lapses,
            reps: reps,
            interval: intervalDays,
            retrievability: r, // Retrievability at time of review (for display/debugging)
        };
    }
    
    // Get projected intervals for all grades (useful for showing users what each button will do)
    getProjectedIntervals(card) {
        const projections = {};
        for (const gradeInfo of FSRS_GRADES) {
            const result = this.schedule({ ...card }, gradeInfo.grade);
            const intervalMs = result.reviewDate.getTime() - new Date().getTime();
            const intervalDays = intervalMs / (1000 * 60 * 60 * 24);
            const intervalMins = intervalMs / (1000 * 60);
            const intervalHours = intervalMins / 60;
            
            // Format interval for display
            if (intervalMins < 60) {
                projections[gradeInfo.grade] = `${Math.round(intervalMins)}m`;
            } else if (intervalHours < 24) {
                projections[gradeInfo.grade] = `${Math.round(intervalHours)}h`;
            } else if (intervalDays < 30) {
                projections[gradeInfo.grade] = `${Math.round(intervalDays)}d`;
            } else if (intervalDays < 365) {
                projections[gradeInfo.grade] = `${(intervalDays / 30).toFixed(1)}mo`;
            } else {
                projections[gradeInfo.grade] = `${(intervalDays / 365).toFixed(1)}y`;
            }
        }
        return projections;
    }
    
    // Get current retrievability for a card
    getRetrievability(card) {
        if (!card.lastReviewed || !card.stability) return null;
        const elapsedDays = (new Date().getTime() - new Date(card.lastReviewed).getTime()) / (1000 * 60 * 60 * 24);
        return retrievability(Math.max(0, elapsedDays), card.stability);
    }
    
    // Check if card is due for review
    isDue(card) {
        if (!card.nextReviewDate) return true; // New cards are always due
        return new Date() >= new Date(card.nextReviewDate);
    }
    
    // Calculate priority score for review queue
    // LOWER score = HIGHER priority
    // 
    // Priority order:
    // 1. Review cards that are due (sorted by most overdue first)
    // 2. New cards (after review cards)
    // 3. Cards not yet due (lowest priority)
    //
    // This matches the FSRS philosophy: prioritize retaining what you've learned
    // before introducing new material.
    getPriorityScore(card) {
        const now = new Date();
        
        // New cards go after due review cards but before cards not yet due
        if (!card.nextReviewDate || !card.lastReviewed) {
            return 1000; // After due cards, before not-yet-due cards
        }
        
        const dueDate = new Date(card.nextReviewDate);
        const overdueMs = now.getTime() - dueDate.getTime();
        const overdueDays = overdueMs / (1000 * 60 * 60 * 24);
        
        // If not yet due, lowest priority (positive score proportional to days until due)
        if (overdueDays < 0) {
            return 10000 + (-overdueDays * 100); // Higher = lower priority
        }
        
        // Due cards: more overdue = lower score = higher priority
        // Calculate current retrievability for weighting
        const r = this.getRetrievability(card);
        if (r === null) return 0;
        
        // Priority formula: more overdue and lower retrievability = more negative = higher priority
        // Cards close to being forgotten (low R) get extra priority
        return -(overdueDays + 1) * (1 - r + 0.1);
    }
    
    // Get expected retention for a card at a specific time
    getExpectedRetention(card, atDate = new Date()) {
        if (!card.lastReviewed || !card.stability) return null;
        const elapsedDays = (atDate.getTime() - new Date(card.lastReviewed).getTime()) / (1000 * 60 * 60 * 24);
        return retrievability(Math.max(0, elapsedDays), card.stability);
    }
}
