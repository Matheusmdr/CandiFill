import React, { useMemo, useState } from 'react';
import { Check, Copy, Loader2, Pencil, Plus, Sparkles, Trash2, Users, X } from 'lucide-react';
import { CandidateProfile, CandidateProfileCollection, CandidateProfileEntry } from '../types/profile';
import { DEFAULT_PROFILE, normalizeCandidateProfile } from '../services/storage';
import { deriveProfileFromJobDescription } from '../services/ai';
import { useLocale } from '../contexts/LocaleContext';

type CreationMode = 'blank' | 'duplicate' | 'derived';

interface ProfileManagerModalProps {
  isOpen: boolean;
  collection: CandidateProfileCollection;
  onClose: () => void;
  onSave: (collection: CandidateProfileCollection) => Promise<void>;
  onOpenSettings: () => void;
}

function makeBlankProfile(source: CandidateProfile): CandidateProfile {
  const blank = normalizeCandidateProfile({
    ...source,
    personal: { ...source.personal, headline: '' },
    salary: {
      ...source.salary,
      desiredSalary: '',
      minimumSalary: '',
      contractType: '',
      availability: '',
    },
    summary: { ...DEFAULT_PROFILE.summary },
    experience: [],
    customFields: [],
    savedAnswers: [],
    unconfirmedDefaults: source.unconfirmedDefaults.filter((item) => item.key === 'personal.nationality'),
  });
  delete blank.resumeFile;
  return blank;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() || `profile-${Date.now()}`;
}

