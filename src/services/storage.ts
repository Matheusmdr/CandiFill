import { CandidateProfile, FlattenedSearchItem, SavedAnswer } from '../types/profile';

export const PROFILE_SCHEMA_VERSION = 2;

export const DEFAULT_PROFILE: CandidateProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  unconfirmedDefaults: [],
  personal: {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    nationality: '',
    linkedin: '',
    github: '',
    portfolio: '',
  },
  salary: {
    currency: 'BRL (R$)',
    desiredSalary: '',
    minimumSalary: '',
    contractType: '',
    availability: '',
  },
  summary: {
    shortSummary: '',
    longSummary: '',
    coverLetterSnippet: '',
  },
  education: [],
  experience: [],
  customFields: [],
  savedAnswers: [],
  aiConfig: {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-1.5-flash',
    customPrompt: '',
  },
  theme: 'emerald',
};

const STORAGE_KEY = 'jobfill_candidate_profile_v1';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function createId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

export function normalizeCandidateProfile(value: unknown): CandidateProfile {
  const source = isRecord(value) ? value : {};
  const personal = isRecord(source.personal) ? source.personal : {};
  const salary = isRecord(source.salary) ? source.salary : {};
  const summary = isRecord(source.summary) ? source.summary : {};
  const aiConfig = isRecord(source.aiConfig) ? source.aiConfig : {};
  const allowedCategories = new Set(['Pessoal', 'Documento', 'Links', 'Diversos']);
  const customFields = Array.isArray(source.customFields)
    ? source.customFields.filter(isRecord).map((field) => ({
        id: asString(field.id, createId('cf')),
        key: asString(field.key),
        label: asString(field.label),
        value: asString(field.value),
        category: (allowedCategories.has(String(field.category)) ? field.category : 'Diversos') as CandidateProfile['customFields'][number]['category'],
      }))
    : [];
  const savedAnswers: SavedAnswer[] = Array.isArray(source.savedAnswers)
    ? source.savedAnswers.filter(isRecord).map((answer) => ({
        id: asString(answer.id, createId('answer')),
        question: asString(answer.question),
        answer: asString(answer.answer),
        site: asString(answer.site),
        reuseOnAnySite: answer.reuseOnAnySite === true,
        createdAt: asString(answer.createdAt, new Date().toISOString()),
      })).filter((answer) => answer.question.trim() && answer.answer.trim())
    : [];
  const experience = Array.isArray(source.experience) ? source.experience.filter(isRecord).map((item) => ({
    id: asString(item.id, createId('exp')),
    company: asString(item.company),
    role: asString(item.role),
    location: asString(item.location),
    startDate: asString(item.startDate),
    endDate: asString(item.endDate),
    current: item.current === true,
    description: asString(item.description),
  })) : [];
  const education = Array.isArray(source.education) ? source.education.filter(isRecord).map((item) => ({
    id: asString(item.id, createId('edu')),
    institution: asString(item.institution),
    degree: asString(item.degree),
    fieldOfStudy: asString(item.fieldOfStudy),
    startDate: asString(item.startDate),
    endDate: asString(item.endDate),
    description: asString(item.description),
  })) : [];
  const resumeFile = isRecord(source.resumeFile) && typeof source.resumeFile.base64 === 'string'
    ? {
        name: asString(source.resumeFile.name, 'curriculo.pdf'),
        size: asNumber(source.resumeFile.size),
        type: asString(source.resumeFile.type, 'application/pdf'),
        lastModified: asNumber(source.resumeFile.lastModified),
        base64: source.resumeFile.base64,
      }
    : undefined;
  const unconfirmedDefaults = Array.isArray(source.unconfirmedDefaults)
    ? source.unconfirmedDefaults.filter(isRecord).map((item) => ({
        key: asString(item.key),
        label: asString(item.label),
        value: asString(item.value),
      })).filter((item) => item.key && item.label && item.value)
    : [];

  if (Number(source.schemaVersion || 1) < PROFILE_SCHEMA_VERSION) {
    const legacyDefaults: Array<{ key: string; label: string; value: string }> = [
      { key: 'personal.nationality', label: 'Nacionalidade', value: 'Brasileira' },
      { key: 'salary.contractType', label: 'Tipo de contrato', value: 'PJ ou CLT' },
      { key: 'salary.availability', label: 'Disponibilidade', value: 'Imediata' },
    ];
    for (const item of legacyDefaults) {
      const [group, field] = item.key.split('.');
      const data = group === 'personal' ? personal : salary;
      if (data[field] === item.value && !unconfirmedDefaults.some((entry) => entry.key === item.key)) {
        unconfirmedDefaults.push(item);
      }
    }
    for (const field of customFields) {
      if (field.key === 'ingles' && field.value === 'Fluente / Avançado') {
        unconfirmedDefaults.push({ key: `customFields.${field.id}`, label: field.label, value: field.value });
      }
    }
  }

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    unconfirmedDefaults,
    personal: {
      fullName: asString(personal.fullName),
      headline: asString(personal.headline),
      email: asString(personal.email),
      phone: asString(personal.phone),
      location: asString(personal.location),
      nationality: asString(personal.nationality),
      linkedin: asString(personal.linkedin),
      github: asString(personal.github),
      portfolio: asString(personal.portfolio),
    },
    salary: {
      currency: asString(salary.currency, 'BRL (R$)'),
      desiredSalary: asString(salary.desiredSalary),
      minimumSalary: asString(salary.minimumSalary),
      contractType: asString(salary.contractType),
      availability: asString(salary.availability),
    },
    summary: {
      shortSummary: asString(summary.shortSummary),
      longSummary: asString(summary.longSummary),
      coverLetterSnippet: asString(summary.coverLetterSnippet),
    },
    education,
    experience,
    customFields,
    savedAnswers,
    aiConfig: {
      provider: aiConfig.provider === 'openai' ? 'openai' : 'gemini',
      apiKey: asString(aiConfig.apiKey),
      model: asString(aiConfig.model, 'gemini-1.5-flash'),
      customPrompt: asString(aiConfig.customPrompt),
    },
    theme: typeof source.theme === 'string' ? source.theme as CandidateProfile['theme'] : 'emerald',
    ...(resumeFile ? { resumeFile } : {}),
  };
}

