import { loadCandidateProfile, loadCandidateProfileCollection, saveCandidateProfile, saveCandidateProfileCollection } from './services/storage';
import { autofillCurrentPage } from './services/autofill';
import { CandidateProfile, PersonalInfo, SavedAnswer, SiteFieldMapping } from './types/profile';
import { CapturedProfileField, CapturedProfileFieldKey, getAnswerFieldQuestion, getAnswerFieldValue, getAnswerProfileField, getTrackedAnswerCaptureFields, isReusableAnswerQuestion, isSafeAnswerCaptureField } from './services/answerCapture';
import { getSavedAnswerKey, mergeSavedAnswers } from './services/savedAnswers';
import { normalizePendingAnswerCandidates } from './services/pendingAnswerReview';
import { shouldSuggestAutofill } from './services/formDetection';
import { startFieldMapping } from './services/fieldMappingOverlay';
import { observeOpenShadowRoots } from './services/formFields';
import { getBrowserLocale, loadPreferredLocale, LOCALE_STORAGE_KEY, Locale, translate, translatePlural } from './services/localization';

let contentLocale: Locale = getBrowserLocale();

function t(message: string, values?: Record<string, string | number>): string {
  return translate(contentLocale, message, values);
}

function tp(singular: string, plural: string, count: number): string {
  return translatePlural(contentLocale, singular, plural, count);
}

function updateContentLocale(locale: Locale): void {
  contentLocale = locale;
  const host = document.getElementById('jobfill-trigger-btn');
  const actionButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-candifill-action]');
  const label = actionButton?.querySelector('span:last-child');
  if (actionButton) actionButton.title = t('Preencher formulário automaticamente com CandiFill (Ctrl+Shift+.)');
  if (label && !actionButton?.disabled) label.textContent = t('Preencher com CandiFill');
  if (pendingAnswerCandidates.size > 0) renderAnswerReview();
}

void loadPreferredLocale().then((locale) => {
  if (locale) updateContentLocale(locale);
});

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const locale = changes[LOCALE_STORAGE_KEY]?.newValue;
    if (areaName === 'local' && (locale === 'en' || locale === 'pt-BR')) {
      updateContentLocale(locale);
    }
  });
}

interface PendingCapturedAnswer extends SavedAnswer {
  profileField: CapturedProfileField | null;
  destination: CapturedProfileFieldKey | 'saved-answer';
  selectedForSave: boolean;
}

let answerCaptureFields = new WeakSet<Element>();
const pendingAnswerCandidates = new Map<string, PendingCapturedAnswer>();
let answerCaptureActive = false;
let answerCaptureRenderTimer: ReturnType<typeof setTimeout> | undefined;
let answerCaptureTimer: ReturnType<typeof setTimeout> | undefined;
let answerReviewOpen = false;

function sendAnswerReviewMessage(action: string): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  const message: { action: string; candidates?: Array<Pick<SavedAnswer, 'id' | 'question' | 'answer' | 'site' | 'createdAt'>> } = { action };
  if (action === 'JOBFILL_STAGE_ANSWER_REVIEW') {
    message.candidates = Array.from(pendingAnswerCandidates.values()).map(({ id, question, answer, site, createdAt }) => ({
      id,
      question,
      answer,
      site,
      createdAt,
    }));
  }
  try {
    const response = chrome.runtime.sendMessage(message);
    if (response && typeof response.then === 'function') void response.catch(() => undefined);
  } catch {
    // A extensão pode estar sendo atualizada ou não oferecer storage.session.
  }
}

function clearStagedAnswerReview(): void {
  sendAnswerReviewMessage('JOBFILL_CLEAR_ANSWER_REVIEW');
}

function stageAnswerReview(): void {
  // Persist each eligible edit immediately. A debounced write can be lost when
  // the user submits a form and the page navigates before the timer fires.
  sendAnswerReviewMessage(pendingAnswerCandidates.size > 0
    ? 'JOBFILL_STAGE_ANSWER_REVIEW'
    : 'JOBFILL_CLEAR_ANSWER_REVIEW');
}

