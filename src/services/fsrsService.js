export const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
  1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

export const Grade = {
  Forgot: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
};

export const FSRS_GRADES = [
    { grade: Grade.Forgot, label: 'Again', description: 'Completely forgot' },
    { grade: Grade.Hard, label: 'Hard', description: 'Recalled with difficulty' },
    { grade: Grade.Good, label: 'Good', description: 'Recalled with effort' },
    { grade: Grade.Easy, label: 'Easy', description: 'Recalled with ease' }
];

const F = 19.0 / 81.0;
const C = -0.5;

export function retrievability(t, s) {
  return Math.pow(1.0 + F * (t / s), C);
}

export function interval(r_d, s) {
  return (s / F) * (Math.pow(r_d, 1.0 / C) - 1.0);
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

function s_success(d, s, r, g) {
  const t_d = 11.0 - d;
  const t_s = Math.pow(s, -W[9]);
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

export function updateStability(d, s, r, g) {
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
        this.r_d = 0.9;
    }

    schedule(card, grade) {
        const now = new Date();
        if (!card.stability || !card.difficulty) {
            // First review
            const s = s_0(grade);
            const d = d_0(grade);
            const i = Math.max(Math.round(interval(this.r_d, s)), 1);
            
            const nextReview = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);

            return {
                stability: s,
                difficulty: d,
                reviewDate: nextReview,
                lastReviewed: now,
                lapses: grade === Grade.Forgot ? 1 : 0,
                reps: 1,
            };
        }

        // t is days since last review. card.lastReviewed should be a Date object.
        const t = (now.getTime() - new Date(card.lastReviewed).getTime()) / (24 * 60 * 60 * 1000);
        const r = retrievability(t, card.stability);
        const s = updateStability(card.difficulty, card.stability, r, grade);
        const d = updateDifficulty(card.difficulty, grade);
        const i = Math.max(Math.round(interval(this.r_d, s)), 1);
        const nextReview = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);

        return {
            stability: s,
            difficulty: d,
            reviewDate: nextReview,
            lastReviewed: now,
            lapses: (card.lapses || 0) + (grade === Grade.Forgot ? 1 : 0),
            reps: (card.reps || 0) + 1,
        }
    }
}
