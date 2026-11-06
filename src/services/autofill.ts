import { CandidateProfile, ResumeFile } from '../types/profile';

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

  // Se for um <select>, redireciona para a rotina especializada
  if (element.tagName === 'SELECT') {
    return setSelectValue(element as HTMLSelectElement, value, dryRun);
  }

  if (dryRun) return true;

  try {
    element.focus();

    // Em React 16+, inputs controlados sobrescrevem o setter do value.
    // Usamos o protótipo nativo para garantir que o React intercepte a mudança.
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
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

/**
 * Varre o DOM da página atual e preenche automaticamente todos os campos compatíveis
 */
export function autofillCurrentPage(profile: CandidateProfile, dryRun = false, selectedFieldIds?: string[]): AutofillResult {
  const elements = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select'
    )
  );

  let totalFilled = 0;
  let fieldsDetected = 0;
  let fieldsSkippedCount = 0;
  const fieldsFilled: string[] = [];
  const fillableFields: Array<{ id: string; label: string }> = [];
  const fieldsSkipped: string[] = [];
  const recordFilled = (id: string, label: string) => {
    totalFilled++;
    fieldsFilled.push(label);
    fillableFields.push({ id, label });
  };

  elements.forEach((el, index) => {
    const fieldId = `field-${index}`;
    if (selectedFieldIds && !selectedFieldIds.includes(fieldId)) return;
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

    // 3. Telefone / Celular / WhatsApp
    if (/telefone|celular|phone|whatsapp|mobile/i.test(tag)) {
      if (profile.personal.phone && setNativeValue(el, profile.personal.phone, dryRun)) {
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
    if (/nacionalidade|nationality|pa[ií]s|country/i.test(tag) && !/empresa|company/i.test(tag)) {
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
    if (/sal[aá]ri|pretens|desired.?salary|expectation/i.test(tag)) {
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
        return;
      }
    }
  });

  return { totalFilled, fieldsFilled, fillableFields, fieldsSkipped: Array.from(new Set(fieldsSkipped)), fieldsSkippedCount, fieldsDetected };
}