async function restoreStagedAnswerReview(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'JOBFILL_GET_ANSWER_REVIEW' });
    const restored = normalizePendingAnswerCandidates(response?.candidates, window.location.hostname);
    for (const answer of restored) {
      const key = getSavedAnswerKey(answer.question, answer.site);
      if (pendingAnswerCandidates.has(key)) continue;
      const profileField = getAnswerProfileField(answer.question);
      pendingAnswerCandidates.set(key, {
        ...answer,
        reuseOnAnySite: false,
        profileField,
        destination: profileField?.key || 'saved-answer',
        selectedForSave: false,
      });
    }
    if (restored.length > 0 && pendingAnswerCandidates.size > 0) {
      answerReviewOpen = true;
      renderAnswerReview();
    }
  } catch {
    // A falha na restauração não impede o preenchimento normal da página.
  }
}

function renderAnswerReview(): void {
  let host = document.getElementById('jobfill-answer-review');
  if (pendingAnswerCandidates.size === 0) {
    host?.remove();
    answerReviewOpen = false;
    return;
  }

  if (!host) {
    host = document.createElement('div');
    host.id = 'jobfill-answer-review';
    host.style.cssText = 'position:fixed;right:24px;bottom:82px;z-index:2147483646;pointer-events:auto;';
    host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
  }

  const shadow = host.shadowRoot;
  if (!shadow) return;
  shadow.replaceChildren();

  const panel = document.createElement('div');
  panel.style.cssText = 'width:min(360px,calc(100vw - 32px));max-height:min(420px,70vh);overflow:auto;padding:12px;border:1px solid rgba(16,185,129,.4);border-radius:16px;background:#09090b;color:#f4f4f5;box-shadow:0 16px 40px rgba(0,0,0,.55);font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

  const heading = document.createElement('div');
  heading.textContent = t('Respostas novas para revisar');
  heading.style.cssText = 'font-size:13px;font-weight:700;margin-bottom:4px;';
  panel.appendChild(heading);

  const explanation = document.createElement('p');
  explanation.textContent = t('Escolha quais respostas quer guardar. Se a página navegar, a revisão fica nesta sessão por até 15 min. Nada vai ao perfil sem sua confirmação.');
  explanation.style.cssText = 'margin:0 0 10px;color:#a1a1aa;';
  panel.appendChild(explanation);

  const checkboxes: HTMLInputElement[] = [];
  for (const [key, candidate] of pendingAnswerCandidates) {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:9px 0;border-top:1px solid rgba(63,63,70,.6);cursor:pointer;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.answerKey = key;
    checkbox.checked = candidate.selectedForSave;
    checkbox.onchange = () => { candidate.selectedForSave = checkbox.checked; };
    checkbox.style.cssText = 'margin-top:2px;accent-color:#10b981;';
    checkboxes.push(checkbox);

    const text = document.createElement('span');
    text.style.cssText = 'min-width:0;';
    const question = document.createElement('strong');
    question.textContent = candidate.question;
    question.style.cssText = 'display:block;color:#e4e4e7;font-weight:600;';
    const answer = document.createElement('span');
    answer.textContent = candidate.answer;
    answer.style.cssText = 'display:block;margin-top:3px;color:#a1a1aa;white-space:pre-wrap;overflow-wrap:anywhere;';
    const site = document.createElement('small');
    site.textContent = candidate.site;
    site.style.cssText = 'display:block;margin-top:3px;color:#71717a;';
    text.append(question, answer, site);
    const destination = document.createElement('select');
    destination.setAttribute('aria-label', t('Onde salvar a resposta: {question}', { question: candidate.question }));
    destination.style.cssText = 'display:block;max-width:100%;margin-top:6px;padding:4px 6px;border:1px solid #3f3f46;border-radius:7px;background:#18181b;color:#d4d4d8;font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    if (candidate.profileField) {
      const profileOption = document.createElement('option');
      profileOption.value = candidate.profileField.key;
      profileOption.textContent = t('Salvar no perfil: {label}', { label: t(candidate.profileField.label) });
      destination.appendChild(profileOption);
    }
    const answerOption = document.createElement('option');
    answerOption.value = 'saved-answer';
    answerOption.textContent = t('Salvar como resposta reutilizável');
    destination.appendChild(answerOption);
    destination.value = candidate.destination;
    destination.onchange = () => {
      candidate.destination = destination.value as PendingCapturedAnswer['destination'];
      reuseLabel.style.display = candidate.destination === 'saved-answer' ? 'flex' : 'none';
    };
    text.appendChild(destination);
    const reuseLabel = document.createElement('label');
    reuseLabel.style.cssText = `display:${candidate.destination === 'saved-answer' ? 'flex' : 'none'};align-items:center;gap:5px;margin-top:5px;color:#a1a1aa;font-size:10px;cursor:pointer;`;
    const reuseCheckbox = document.createElement('input');
    reuseCheckbox.type = 'checkbox';
    reuseCheckbox.checked = candidate.reuseOnAnySite;
    reuseCheckbox.onchange = () => { candidate.reuseOnAnySite = reuseCheckbox.checked; };
    reuseCheckbox.style.cssText = 'accent-color:#10b981;';
    const reuseText = document.createElement('span');
    reuseText.textContent = t('Permitir reutilizar em outros sites');
    reuseLabel.append(reuseCheckbox, reuseText);
    text.appendChild(reuseLabel);
    row.append(checkbox, text);
    panel.appendChild(row);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;';
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = t('Descartar');
  dismiss.style.cssText = 'padding:7px 10px;border:1px solid #3f3f46;border-radius:9px;background:#18181b;color:#d4d4d8;cursor:pointer;';
  dismiss.onclick = () => {
    pendingAnswerCandidates.clear();
    answerCaptureFields = new WeakSet<Element>();
    clearStagedAnswerReview();
    renderAnswerReview();
  };

  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = t('Salvar selecionadas');
  save.disabled = true;
  save.style.cssText = 'padding:7px 10px;border:0;border-radius:9px;background:#059669;color:#03120c;font-weight:700;cursor:pointer;opacity:.5;';
  const updateSaveState = () => {
    const hasSelection = checkboxes.some((checkbox) => checkbox.checked);
    save.disabled = !hasSelection;
    save.style.opacity = hasSelection ? '1' : '.5';
  };
  checkboxes.forEach((checkbox) => checkbox.addEventListener('change', updateSaveState));
  save.onclick = async () => {
    const selected = checkboxes
      .filter((checkbox) => checkbox.checked && checkbox.dataset.answerKey)
      .map((checkbox) => checkbox.dataset.answerKey as string)
      .map((key) => pendingAnswerCandidates.get(key))
      .filter((answer): answer is PendingCapturedAnswer => Boolean(answer));
    if (selected.length === 0) return;

    save.disabled = true;
    save.textContent = t('Salvando…');
    try {
      const profile = await loadCandidateProfile({ allowLocalStorageFallback: false });
      const personalUpdates: Partial<PersonalInfo> = {};
      const reusableAnswers: SavedAnswer[] = [];
      for (const candidate of selected) {
        if (candidate.destination !== 'saved-answer' && candidate.profileField?.key === candidate.destination) {
          personalUpdates[candidate.destination] = candidate.answer;
        } else {
          reusableAnswers.push(candidate);
        }
      }
      const confirmedProfileFields = new Set(Object.keys(personalUpdates).map((field) => `personal.${field}`));
      await saveCandidateProfile({
        ...profile,
        personal: { ...profile.personal, ...personalUpdates },
        unconfirmedDefaults: profile.unconfirmedDefaults.filter((item) => !confirmedProfileFields.has(item.key)),
        savedAnswers: mergeSavedAnswers(profile.savedAnswers, reusableAnswers),
      });
      for (const candidate of selected) pendingAnswerCandidates.delete(getSavedAnswerKey(candidate.question, candidate.site));
      answerCaptureFields = new WeakSet<Element>();
      answerReviewOpen = false;
      if (pendingAnswerCandidates.size > 0) stageAnswerReview();
      else clearStagedAnswerReview();
      renderAnswerReview();
      showFloatingToast(tp('{count} resposta salva no CandiFill.', '{count} respostas salvas no CandiFill.', selected.length), true);
    } catch (error) {
      showFloatingToast(`${t('Não foi possível salvar as respostas: ')}${String(error)}`, false);
      save.disabled = false;
      save.textContent = t('Salvar selecionadas');
      updateSaveState();
    }
  };
  actions.append(dismiss, save);
  panel.appendChild(actions);

  if (answerReviewOpen) {
    shadow.appendChild(panel);
  } else {
    const reviewButton = document.createElement('button');
    reviewButton.type = 'button';
    reviewButton.textContent = tp('Revisar {count} resposta nova', 'Revisar {count} respostas novas', pendingAnswerCandidates.size);
    reviewButton.style.cssText = 'padding:10px 14px;border:1px solid rgba(16,185,129,.5);border-radius:999px;background:#09090b;color:#d1fae5;font:600 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 10px 25px rgba(0,0,0,.45);cursor:pointer;';
    reviewButton.onclick = () => {
      answerReviewOpen = true;
      renderAnswerReview();
    };
    shadow.appendChild(reviewButton);
  }
}

