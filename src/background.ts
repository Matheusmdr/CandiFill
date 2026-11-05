// Background Service Worker para CandiFill WebExtension

import {
  createPendingAnswerReviewDraft,
  normalizePendingAnswerCandidates,
  PENDING_ANSWER_REVIEW_STORAGE_KEY,
  readPendingAnswerReviewDraft,
} from './services/pendingAnswerReview';

let pendingReviewOperation = Promise.resolve();

function getAnswerReviewContext(sender: chrome.runtime.MessageSender): { tabId: number; site: string } | null {
  if (typeof sender.tab?.id !== 'number' || !sender.url) return null;
  try {
    const url = new URL(sender.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return { tabId: sender.tab.id, site: url.hostname };
  } catch {
    return null;
  }
}

function serializePendingReviewOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingReviewOperation.then(operation, operation);
  pendingReviewOperation = result.then(() => undefined, () => undefined);
  return result;
}

async function readPendingReviewMap(): Promise<Record<string, unknown>> {
  const result = await chrome.storage.session.get(PENDING_ANSWER_REVIEW_STORAGE_KEY);
  const value = result[PENDING_ANSWER_REVIEW_STORAGE_KEY];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function writePendingReviewMap(reviews: Record<string, unknown>): Promise<void> {
  await chrome.storage.session.set({ [PENDING_ANSWER_REVIEW_STORAGE_KEY]: reviews });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message?.action;
  if (!['JOBFILL_STAGE_ANSWER_REVIEW', 'JOBFILL_GET_ANSWER_REVIEW', 'JOBFILL_CLEAR_ANSWER_REVIEW'].includes(action)) {
    return false;
  }

  const context = getAnswerReviewContext(sender);
  if (!context || !chrome.storage.session) {
    sendResponse({ ok: false, candidates: [] });
    return false;
  }

  void serializePendingReviewOperation(async () => {
    const reviews = await readPendingReviewMap();
    const key = String(context.tabId);

    if (action === 'JOBFILL_STAGE_ANSWER_REVIEW') {
      const draft = createPendingAnswerReviewDraft(message.candidates, context.site);
      if (draft) reviews[key] = draft;
      else delete reviews[key];
      await writePendingReviewMap(reviews);
      return { ok: true, candidates: draft?.candidates || [] };
    }

    const stored = reviews[key];
    if (action === 'JOBFILL_CLEAR_ANSWER_REVIEW') {
      if (typeof stored === 'object' && stored !== null && 'site' in stored && stored.site === context.site) {
        delete reviews[key];
        await writePendingReviewMap(reviews);
      }
      return { ok: true, candidates: [] };
    }

    if (typeof stored !== 'object' || stored === null || !('site' in stored)) {
      return { ok: true, candidates: [] };
    }

    if ('expiresAt' in stored && typeof stored.expiresAt === 'number' && stored.expiresAt <= Date.now()) {
      delete reviews[key];
      await writePendingReviewMap(reviews);
      return { ok: true, candidates: [] };
    }
    if (stored.site !== context.site) return { ok: true, candidates: [] };

    const draft = readPendingAnswerReviewDraft(stored, context.site);
    if (!draft) {
      delete reviews[key];
      await writePendingReviewMap(reviews);
      return { ok: true, candidates: [] };
    }

    const sanitizedCandidates = normalizePendingAnswerCandidates(draft.candidates, context.site);
    reviews[key] = { ...draft, candidates: sanitizedCandidates };
    await writePendingReviewMap(reviews);
    return { ok: true, candidates: sanitizedCandidates, expiresAt: draft.expiresAt };
  }).then(sendResponse).catch((error: unknown) => {
    sendResponse({ ok: false, candidates: [], error: String(error) });
  });
  return true;
});

// Ouve comandos de atalho do teclado configurados no manifest
chrome.commands?.onCommand.addListener(async (command) => {
  if (command === 'autofill_page') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL' }, (_response) => {
          if (chrome.runtime.lastError) {
            // Tenta injetar content script caso a página tenha sido carregada antes da extensão
            chrome.scripting?.executeScript(
              {
                target: { tabId: tab.id! },
                files: ['content.js'],
              },
              () => {
                if (!chrome.runtime.lastError) {
                  chrome.tabs.sendMessage(tab.id!, { action: 'AUTOFILL' });
                }
              }
            );
          }
        });
      }
    } catch (err) {
      console.warn('Erro ao processar comando de atalho:', err);
    }
  }
});

// Ao instalar ou atualizar a extensão
chrome.runtime?.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('CandiFill Extensão instalada com sucesso!');
  }
});