export function parseCandidateProfileBackup(value: unknown): CandidateProfile {
  if (!isRecord(value) || !isRecord(value.personal) || !isRecord(value.summary)) {
    throw new Error('Backup inválido: dados pessoais ou resumo ausentes.');
  }
  if (
    !isRecord(value.salary) ||
    !isRecord(value.aiConfig) ||
    !Array.isArray(value.education) ||
    !Array.isArray(value.experience) ||
    !Array.isArray(value.customFields)
  ) {
    throw new Error('Backup inválido ou incompleto. Selecione um arquivo exportado pelo CandiFill.');
  }
  return normalizeCandidateProfile(value);
}

export function createCandidateProfileBackup(profile: CandidateProfile): CandidateProfile {
  const normalized = normalizeCandidateProfile(profile);
  return { ...normalized, aiConfig: { ...normalized.aiConfig, apiKey: '' } };
}

/**
 * Carrega o perfil do candidato usando chrome.storage.local ou fallback para localStorage
 */
export async function loadCandidateProfile(options: { allowLocalStorageFallback?: boolean; includeApiKey?: boolean } = {}): Promise<CandidateProfile> {
  const includeApiKey = options.includeApiKey ?? true;
  const withoutApiKey = (profile: CandidateProfile) => includeApiKey
    ? profile
    : { ...profile, aiConfig: { ...profile.aiConfig, apiKey: '' } };
  let profile: CandidateProfile = DEFAULT_PROFILE;

  // 1. Tenta carregar via chrome.storage.local (Extensão WebExtension)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const res = await chrome.storage.local.get(STORAGE_KEY);
      return withoutApiKey(normalizeCandidateProfile(res?.[STORAGE_KEY] ?? DEFAULT_PROFILE));
    } catch (err) {
      throw new Error(`Não foi possível carregar o perfil da extensão: ${String(err)}`);
    }
  }

  // 2. Fallback para localStorage
  if (options.allowLocalStorageFallback !== false && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        profile = normalizeCandidateProfile(JSON.parse(raw));
      }
    } catch (e) {
      throw new Error(`Não foi possível carregar o perfil local: ${String(e)}`);
    }
  }

  return withoutApiKey(profile);
}

