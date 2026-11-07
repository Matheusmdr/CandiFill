import { ApplicationRecord, ApplicationStatus, CandidateProfile, CandidateProfileCollection, CandidateProfileEntry, FlattenedSearchItem, SavedAnswer, SiteFieldMapping } from '../types/profile';

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
const PROFILE_COLLECTION_KEY = 'jobfill_profile_collection_v1';

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
        category: ['Geral', 'Pessoal', 'Motivação', 'Experiência', 'Disponibilidade', 'Diversos'].includes(asString(answer.category))
          ? asString(answer.category)
          : 'Geral',
        ...(typeof answer.lastUsedAt === 'string' ? { lastUsedAt: answer.lastUsedAt } : {}),
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

function createDefaultProfileCollection(profile: CandidateProfile = DEFAULT_PROFILE): CandidateProfileCollection {
  const normalized = normalizeCandidateProfile(profile);
  return {
    schemaVersion: 1,
    activeProfileId: 'profile-default',
    profiles: [{
      id: 'profile-default',
      name: 'Perfil principal',
      targetRole: normalized.personal.headline,
      description: '',
      createdAt: new Date().toISOString(),
      profile: normalized,
    }],
    applications: [],
    siteFieldMappings: [],
  };
}

export function normalizeCandidateProfileCollection(
  value: unknown,
  fallbackProfile: CandidateProfile = DEFAULT_PROFILE
): CandidateProfileCollection {
  if (!isRecord(value) || !Array.isArray(value.profiles)) {
    return createDefaultProfileCollection(fallbackProfile);
  }

  const ids = new Set<string>();
  const profiles: CandidateProfileEntry[] = value.profiles.filter(isRecord).flatMap((entry) => {
    if (!isRecord(entry.profile)) return [];
    let id = asString(entry.id, createId('profile'));
    if (ids.has(id)) id = createId('profile');
    ids.add(id);
    const profile = normalizeCandidateProfile(entry.profile);
    return [{
      id,
      name: asString(entry.name, 'New profile').trim() || 'New profile',
      targetRole: asString(entry.targetRole, profile.personal.headline),
      description: asString(entry.description),
      createdAt: asString(entry.createdAt, new Date().toISOString()),
      profile,
    }];
  });

  if (profiles.length === 0) return createDefaultProfileCollection(fallbackProfile);
  const requestedActiveId = asString(value.activeProfileId);
  const activeProfileId = profiles.some((entry) => entry.id === requestedActiveId)
    ? requestedActiveId
    : profiles[0].id;
  const validStatuses: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];
  const applications: ApplicationRecord[] = Array.isArray(value.applications)
    ? value.applications.filter(isRecord).flatMap((entry) => {
        const company = asString(entry.company).trim();
        const role = asString(entry.role).trim();
        if (!company || !role) return [];
        const status = validStatuses.includes(entry.status as ApplicationStatus) ? entry.status as ApplicationStatus : 'saved';
        return [{
          id: asString(entry.id, createId('application')),
          company: company.slice(0, 200),
          role: role.slice(0, 200),
          url: asString(entry.url).slice(0, 2000),
          appliedAt: asString(entry.appliedAt, new Date().toISOString().slice(0, 10)),
          status,
          profileId: asString(entry.profileId, activeProfileId),
          profileName: asString(entry.profileName, profiles.find((profile) => profile.id === entry.profileId)?.name || ''),
          notes: asString(entry.notes).slice(0, 5000),
          updatedAt: asString(entry.updatedAt, new Date().toISOString()),
        }];
      })
    : [];
  const siteFieldMappings: SiteFieldMapping[] = Array.isArray(value.siteFieldMappings)
    ? value.siteFieldMappings.filter(isRecord).flatMap((entry) => {
        if (!isRecord(entry.selector)) return [];
        const site = asString(entry.site).toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
        const sourceKey = asString(entry.sourceKey);
        if (!site || !sourceKey) return [];
        return [{
          id: asString(entry.id, createId('mapping')),
          site: site.slice(0, 253),
          profileId: profiles.some((profile) => profile.id === entry.profileId) ? asString(entry.profileId) : activeProfileId,
          selector: {
            id: asString(entry.selector.id).slice(0, 200),
            name: asString(entry.selector.name).slice(0, 200),
            label: asString(entry.selector.label).trim().slice(0, 300),
            tagName: asString(entry.selector.tagName).toLowerCase().slice(0, 20),
            inputType: asString(entry.selector.inputType).toLowerCase().slice(0, 30),
            role: asString(entry.selector.role).toLowerCase().slice(0, 40),
          },
          sourceKey: sourceKey.slice(0, 300),
          sourceLabel: asString(entry.sourceLabel).slice(0, 200),
          createdAt: asString(entry.createdAt, new Date().toISOString()),
        }];
      })
    : [];
  return { schemaVersion: 1, activeProfileId, profiles, applications, siteFieldMappings };
}