function collectAnswerCandidate(element: Element): void {
  if (!answerCaptureActive || !isSafeAnswerCaptureField(element)) return;
  const question = getAnswerFieldQuestion(element);
  const profileField = getAnswerProfileField(question);
  if (!profileField && !isReusableAnswerQuestion(question)) return;
  const answer = getAnswerFieldValue(element).trim();
  const site = window.location.hostname;
  const key = getSavedAnswerKey(question, site);
  if (!answer || answer.length > 5000) {
    pendingAnswerCandidates.delete(key);
    sendAnswerReviewMessage(pendingAnswerCandidates.size > 0
      ? 'JOBFILL_STAGE_ANSWER_REVIEW'
      : 'JOBFILL_CLEAR_ANSWER_REVIEW');
    renderAnswerReview();
    return;
  }

  pendingAnswerCandidates.set(key, {
    id: `answer-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    question,
    answer,
    site,
    reuseOnAnySite: pendingAnswerCandidates.get(key)?.reuseOnAnySite || false,
    createdAt: new Date().toISOString(),
    profileField,
    destination: pendingAnswerCandidates.get(key)?.destination || profileField?.key || 'saved-answer',
    selectedForSave: pendingAnswerCandidates.get(key)?.selectedForSave || false,
  });
  stageAnswerReview();
  if (answerCaptureRenderTimer) clearTimeout(answerCaptureRenderTimer);
  answerCaptureRenderTimer = setTimeout(renderAnswerReview, 350);
}

function armAnswerCapture(): void {
  answerCaptureActive = true;
  const collectBlankFields = () => {
    document.querySelectorAll('input, textarea, select').forEach((element) => {
      const question = getAnswerFieldQuestion(element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement);
      if (!isSafeAnswerCaptureField(element) || (!getAnswerProfileField(question) && !isReusableAnswerQuestion(question))) return;
      if (!getAnswerFieldValue(element).trim()) answerCaptureFields.add(element);
    });
  };
  collectBlankFields();
  if (answerCaptureTimer) clearTimeout(answerCaptureTimer);
  answerCaptureTimer = setTimeout(() => { answerCaptureActive = false; }, 30 * 60 * 1000);
}

document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (!answerCaptureActive || !(target instanceof Element)) return;
  if (!isSafeAnswerCaptureField(target)) return;
  const question = getAnswerFieldQuestion(target);
  if (!getAnswerProfileField(question) && !isReusableAnswerQuestion(question)) return;
  if (!getAnswerFieldValue(target).trim()) answerCaptureFields.add(target);
}, true);

const handleCapturedFieldInput = (event: Event) => {
  const target = event.target;
  if (!answerCaptureActive || !(target instanceof Element) || !answerCaptureFields.has(target)) return;
  collectAnswerCandidate(target);
};
document.addEventListener('input', handleCapturedFieldInput, true);
document.addEventListener('change', handleCapturedFieldInput, true);

// Algumas páginas só deixam claro que o formulário foi respondido no envio
// (por exemplo, selects e campos controlados por frameworks). Releia os
// campos que estavam vazios e abra a revisão antes da navegação padrão.
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !answerCaptureActive) return;

  getTrackedAnswerCaptureFields(form, answerCaptureFields).forEach(collectAnswerCandidate);
  if (pendingAnswerCandidates.size > 0) {
    sendAnswerReviewMessage('JOBFILL_STAGE_ANSWER_REVIEW');
    answerReviewOpen = true;
    renderAnswerReview();
  }
}, true);

void restoreStagedAnswerReview();

/**
 * Exibe um toast visual sofisticado e flutuante na página do formulário
 */
function showFloatingToast(message: string, isSuccess = true) {
  const existing = document.getElementById('jobfill-floating-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'jobfill-floating-toast';
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 2147483647;
    background: ${isSuccess ? 'rgba(6, 78, 59, 0.95)' : 'rgba(39, 39, 42, 0.95)'};
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4), 0 0 0 1px ${isSuccess ? 'rgba(52, 211, 153, 0.4)' : 'rgba(113, 113, 122, 0.4)'};
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    transform: translateY(-8px) scale(0.96);
    opacity: 0;
  `;

  const iconSpan = document.createElement('span');
  iconSpan.style.fontSize = '16px';
  iconSpan.textContent = isSuccess ? '✨' : 'ℹ️';

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);

  document.body.appendChild(toast);

  // Animação de entrada
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0) scale(1)';
    toast.style.opacity = '1';
  });

  // Animação de saída
  setTimeout(() => {
    toast.style.transform = 'translateY(-10px) scale(0.96)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

/**
 * Executa o preenchimento automático
 */
async function triggerAutofill(customProfile?: CandidateProfile, selectedFieldIds?: string[], suppliedMappings?: SiteFieldMapping[], suppliedProfileId?: string) {
  try {
    const collection = await loadCandidateProfileCollection({ allowLocalStorageFallback: false });
    const activeEntry = collection.profiles.find((entry) => entry.id === collection.activeProfileId);
    const profile = customProfile || activeEntry?.profile || (await loadCandidateProfile({ allowLocalStorageFallback: false, includeApiKey: false }));
    const mappings = suppliedMappings || collection.siteFieldMappings || [];
    const profileId = suppliedProfileId || activeEntry?.id || collection.activeProfileId;
    const hasProfileData = [
      ...Object.values(profile.personal),
      profile.salary.desiredSalary,
      profile.salary.minimumSalary,
      profile.salary.contractType,
      profile.salary.availability,
      ...Object.values(profile.summary),
      ...profile.customFields.map((field) => field.value),
      ...profile.savedAnswers.map((answer) => answer.answer),
    ].some((value) => typeof value === 'string' && value.trim()) || profile.experience.length > 0 || profile.education.length > 0;

    if (!hasProfileData) {
      armAnswerCapture();
      showFloatingToast(t('Seu perfil ainda está vazio. Preencha o formulário e revise respostas novas para salvá-las.'), false);
      return { totalFilled: 0, fieldsFilled: [], fillableFields: [], fieldsSkipped: [], fieldsSkippedCount: 0, fieldsDetected: 0, unmatchedFields: [], usedSavedAnswerIds: [] };
    }

    // Nunca disponibiliza a chave de IA para a lógica executada na página.
    const safeProfile: CandidateProfile = {
      ...profile,
      aiConfig: { ...profile.aiConfig, apiKey: '' },
    };
    const result = autofillCurrentPage(safeProfile, false, selectedFieldIds, mappings, profileId);
    armAnswerCapture();

    if (result.usedSavedAnswerIds.length > 0) {
      try {
        const latestCollection = await loadCandidateProfileCollection({ allowLocalStorageFallback: false });
        const usedIds = new Set(result.usedSavedAnswerIds);
        const updatedCollection = {
          ...latestCollection,
          profiles: latestCollection.profiles.map((entry) => entry.id === profileId ? {
            ...entry,
            profile: {
              ...entry.profile,
              savedAnswers: entry.profile.savedAnswers.map((answer) => usedIds.has(answer.id)
                ? { ...answer, lastUsedAt: new Date().toISOString() }
                : answer),
            },
          } : entry),
        };
        await saveCandidateProfileCollection(updatedCollection, latestCollection.activeProfileId);
      } catch (error) {
        console.warn('Could not record saved answer usage:', error);
      }
    }

    if (result.totalFilled > 0) {
      const preservedMessage = result.fieldsSkipped.length
        ? tp(' {count} campo já preenchido foi preservado.', ' {count} campos já preenchidos foram preservados.', result.fieldsSkipped.length)
        : '';
      showFloatingToast(`${tp('CandiFill preencheu {count} campo.', 'CandiFill preencheu {count} campos.', result.totalFilled)}${preservedMessage}`, true);
    } else if (result.fieldsSkipped.length > 0) {
      showFloatingToast(tp(
        'Nenhum campo foi alterado; {count} resposta existente foi preservada.',
        'Nenhum campo foi alterado; {count} respostas existentes foram preservadas.',
        result.fieldsSkipped.length
      ), false);
    } else {
      showFloatingToast(t('Nenhum campo compatível foi preenchido. Você pode completar o formulário; respostas novas poderão ser revisadas.'), false);
    }

    return result;
  } catch {
    showFloatingToast(t('Não foi possível acessar o perfil da extensão. Abra o cofre e tente novamente.'), false);
    return { totalFilled: 0, fieldsFilled: [], fillableFields: [], fieldsSkipped: [], fieldsSkippedCount: 0, fieldsDetected: 0, unmatchedFields: [], usedSavedAnswerIds: [] };
  }
}

/**
 * Cria o botão flutuante discreto no canto inferior direito da página
 */
let buttonDismissedAtUrl: string | null = null;

function injectFloatingButton() {
  const currentUrl = window.location.href;
  if (buttonDismissedAtUrl && buttonDismissedAtUrl !== currentUrl) {
    buttonDismissedAtUrl = null;
  }
  if (buttonDismissedAtUrl === currentUrl || document.getElementById('jobfill-trigger-btn')) return;

  const btnContainer = document.createElement('div');
  btnContainer.id = 'jobfill-trigger-btn';
  btnContainer.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    max-width: calc(100vw - 24px);
    box-sizing: border-box;
    z-index: 2147483646;
  `;

  const shadow = btnContainer.attachShadow({ mode: 'open' });
  const pill = document.createElement('div');
  pill.style.cssText = `
    display: flex;
    align-items: center;
    background: #09090b;
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 9999px;
    padding: 3px 4px 3px 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(16, 185, 129, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f4f4f5;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    opacity: 0.9;
  `;

  btnContainer.onmouseenter = () => {
    pill.style.opacity = '1';
    pill.style.transform = 'scale(1.04)';
    pill.style.boxShadow = '0 12px 30px -5px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.35)';
  };
  btnContainer.onmouseleave = () => {
    pill.style.opacity = '0.9';
    pill.style.transform = 'scale(1)';
    pill.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(16, 185, 129, 0.2)';
  };

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.dataset.candifillAction = 'true';
  actionBtn.title = t('Preencher formulário automaticamente com CandiFill (Ctrl+Shift+.)');
  actionBtn.style.cssText = `
    background: none;
    border: none;
    color: inherit;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 4px 6px;
  `;
  actionBtn.innerHTML = `
    <span style="color: #34d399; font-size: 14px;">⚡</span>
    <span>${t('Preencher com CandiFill')}</span>
  `;
  actionBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (actionBtn.disabled) return;

    const label = actionBtn.querySelector('span:last-child');
    actionBtn.disabled = true;
    actionBtn.setAttribute('aria-busy', 'true');
    actionBtn.style.cursor = 'wait';
    if (label) label.textContent = t('Preenchendo…');

    try {
      await triggerAutofill();
    } finally {
      actionBtn.disabled = false;
      actionBtn.removeAttribute('aria-busy');
      actionBtn.style.cursor = 'pointer';
      if (label) label.textContent = t('Preencher com CandiFill');
    }
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', t('Ocultar botão nesta página'));
  closeBtn.title = t('Ocultar botão nesta página');
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: #71717a;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  `;
  closeBtn.textContent = '×';
  closeBtn.onmouseenter = () => { closeBtn.style.color = '#ef4444'; };
  closeBtn.onmouseleave = () => { closeBtn.style.color = '#71717a'; };
  closeBtn.onpointerdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    buttonDismissedAtUrl = window.location.href;
    btnContainer.remove();
  };
  closeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    buttonDismissedAtUrl = window.location.href;
    btnContainer.remove();
  };

  pill.appendChild(actionBtn);
  pill.appendChild(closeBtn);
  shadow.appendChild(pill);
  document.body.appendChild(btnContainer);
}

/**
 * Mostra o atalho somente em páginas com campos de candidatura e contexto de vaga
 */
// 1. Ouve mensagens da extensão (popup, atalho ou background)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'START_FIELD_MAPPING' && message.profile) {
      startFieldMapping(message.profile as CandidateProfile, String(message.profileId || ''), t, showFloatingToast);
      sendResponse({ ok: true });
      return false;
    }
    if (message.action === 'AUTOFILL_PREVIEW') {
      const profile = message.profile as CandidateProfile;
      const safeProfile: CandidateProfile = {
        ...profile,
        aiConfig: { ...profile.aiConfig, apiKey: '' },
      };
      sendResponse(autofillCurrentPage(
        safeProfile,
        true,
        undefined,
        Array.isArray(message.siteFieldMappings) ? message.siteFieldMappings : [],
        typeof message.profileId === 'string' ? message.profileId : ''
      ));
      return false;
    }

    if (message.action === 'AUTOFILL') {
      triggerAutofill(
        message.profile,
        Array.isArray(message.selectedFieldIds) ? message.selectedFieldIds : undefined,
        Array.isArray(message.siteFieldMappings) ? message.siteFieldMappings : undefined,
        typeof message.profileId === 'string' ? message.profileId : undefined
      ).then((result) => {
        sendResponse(result);
      });
      return true; // mantém canal aberto para resposta assíncrona
    }

    if (message.action === 'PING') {
      sendResponse({ status: 'PONG' });
      return false;
    }
  });
}

