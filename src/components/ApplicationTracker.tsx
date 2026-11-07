import React, { useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarDays, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { ApplicationRecord, ApplicationStatus, CandidateProfileEntry } from '../types/profile';
import { useLocale } from '../contexts/LocaleContext';

interface Props {
  applications: ApplicationRecord[];
  profiles: CandidateProfileEntry[];
  activeProfileId: string;
  onChange: (applications: ApplicationRecord[]) => Promise<void>;
}

const STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];

export const ApplicationTracker: React.FC<Props> = ({ applications, profiles, activeProfileId, onChange }) => {
  const { t } = useLocale();
  const [isAdding, setIsAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ company: '', role: '', url: '', appliedAt: new Date().toISOString().slice(0, 10), status: 'saved' as ApplicationStatus, profileId: activeProfileId, notes: '' });

  const visibleApplications = useMemo(() => applications
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .filter((item) => `${item.company} ${item.role}`.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)), [applications, query, statusFilter]);

  const updateApplications = async (next: ApplicationRecord[]) => {
    try {
      await onChange(next);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Não foi possível salvar as candidaturas.'));
    }
  };

  const addApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.company.trim() || !draft.role.trim()) return;
    const record: ApplicationRecord = {
      ...draft,
      id: globalThis.crypto?.randomUUID?.() || `application-${Date.now()}`,
      profileName: profiles.find((profile) => profile.id === draft.profileId)?.name || '',
      company: draft.company.trim(),
      role: draft.role.trim(),
      url: draft.url.trim(),
      notes: draft.notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    await updateApplications([record, ...applications]);
    setDraft({ company: '', role: '', url: '', appliedAt: new Date().toISOString().slice(0, 10), status: 'saved', profileId: activeProfileId, notes: '' });
    setIsAdding(false);
  };

  const updateRecord = (id: string, patch: Partial<ApplicationRecord>) => {
    void updateApplications(applications.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  };

  const statusLabel: Record<ApplicationStatus, string> = {
    saved: t('Salva'), applied: t('Candidatura enviada'), interview: t('Entrevista'), offer: t('Oferta'), rejected: t('Recusada'), withdrawn: t('Retirada'),
  };

  return (
    <section className="w-full space-y-5 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-base font-semibold text-zinc-100"><BriefcaseBusiness className="h-4 w-4 text-emerald-400" />{t('Acompanhamento de candidaturas')}</h2><p className="mt-1 text-xs text-zinc-400">{t('Este histórico fica no armazenamento local da extensão e entra no backup do cofre.')}</p></div>
        <button type="button" onClick={() => setIsAdding((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"><Plus className="h-3.5 w-3.5" />{t('Adicionar candidatura')}</button>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{error}</p>}

      {isAdding && <form onSubmit={addApplication} className="grid gap-3 rounded-xl border border-emerald-800/50 bg-emerald-950/10 p-4 sm:grid-cols-2">
        <label className="space-y-1 text-[11px] text-zinc-400"><span>{t('Empresa')} *</span><input required value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100" /></label>
        <label className="space-y-1 text-[11px] text-zinc-400"><span>{t('Cargo')} *</span><input required value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100" /></label>
        <label className="space-y-1 text-[11px] text-zinc-400"><span>{t('Link da vaga')}</span><input type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100" /></label>
        <label className="space-y-1 text-[11px] text-zinc-400"><span>{t('Data')}</span><input type="date" value={draft.appliedAt} onChange={(event) => setDraft({ ...draft, appliedAt: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100" /></label>
        <label className="space-y-1 text-[11px] text-zinc-400"><span>{t('Etapa')}</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ApplicationStatus })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100">{STATUSES.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
        <label className="space-y-1 text-[11px] text-zinc-400"><span>{t('Perfil usado')}</span><select value={draft.profileId} onChange={(event) => setDraft({ ...draft, profileId: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100">{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
        <label className="space-y-1 text-[11px] text-zinc-400 sm:col-span-2"><span>{t('Notas')}</span><textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100" /></label>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setIsAdding(false)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300">{t('Cancelar')}</button><button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">{t('Salvar candidatura')}</button></div>
      </form>}

      <div className="flex flex-wrap gap-2"><label className="relative min-w-48 flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Buscar empresa ou vaga')} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-8 pr-3 text-xs text-zinc-100" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ApplicationStatus | 'all')} aria-label={t('Filtrar por etapa')} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"><option value="all">{t('Todas as etapas')}</option>{STATUSES.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></div>

      {visibleApplications.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">{applications.length ? t('Nenhuma candidatura corresponde à busca.') : t('Ainda não há candidaturas registradas.')}</div> : <ul className="space-y-2">{visibleApplications.map((item) => <li key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-semibold text-zinc-100">{item.role}</h3><p className="mt-0.5 text-xs text-zinc-400">{item.company}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500"><CalendarDays className="h-3 w-3" />{item.appliedAt} · {profiles.find((profile) => profile.id === item.profileId)?.name || item.profileName || t('Perfil removido')}</p></div><div className="flex items-center gap-2"><select value={item.status} onChange={(event) => updateRecord(item.id, { status: event.target.value as ApplicationStatus })} aria-label={t('Etapa de {role}', { role: item.role })} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-200">{STATUSES.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select>{item.url && <a href={item.url} target="_blank" rel="noreferrer" aria-label={t('Abrir link da vaga')} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><ExternalLink className="h-3.5 w-3.5" /></a>}<button type="button" onClick={() => void updateApplications(applications.filter((application) => application.id !== item.id))} aria-label={t('Excluir candidatura')} className="rounded-md p-1.5 text-zinc-500 hover:bg-rose-950/40 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div></div>
        <label className="mt-3 block space-y-1 text-[10px] text-zinc-500"><span>{t('Notas')}</span><textarea rows={1} defaultValue={item.notes} onBlur={(event) => { if (event.target.value !== item.notes) updateRecord(item.id, { notes: event.target.value }); }} className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-300" /></label>
      </li>)}</ul>}
    </section>
  );
};