/**
 * Salva o perfil do candidato no chrome.storage.local e propaga para todas as abas
 */
export async function saveCandidateProfile(profile: CandidateProfile): Promise<void> {
  const normalized = normalizeCandidateProfile(profile);
  // 1. Salva no chrome.storage.local se disponível
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
      return;
    } catch (err) {
      throw new Error(`Não foi possível salvar o perfil da extensão: ${String(err)}`);
    }
  }

  // 2. Fallback no localStorage
  if (typeof chrome === 'undefined' && typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: normalized }));
    } catch (e) {
      throw new Error(`Não foi possível salvar o perfil local: ${String(e)}`);
    }
  } else {
    throw new Error('Armazenamento de perfil indisponível.');
  }
}

/**
 * Registra um ouvinte de atualização em tempo real para o perfil (funciona em abas e popup)
 */
export function onProfileUpdated(callback: (profile: CandidateProfile) => void): () => void {
  // Listener do chrome.storage
  const storageListener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[STORAGE_KEY]?.newValue) {
      callback(normalizeCandidateProfile(changes[STORAGE_KEY].newValue));
    }
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(storageListener);
  }

  // Listener local fallback
  const domListener = (e: Event) => {
    const detail = (e as CustomEvent<CandidateProfile>).detail;
    if (detail) callback(normalizeCandidateProfile(detail));
  };
  window.addEventListener('profile-updated', domListener);

  return () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(storageListener);
    }
    window.removeEventListener('profile-updated', domListener);
  };
}

/**
 * Converte o perfil em uma lista linear para pesquisa instantânea no Spotlight HUD
 */