function syncSharedProfileData(
  collection: CandidateProfileCollection,
  sharedSourceId: string
): CandidateProfileCollection {
  const source = collection.profiles.find((entry) => entry.id === sharedSourceId)?.profile;
  if (!source) return collection;

  return {
    ...collection,
    profiles: collection.profiles.map((entry) => entry.id === sharedSourceId
      ? entry
      : {
          ...entry,
          profile: {
            ...entry.profile,
            personal: { ...source.personal, headline: entry.profile.personal.headline },
            education: source.education,
            unconfirmedDefaults: [
              ...entry.profile.unconfirmedDefaults.filter((item) => item.key !== 'personal.nationality'),
              ...source.unconfirmedDefaults.filter((item) => item.key === 'personal.nationality'),
            ],
            aiConfig: source.aiConfig,
            theme: source.theme,
          },
        }),
  };
}

export function createCandidateProfileCollectionBackup(collection: CandidateProfileCollection) {
  const normalized = normalizeCandidateProfileCollection(collection);
  return {
    format: 'candifill-profile-collection',
    schemaVersion: 1,
    activeProfileId: normalized.activeProfileId,
    applications: normalized.applications || [],
    siteFieldMappings: normalized.siteFieldMappings || [],
    profiles: normalized.profiles.map((entry) => ({
      ...entry,
      profile: createCandidateProfileBackup(entry.profile),
    })),
  };
}

export type CandidateProfileImport =
  | { kind: 'profile'; profile: CandidateProfile }
  | { kind: 'collection'; collection: CandidateProfileCollection };

export function parseCandidateProfileImport(value: unknown): CandidateProfileImport {
  if (isRecord(value) && value.format === 'candifill-profile-collection' && Array.isArray(value.profiles)) {
    if (!value.profiles.length || value.profiles.some((entry) => !isRecord(entry) || !isRecord(entry.profile))) {
      throw new Error('Backup de perfis inválido ou incompleto.');
    }
    return { kind: 'collection', collection: normalizeCandidateProfileCollection(value) };
  }
  return { kind: 'profile', profile: parseCandidateProfileBackup(value) };
}

export async function loadCandidateProfileCollection(
  options: { allowLocalStorageFallback?: boolean } = {}
): Promise<CandidateProfileCollection> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const result = await chrome.storage.local.get([PROFILE_COLLECTION_KEY, STORAGE_KEY]);
      if (result?.[PROFILE_COLLECTION_KEY]) {
        return normalizeCandidateProfileCollection(result[PROFILE_COLLECTION_KEY]);
      }

      const legacyProfile = normalizeCandidateProfile(result?.[STORAGE_KEY] ?? DEFAULT_PROFILE);
      const collection = createDefaultProfileCollection(legacyProfile);
      if (typeof chrome.storage.local.set === 'function') {
        await chrome.storage.local.set({
          [PROFILE_COLLECTION_KEY]: collection,
        });
        if (typeof chrome.storage.local.remove === 'function') await chrome.storage.local.remove(STORAGE_KEY);
      }
      return collection;
    } catch (err) {
      throw new Error(`Não foi possível carregar o perfil da extensão: ${String(err)}`);
    }
  }

  if (options.allowLocalStorageFallback !== false && typeof window !== 'undefined' && window.localStorage) {
    try {
      const rawCollection = localStorage.getItem(PROFILE_COLLECTION_KEY);
      if (rawCollection) return normalizeCandidateProfileCollection(JSON.parse(rawCollection));

      const rawProfile = localStorage.getItem(STORAGE_KEY);
      const legacyProfile = rawProfile ? normalizeCandidateProfile(JSON.parse(rawProfile)) : DEFAULT_PROFILE;
      const collection = createDefaultProfileCollection(legacyProfile);
      localStorage.setItem(PROFILE_COLLECTION_KEY, JSON.stringify(collection));
      localStorage.removeItem(STORAGE_KEY);
      return collection;
    } catch (err) {
      throw new Error(`Não foi possível carregar o perfil local: ${String(err)}`);
    }
  }

  return createDefaultProfileCollection();
}

