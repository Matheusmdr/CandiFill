import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autofillCurrentPage } from './autofill';
import {
  createCandidateProfileBackup,
  createCandidateProfileCollectionBackup,
  DEFAULT_PROFILE,
  loadCandidateProfileCollection,
  loadCandidateProfile,
  normalizeCandidateProfile,
  normalizeCandidateProfileCollection,
  onProfileUpdated,
  parseCandidateProfileImport,
  parseCandidateProfileBackup,
  saveCandidateProfileCollection,
  saveCandidateProfile,
} from './storage';
import { getAnswerFieldQuestion, getAnswerProfileField, getTrackedAnswerCaptureFields, isReusableAnswerQuestion, isSafeAnswerCaptureField } from './answerCapture';
import { mergeSavedAnswers } from './savedAnswers';
import { createPendingAnswerReviewDraft, normalizePendingAnswerCandidates, PENDING_ANSWER_REVIEW_TTL_MS, readPendingAnswerReviewDraft } from './pendingAnswerReview';
import { deriveProfileFromJobDescription, parseResumeWithAi } from './ai';
import { isLikelyJobApplicationPage } from './pageDetection';

describe('autofillCurrentPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('preenche campos compatíveis e preserva valores que a pessoa já digitou', () => {
    document.body.innerHTML = `
      <form>
        <label for="name">Nome completo</label>
        <input id="name" name="full_name" value="Nome digitado pela pessoa">
        <label for="email">E-mail</label>
        <input id="email" name="email" value="">
        <input id="readonly" name="email" value="readonly@example.com" readonly>
        <input id="disabled" name="email" value="disabled@example.com" disabled>
        <input name="email" type="password" value="segredo">
        <input name="email" type="hidden" value="hidden@example.com">
      </form>`;
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Ana Souza', email: 'ana@example.com' },
    });

    const email = document.querySelector('#email') as HTMLInputElement;
    const form = document.querySelector('form') as HTMLFormElement;
    const submitHandler = vi.fn();
    let inputEvents = 0;
    let changeEvents = 0;
    email.addEventListener('input', () => inputEvents++);
    email.addEventListener('change', () => changeEvents++);
    form.addEventListener('submit', submitHandler);

    const result = autofillCurrentPage(profile);

    expect((document.querySelector('#name') as HTMLInputElement).value).toBe('Nome digitado pela pessoa');
    expect(email.value).toBe('ana@example.com');
    expect((document.querySelector('#readonly') as HTMLInputElement).value).toBe('readonly@example.com');
    expect((document.querySelector('#disabled') as HTMLInputElement).value).toBe('disabled@example.com');
    expect(inputEvents).toBe(1);
    expect(changeEvents).toBe(1);
    expect(submitHandler).not.toHaveBeenCalled();
    expect(result.totalFilled).toBe(1);
    expect(result.fieldsSkipped).toHaveLength(1);
  });

  it('attaches the saved resume even when the file input is hidden', () => {
    document.body.innerHTML = `
      <form>
        <label for="resume">Upload your resume (PDF)</label>
        <input id="resume" name="resume" type="file" accept="application/pdf" style="display: none">
      </form>`;

    class TestDataTransfer {
      private selectedFiles: File[] = [];
      items = { add: (file: File) => this.selectedFiles.push(file) };
      get files(): FileList {
        return this.selectedFiles as unknown as FileList;
      }
    }

    vi.stubGlobal('DataTransfer', TestDataTransfer);
    const fileInput = document.querySelector('#resume') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { configurable: true, writable: true, value: [] });
    const changeHandler = vi.fn();
    fileInput.addEventListener('change', changeHandler);

    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      resumeFile: {
        name: 'resume.pdf',
        size: 5,
        type: 'application/pdf',
        lastModified: 1,
        base64: 'JVBERi0=',
      },
    });

    const result = autofillCurrentPage(profile);

    expect(result.totalFilled).toBe(1);
    expect(result.fieldsFilled.some((field) => field.includes('resume.pdf'))).toBe(true);
    expect((fileInput.files as unknown as File[])[0]?.name).toBe('resume.pdf');
    expect(changeHandler).toHaveBeenCalledTimes(1);
  });

  it('não inventa nacionalidade, contrato, formação ou disponibilidade', () => {
    document.body.innerHTML = `
      <label for="country">Nacionalidade</label><select id="country" name="country"><option value="">Selecione</option><option value="br">Brasil</option></select>
      <label for="contract">Tipo de contrato</label><select id="contract" name="contract_type"><option value="">Selecione</option><option value="clt">CLT</option></select>
      <label for="degree">Escolaridade</label><select id="degree" name="degree"><option value="">Selecione</option><option value="bachelor">Bacharelado</option></select>
      <label for="availability">Disponibilidade</label><input id="availability" name="availability">`;

    const result = autofillCurrentPage(DEFAULT_PROFILE);

    expect(result.totalFilled).toBe(0);
    expect((document.querySelector('#country') as HTMLSelectElement).value).toBe('');
    expect((document.querySelector('#contract') as HTMLSelectElement).value).toBe('');
    expect((document.querySelector('#degree') as HTMLSelectElement).value).toBe('');
    expect((document.querySelector('#availability') as HTMLInputElement).value).toBe('');
  });

  it('escapa caracteres especiais em chaves de campos personalizados', () => {
    document.body.innerHTML = '<label for="custom">Código de acesso</label><input id="custom" name="access[code]">';
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      customFields: [{ id: 'custom-1', key: 'access[code]', label: 'Código de acesso', value: 'ABC-123', category: 'Diversos' }],
    });

    const result = autofillCurrentPage(profile);

    expect((document.querySelector('#custom') as HTMLInputElement).value).toBe('ABC-123');
    expect(result.totalFilled).toBe(1);
  });

  it('preserves an answered radio group even when the profile prefers another option', () => {
    document.body.innerHTML = `
      <form>
        <label><input type="radio" name="contract_type" value="clt" checked> CLT</label>
        <label><input type="radio" name="contract_type" value="pj"> PJ</label>
      </form>`;
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      salary: { ...DEFAULT_PROFILE.salary, contractType: 'PJ' },
    });

    const result = autofillCurrentPage(profile);

    expect((document.querySelector('input[value="clt"]') as HTMLInputElement).checked).toBe(true);
    expect((document.querySelector('input[value="pj"]') as HTMLInputElement).checked).toBe(false);
    expect(result.totalFilled).toBe(0);
  });

  it('reuses an answer only when the saved question appears on an empty field', () => {
    document.body.innerHTML = `
      <label for="motivation">Why do you want to work at Example Inc?</label>
      <textarea id="motivation"></textarea>`;
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      savedAnswers: [{
        id: 'answer-1',
        question: 'Why do you want to work at Example Inc?',
        answer: 'The product solves a problem I care about.',
        site: window.location.hostname,
        reuseOnAnySite: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    });

    const result = autofillCurrentPage(profile);

    expect((document.querySelector('#motivation') as HTMLTextAreaElement).value).toBe('The product solves a problem I care about.');
    expect(result.totalFilled).toBe(1);
  });

  it('does not reuse a site-specific answer on another domain unless the user opts in', () => {
    document.body.innerHTML = `
      <label for="motivation">Why do you want to work at Example Inc?</label>
      <textarea id="motivation"></textarea>`;
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      savedAnswers: [{
        id: 'answer-2',
        question: 'Why do you want to work at Example Inc?',
        answer: 'Site-specific answer.',
        site: 'jobs.example.com',
        reuseOnAnySite: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    });

    expect(autofillCurrentPage(profile).totalFilled).toBe(0);
    profile.savedAnswers[0].reuseOnAnySite = true;
    expect(autofillCurrentPage(profile).totalFilled).toBe(1);
  });
});