export function flattenProfileForSearch(profile: CandidateProfile): FlattenedSearchItem[] {
  const items: FlattenedSearchItem[] = [];

  // Pessoal & Contato
  if (profile.personal.fullName) {
    items.push({
      id: 'full_name',
      label: 'Nome Completo',
      category: 'Contato',
      value: profile.personal.fullName,
      keywords: ['nome', 'name', 'full name', 'candidato'],
    });
  }

  if (profile.personal.email) {
    items.push({
      id: 'email',
      label: 'E-mail Principal',
      category: 'Contato',
      value: profile.personal.email,
      keywords: ['email', 'e-mail', 'contato', 'mail'],
    });
  }

  if (profile.personal.phone) {
    items.push({
      id: 'phone',
      label: 'Telefone / WhatsApp',
      category: 'Contato',
      value: profile.personal.phone,
      keywords: ['telefone', 'celular', 'whatsapp', 'phone', 'zap', 'mobile'],
    });
  }

  if (profile.personal.location) {
    items.push({
      id: 'location',
      label: 'Localização / Endereço',
      category: 'Contato',
      value: profile.personal.location,
      keywords: ['localização', 'cidade', 'estado', 'endereço', 'address', 'city'],
    });
  }

  if (profile.personal.headline) {
    items.push({
      id: 'headline',
      label: 'Título Profissional (Headline)',
      category: 'Contato',
      value: profile.personal.headline,
      keywords: ['headline', 'título', 'cargo', 'role', 'profissão'],
    });
  }

  if (profile.personal.nationality) {
    items.push({
      id: 'nationality',
      label: 'Nacionalidade',
      category: 'Contato',
      value: profile.personal.nationality,
      keywords: ['nacionalidade', 'país', 'citizenship'],
    });
  }

  // Links & Redes
  if (profile.personal.linkedin) {
    items.push({
      id: 'linkedin',
      label: 'LinkedIn',
      category: 'Links',
      value: profile.personal.linkedin,
      keywords: ['linkedin', 'perfil', 'social', 'in'],
    });
  }

  if (profile.personal.github) {
    items.push({
      id: 'github',
      label: 'GitHub',
      category: 'Links',
      value: profile.personal.github,
      keywords: ['github', 'git', 'código', 'repositório'],
    });
  }

  if (profile.personal.portfolio) {
    items.push({
      id: 'portfolio',
      label: 'Portfólio / Site',
      category: 'Links',
      value: profile.personal.portfolio,
      keywords: ['portfólio', 'site', 'website', 'portfolio', 'link'],
    });
  }

  // Salário
  if (profile.salary.desiredSalary) {
    items.push({
      id: 'desired_salary',
      label: `Pretensão Desejada (${profile.salary.currency || 'R$'})`,
      category: 'Salário',
      value: `${profile.salary.desiredSalary}`,
      keywords: ['salário', 'pretensão', 'desired salary', 'remuneração', 'expectativa'],
    });
  }

  if (profile.salary.minimumSalary) {
    items.push({
      id: 'minimum_salary',
      label: `Pretensão Mínima (${profile.salary.currency || 'R$'})`,
      category: 'Salário',
      value: `${profile.salary.minimumSalary}`,
      keywords: ['salário mínimo', 'piso', 'minimum salary'],
    });
  }

  if (profile.salary.contractType) {
    items.push({
      id: 'contract_type',
      label: 'Modelo de Contratação',
      category: 'Salário',
      value: profile.salary.contractType,
      keywords: ['contrato', 'pj', 'clt', 'regime', 'contract', 'contractor', 'employee'],
    });
  }

  if (profile.salary.availability) {
    items.push({
      id: 'availability',
      label: 'Disponibilidade para Início',
      category: 'Salário',
      value: profile.salary.availability,
      keywords: ['disponibilidade', 'início', 'aviso prévio', 'start date', 'notice period'],
    });
  }

  // Resumos
  if (profile.summary.shortSummary) {
    items.push({
      id: 'short_summary',
      label: 'Resumo Curto / Pitch',
      category: 'Resumo',
      value: profile.summary.shortSummary,
      keywords: ['resumo', 'pitch', 'bio', 'sobre', 'apresentação curta'],
    });
  }

  if (profile.summary.longSummary) {
    items.push({
      id: 'long_summary',
      label: 'Resumo Profissional Completo',
      category: 'Resumo',
      value: profile.summary.longSummary,
      keywords: ['resumo completo', 'histórico', 'experiência geral', 'sobre mim'],
    });
  }

  if (profile.summary.coverLetterSnippet) {
    items.push({
      id: 'cover_letter',
      label: 'Carta de Apresentação (Cover Letter)',
      category: 'Resumo',
      value: profile.summary.coverLetterSnippet,
      keywords: ['carta', 'cover letter', 'motivação', 'apresentação'],
    });
  }

  // Experiências
  profile.experience.forEach((exp, idx) => {
    if (exp.company || exp.role) {
      items.push({
        id: `exp_${exp.id || idx}`,
        label: `${exp.role || 'Cargo'} na ${exp.company || 'Empresa'}`,
        category: 'Experiência',
        value: `${exp.role} @ ${exp.company} (${exp.startDate} - ${exp.current ? 'Presente' : exp.endDate})\n${exp.description}`,
        keywords: [
          'experiência',
          'cargo',
          exp.company.toLowerCase(),
          exp.role.toLowerCase(),
          'trabalho',
        ],
      });
    }
  });

  // Formações
  profile.education.forEach((edu, idx) => {
    if (edu.institution || edu.degree) {
      items.push({
        id: `edu_${edu.id || idx}`,
        label: `${edu.degree} em ${edu.fieldOfStudy} (${edu.institution})`,
        category: 'Formação',
        value: `${edu.degree} em ${edu.fieldOfStudy} - ${edu.institution} (${edu.startDate} - ${edu.endDate})`,
        keywords: [
          'faculdade',
          'graduação',
          'curso',
          edu.institution.toLowerCase(),
          edu.fieldOfStudy.toLowerCase(),
        ],
      });
    }
  });

  // Campos Customizados
  profile.customFields.forEach((cf) => {
    if (cf.value) {
      items.push({
        id: `cf_${cf.id}`,
        label: cf.label,
        category: 'Custom',
        value: cf.value,
        keywords: [cf.label.toLowerCase(), cf.key.toLowerCase(), 'custom'],
      });
    }
  });

  (profile.savedAnswers || []).forEach((answer) => {
    items.push({
      id: `answer_${answer.id}`,
      label: answer.question,
      category: 'Custom',
      value: answer.answer,
      preview: answer.site ? `Resposta salva para ${answer.site}` : 'Resposta salva de formulário',
      keywords: [answer.question.toLowerCase(), answer.site.toLowerCase(), 'resposta salva'],
    });
  });

  return items;
}
