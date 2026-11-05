const SENSITIVE_QUESTION_PATTERN = /\b(password|senha|cpf|ssn|social security|birth|birthday|nascimento|data de nascimento|age|idade|marital|estado civil|national origin|origem nacional|citizen|cidadan|gender|pronouns|sexo|race|ethnicity|etnia|racial|demographic|diversity|protected class|disability|deficien|veteran|military|relig|religio|sexual orientation|orienta[cç][aã]o sexual|health|sa[uú]de|visa|immigration|immigra|work authorization|authorization to work|authorized to work|right to work|direito de trabalho|sponsor|patroc[ií]nio|criminal|felony|conviction|background check|drug test|emergency contact|contato de emerg[eê]ncia|consent|consentimento|terms|termos|privacy|privacidade|salary|sal[aá]rio|remunera[cç][aã]o|pretens[aã]o)\b/i;

export type CapturedProfileFieldKey = 'fullName' | 'email' | 'phone' | 'location' | 'nationality' | 'linkedin' | 'github' | 'portfolio';

export interface CapturedProfileField {
  key: CapturedProfileFieldKey;
  label: string;
}

function normalizeQuestion(question: string): string {
  return question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getAnswerProfileField(question: string): CapturedProfileField | null {
  const normalized = normalizeQuestion(question);
  if (/\b(e-?mail|email address)\b/.test(normalized)) return { key: 'email', label: 'E-mail' };
  if (/\b(phone|telephone|mobile|celular|telefone|whatsapp)\b/.test(normalized)) return { key: 'phone', label: 'Telefone' };
  if (/\blinked\s?in\b/.test(normalized)) return { key: 'linkedin', label: 'LinkedIn' };
  if (/\bgithub\b/.test(normalized)) return { key: 'github', label: 'GitHub' };
  if (/\b(portfolio|website|personal site|site pessoal)\b/.test(normalized)) return { key: 'portfolio', label: 'Portfólio' };
  if (/\b(city|location|address|cidade|localizacao|endereco)\b/.test(normalized)) return { key: 'location', label: 'Localização' };
  if (/\b(nationality|nacionalidade|citizenship|cidadania)\b/.test(normalized)) return { key: 'nationality', label: 'Nacionalidade' };
  const isNameQuestion = /\b(full|first|last|your|preferred)\s+name\b|\b(nome completo|seu nome)\b/.test(normalized) || /^(name|nome)[?!.:\s]*$/.test(normalized);
  if (!/company|empresa|employer/.test(normalized) && isNameQuestion) {
    return { key: 'fullName', label: 'Nome completo' };
  }
  return null;
}

export function getAnswerFieldValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (element instanceof HTMLSelectElement) {
    return element.value;
  }
  return element.value;
}

export function getAnswerFieldQuestion(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const explicitLabel = element.labels?.[0]?.textContent?.trim();
  const ariaLabel = element.getAttribute('aria-label')?.trim();
  const placeholder = element.getAttribute('placeholder')?.trim();
  const groupText = element.closest('[role="group"], fieldset, .form-group, .field')?.textContent?.trim();
  return (explicitLabel || ariaLabel || placeholder || groupText || element.name || element.id || '').replace(/\s+/g, ' ').slice(0, 240);
}

export function isSafeAnswerCaptureField(element: Element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
    return false;
  }
  if (element.disabled || ('readOnly' in element && element.readOnly)) return false;
  if (element instanceof HTMLInputElement && !['text', 'email', 'tel', 'url', 'number', 'search'].includes(element.type)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

  const question = getAnswerFieldQuestion(element);
  return question.length >= 4 && !SENSITIVE_QUESTION_PATTERN.test(question);
}

export function isSensitiveAnswerQuestion(question: string): boolean {
  return SENSITIVE_QUESTION_PATTERN.test(question);
}

/**
 * Retorna só campos que estavam vazios quando a captura foi armada e ainda
 * pertencem ao formulário enviado. Isso evita sugerir valores preexistentes.
 */
export function getTrackedAnswerCaptureFields(form: ParentNode, trackedFields: WeakSet<Element>): Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
  return Array.from(form.querySelectorAll('input, textarea, select'))
    .filter((element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      trackedFields.has(element) && isSafeAnswerCaptureField(element),
    );
}

export function isReusableAnswerQuestion(question: string): boolean {
  // Experiência, formação, disponibilidade e texto de apresentação também
  // podem ser respostas úteis de candidatura. Só excluímos perguntas sensíveis.
  return question.trim().length >= 4 && !isSensitiveAnswerQuestion(question) && !getAnswerProfileField(question);
}