describe('profile storage and backups', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('normalizes old profiles and flags seeded answers for confirmation', () => {
    const oldProfile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      schemaVersion: 1,
      personal: { ...DEFAULT_PROFILE.personal, nationality: 'Brasileira' },
      salary: { ...DEFAULT_PROFILE.salary, contractType: 'PJ ou CLT', availability: 'Imediata' },
      customFields: [{ id: 'cf-2', key: 'ingles', label: 'Nível de Inglês', value: 'Fluente / Avançado', category: 'Diversos' }],
    });

    expect(oldProfile.unconfirmedDefaults.map((item) => item.key)).toEqual([
      'personal.nationality',
      'salary.contractType',
      'salary.availability',
      'customFields.cf-2',
    ]);
  });

  it('round-trips through local storage only when extension storage is unavailable', async () => {
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Ana Souza' },
    });

    await saveCandidateProfile(profile);

    await expect(loadCandidateProfile()).resolves.toMatchObject({ personal: { fullName: 'Ana Souza' } });
  });

  it('migrates a legacy single profile into the new collection without losing data', async () => {
    const legacyProfile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Ana Souza', headline: 'Frontend Developer' },
    });
    window.localStorage.setItem('jobfill_candidate_profile_v1', JSON.stringify(legacyProfile));

    const collection = await loadCandidateProfileCollection();

    expect(collection.profiles).toHaveLength(1);
    expect(collection.profiles[0].profile.personal.fullName).toBe('Ana Souza');
    expect(collection.profiles[0].targetRole).toBe('Frontend Developer');
    expect(window.localStorage.getItem('jobfill_candidate_profile_v1')).toBeNull();
    await expect(loadCandidateProfile()).resolves.toMatchObject({ personal: { fullName: 'Ana Souza' } });
  });

  it('switches profiles and keeps contact, education, and AI settings shared', async () => {
    const frontend = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Ana Souza', headline: 'Frontend Developer' },
    });
    const backend = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Older name', headline: 'Backend Developer' },
    });
    const collection = normalizeCandidateProfileCollection({
      schemaVersion: 1,
      activeProfileId: 'frontend',
      profiles: [
        { id: 'frontend', name: 'Frontend', profile: frontend },
        { id: 'backend', name: 'Backend', profile: backend },
      ],
    });

    await saveCandidateProfileCollection(collection);
    await saveCandidateProfile({
      ...backend,
      personal: { ...backend.personal, fullName: 'Ana Souza', headline: 'Backend Developer' },
    }, 'backend');

    const updated = await loadCandidateProfileCollection();
    expect(updated.activeProfileId).toBe('frontend');
    expect(updated.profiles.find((entry) => entry.id === 'frontend')?.profile.personal.fullName).toBe('Ana Souza');
    expect(updated.profiles.find((entry) => entry.id === 'backend')?.profile.personal.fullName).toBe('Ana Souza');
    expect(updated.profiles.find((entry) => entry.id === 'frontend')?.profile.personal.headline).toBe('Frontend Developer');
    expect(updated.profiles.find((entry) => entry.id === 'backend')?.profile.personal.headline).toBe('Backend Developer');

    await saveCandidateProfileCollection({ ...updated, activeProfileId: 'backend' });
    await expect(loadCandidateProfile()).resolves.toMatchObject({ personal: { headline: 'Backend Developer' } });
  });

  it('preserves the current profile shared data when switching with pending edits', async () => {
    const frontend = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Old name', headline: 'Frontend Developer' },
    });
    const backend = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Old name', headline: 'Backend Developer' },
    });
    const collection = normalizeCandidateProfileCollection({
      schemaVersion: 1,
      activeProfileId: 'frontend',
      profiles: [
        { id: 'frontend', name: 'Frontend', profile: frontend },
        { id: 'backend', name: 'Backend', profile: backend },
      ],
    });
    const editedFrontend = {
      ...frontend,
      personal: { ...frontend.personal, fullName: 'Updated name' },
    };

    const saved = await saveCandidateProfileCollection({
      ...collection,
      activeProfileId: 'backend',
      profiles: collection.profiles.map((entry) => entry.id === 'frontend'
        ? { ...entry, profile: editedFrontend }
        : entry),
    }, 'frontend');

    expect(saved.activeProfileId).toBe('backend');
    expect(saved.profiles.every((entry) => entry.profile.personal.fullName === 'Updated name')).toBe(true);
    expect(saved.profiles.find((entry) => entry.id === 'frontend')?.profile.personal.headline).toBe('Frontend Developer');
    expect(saved.profiles.find((entry) => entry.id === 'backend')?.profile.personal.headline).toBe('Backend Developer');
  });

  it('notifies profile listeners with the active profile when the collection changes', () => {
    let storageListener: ((changes: Record<string, { newValue?: unknown }>, areaName: string) => void) | undefined;
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          onChanged: {
            addListener: (listener: typeof storageListener) => { storageListener = listener; },
            removeListener: vi.fn(),
          },
        },
      } as unknown as typeof chrome,
    });
    const callback = vi.fn();
    const unsubscribe = onProfileUpdated(callback);
    const collection = normalizeCandidateProfileCollection({
      schemaVersion: 1,
      activeProfileId: 'backend',
      profiles: [
        { id: 'frontend', name: 'Frontend', profile: DEFAULT_PROFILE },
        {
          id: 'backend',
          name: 'Backend',
          profile: normalizeCandidateProfile({
            ...DEFAULT_PROFILE,
            personal: { ...DEFAULT_PROFILE.personal, headline: 'Backend Developer' },
          }),
        },
      ],
    });

    storageListener?.({ jobfill_profile_collection_v1: { newValue: collection } }, 'local');

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      personal: expect.objectContaining({ headline: 'Backend Developer' }),
    }));
    unsubscribe();
  });

  it('backs up every profile without copying the API key', () => {
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Ana Souza' },
      aiConfig: { ...DEFAULT_PROFILE.aiConfig, apiKey: 'private-key' },
    });
    const collection = normalizeCandidateProfileCollection({
      schemaVersion: 1,
      activeProfileId: 'one',
      profiles: [
        { id: 'one', name: 'Frontend', profile },
        { id: 'two', name: 'Backend', profile: { ...profile, personal: { ...profile.personal, headline: 'Backend Developer' } } },
      ],
    });

    const backup = createCandidateProfileCollectionBackup(collection);
    const restored = parseCandidateProfileImport(backup);

    expect(backup.profiles).toHaveLength(2);
    expect(backup.profiles[0].profile.aiConfig.apiKey).toBe('');
    expect(restored.kind).toBe('collection');
    if (restored.kind === 'collection') {
      expect(restored.collection.profiles).toHaveLength(2);
      expect(restored.collection.profiles[1].profile.personal.headline).toBe('Backend Developer');
    }
  });

  it('does not read the page localStorage when fallback is disabled', async () => {
    window.localStorage.setItem('jobfill_candidate_profile_v1', JSON.stringify({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Site data' },
    }));

    await expect(loadCandidateProfile({ allowLocalStorageFallback: false })).resolves.toMatchObject({
      personal: { fullName: '' },
    });
  });

  it('does not fall back to page localStorage when extension storage fails', async () => {
    window.localStorage.setItem('jobfill_candidate_profile_v1', JSON.stringify({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, fullName: 'Site data' },
    }));
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { storage: { local: { get: vi.fn().mockRejectedValue(new Error('unavailable')) } } },
    });

    await expect(loadCandidateProfile()).rejects.toThrow(/perfil da extensão/);
  });

  it('reports extension storage write failures instead of showing a false success', async () => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({
              jobfill_profile_collection_v1: {
                schemaVersion: 1,
                activeProfileId: 'profile-default',
                profiles: [{ id: 'profile-default', name: 'Default profile', profile: DEFAULT_PROFILE }],
              },
            }),
            set: vi.fn().mockRejectedValue(new Error('quota')),
          },
        },
      },
    });

    await expect(saveCandidateProfile(DEFAULT_PROFILE)).rejects.toThrow(/Não foi possível salvar/);
    expect(window.localStorage.getItem('jobfill_candidate_profile_v1')).toBeNull();
  });

  it('can load profile data without exposing the API key to content scripts', async () => {
    window.localStorage.setItem('jobfill_candidate_profile_v1', JSON.stringify({
      ...DEFAULT_PROFILE,
      aiConfig: { ...DEFAULT_PROFILE.aiConfig, apiKey: 'secret-key' },
    }));

    await expect(loadCandidateProfile({ includeApiKey: false })).resolves.toMatchObject({
      aiConfig: { apiKey: '' },
    });
  });

  it('strips the API key from profiles loaded through extension storage for content scripts', async () => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({
              jobfill_candidate_profile_v1: {
                ...DEFAULT_PROFILE,
                aiConfig: { ...DEFAULT_PROFILE.aiConfig, apiKey: 'extension-secret' },
              },
            }),
          },
        },
      },
    });

    await expect(loadCandidateProfile({ includeApiKey: false })).resolves.toMatchObject({
      aiConfig: { apiKey: '' },
    });
  });

  it('exports without the API key and rejects incomplete backups', () => {
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      aiConfig: { ...DEFAULT_PROFILE.aiConfig, apiKey: 'secret-key' },
    });

    expect(createCandidateProfileBackup(profile).aiConfig.apiKey).toBe('');
    expect(() => parseCandidateProfileBackup({ personal: {}, summary: {} })).toThrow(/Backup inválido/);
  });
});

