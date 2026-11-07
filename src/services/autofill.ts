import { CandidateProfile, ResumeFile } from '../types/profile';
import { SiteFieldMapping } from '../types/profile';
import { getProfileFieldValue, matchesMappedField } from './siteFieldMappings';
import { collectAutofillFields, getFormFieldLabel, isNativeFormField, queryDeepElements } from './formFields';

/**
 * Remove acentos e normaliza para comparações semânticas tolerantes
 */
function normalizeStr(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Aplica efeito visual de confirmação verde em um campo preenchido
 */
function applyGlowEffect(element: HTMLElement) {
  element.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
  element.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.45)';
  const container = element.closest('.form-group, .field, label, div');
  if (container && container !== document.body) {
    (container as HTMLElement).style.transition = 'border-color 0.3s ease';
  }
  setTimeout(() => {
    element.style.boxShadow = '';
  }, 2500);
}

/**
 * Define o valor de um input ou textarea disparando eventos nativos do React/Vue/Angular
 */
function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
  dryRun = false
): boolean {
  if (!element || value === undefined || value === null) return false;

  const combobox = element.getAttribute('role') === 'combobox'
    ? element
    : element.closest<HTMLElement>('[role="combobox"]');
  if (combobox && setCustomComboboxValue(combobox, value, dryRun)) return true;

  // Se for um <select>, redireciona para a rotina especializada
  if (element.tagName === 'SELECT') {
    return setSelectValue(element as HTMLSelectElement, value, dryRun);
  }

  const compatibleValue = element instanceof HTMLInputElement && element.type === 'number'
    ? normalizeNumberValue(value)
    : value;
  if (compatibleValue === null) return false;

  if (dryRun) return true;

  try {
    element.focus();

    // Em React 16+, inputs controlados sobrescrevem o setter do value.
    // Usamos o protótipo nativo para garantir que o React intercepte a mudança.
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, compatibleValue);
    } else {
      element.value = compatibleValue;
    }

    // Dispara eventos em cascata para validações de formulário
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));

    applyGlowEffect(element);
    return true;
  } catch (err) {
    console.warn('CandiFill: Erro ao preencher elemento:', err);
    return false;
  }
}

function getCustomComboboxValue(element: HTMLElement): string {
  const controlledFields = queryDeepElements<HTMLInputElement | HTMLTextAreaElement>(element, 'input:not([type="hidden"]), textarea');
  const innerValue = controlledFields.find((field) => field.value.trim())?.value;
  if (innerValue) return innerValue.trim();

  const activeOptionId = element.getAttribute('aria-activedescendant');
  if (activeOptionId) {
    const activeOption = queryDeepElements<HTMLElement>(document, '[id]')
      .find((candidate) => candidate.id === activeOptionId);
    if (activeOption?.textContent?.trim()) return activeOption.textContent.trim();
  }

  const ariaValue = element.getAttribute('aria-valuetext')?.trim() || element.getAttribute('aria-valuenow')?.trim();
  if (ariaValue) return ariaValue;
  const valueContainer = element.cloneNode(true) as HTMLElement;
  valueContainer.querySelectorAll('[role="listbox"], [role="option"]').forEach((option) => option.remove());
  const textValue = (valueContainer.innerText || valueContainer.textContent || '').replace(/\s+/g, ' ').trim();
  const placeholder = element.getAttribute('aria-placeholder') || element.getAttribute('placeholder') || element.getAttribute('data-placeholder') || '';
  if (placeholder && normalizeStr(textValue) === normalizeStr(placeholder)) return '';
  if (/^(select|choose|please select|selecion|escolha|selecione)\b/i.test(textValue)) return '';
  return textValue;
}

function isVisibleElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && element.getClientRects().length > 0;
}

function getComboboxOptions(element: HTMLElement): HTMLElement[] {
  const controls = [element, ...queryDeepElements<HTMLElement>(element, 'input, [role="combobox"]')];
  const controlledIds = new Set(controls.flatMap((control) =>
    `${control.getAttribute('aria-controls') || ''} ${control.getAttribute('aria-owns') || ''}`
      .split(/\s+/).filter(Boolean),
  ));
  const listboxes = queryDeepElements<HTMLElement>(document, '[role="listbox"]');
  const relatedListboxes = listboxes.filter((listbox) => controlledIds.has(listbox.id));

  let relevantListboxes = relatedListboxes;
  if (relevantListboxes.length === 0) {
    const localRoot = element.getRootNode();
    const localListboxes = localRoot instanceof Document || localRoot instanceof ShadowRoot
      ? queryDeepElements<HTMLElement>(localRoot, '[role="listbox"]')
      : [];
    const visibleLocalListboxes = localListboxes.filter(isVisibleElement);
    if (visibleLocalListboxes.length === 1) {
      relevantListboxes = visibleLocalListboxes;
    } else {
      const visiblePageListboxes = listboxes.filter(isVisibleElement);
      if (visiblePageListboxes.length === 1) relevantListboxes = visiblePageListboxes;
    }
  }

  const options = relevantListboxes.flatMap((listbox) =>
    queryDeepElements<HTMLElement>(listbox, '[role="option"]'),
  );
  return Array.from(new Set(options));
}

