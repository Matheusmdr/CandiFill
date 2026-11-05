import { SavedAnswer } from '../types/profile';

export function getSavedAnswerKey(question: string, site: string): string {
  return `${question.trim().toLocaleLowerCase()}::${site.trim().toLocaleLowerCase()}`;
}

export function mergeSavedAnswers(existing: SavedAnswer[], incoming: SavedAnswer[]): SavedAnswer[] {
  const merged = [...existing];
  for (const answer of incoming) {
    const key = getSavedAnswerKey(answer.question, answer.site);
    const duplicateIndex = merged.findIndex((item) => getSavedAnswerKey(item.question, item.site) === key);
    if (duplicateIndex >= 0) merged[duplicateIndex] = answer;
    else merged.push(answer);
  }
  return merged;
}