export const ProfileManagerModal: React.FC<ProfileManagerModalProps> = ({
  isOpen,
  collection,
  onClose,
  onSave,
  onOpenSettings,
}) => {
  const { t } = useLocale();
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<CreationMode>('blank');
  const [profileName, setProfileName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [description, setDescription] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [draftProfile, setDraftProfile] = useState<CandidateProfile | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValues, setRenameValues] = useState({ name: '', targetRole: '', description: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const activeEntry = useMemo(
    () => collection.profiles.find((entry) => entry.id === collection.activeProfileId) || collection.profiles[0],
    [collection]
  );

  if (!isOpen) return null;

  const resetCreation = () => {
    setCreating(false);
    setMode('blank');
    setProfileName('');
    setTargetRole('');
    setDescription('');
    setJobDescription('');
    setDraftProfile(null);
    setDraftReady(false);
    setErrorMessage('');
  };

  const chooseMode = (nextMode: CreationMode) => {
    setMode(nextMode);
    setDraftProfile(null);
    setDraftReady(false);
    setErrorMessage('');
    if (nextMode === 'derived' && !targetRole) {
      setTargetRole(activeEntry?.targetRole || activeEntry?.profile.personal.headline || '');
    }
  };

  const handleCreate = async () => {
    if (!profileName.trim()) {
      setErrorMessage(t('Dê um nome para este perfil.'));
      return;
    }
    if (mode === 'derived' && (!draftProfile || !draftReady)) {
      setErrorMessage(t('Gere e revise o rascunho antes de criar o perfil.'));
      return;
    }

    const sourceProfile = activeEntry?.profile || DEFAULT_PROFILE;
    const profile = mode === 'blank'
      ? makeBlankProfile(sourceProfile)
      : mode === 'derived' && draftProfile
        ? draftProfile
        : normalizeCandidateProfile(sourceProfile);
    if (targetRole.trim()) profile.personal.headline = targetRole.trim();
    const entry: CandidateProfileEntry = {
      id: createId(),
      name: profileName.trim(),
      targetRole: targetRole.trim() || profile.personal.headline,
      description: description.trim(),
      createdAt: new Date().toISOString(),
      profile,
    };

    setIsLoading(true);
    setErrorMessage('');
    try {
      await onSave({
        ...collection,
        activeProfileId: entry.id,
        profiles: [...collection.profiles, entry],
      });
      resetCreation();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Não foi possível criar o perfil.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!profileName.trim()) {
      setErrorMessage(t('Dê um nome para este perfil.'));
      return;
    }
    if (!targetRole.trim()) {
      setErrorMessage(t('Informe o cargo ou foco desejado.'));
      return;
    }
    if (!jobDescription.trim()) {
      setErrorMessage(t('Cole a descrição da vaga para continuar.'));
      return;
    }
    if (!activeEntry?.profile.aiConfig.apiKey.trim()) {
      setErrorMessage(t('Configure sua chave de API nas configurações para criar um perfil derivado.'));
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setDraftReady(false);
    try {
      const sourceProfile = activeEntry.profile;
      const suggestion = await deriveProfileFromJobDescription({
        provider: sourceProfile.aiConfig.provider,
        apiKey: sourceProfile.aiConfig.apiKey,
        model: sourceProfile.aiConfig.model,
        targetRole,
        jobDescription,
        profile: sourceProfile,
      });
      const experiences = new Map(sourceProfile.experience.map((experience) => [experience.id, experience]));
      const draft = normalizeCandidateProfile({
        ...sourceProfile,
        personal: { ...sourceProfile.personal, headline: suggestion.headline || targetRole },
        summary: {
          shortSummary: suggestion.shortSummary,
          longSummary: suggestion.longSummary,
          coverLetterSnippet: suggestion.coverLetterSnippet,
        },
        experience: suggestion.experienceOrder
          .map((id) => experiences.get(id))
          .filter((experience): experience is NonNullable<typeof experience> => Boolean(experience))
          .map((experience) => ({
            ...experience,
            description: suggestion.experienceDescriptions[experience.id] || experience.description,
          })),
      });
      setDraftProfile(draft);
      setDraftReady(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Não foi possível gerar o rascunho.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (profileId: string) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await onSave({ ...collection, activeProfileId: profileId });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Não foi possível trocar o perfil ativo.'));
    } finally {
      setIsLoading(false);
    }
  };

  const beginRename = (entry: CandidateProfileEntry) => {
    setRenamingId(entry.id);
    setRenameValues({ name: entry.name, targetRole: entry.targetRole, description: entry.description });
    setErrorMessage('');
  };

  const saveRename = async (entry: CandidateProfileEntry) => {
    if (!renameValues.name.trim()) {
      setErrorMessage(t('Dê um nome para este perfil.'));
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      await onSave({
        ...collection,
        profiles: collection.profiles.map((profile) => profile.id === entry.id
          ? {
              ...profile,
              name: renameValues.name.trim(),
              targetRole: renameValues.targetRole.trim(),
              description: renameValues.description.trim(),
            }
          : profile),
      });
      setRenamingId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Não foi possível salvar este perfil.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (entry: CandidateProfileEntry) => {
    if (collection.profiles.length <= 1) return;
    if (!window.confirm(t('Apagar este perfil e os dados exclusivos dele?'))) return;

    const profiles = collection.profiles.filter((profile) => profile.id !== entry.id);
    const activeProfileId = entry.id === collection.activeProfileId ? profiles[0].id : collection.activeProfileId;
    setIsLoading(true);
    setErrorMessage('');
    try {
      await onSave({ ...collection, profiles, activeProfileId });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('Não foi possível apagar este perfil.'));
    } finally {
      setIsLoading(false);
    }
  };

  const updateDraft = (updater: (profile: CandidateProfile) => CandidateProfile) => {
    setDraftProfile((previous) => previous ? updater(previous) : previous);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-manager-title"
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Users className="h-4 w-4" />
              <h2 id="profile-manager-title" className="text-sm font-semibold text-zinc-100">{t('Perfis de candidatura')}</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400">{t('Mantenha versões profissionais diferentes para cada tipo de vaga.')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Fechar')} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="space-y-2">
            {collection.profiles.map((entry) => {
              const active = entry.id === collection.activeProfileId;
              return (
                <div key={entry.id} className={`rounded-xl border p-3 ${active ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
                  {renamingId === entry.id ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={renameValues.name} onChange={(event) => setRenameValues({ ...renameValues, name: event.target.value })} aria-label={t('Nome do perfil')} className="profile-modal-input" />
                      <input value={renameValues.targetRole} onChange={(event) => setRenameValues({ ...renameValues, targetRole: event.target.value })} aria-label={t('Cargo desejado')} placeholder={t('Cargo desejado')} className="profile-modal-input" />
                      <input value={renameValues.description} onChange={(event) => setRenameValues({ ...renameValues, description: event.target.value })} aria-label={t('Descrição do foco')} placeholder={t('Descrição do foco')} className="profile-modal-input sm:col-span-2" />
                      <div className="flex gap-2 sm:col-span-2">
                        <button type="button" onClick={() => saveRename(entry)} disabled={isLoading} className="profile-modal-primary"><Check className="h-3.5 w-3.5" />{t('Salvar')}</button>
                        <button type="button" onClick={() => setRenamingId(null)} className="profile-modal-secondary">{t('Cancelar')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-zinc-100">
                            {entry.id === 'profile-default' && entry.name === 'Perfil principal' ? t('Perfil principal') : entry.name}
                          </span>
                          {active && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">{t('Ativo')}</span>}
                        </div>
                        {(entry.targetRole || entry.description) && <p className="mt-1 truncate text-xs text-zinc-400">{[entry.targetRole, entry.description].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!active && <button type="button" disabled={isLoading} onClick={() => handleActivate(entry.id)} className="profile-modal-secondary">{t('Usar')}</button>}
                        <button type="button" onClick={() => beginRename(entry)} aria-label={t('Editar perfil')} className="profile-modal-icon"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={isLoading || collection.profiles.length <= 1} onClick={() => handleDelete(entry)} aria-label={t('Apagar perfil')} className="profile-modal-icon text-rose-300 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!creating ? (
            <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-xs font-medium text-emerald-300 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5">
              <Plus className="h-4 w-4" />{t('Criar novo perfil')}
            </button>
          ) : (
            <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-100">{t('Novo perfil')}</h3>
                <button type="button" onClick={resetCreation} aria-label={t('Fechar')} className="profile-modal-icon"><X className="h-3.5 w-3.5" /></button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs text-zinc-400">
                  <span>{t('Nome do perfil')}</span>
                  <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={t('Ex.: Front-end')} className="profile-modal-input" />
                </label>
                <label className="space-y-1.5 text-xs text-zinc-400">
                  <span>{t('Cargo desejado')}</span>
                  <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder={t('Ex.: Desenvolvedor Front-end')} className="profile-modal-input" />
                </label>
                <label className="space-y-1.5 text-xs text-zinc-400 sm:col-span-2">
                  <span>{t('Descrição do foco (opcional)')}</span>
                  <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('Ex.: React, acessibilidade e performance')} className="profile-modal-input" />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => chooseMode('blank')} className={`profile-mode-button ${mode === 'blank' ? 'profile-mode-button-active' : ''}`}>
                  <Plus className="h-3.5 w-3.5" />{t('Começar vazio')}
                </button>
                <button type="button" onClick={() => chooseMode('duplicate')} className={`profile-mode-button ${mode === 'duplicate' ? 'profile-mode-button-active' : ''}`}>
                  <Copy className="h-3.5 w-3.5" />{t('Duplicar perfil ativo')}
                </button>
                <button type="button" onClick={() => chooseMode('derived')} className={`profile-mode-button ${mode === 'derived' ? 'profile-mode-button-active' : ''}`}>
                  <Sparkles className="h-3.5 w-3.5" />{t('Adaptar a uma vaga')}
                </button>
              </div>

              {mode === 'derived' && (
                <div className="space-y-3">
                  <label className="space-y-1.5 text-xs text-zinc-400">
                    <span>{t('Descrição da vaga')}</span>
                    <textarea value={jobDescription} onChange={(event) => { setJobDescription(event.target.value); setDraftReady(false); }} rows={5} placeholder={t('Cole aqui a descrição da vaga...')} className="profile-modal-input resize-y" />
                  </label>
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] leading-relaxed text-amber-100/80">{t('Ao clicar em "Gerar rascunho com IA", você autoriza o envio da descrição da vaga, cargo desejado, título profissional, resumos e experiências do perfil ativo, junto com sua chave de API, diretamente a {provider}. Contato, formação, currículo anexado e respostas salvas não são enviados. O provedor pode cobrar pelo uso.', {
                    provider: activeEntry?.profile.aiConfig.provider === 'gemini' ? 'Google Gemini' : 'OpenAI',
                  })}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleGenerateDraft} disabled={isLoading} className="profile-modal-primary">
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {isLoading ? t('Gerando rascunho...') : t('Gerar rascunho com IA')}
                    </button>
                    {!activeEntry?.profile.aiConfig.apiKey && <button type="button" onClick={onOpenSettings} className="profile-modal-secondary">{t('Abrir configurações')}</button>}
                  </div>

                  {draftReady && draftProfile && (
                    <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><Check className="h-3.5 w-3.5" />{t('Revise o rascunho antes de criar')}</div>
                      <p className="text-[11px] leading-relaxed text-zinc-400">{t('A IA pode errar. Confira os fatos e edite tudo o que precisar antes de salvar.')}</p>
                      <label className="space-y-1.5 text-xs text-zinc-400">
                        <span>{t('Título profissional')}</span>
                        <input value={draftProfile.personal.headline} onChange={(event) => updateDraft((previous) => ({ ...previous, personal: { ...previous.personal, headline: event.target.value } }))} className="profile-modal-input" />
                      </label>
                      <label className="space-y-1.5 text-xs text-zinc-400">
                        <span>{t('Resumo curto')}</span>
                        <textarea value={draftProfile.summary.shortSummary} onChange={(event) => updateDraft((previous) => ({ ...previous, summary: { ...previous.summary, shortSummary: event.target.value } }))} rows={3} className="profile-modal-input resize-y" />
                      </label>
                      <label className="space-y-1.5 text-xs text-zinc-400">
                        <span>{t('Resumo profissional')}</span>
                        <textarea value={draftProfile.summary.longSummary} onChange={(event) => updateDraft((previous) => ({ ...previous, summary: { ...previous.summary, longSummary: event.target.value } }))} rows={4} className="profile-modal-input resize-y" />
                      </label>
                      <label className="space-y-1.5 text-xs text-zinc-400">
                        <span>{t('Apresentação para a vaga')}</span>
                        <textarea value={draftProfile.summary.coverLetterSnippet} onChange={(event) => updateDraft((previous) => ({ ...previous, summary: { ...previous.summary, coverLetterSnippet: event.target.value } }))} rows={4} className="profile-modal-input resize-y" />
                      </label>
                      {draftProfile.experience.map((experience) => (
                        <label key={experience.id} className="space-y-1.5 text-xs text-zinc-400">
                          <span>{experience.role} · {experience.company}</span>
                          <textarea value={experience.description} onChange={(event) => updateDraft((previous) => ({
                            ...previous,
                            experience: previous.experience.map((item) => item.id === experience.id ? { ...item, description: event.target.value } : item),
                          }))} rows={3} className="profile-modal-input resize-y" />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {errorMessage && <p role="alert" className="text-xs text-rose-300">{t(errorMessage)}</p>}

              <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
                <button type="button" onClick={resetCreation} className="profile-modal-secondary">{t('Cancelar')}</button>
                <button type="button" onClick={handleCreate} disabled={isLoading || (mode === 'derived' && !draftReady)} className="profile-modal-primary disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{t('Criar perfil')}
                </button>
              </div>
            </div>
          )}

          {errorMessage && !creating && <p role="alert" className="text-xs text-rose-300">{t(errorMessage)}</p>}
        </div>
      </section>
    </div>
  );
};