function findComboboxOption(options: HTMLElement[], target: string | string[]): HTMLElement | null {
  const targets = (Array.isArray(target) ? target : [target])
    .flatMap((value) => [value, ...value.split(/\s+ou\s+|\s*\/\s*|\s*\|\s*/i)])
    .map(normalizeStr)
    .filter((value) => value.length > 1);
  let bestOption: HTMLElement | null = null;
  let bestScore = 0;

  options.forEach((option) => {
    if (option.getAttribute('aria-disabled') === 'true' || !isVisibleElement(option)) return;
    const optionText = normalizeStr(option.innerText || option.textContent || '');
    if (optionText.length < 2) return;
    targets.forEach((value) => {
      let score = 0;
      if (optionText === value) score = 100;
      else if (optionText.startsWith(value) || value.startsWith(optionText)) score = 88;
      else if (optionText.includes(value)) score = 78;
      else if (value.length >= 3 && value.includes(optionText)) score = 72;
      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    });
  });

  return bestScore >= 72 ? bestOption : null;
}

/**
 * Handles accessible custom select widgets that expose role=combobox/listbox/option.
 * Native inputs and selects keep using their existing setters when no option is found.
 */
function setCustomComboboxValue(element: HTMLElement, target: string | string[], dryRun = false): boolean {
  if (element.getAttribute('role') !== 'combobox') return false;
  const targetValues = (Array.isArray(target) ? target : [target]).filter((value) => value.trim());
  if (targetValues.length === 0 || element.getAttribute('aria-disabled') === 'true') return false;
  if (dryRun) return true;

  try {
    let option = findComboboxOption(getComboboxOptions(element), targetValues);
    if (!option) {
      element.focus();
      element.click();
      option = findComboboxOption(getComboboxOptions(element), targetValues);
    }

    if (option) {
      option.click();
      applyGlowEffect(element);
      return true;
    }

    const editableField = queryDeepElements<HTMLInputElement | HTMLTextAreaElement>(element, 'input:not([type="hidden"]), textarea')
      .find((field) => !field.readOnly && !field.disabled);
    if (editableField) {
      const prototype = Object.getPrototypeOf(editableField);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor?.set) descriptor.set.call(editableField, targetValues[0]);
      else editableField.value = targetValues[0];
      editableField.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      editableField.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      editableField.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
      applyGlowEffect(element);
      return true;
    }
  } catch (error) {
    console.warn('CandiFill: Erro ao selecionar uma opÃ§Ã£o personalizada:', error);
  }

  return false;
}

function normalizeNumberValue(value: string): string | null {
  let normalized = value.trim().replace(/[^\d,.-]/g, '');
  if (!normalized || !/\d/.test(normalized)) return null;
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (comma >= 0) {
    const decimals = normalized.length - comma - 1;
    normalized = decimals > 0 && decimals <= 2 ? normalized.replace(',', '.') : normalized.replace(/,/g, '');
  } else if (dot >= 0) {
    const pieces = normalized.split('.');
    if (pieces.length > 2 || pieces.slice(1).every((part) => part.length === 3)) normalized = pieces.join('');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

/**
 * Seleciona a melhor opção dentro de um elemento <select> com base em texto ou valor
 */
export function setSelectValue(select: HTMLSelectElement, target: string | string[], dryRun = false): boolean {
  if (!select || !select.options || select.options.length === 0) return false;

  const rawTargets = Array.isArray(target) ? target : [target];
  const normalizedTargets = rawTargets.map(normalizeStr).filter(Boolean);

  if (normalizedTargets.length === 0) return false;

  let bestIndex = -1;
  let highestScore = 0;

  for (let i = 0; i < select.options.length; i++) {
    const opt = select.options[i];
    // Ignora placeholders vazios ("Selecione...", "Escolha...")
    if (i === 0 && (!opt.value || opt.value === '0' || opt.value === '-1')) {
      const optNorm = normalizeStr(opt.text);
      if (optNorm.includes('selecion') || optNorm.includes('select') || optNorm.includes('escolh')) {
        continue;
      }
    }

    const optText = normalizeStr(opt.text);
    const optVal = normalizeStr(opt.value);

    for (const t of normalizedTargets) {
      // 1. Correspondência exata no texto ou value (Score máximo: 100)
      if (optText === t || optVal === t) {
        bestIndex = i;
        highestScore = 100;
        break;
      }

      // 2. O texto da opção contém o termo ou vice-versa (Score: 70)
      if (optText.includes(t) || t.includes(optText)) {
        const score = 70 + Math.min(t.length, 10);
        if (score > highestScore) {
          highestScore = score;
          bestIndex = i;
        }
      }

      // 3. Validação por termos compostos (ex: "PJ ou CLT" batendo com opção "CLT")
      const words = t.split(/\s+ou\s+|\s*\/\s*|\s+/).filter((w) => w.length >= 2);
      for (const w of words) {
        if (optText.includes(w) || optVal.includes(w)) {
          const score = 50 + w.length * 2;
          if (score > highestScore) {
            highestScore = score;
            bestIndex = i;
          }
        }
      }
    }

    if (highestScore === 100) break;
  }

  if (bestIndex >= 0) {
    if (dryRun) return true;
    try {
      select.focus();
      select.selectedIndex = bestIndex;
      const matched = select.options[bestIndex];
      matched.selected = true;

      // Setter React no prototype de select
      const prototype = Object.getPrototypeOf(select);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(select, matched.value);
      } else {
        select.value = matched.value;
      }

      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('blur', { bubbles: true }));

      applyGlowEffect(select);
      return true;
    } catch (e) {
      console.warn('CandiFill: Erro ao despachar seleção do select:', e);
    }
  }

  return false;
}