describe('answer capture guardrails', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('accepts reusable open questions but excludes personal profile and sensitive fields', () => {
    document.body.innerHTML = `
      <label for="why">Por que você quer trabalhar nesta empresa?</label><textarea id="why"></textarea>
      <label for="cpf">CPF</label><input id="cpf">
      <label for="age">Age</label><input id="age">
      <label for="name">Nome completo</label><input id="name">`;
    const why = document.querySelector('#why') as HTMLTextAreaElement;
    const cpf = document.querySelector('#cpf') as HTMLInputElement;
    const age = document.querySelector('#age') as HTMLInputElement;
    const name = document.querySelector('#name') as HTMLInputElement;

    expect(getAnswerFieldQuestion(why)).toContain('Por que');
    expect(isSafeAnswerCaptureField(why)).toBe(true);
    expect(isReusableAnswerQuestion(getAnswerFieldQuestion(why))).toBe(true);
    expect(isSafeAnswerCaptureField(cpf)).toBe(false);
    expect(isSafeAnswerCaptureField(age)).toBe(false);
    expect(isReusableAnswerQuestion(getAnswerFieldQuestion(name))).toBe(false);
    expect(getAnswerProfileField('E-mail profissional')).toEqual({ key: 'email', label: 'E-mail' });
    expect(getAnswerProfileField('Nome completo')).toEqual({ key: 'fullName', label: 'Nome completo' });
  });

  it('collects newly answered safe fields from the submitted form only', () => {
    document.body.innerHTML = `
      <form>
        <label for="why">Por que você quer trabalhar nesta empresa?</label><textarea id="why">Resposta digitada</textarea>
        <label for="cpf">CPF</label><input id="cpf" value="12345678900">
        <label for="untouched">Conte sobre você</label><textarea id="untouched"></textarea>
      </form>`;
    const form = document.querySelector('form') as HTMLFormElement;
    const why = document.querySelector('#why') as HTMLTextAreaElement;
    const cpf = document.querySelector('#cpf') as HTMLInputElement;
    const untouched = document.querySelector('#untouched') as HTMLTextAreaElement;
    const trackedFields = new WeakSet<Element>([why, cpf, untouched]);

    expect(getTrackedAnswerCaptureFields(form, trackedFields)).toEqual([why, untouched]);
  });

  it('allows reusable answers about experience, education and cover letters', () => {
    expect(isReusableAnswerQuestion('Describe your experience with React')).toBe(true);
    expect(isReusableAnswerQuestion('Conte sobre sua formação acadêmica')).toBe(true);
    expect(isReusableAnswerQuestion('Why did you write this cover letter?')).toBe(true);
    expect(isReusableAnswerQuestion('What is your expected salary?')).toBe(false);
  });

  it('recognizes application context without arming passive capture on unrelated pages', () => {
    expect(isLikelyJobApplicationPage('Careers — Software Engineer application')).toBe(true);
    expect(isLikelyJobApplicationPage('Search — latest news and articles')).toBe(false);
  });

  it('keeps valid pending suggestions only for the same site and expires them', () => {
    const now = Date.now();
    const candidates = [
      { id: 'answer-1', question: 'Describe your experience with React', answer: 'Five years', site: 'jobs.example.com', createdAt: new Date(now).toISOString() },
      { id: 'answer-2', question: 'What is your salary?', answer: '$100k', site: 'jobs.example.com', createdAt: new Date(now).toISOString() },
      { id: 'answer-3', question: 'Why this company?', answer: 'A good fit', site: 'other.example.com', createdAt: new Date(now).toISOString() },
    ];

    const draft = createPendingAnswerReviewDraft(candidates, 'jobs.example.com', now);

    expect(draft?.candidates.map((candidate) => candidate.id)).toEqual(['answer-1']);
    expect(draft?.expiresAt).toBe(now + PENDING_ANSWER_REVIEW_TTL_MS);
    expect(readPendingAnswerReviewDraft(draft, 'jobs.example.com', now + 1000)?.candidates).toHaveLength(1);
    expect(readPendingAnswerReviewDraft(draft, 'jobs.example.com', now + PENDING_ANSWER_REVIEW_TTL_MS)).toBeNull();
    expect(normalizePendingAnswerCandidates(candidates, 'other.example.com').map((candidate) => candidate.id)).toEqual(['answer-3']);
  });

  it('updates the same saved question on one site without merging answers across sites', () => {
    const existing = [
      { id: '1', question: 'Why this company?', answer: 'Old answer', site: 'jobs.example.com', reuseOnAnySite: false, createdAt: '2026-01-01' },
      { id: '2', question: 'Why this company?', answer: 'Other answer', site: 'other.example.com', reuseOnAnySite: false, createdAt: '2026-01-01' },
    ];
    const updated = { id: '3', question: ' Why this company? ', answer: 'Updated answer', site: 'jobs.example.com', reuseOnAnySite: false, createdAt: '2026-02-01' };

    const result = mergeSavedAnswers(existing, [updated]);

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.site === 'jobs.example.com')?.answer).toBe('Updated answer');
    expect(result.find((item) => item.site === 'other.example.com')?.answer).toBe('Other answer');
  });
});