// 3. Inicialização e observação de novos formulários (SPAs)
function syncFloatingButton() {
  if (buttonDismissedAtUrl && buttonDismissedAtUrl !== window.location.href) {
    buttonDismissedAtUrl = null;
  }

  if (!shouldSuggestAutofill()) {
    document.getElementById('jobfill-trigger-btn')?.remove();
    return;
  }

  // A captura passiva só fica ativa em páginas com sinais de candidatura.
  // Ao acionar o CandiFill manualmente, triggerAutofill também a arma.
  if (!answerCaptureActive) armAnswerCapture();
  injectFloatingButton();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncFloatingButton);
} else {
  syncFloatingButton();
}

// Observa mudanças dinâmicas no DOM (ex: navegação de etapas de candidatura)
let lastCheck = 0;
const observer = new MutationObserver((mutations) => {
  // Open Shadow Roots need their own observer; document subtree observation does not pierce them.
  mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (node instanceof Element) observeOpenShadowRoots(observer, node, observedShadowRoots);
  }));
  const now = Date.now();
  if (now - lastCheck > 2000) {
    lastCheck = now;
    syncFloatingButton();
  }
});

const mutationRoot = document.body || document.documentElement;
const observedShadowRoots = new WeakSet<ShadowRoot>();
observer.observe(mutationRoot, {
  childList: true,
  subtree: true,
});
observeOpenShadowRoots(observer, mutationRoot, observedShadowRoots);