/**
 * Preenche botões de rádio ou opções de checkbox
 */
function setRadioOrSelect(element: HTMLInputElement, shouldCheck: boolean, dryRun = false): boolean {
  if (element.type === 'radio' || element.type === 'checkbox') {
    if (shouldCheck && !element.checked) {
      if (dryRun) return true;
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('click', { bubbles: true }));
      applyGlowEffect(element);
      return true;
    }
  }
  return false;
}

/**
 * Converte base64 para File nativo e anexa automaticamente ao input[type="file"]
 */
function attachResumeFile(fileInput: HTMLInputElement, resumeFile: ResumeFile): boolean {
  if (!fileInput || !resumeFile || !resumeFile.base64) return false;

  try {
    const byteCharacters = atob(resumeFile.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: resumeFile.type || 'application/pdf' });
    const file = new File([blob], resumeFile.name || 'Curriculo.pdf', {
      type: resumeFile.type || 'application/pdf',
      lastModified: resumeFile.lastModified || Date.now(),
    });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Efeito visual no container do anexo
    const container = fileInput.closest('.upload-zone, .dropzone, label, div') || fileInput;
    applyGlowEffect(container as HTMLElement);

    return true;
  } catch (err) {
    console.warn('CandiFill: Erro ao anexar currículo automaticamente:', err);
    return false;
  }
}

export interface AutofillResult {
  totalFilled: number;
  fieldsFilled: string[];
  fillableFields: Array<{ id: string; label: string }>;
  fieldsSkipped: string[];
  fieldsSkippedCount: number;
  fieldsDetected: number;
  unmatchedFields: string[];
  usedSavedAnswerIds: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getFieldValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    return el.checked ? el.value || 'checked' : '';
  }
  return el.value || '';
}

function isFieldVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function isUnconfirmedDefault(profile: CandidateProfile, key: string): boolean {
  return profile.unconfirmedDefaults.some((item) => item.key === key);
}

const PHONE_DIAL_CODE_ALIASES: Record<string, string[]> = {
  '1': ['United States', 'Canada', 'US', 'CA'],
  '7': ['Russia', 'Kazakhstan', 'RU', 'KZ'],
  '27': ['South Africa', 'ZA'],
  '30': ['Greece', 'GR'],
  '31': ['Netherlands', 'Holland', 'NL'],
  '32': ['Belgium', 'BE'],
  '33': ['France', 'FR'],
  '34': ['Spain', 'ES'],
  '39': ['Italy', 'IT'],
  '40': ['Romania', 'RO'],
  '41': ['Switzerland', 'CH'],
  '43': ['Austria', 'AT'],
  '44': ['United Kingdom', 'UK', 'Great Britain', 'GB'],
  '45': ['Denmark', 'DK'],
  '46': ['Sweden', 'SE'],
  '47': ['Norway', 'NO'],
  '48': ['Poland', 'PL'],
  '49': ['Germany', 'DE'],
  '52': ['Mexico', 'MX'],
  '54': ['Argentina', 'AR'],
  '55': ['Brazil', 'Brasil', 'BR'],
  '56': ['Chile', 'CL'],
  '57': ['Colombia', 'CO'],
  '58': ['Venezuela', 'VE'],
  '60': ['Malaysia', 'MY'],
  '61': ['Australia', 'AU'],
  '62': ['Indonesia', 'ID'],
  '63': ['Philippines', 'PH'],
  '64': ['New Zealand', 'NZ'],
  '65': ['Singapore', 'SG'],
  '81': ['Japan', 'JP'],
  '82': ['South Korea', 'Korea', 'KR'],
  '86': ['China', 'CN'],
  '91': ['India', 'IN'],
  '351': ['Portugal', 'PT'],
  '353': ['Ireland', 'IE'],
  '358': ['Finland', 'FI'],
};