describe('resume AI response validation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects a response that is not a JSON profile object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'null' }] } }] }),
    }));

    await expect(parseResumeWithAi({
      provider: 'gemini',
      apiKey: 'test-key',
      resumeText: 'resume text',
    })).rejects.toThrow(/perfil JSON inválido/);
  });

  it('normalizes uncertain categories and leaves absent facts empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          personal: { fullName: 'Ana Souza' },
          customFields: [{ id: 'skill-1', key: 'skills', label: 'Habilidades', value: 'TypeScript', category: 'Habilidades Técnicas' }],
        }) }] } }],
      }),
    }));

    const profile = await parseResumeWithAi({ provider: 'gemini', apiKey: 'test-key', resumeText: 'Ana Souza, engenheira de software.' });

    expect(profile.personal.nationality).toBe('');
    expect(profile.salary.availability).toBe('');
    expect(profile.customFields[0].category).toBe('Diversos');
  });

  it('derives a reviewed profile draft without sending contact data or accepting invented experience IDs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          headline: 'Frontend Developer',
          shortSummary: 'Summary based on source facts.',
          longSummary: 'Long summary based on source facts.',
          coverLetterSnippet: 'Intro based on source facts.',
          experienceOrder: ['experience-1', 'invented-experience'],
          experienceDescriptions: [
            { id: 'experience-1', description: 'Existing work rewritten for relevance.' },
            { id: 'invented-experience', description: 'Invented experience.' },
          ],
        }) } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const profile = normalizeCandidateProfile({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, email: 'ana@example.com', headline: 'Software Developer' },
      experience: [{
        id: 'experience-1',
        company: 'Example Co',
        role: 'Software Developer',
        location: 'Remote',
        startDate: '2022',
        endDate: '2025',
        current: false,
        description: 'Built existing web applications.',
      }],
    });

    const suggestion = await deriveProfileFromJobDescription({
      provider: 'openai',
      apiKey: 'private-api-key',
      model: 'gpt-4o-mini',
      targetRole: 'Frontend Developer',
      jobDescription: 'We need a frontend engineer.',
      profile,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const sentUserContext = requestBody.messages[1].content as string;
    expect(sentUserContext).toContain('We need a frontend engineer.');
    expect(sentUserContext).toContain('Built existing web applications.');
    expect(sentUserContext).not.toContain('ana@example.com');
    expect(sentUserContext).not.toContain('private-api-key');
    expect(suggestion.experienceOrder).toEqual(['experience-1']);
    expect(suggestion.experienceDescriptions).toEqual({ 'experience-1': 'Existing work rewritten for relevance.' });
  });
});
