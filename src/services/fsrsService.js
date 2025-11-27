// FSRS-6 default parameters (21 parameters)
export const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
];

export const Grade = {
  Forgot: 1,
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

// FSRS-6 retrievability formula: R(t, S) = (1 + factor * t/S)^(-w[20])
// where factor = 0.9^(-1/w[20]) - 1 to ensure R(S, S) = 90%
// Derivation: R(S, S) = (1 + factor)^(-w[20]) = 0.9
//              => 1 + factor = 0.9^(-1/w[20])
//              => factor = 0.9^(-1/w[20]) - 1
export function retrievability(t, s) {
  if (s <= 0) return 0;
  const w20 = W[20];
  const factor = Math.pow(0.9, -1.0 / w20) - 1.0;
  return Math.pow(1.0 + factor * (t / s), -w20);
}

// Inverse of retrievability formula to calculate interval
// R = (1 + factor * t/S)^(-w[20])
// => (1 + factor * t/S) = R^(-1/w[20])
// => factor * t/S = R^(-1/w[20]) - 1
// => t = S * (R^(-1/w[20]) - 1) / factor
export function interval(r_d, s) {
  if (s <= 0) return 1;
  const w20 = W[20];
  const factor = Math.pow(0.9, -1.0 / w20) - 1.0;
  const r_inv = Math.pow(r_d, -1.0 / w20);
  return (s / factor) * (r_inv - 1.0);
}

export function s_0(g) {
  switch (g) {
    case Grade.Forgot:
      return W[0];
    case Grade.Hard:
      return W[1];
    case Grade.Good:
      return W[2];
    case Grade.Easy:
      return W[3];
    default:
      throw new Error("Invalid grade");
  }
}

// FSRS-6: Stability update for same-day review
// S' = S * e^(w[17] * (G - 3 + w[18]) * S^(-w[19]))
function s_sameDay(s, g) {
  const w17 = W[17];
  const w18 = W[18];
  const w19 = W[19];
  const exponent = w17 * (g - 3 + w18) * Math.pow(s, -w19);
  return s * Math.exp(exponent);
}

function s_success(d, s, r, g) {
  const t_d = 11.0 - d;
  const t_s = Math.pow(Math.max(s, 0.1), -W[9]);
  const t_r = Math.exp(W[10] * (1.0 - r)) - 1.0;
  const h = g === Grade.Hard ? W[15] : 1.0;
  const b = g === Grade.Easy ? W[16] : 1.0;
  const c = Math.exp(W[8]);
  const alpha = 1.0 + t_d * t_s * t_r * h * b * c;
  return s * alpha;
}

function s_fail(d, s, r) {
  const d_f = Math.pow(d, -W[12]);
  const s_f = Math.pow(s + 1.0, W[13]) - 1.0;
  const r_f = Math.exp(W[14] * (1.0 - r));
  const c_f = W[11];
  const new_s = d_f * s_f * r_f * c_f;
  return Math.min(new_s, s);
}

export function updateStability(d, s, r, g, t) {
  // FSRS-6: Use same-day review formula if reviewed within 1 day
  // The formula S' = S * e^(w[17] * (G - 3 + w[18]) * S^(-w[19])) applies to all grades
  // The constraint S_Inc >= 1 when G >= 3 ensures stability increases for Good/Easy
  if (t < 1.0) {
    return s_sameDay(s, g);
  }
  
  if (g === Grade.Forgot) {
    return s_fail(d, s, r);
  } else {
    return s_success(d, s, r, g);
  }
}

export function clampDifficulty(d) {
  return Math.max(1.0, Math.min(d, 10.0));
}

export function d_0(g) {
  const grade = g;
  return clampDifficulty(W[4] - Math.exp(W[5] * (grade - 1.0)) + 1.0);
}

function deltaDifficulty(g) {
    const grade = g;
  return -W[6] * (grade - 3.0);
}

function dp(d, g) {
  return d + deltaDifficulty(g) * ((10.0 - d) / 9.0);
}

export function updateDifficulty(d, g) {
  return clampDifficulty(W[7] * d_0(Grade.Easy) + (1.0 - W[7]) * dp(d, g));
}

export class FSRS {
    constructor() {
        this.r_d = 0.9; // Target retrievability (90%)
    }

    schedule(card, grade) {
        const now = new Date();

        const isNewCard = !card.stability || 
                          !card.difficulty || 
                          !card.lastReviewed || 
                          isNaN(new Date(card.lastReviewed).getTime());
        
        let s, d;
        if (isNewCard) {
            s = s_0(grade);
            d = d_0(grade);
        } else {
            const elapsedDays = (now.getTime() - new Date(card.lastReviewed).getTime()) / (1000 * 60 * 60 * 24);
            const t = Math.max(0, elapsedDays);
            const r = retrievability(t, card.stability);
            // Pass elapsed time (t) for same-day review detection
            s = updateStability(card.difficulty, card.stability, r, grade, t);
            d = updateDifficulty(card.difficulty, grade);
        }

        let nextReview;
        if (grade === Grade.Forgot) {
            nextReview = new Date(now.getTime() + 1 * 60 * 1000); // 1 minute
        } else if (grade === Grade.Hard) {
            nextReview = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
        } else { // Good, Easy
            const i = Math.max(Math.round(interval(this.r_d, s)), 1);
            nextReview = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        }
        
        const lapses = (card.lapses || 0) + (grade === Grade.Forgot ? 1 : 0);
        const reps = (isNewCard ? 0 : card.reps || 0) + 1;

        return {
            stability: s,
            difficulty: d,
            reviewDate: nextReview,
            lastReviewed: now,
            lapses: lapses,
            reps: reps,
        }
    }
}