function getInternationalPhoneParts(phone: string, nationality = ''): { dialCode: string; localNumber: string } | null {
  const trimmed = phone.trim();
  const normalized = trimmed.replace(/[^\d+]/g, '');
  const digits = normalized.startsWith('00') ? normalized.slice(2) : normalized.startsWith('+') ? normalized.slice(1) : '';
  const country = normalizeStr(nationality);
  const countryDialCodes: Record<string, string> = {
    brazil: '55', brasil: '55', br: '55', portugal: '351', pt: '351',
    'united states': '1', usa: '1', us: '1', canada: '1', ca: '1',
    'united kingdom': '44', uk: '44', gb: '44', france: '33', fr: '33',
    spain: '34', es: '34', germany: '49', de: '49', italy: '39', it: '39',
    australia: '61', au: '61', japan: '81', jp: '81', india: '91', in: '91',
  };
  if (!digits) {
    const dialCode = countryDialCodes[country];
    return dialCode ? { dialCode, localNumber: trimmed } : null;
  }
  const knownCode = Object.keys(PHONE_DIAL_CODE_ALIASES).sort((a, b) => b.length - a.length).find((code) => digits.startsWith(code));
  const explicitCountryCode = Boolean(normalized.startsWith('00') || normalized.startsWith('+'));
  const dialCode = explicitCountryCode
    ? knownCode || digits.slice(0, Math.min(3, digits.length))
    : countryDialCodes[country];
  if (!dialCode) return null;
  if (!explicitCountryCode) return { dialCode, localNumber: trimmed };
  const localDigits = digits.slice(dialCode.length);
  const prefixPattern = normalized.startsWith('00') ? new RegExp(`^\\s*00\\s*\\+?\\s*${dialCode}`) : new RegExp(`^\\s*\\+\\s*${dialCode}`);
  const localNumber = trimmed.replace(prefixPattern, '').trim().replace(/^[\s().-]+/, '') || localDigits;
  return { dialCode, localNumber };
}

function isPhoneCountryField(tag: string): boolean {
  const normalized = normalizeStr(tag);
  const phone = /phone|telephone|mobile|celular|telefone|whatsapp/.test(normalized);
  const country = /country|pais|codigo|code|ddi|dial|calling|prefix/.test(normalized);
  return (phone && country) || /calling.?code|dial.?code|country.?code|phone.?country|ddi|prefixo.?telefon/.test(normalized);
}

function isPhoneCountryControl(element: HTMLElement, tag: string): boolean {
  if (isPhoneCountryField(tag)) return true;
  if (element.tagName !== 'SELECT') return false;
  let container = element.parentElement;
  for (let depth = 0; container && depth < 3 && container.tagName !== 'FORM'; depth++, container = container.parentElement) {
    if (container.querySelector('input[type="tel"],input[name*="phone" i],input[name*="mobile" i]')) return true;
  }
  return false;
}

function isLikelyPhoneNumberField(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, tag: string): boolean {
  const normalized = normalizeStr(tag);
  if (/emergency|backup|alternative|company|office|contato de emergencia|recado/.test(normalized)) return false;
  return /telefone|celular|phone|whatsapp|mobile/.test(normalized) ||
    (element instanceof HTMLInputElement && element.type === 'tel');
}

function hasPhoneCountrySelector(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  const scope: ParentNode = element.closest('form') || element.closest('fieldset, [role="group"], .form-group, .field')?.parentElement || document;
  return collectAutofillFields(scope)
    .filter((control) => control !== element)
    .some((control) => {
      const context = [control.getAttribute('name'), control.id, getFormFieldLabel(control), control.closest('label,fieldset,[role="group"],.form-group,.field')?.textContent]
        .filter(Boolean).join(' ');
      return isPhoneCountryControl(control, context);
    });
}

function getPhoneCountryTokens(phone: string, nationality = ''): string[] {
  const parts = getInternationalPhoneParts(phone, nationality);
  if (!parts) return [];
  const aliases = PHONE_DIAL_CODE_ALIASES[parts.dialCode] || [];
  return [`+${parts.dialCode}`, parts.dialCode, ...aliases];
}

/**
 * Varre o DOM da página atual e preenche automaticamente todos os campos compatíveis
 */