export async function saveCandidateProfileCollection(
  collection: CandidateProfileCollection,
  sharedSourceId = collection.activeProfileId
): Promise<CandidateProfileCollection> {
  const normalized = syncSharedProfileData(
    normalizeCandidateProfileCollection(collection),
    sharedSourceId
  );
  const activeProfile = normalized.profiles.find((entry) => entry.id === normalized.activeProfileId);
  if (!activeProfile) throw new Error('O perfil ativo não existe.');

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({
        [PROFILE_COLLECTION_KEY]: normalized,
      });
      if (typeof chrome.storage.local.remove === 'function') await chrome.storage.local.remove(STORAGE_KEY);
      return normalized;
    } catch (err) {
      throw new Error(`Não foi possível salvar os perfis da extensão: ${String(err)}`);
    }
  }

  if (typeof chrome === 'undefined' && typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(PROFILE_COLLECTION_KEY, JSON.stringify(normalized));
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: activeProfile.profile }));
      window.dispatchEvent(new CustomEvent('profile-collection-updated', { detail: normalized }));
      return normalized;
    } catch (err) {
      throw new Error(`Não foi possível salvar os perfis locais: ${String(err)}`);
    }
  }

  throw new Error('Armazenamento de perfis indisponível.');
}

export function onCandidateProfileCollectionUpdated(
  callback: (collection: CandidateProfileCollection) => void
): () => void {
  const storageListener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[PROFILE_COLLECTION_KEY]?.newValue) {
      callback(normalizeCandidateProfileCollection(changes[PROFILE_COLLECTION_KEY].newValue));
    }
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(storageListener);
  }

  const domListener = (event: Event) => {
    const detail = (event as CustomEvent<CandidateProfileCollection>).detail;
    if (detail) callback(normalizeCandidateProfileCollection(detail));
  };
  window.addEventListener('profile-collection-updated', domListener);

  return () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(storageListener);
    }
    window.removeEventListener('profile-collection-updated', domListener);
  };
}

/**
 * Carrega o perfil do candidato usando chrome.storage.local ou fallback para localStorage
 */
export async function loadCandidateProfile(options: { allowLocalStorageFallback?: boolean; includeApiKey?: boolean } = {}): Promise<CandidateProfile> {
  const includeApiKey = options.includeApiKey ?? true;
  const collection = await loadCandidateProfileCollection(options);
  const activeProfile = collection.profiles.find((entry) => entry.id === collection.activeProfileId)?.profile || DEFAULT_PROFILE;
  return includeApiKey
    ? activeProfile
    : { ...activeProfile, aiConfig: { ...activeProfile.aiConfig, apiKey: '' } };
}

/**
 * Salva o perfil do candidato no chrome.storage.local e propaga para todas as abas
 */
export async function saveCandidateProfile(profile: CandidateProfile, profileId?: string): Promise<void> {
  const normalized = normalizeCandidateProfile(profile);
  const collection = await loadCandidateProfileCollection();
  const targetId = profileId || collection.activeProfileId;
  if (!collection.profiles.some((entry) => entry.id === targetId)) {
    throw new Error('O perfil que está sendo editado não existe mais.');
  }
  const updated: CandidateProfileCollection = {
    ...collection,
    profiles: collection.profiles.map((entry) => entry.id === targetId
      ? { ...entry, targetRole: normalized.personal.headline, profile: normalized }
      : entry),
  };
  await saveCandidateProfileCollection(updated, targetId);
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
    if (areaName !== 'local') return;
    if (changes[PROFILE_COLLECTION_KEY]?.newValue) {
      const collection = normalizeCandidateProfileCollection(changes[PROFILE_COLLECTION_KEY].newValue);
      const activeProfile = collection.profiles.find((entry) => entry.id === collection.activeProfileId)?.profile;
      if (activeProfile) callback(activeProfile);
    } else if (changes[STORAGE_KEY]?.newValue) {
      // Support updates from older extension builds during migration.
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
