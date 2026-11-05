import { getAnswerProfileField, isReusableAnswerQuestion, isSensitiveAnswerQuestion } from './answerCapture';

export const PENDING_ANSWER_REVIEW_STORAGE_KEY = 'jobfill_pending_answer_reviews_v1';
export const PENDING_ANSWER_REVIEW_TTL_MS = 15 * 60 * 1000;
export const MAX_PENDING_ANSWER_CANDIDATES = 50;

export interface PendingAnswerReviewCandidate {
  id: string;
  question: string;
  answer: string;
  site: string;
  createdAt: string;
}

export interface PendingAnswerReviewDraft {
  site: string;
  expiresAt: number;
  candidates: PendingAnswerReviewCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizePendingAnswerCandidates(value: unknown, site: string): PendingAnswerReviewCandidate[] {
  if (!Array.isArray(value) || !site) return [];

  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const question = typeof item.question === 'string' ? item.question.trim().replace(/\s+/g, ' ').slice(0, 240) : '';
    const answer = typeof item.answer === 'string' ? item.answer.trim() : '';
    const candidateSite = typeof item.site === 'string' ? item.site : '';
    if (!question || question.length < 4 || !answer || answer.length > 5000 || candidateSite !== site || isSensitiveAnswerQuestion(question)) return [];
    if (!getAnswerProfileField(question) && !isReusableAnswerQuestion(question)) return [];

    const createdAt = typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt))
      ? item.createdAt
      : new Date().toISOString();
    const id = typeof item.id === 'string' && item.id.length <= 120
      ? item.id
      : `pending-answer-${index}-${Date.now()}`;

    return [{ id, question, answer, site, createdAt }];
  }).slice(0, MAX_PENDING_ANSWER_CANDIDATES);
}

export function createPendingAnswerReviewDraft(value: unknown, site: string, now = Date.now()): PendingAnswerReviewDraft | null {
  const candidates = normalizePendingAnswerCandidates(value, site);
  if (candidates.length === 0) return null;
  return { site, expiresAt: now + PENDING_ANSWER_REVIEW_TTL_MS, candidates };
}

export function readPendingAnswerReviewDraft(value: unknown, site: string, now = Date.now()): PendingAnswerReviewDraft | null {
  if (!isRecord(value) || value.site !== site || typeof value.expiresAt !== 'number' || value.expiresAt <= now) return null;
  const candidates = normalizePendingAnswerCandidates(value.candidates, site);
  if (candidates.length === 0) return null;
  return { site, expiresAt: value.expiresAt, candidates };
}