export function autofillCurrentPage(
  profile: CandidateProfile,
  dryRun = false,
  selectedFieldIds?: string[],
  siteFieldMappings: SiteFieldMapping[] = [],
  profileId = ''
): AutofillResult {
  const elements = collectAutofillFields();

  let totalFilled = 0;
  let fieldsDetected = 0;
  let fieldsSkippedCount = 0;
  const fieldsFilled: string[] = [];
  const fillableFields: Array<{ id: string; label: string }> = [];
  const fieldsSkipped: string[] = [];
  const unmatchedFields: string[] = [];
  const usedSavedAnswerIds: string[] = [];
  const recordFilled = (id: string, label: string) => {
    totalFilled++;
    fieldsFilled.push(label);
    fillableFields.push({ id, label });
  };

  elements.forEach((element, index) => {
    const fieldId = `field-${index}`;
    if (selectedFieldIds && !selectedFieldIds.includes(fieldId)) return;

    if (!isNativeFormField(element)) {
      const el = element;
      const fieldLabel = getFormFieldLabel(el) || el.id || 'Campo sem rÃ³tulo';
      if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-readonly') === 'true' || !isFieldVisible(el)) return;
      fieldsDetected++;

      const currentValue = getCustomComboboxValue(el);
      if (currentValue.trim()) {
        fieldsSkipped.push(fieldLabel);
        fieldsSkippedCount++;
        return;
      }

      const parentText = el.closest('[role="group"], fieldset, .form-group, .field')?.textContent?.slice(0, 150) || '';
      const tag = [
        el.getAttribute('name'), el.id, el.getAttribute('placeholder'), el.getAttribute('aria-label'),
        el.getAttribute('aria-labelledby'), el.getAttribute('autocomplete'), fieldLabel, parentText,
      ].filter(Boolean).join(' ').toLowerCase();
      const siteMapping = siteFieldMappings.find((mapping) =>
        mapping.site === window.location.hostname.toLowerCase() &&
        mapping.profileId === profileId &&
        matchesMappedField(el, mapping.selector)
      );
      const mappedValue = siteMapping ? getProfileFieldValue(profile, siteMapping.sourceKey) : '';

      let candidateValue: string | string[] = '';
      let candidateLabel = fieldLabel;
      let savedAnswerId = '';
      if (siteMapping && mappedValue.trim()) {
        candidateValue = mappedValue;
        candidateLabel = siteMapping.sourceLabel || fieldLabel;
      } else if (isPhoneCountryControl(el, tag)) {
        candidateValue = getPhoneCountryTokens(profile.personal.phone, profile.personal.nationality);
        candidateLabel = 'CÃ³digo do paÃ­s do telefone';
      } else if (/nome|full.?name|first.?name|candidat/i.test(tag) && !/empresa|company|cargo|role/i.test(tag)) {
        candidateValue = profile.personal.fullName;
        candidateLabel = 'Nome Completo';
      } else if (/e.?mail|best.?email/i.test(tag) && !/empresa|company/i.test(tag)) {
        candidateValue = profile.personal.email;
        candidateLabel = 'E-mail';
      } else if (/telefone|celular|phone|whatsapp|mobile/i.test(tag)) {
        candidateValue = profile.personal.phone;
        candidateLabel = 'Telefone / WhatsApp';
      } else if (/cidade|city|endere[cÃ§]o|localiza|address|location/i.test(tag) && !/empresa|company/i.test(tag)) {
        candidateValue = profile.personal.location;
        candidateLabel = 'LocalizaÃ§Ã£o';
      } else if (/nacionalidade|nationality|pa[iÃ­]s|country/i.test(tag) && !/empresa|company/i.test(tag)) {
        if (!isUnconfirmedDefault(profile, 'personal.nationality')) candidateValue = profile.personal.nationality;
        candidateLabel = 'Nacionalidade';
      } else if (/linkedin/i.test(tag)) {
        candidateValue = profile.personal.linkedin;
        candidateLabel = 'LinkedIn';
      } else if (/github/i.test(tag)) {
        candidateValue = profile.personal.github;
        candidateLabel = 'GitHub';
      } else if (/portf|website|homepage/i.test(tag)) {
        candidateValue = profile.personal.portfolio;
        candidateLabel = 'PortfÃ³lio / Site';
      } else if (/contract|contrato|regime|tipo.?de.?contrat/i.test(tag)) {
        if (!isUnconfirmedDefault(profile, 'salary.contractType') && !/pj.*clt|clt.*pj/i.test(profile.salary.contractType)) {
          candidateValue = profile.salary.contractType;
        }
        candidateLabel = 'Modelo de ContrataÃ§Ã£o';
      } else if (/escolaridade|grau|degree|educa[cÃ§]|forma[cÃ§][aÃ£]o/i.test(tag)) {
        candidateValue = profile.education[0]?.degree || '';
        candidateLabel = 'Grau de FormaÃ§Ã£o';
      } else if (/disponibilidade|notice.?period|aviso.?pr[eÃ©]vio|in[iÃ­]cio/i.test(tag)) {
        if (!isUnconfirmedDefault(profile, 'salary.availability')) candidateValue = profile.salary.availability;
        candidateLabel = 'Disponibilidade';
      } else if (/sal[aÃ¡]ri|pretens|desired.?salary|expected.?salary|salary/i.test(tag)) {
        candidateValue = profile.salary.desiredSalary;
        candidateLabel = 'PretensÃ£o Salarial';
      } else {
        const customField = profile.customFields.find((field) => {
          if (!field.value || isUnconfirmedDefault(profile, `customFields.${field.id}`)) return false;
          const matcher = new RegExp(`${escapeRegExp(field.key).replace(/_/g, '.*')}|${escapeRegExp(field.label)}`, 'i');
          return matcher.test(tag);
        });
        if (customField) {
          candidateValue = customField.value;
          candidateLabel = customField.label;
        } else {
          const savedAnswer = (profile.savedAnswers || []).find((answer) => {
            const question = normalizeStr(answer.question);
            return (answer.reuseOnAnySite || answer.site.toLowerCase() === window.location.hostname.toLowerCase()) &&
              question.length >= 4 && normalizeStr(tag).includes(question);
          });
          if (savedAnswer) {
            candidateValue = savedAnswer.answer;
            candidateLabel = `Resposta salva: ${savedAnswer.question}`;
            savedAnswerId = savedAnswer.id;
          }
        }
      }

      const hasCandidate = Array.isArray(candidateValue)
        ? candidateValue.some((value) => value.trim())
        : candidateValue.trim().length > 0;
      if (hasCandidate && setCustomComboboxValue(el, candidateValue, dryRun)) {
        recordFilled(fieldId, candidateLabel);
        if (!dryRun && savedAnswerId) usedSavedAnswerIds.push(savedAnswerId);
      } else {
        unmatchedFields.push(fieldLabel);
      }
      return;
    }

    const el = element;
    const input = el as HTMLInputElement;
    const fieldLabel = el.labels?.[0]?.textContent?.trim() ||
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.name ||
      el.id ||
      'Campo sem rótulo';
    const supportedInputTypes = ['text', 'email', 'tel', 'url', 'number', 'search', 'date', 'radio', 'file'];
    const isFileInput = el instanceof HTMLInputElement && el.type === 'file';
    if (
      (el instanceof HTMLInputElement && !supportedInputTypes.includes(el.type)) ||
      el.disabled ||
      ('readOnly' in el && el.readOnly) ||
      (!isFileInput && !isFieldVisible(el))
    ) {
      return;
    }
    if (el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button' && el.type !== 'reset') fieldsDetected++;

    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      const groupAlreadyAnswered = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
        .some((radio) => radio.form === el.form && radio.name === el.name && radio.checked);
      if (groupAlreadyAnswered) {
        fieldsSkipped.push(fieldLabel);
        fieldsSkippedCount++;
        return;
      }
    }

    if (el.type !== 'file') {
      const currentValue = getFieldValue(el);
      if (el instanceof HTMLSelectElement) {
        if (currentValue && currentValue !== '0' && currentValue !== '-1') {
          fieldsSkipped.push(fieldLabel);
          fieldsSkippedCount++;
          return;
        }
      } else if (currentValue.trim()) {
        fieldsSkipped.push(fieldLabel);
        fieldsSkippedCount++;
        return;
      }
    } else if (input.files?.length) {
      fieldsSkipped.push(fieldLabel);
      fieldsSkippedCount++;
      return;
    }

    // 0. Anexo automático de Currículo em PDF (input[type="file"])
    if (el.type === 'file' && profile.resumeFile) {
      const labelsText = Array.from((el as HTMLInputElement).labels || [])
        .map((label) => label.textContent || '')
        .join(' ');
      const parentText = (el.closest('.upload-zone, .dropzone, .form-group, .field, label') as HTMLElement | null)
        ?.textContent?.slice(0, 500) || '';
      const tag = [
        el.name,
        el.id,
        el.getAttribute('aria-label'),
        el.getAttribute('placeholder'),
        labelsText,
        parentText,
      ].filter(Boolean).join(' ').toLowerCase();
      const accept = (el.getAttribute('accept') || '').toLowerCase();
      const isResumeRelated =
        /curriculo|curr[ií]culo|resume|cv|upload|anexar|anexo|arquivo|document|ficheiro/i.test(tag) ||
        accept.includes('pdf');
      if (isResumeRelated) {
        if (dryRun) {
          recordFilled(fieldId, `Currículo Anexado (${profile.resumeFile.name})`);
          return;
        }
        if (attachResumeFile(el as HTMLInputElement, profile.resumeFile)) {
          recordFilled(fieldId, `Currículo Anexado (${profile.resumeFile.name})`);
          return;
        }
      }
      return;
    }
    if (el.type === 'file') return;

    // Ignora campos invisíveis, de envio ou desabilitados
    if (el.type === 'hidden' || el.type === 'submit' || el.disabled || ('readOnly' in el && (el as HTMLInputElement).readOnly)) {
      return;
    }

    // Coleta contexto semântico do campo (id, name, placeholder, label, texto próximo)
    const parentText = (el.closest('label, .form-group, .field, div') as HTMLElement | null)?.textContent?.slice(0, 150) || '';
    const labelText = el.labels?.[0]?.textContent || '';
    const tag = (
      (el.name || '') + ' ' +
      (el.id || '') + ' ' +
      (el.getAttribute('placeholder') || '') + ' ' +
      (el.getAttribute('aria-label') || '') + ' ' +
      (el.getAttribute('autocomplete') || '') + ' ' +
      labelText + ' ' +
      parentText
    ).toLowerCase();

    const siteMapping = siteFieldMappings.find((mapping) =>
      mapping.site === window.location.hostname.toLowerCase() &&
      mapping.profileId === profileId &&
      matchesMappedField(el, mapping.selector)
    );
    if (siteMapping) {
      const mappedValue = getProfileFieldValue(profile, siteMapping.sourceKey);
      if (mappedValue && setNativeValue(el, mappedValue, dryRun)) {
        recordFilled(fieldId, siteMapping.sourceLabel || fieldLabel);
        return;
      }
    }

    // 1. Nome Completo / First Name
    if (/nome|full.?name|first.?name|candidat/i.test(tag) && !/empresa|company|cargo|role/i.test(tag)) {
      if (profile.personal.fullName && setNativeValue(el, profile.personal.fullName, dryRun)) {
        recordFilled(fieldId, 'Nome Completo');
        return;
      }
    }

    // 2. E-mail
    if (/e.?mail|best.?email/i.test(tag) && !/empresa|company/i.test(tag)) {
      if (profile.personal.email && setNativeValue(el, profile.personal.email, dryRun)) {
        recordFilled(fieldId, 'E-mail');
        return;
      }
    }

    // InHire and other forms may separate the phone country code from the local number.
    const phoneCountryField = isPhoneCountryControl(el, tag);
    if (phoneCountryField) {
      const countryTokens = getPhoneCountryTokens(profile.personal.phone, profile.personal.nationality);
      if (countryTokens.length > 0) {
        const dialCode = getInternationalPhoneParts(profile.personal.phone, profile.personal.nationality)?.dialCode || '';
        const didFill = el instanceof HTMLSelectElement
          ? setSelectValue(el, countryTokens, dryRun)
          : setNativeValue(el, `+${dialCode}`, dryRun);
        if (didFill) {
          recordFilled(fieldId, 'Código do país do telefone');
          return;
        }
      }
    }

    // 3. Phone / mobile / WhatsApp
    if (isLikelyPhoneNumberField(el, tag) && !phoneCountryField) {
      const phoneParts = getInternationalPhoneParts(profile.personal.phone, profile.personal.nationality);
      const phoneValue = phoneParts && hasPhoneCountrySelector(el) ? phoneParts.localNumber : profile.personal.phone;
      if (phoneValue && setNativeValue(el, phoneValue, dryRun)) {
        recordFilled(fieldId, 'Telefone / WhatsApp');
        return;
      }
    }

    // 4. Localização / Cidade / Endereço
    if (/cidade|city|endereço|localiza|address|location/i.test(tag) && !/empresa|company/i.test(tag)) {
      if (profile.personal.location && setNativeValue(el, profile.personal.location, dryRun)) {
        recordFilled(fieldId, 'Localização');
        return;
      }
    }

    // 5. Nacionalidade / País / Country (Suporta <select> ou input de texto)
    if (!phoneCountryField && /nacionalidade|nationality|pa[ií]s|country/i.test(tag) && !/empresa|company/i.test(tag)) {
      const nat = profile.personal.nationality;
      if (!nat || isUnconfirmedDefault(profile, 'personal.nationality')) return;
      if (el.tagName === 'SELECT') {
        if (setSelectValue(el as HTMLSelectElement, nat, dryRun)) {
          recordFilled(fieldId, 'Nacionalidade');
          return;
        }
      } else {
        if (setNativeValue(el, nat, dryRun)) {
          recordFilled(fieldId, 'Nacionalidade');
          return;
        }
      }
    }

    // 6. LinkedIn
    if (/linkedin/i.test(tag)) {
      if (profile.personal.linkedin && setNativeValue(el, profile.personal.linkedin, dryRun)) {
        recordFilled(fieldId, 'LinkedIn');
        return;
      }
    }

    // 7. GitHub
    if (/github/i.test(tag)) {
      if (profile.personal.github && setNativeValue(el, profile.personal.github, dryRun)) {
        recordFilled(fieldId, 'GitHub');
        return;
      }
    }

    // 8. Portfólio / Site Pessoal
    if (/portf|site|website|homepage/i.test(tag) && !/linkedin|github/i.test(tag)) {
      if (profile.personal.portfolio && setNativeValue(el, profile.personal.portfolio, dryRun)) {
        recordFilled(fieldId, 'Portfólio / Site');
        return;
      }
    }

    // 9. Pretensão Salarial / Expectation
    if (/sal[aá]ri|pretens|desired.?salary|expected.?salary|salary(?:.?expectation)?|expectation/i.test(tag)) {
      if (profile.salary.desiredSalary && setNativeValue(el, profile.salary.desiredSalary, dryRun)) {
        recordFilled(fieldId, 'Pretensão Salarial');
        return;
      }
    }

    // 10. Tipo de Contrato (PJ / CLT / Contractor)
    if (/contract|contrato|regime|tipo.?de.?contrat/i.test(tag)) {
      const pref = (profile.salary.contractType || '').toLowerCase();
      if (!pref || isUnconfirmedDefault(profile, 'salary.contractType')) return;
      if (pref.includes('pj') && pref.includes('clt')) return;
      if (el.tagName === 'SELECT') {
        if (setSelectValue(el as HTMLSelectElement, pref, dryRun)) {
          recordFilled(fieldId, 'Modelo de Contratação');
          return;
        }
      } else if (el.type === 'radio') {
        const radioVal = ((el.value || '') + ' ' + tag).toLowerCase();
        if ((pref.includes('pj') || pref.includes('contractor')) && (radioVal.includes('pj') || radioVal.includes('contractor'))) {
          if (setRadioOrSelect(el as HTMLInputElement, true, dryRun)) {
            recordFilled(fieldId, 'Modelo de Contratação (PJ)');
            return;
          }
        } else if ((pref.includes('clt') || pref.includes('employee')) && (radioVal.includes('clt') || radioVal.includes('employee'))) {
          if (setRadioOrSelect(el as HTMLInputElement, true, dryRun)) {
            recordFilled(fieldId, 'Modelo de Contratação (CLT)');
            return;
          }
        }
      }
    }

    // 11. Escolaridade / Grau de Formação (Select ou Input)
    if (/escolaridade|grau|degree|educa[cç]|formacao|forma[cç][aã]o/i.test(tag)) {
      const degree = profile.education[0]?.degree;
      if (!degree) return;
      if (el.tagName === 'SELECT') {
        if (setSelectValue(el as HTMLSelectElement, degree, dryRun)) {
          recordFilled(fieldId, 'Grau de Formação');
          return;
        }
      } else {
        if (setNativeValue(el, degree, dryRun)) {
          recordFilled(fieldId, 'Grau de Formação');
          return;
        }
      }
    }

    // 12. Disponibilidade / Aviso Prévio
    if (/disponibilidade|notice.?period|aviso.?pr[eé]vio|inicio|in[ií]cio/i.test(tag)) {
      const avail = profile.salary.availability;
      if (!avail || isUnconfirmedDefault(profile, 'salary.availability')) return;
      if (el.tagName === 'SELECT') {
        if (setSelectValue(el as HTMLSelectElement, avail, dryRun)) {
          recordFilled(fieldId, 'Disponibilidade');
          return;
        }
      } else {
        if (setNativeValue(el, avail, dryRun)) {
          recordFilled(fieldId, 'Disponibilidade');
          return;
        }
      }
    }

    // 13. Resumo / Bio / Pitch / Summary (geralmente em TEXTAREA)
    if (/sobre|resumo|bio|pitch|summary|apresenta/i.test(tag) && el.tagName === 'TEXTAREA') {
      const summaryText = profile.summary.shortSummary || profile.summary.longSummary;
      if (summaryText && setNativeValue(el, summaryText, dryRun)) {
        recordFilled(fieldId, 'Resumo Profissional');
        return;
      }
    }

    // 14. Carta de Apresentação / Cover Letter
    if (/carta|cover.?letter|motiva/i.test(tag) && el.tagName === 'TEXTAREA') {
      const coverText = profile.summary.coverLetterSnippet || profile.summary.shortSummary;
      if (coverText && setNativeValue(el, coverText, dryRun)) {
        recordFilled(fieldId, 'Carta de Apresentação');
        return;
      }
    }

    // 15. Campos Customizados (CPF, Nível de Inglês, etc.)
    if (profile.customFields && Array.isArray(profile.customFields)) {
      for (const cf of profile.customFields) {
        if (!cf.value) continue;
        if (isUnconfirmedDefault(profile, `customFields.${cf.id}`)) continue;
        if (el instanceof HTMLInputElement && el.type === 'radio') continue;
        const regex = new RegExp(`${escapeRegExp(cf.key).replace(/_/g, '.*')}|${escapeRegExp(cf.label)}`, 'i');
        if (regex.test(tag)) {
          if (el.tagName === 'SELECT') {
            if (setSelectValue(el as HTMLSelectElement, cf.value, dryRun)) {
              recordFilled(fieldId, cf.label);
              return;
            }
          } else {
            if (setNativeValue(el, cf.value, dryRun)) {
              recordFilled(fieldId, cf.label);
              return;
            }
          }
        }
      }
    }

    for (const savedAnswer of profile.savedAnswers || []) {
      const question = normalizeStr(savedAnswer.question);
      if (!savedAnswer.reuseOnAnySite && savedAnswer.site.toLowerCase() !== window.location.hostname.toLowerCase()) continue;
      if (question.length < 4 || !normalizeStr(tag).includes(question)) continue;
      if (setNativeValue(el, savedAnswer.answer, dryRun)) {
        recordFilled(fieldId, `Resposta salva: ${savedAnswer.question}`);
        if (!dryRun) usedSavedAnswerIds.push(savedAnswer.id);
        return;
      }
    }
    unmatchedFields.push(fieldLabel);
  });

  return { totalFilled, fieldsFilled, fillableFields, fieldsSkipped: Array.from(new Set(fieldsSkipped)), fieldsSkippedCount, fieldsDetected, unmatchedFields: Array.from(new Set(unmatchedFields)), usedSavedAnswerIds };
}
