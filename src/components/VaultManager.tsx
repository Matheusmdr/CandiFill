import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  FileText,
  Briefcase,
  Tag,
  Settings,
  Save,
  Trash2,
  Keyboard,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  FileUp,
  Zap,
  ExternalLink,
  Users,
  ClipboardList,
} from 'lucide-react';
import { ApplicationListUpdater, CandidateProfile, CandidateProfileCollection, ExperienceItem, EducationItem } from '../types/profile';
import { createCandidateProfileCollectionBackup } from '../services/storage';
import { CustomFieldsEditor } from './CustomFieldsEditor';
import { AiEnhancerModal } from './AiEnhancerModal';
import { CvImporterModal } from './CvImporterModal';
import { useLocale } from '../contexts/LocaleContext';
import { ProfileManagerModal } from './ProfileManagerModal';
import { AvailableAiModel, listAvailableAiModels, testAiModel } from '../services/aiModels';
import { getFirefoxDataConsentErrorMessage } from '../services/firefoxDataConsent';
import { ApplicationTracker } from './ApplicationTracker';
import { PersonalTab } from './vault/PersonalTab';
import { SummariesTab } from './vault/SummariesTab';
import { ExperienceTab } from './vault/ExperienceTab';
import { SettingsTab } from './vault/SettingsTab';
import { VaultManagerTabsContextValue, VaultManagerTabsProvider } from './vault/VaultManagerTabsContext';

interface VaultManagerProps {
  profile: CandidateProfile;
  profileId: string;
  profileCollection: CandidateProfileCollection;
  onSave: (updatedProfile: CandidateProfile, profileId?: string) => Promise<void>;
  onSaveProfileCollection: (collection: CandidateProfileCollection, sharedSourceId?: string) => Promise<void>;
  onUpdateApplications: (update: ApplicationListUpdater) => Promise<void>;
  onImportProfileCollection: (collection: CandidateProfileCollection) => Promise<void>;
  onOpenSpotlight?: () => void;
  onAutofillPage?: () => void;
}

type TabType = 'personal' | 'summaries' | 'experience' | 'applications' | 'custom' | 'settings';

export const VaultManager: React.FC<VaultManagerProps> = ({
  profile,
  profileId,
  profileCollection,
  onSave,
  onSaveProfileCollection,
  onUpdateApplications,
  onImportProfileCollection,
  onOpenSpotlight,
  onAutofillPage,
}) => {
  const { locale, setLocale, t } = useLocale();
  const [formData, setFormData] = useState<CandidateProfile>(profile);
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);
  const [availableAiModels, setAvailableAiModels] = useState<AvailableAiModel[]>([]);
  const [modelsLoadedForProvider, setModelsLoadedForProvider] = useState<'gemini' | 'openai' | null>(null);
  const [isLoadingAiModels, setIsLoadingAiModels] = useState(false);
  const [isTestingAiModel, setIsTestingAiModel] = useState(false);
  const [aiModelStatus, setAiModelStatus] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const aiModelRequestId = useRef(0);

  const [isResumeDragging, setIsResumeDragging] = useState(false);

  const processResumeFileObject = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert(t('Por favor, selecione um arquivo em formato PDF.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        const updated: CandidateProfile = {
          ...formData,
          resumeFile: {
            name: file.name,
            size: file.size,
            type: file.type || 'application/pdf',
            lastModified: file.lastModified,
            base64,
          },
        };
        setFormData(updated);
        onSave(updated, profileId);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResumeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processResumeFileObject(file);
    }
    // Reseta para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleSelectResumeClick = () => {
    const isPopup = document.body.classList.contains('is-popup') || window.innerWidth <= 800;
    if (isPopup && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html?view=tab') });
      return;
    }
    resumeInputRef.current?.click();
  };

  const handleRemoveResume = () => {
    const updated = { ...formData };
    delete updated.resumeFile;
    setFormData(updated);
    onSave(updated, profileId);
  };

  const handleDownloadResume = () => {
    if (!formData.resumeFile) return;
    try {
      const byteCharacters = atob(formData.resumeFile.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: formData.resumeFile.type || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = formData.resumeFile.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Erro ao baixar currículo:', err);
    }
  };

  const [cvImporterOpen, setCvImporterOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('modal') === 'import-cv';
    }
    return false;
  });

  const handleOpenCvImporter = () => {
    const isPopup = document.body.classList.contains('is-popup') || window.innerWidth <= 800;
    if (isPopup && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html?view=tab&modal=import-cv') });
    } else {
      setCvImporterOpen(true);
    }
  };

  // Sincroniza estado local sempre que a prop profile externa for atualizada
  useEffect(() => {
    if (JSON.stringify(profile) !== JSON.stringify(formData)) {
      setFormData(profile);
    }
  }, [profile]);

  // Debounced auto-save: sincroniza instantaneamente qualquer edição
  const isFirstMount = useRef(true);
  const lastProfileId = useRef(profileId);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (lastProfileId.current !== profileId) {
      lastProfileId.current = profileId;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        await onSave(formData, profileId);
        setSaveError(null);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Falha ao salvar alterações.');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData, profileId]);
  const handleExportBackup = () => {
    const backup = createCandidateProfileCollectionBackup(profileCollection);
    const dataUrl = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataUrl);
    downloadAnchor.setAttribute('download', `candifill-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
  };

  const handleImportProfile = async (newProfile: CandidateProfile) => {
    setFormData(newProfile);
    try {
      await onSave(newProfile, profileId);
      setSaveError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      setSaveSuccess(false);
      setSaveError(error instanceof Error ? error.message : 'Falha ao importar e salvar o perfil.');
    }
  };

  const resolveUnconfirmedDefault = (key: string, keepValue: boolean) => {
    setFormData((previous) => {
      const next = { ...previous, unconfirmedDefaults: previous.unconfirmedDefaults.filter((item) => item.key !== key) };
      if (keepValue) return next;
      if (key === 'personal.nationality') {
        next.personal = { ...next.personal, nationality: '' };
      } else if (key === 'salary.contractType') {
        next.salary = { ...next.salary, contractType: '' };
      } else if (key === 'salary.availability') {
        next.salary = { ...next.salary, availability: '' };
      } else if (key.startsWith('customFields.')) {
        const id = key.slice('customFields.'.length);
        next.customFields = next.customFields.map((field) => field.id === id ? { ...field, value: '' } : field);
      }
      return next;
    });
  };

  // Estado do Modal de IA
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTargetField, setAiTargetField] = useState<{
    key: 'shortSummary' | 'longSummary' | 'coverLetterSnippet';
    label: string;
    text: string;
  } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData, profileId);
      setSaveError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      setSaveSuccess(false);
      setSaveError(error instanceof Error ? error.message : 'Falha ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchProfile = async (nextProfileId: string) => {
    if (nextProfileId === profileId) return;
    setIsSaving(true);
    try {
      const updatedCollection: CandidateProfileCollection = {
        ...profileCollection,
        activeProfileId: nextProfileId,
        profiles: profileCollection.profiles.map((entry) => entry.id === profileId
          ? { ...entry, targetRole: formData.personal.headline, profile: formData }
          : entry),
      };
      await onSaveProfileCollection(updatedCollection, profileId);
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível trocar o perfil ativo.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    aiModelRequestId.current += 1;
    setAvailableAiModels([]);
    setModelsLoadedForProvider(null);
    setIsLoadingAiModels(false);
    setIsTestingAiModel(false);
    setAiModelStatus(null);
  }, [formData.aiConfig.provider, formData.aiConfig.apiKey]);

  const getAiModelErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : '';
    const consentMessage = getFirefoxDataConsentErrorMessage(message, t);
    if (consentMessage) return consentMessage;
    if (message === 'API_KEY_REQUIRED') return t('Informe a chave de API antes de buscar modelos.');
    if (message === 'MODEL_REQUIRED') return t('Selecione um modelo antes de testar.');
    if (message.endsWith(':EMPTY_MODEL_RESPONSE')) return t('O modelo respondeu sem texto. Verifique se ele aceita geração de texto.');
    if (message.includes(':API_KEY_OR_ACCESS:401') || message.includes(':API_KEY_OR_ACCESS:403')) {
      return t('Chave inválida ou sem acesso aos modelos deste provedor.');
    }
    if (message.includes(':RATE_LIMIT:429')) return t('O provedor limitou as solicitações. Aguarde e tente novamente.');
    if (message.includes(':MODEL_REQUEST_FAILED:')) return t('O provedor não conseguiu concluir a solicitação. Confira a chave e tente novamente.');
    return t('Não foi possível conectar ao provedor. Confira a conexão e as permissões de rede.');
  };

  const handleLoadAiModels = async () => {
    const requestId = ++aiModelRequestId.current;
    const { provider, apiKey } = formData.aiConfig;
    setIsLoadingAiModels(true);
    setAiModelStatus({ message: t('Buscando modelos disponíveis para esta chave...'), type: 'info' });
    try {
      const models = await listAvailableAiModels(provider, apiKey);
      if (requestId !== aiModelRequestId.current) return;
      setAvailableAiModels(models);
      setModelsLoadedForProvider(provider);
      setAiModelStatus({
        message: models.length
          ? t('Modelos compatíveis carregados. A lista reflete o acesso desta chave.')
          : t('Nenhum modelo compatível com geração de texto foi encontrado para esta chave.'),
        type: models.length ? 'success' : 'info',
      });
    } catch (error) {
      if (requestId !== aiModelRequestId.current) return;
      setAvailableAiModels([]);
      setModelsLoadedForProvider(null);
      setAiModelStatus({ message: getAiModelErrorMessage(error), type: 'error' });
    } finally {
      if (requestId === aiModelRequestId.current) setIsLoadingAiModels(false);
    }
  };

  const handleTestAiModel = async () => {
    const requestId = ++aiModelRequestId.current;
    const { provider, apiKey, model } = formData.aiConfig;
    setIsTestingAiModel(true);
    setAiModelStatus({ message: t('Testando o modelo com uma solicitação curta...'), type: 'info' });
    try {
      await testAiModel(provider, apiKey, model);
      if (requestId !== aiModelRequestId.current) return;
      setAiModelStatus({ message: t('Modelo compatível e funcionando com esta chave.'), type: 'success' });
    } catch (error) {
      if (requestId !== aiModelRequestId.current) return;
      setAiModelStatus({ message: getAiModelErrorMessage(error), type: 'error' });
    } finally {
      if (requestId === aiModelRequestId.current) setIsTestingAiModel(false);
    }
  };

  const openAiEnhancer = (
    key: 'shortSummary' | 'longSummary' | 'coverLetterSnippet',
    label: string,
    text: string
  ) => {
    setAiTargetField({ key, label, text });
    setAiModalOpen(true);
  };

  const handleApplyAiEnhancement = (enhancedText: string) => {
    if (!aiTargetField) return;
    setFormData((prev) => ({
      ...prev,
      summary: {
        ...prev.summary,
        [aiTargetField.key]: enhancedText,
      },
    }));
  };

  // Atalhos de teclado no app (Ctrl+S para salvar, Alt+Shift+V para HUD, Ctrl+Shift+. para autofill)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Salvar: Ctrl+S ou Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      // Abrir HUD: Alt+Shift+V ou Ctrl+Shift+V
      if (((e.altKey && e.shiftKey) || (e.ctrlKey && e.shiftKey)) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (onOpenSpotlight) onOpenSpotlight();
      }
      // Autofill: Ctrl+Shift+. (Command+Shift+. no macOS)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Period') {
        e.preventDefault();
        if (onAutofillPage) onAutofillPage();
      }
      // Fechar modal de IA com Escape
      if (e.key === 'Escape' && aiModalOpen) {
        setAiModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, aiModalOpen, onOpenSpotlight, onAutofillPage]);

  // Experiências
  const handleAddExperience = () => {
    const newExp: ExperienceItem = {
      id: `exp-${Date.now()}`,
      company: '',
      role: '',
      location: 'Remoto',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
    };
    setFormData((prev) => ({
      ...prev,
      experience: [newExp, ...prev.experience],
    }));
  };

  const handleRemoveExperience = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }));
  };

  // Formação
  const handleAddEducation = () => {
    const newEdu: EducationItem = {
      id: `edu-${Date.now()}`,
      institution: '',
      degree: 'Bacharelado',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
    };
    setFormData((prev) => ({
      ...prev,
      education: [newEdu, ...prev.education],
    }));
  };

  const handleRemoveEducation = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }));
  };

  const activeEntry = profileCollection.profiles.find((entry) => entry.id === profileId);
  const setupItems = [
    { label: t('Adicione seu nome e e-mail'), done: Boolean(formData.personal.fullName.trim() && formData.personal.email.trim()), tab: 'personal' as TabType },
    { label: t('Escreva um resumo profissional'), done: Boolean(formData.summary.shortSummary.trim() || formData.summary.longSummary.trim()), tab: 'summaries' as TabType },
    { label: t('Cadastre ao menos uma experiência'), done: formData.experience.some((item) => item.role.trim() || item.company.trim()), tab: 'experience' as TabType },
    { label: t('Anexe seu currículo em PDF'), done: Boolean(formData.resumeFile), tab: 'personal' as TabType },
  ];
  const setupDone = setupItems.filter((item) => item.done).length;
  const vacancyGaps = [
    !formData.personal.fullName.trim() && t('Nome completo'),
    !formData.personal.email.trim() && t('E-mail'),
    !formData.summary.shortSummary.trim() && !formData.summary.longSummary.trim() && t('Resumo profissional'),
    formData.experience.length === 0 && t('Experiência profissional'),
    !formData.resumeFile && t('Currículo em PDF'),
  ].filter((item): item is string => Boolean(item));
  const parseYearMonth = (value: string): number | null => {
    const match = value.trim().match(/^(\d{4})(?:[-/](\d{1,2}))?/);
    return match ? Number(match[1]) * 12 + Number(match[2] || 1) : null;
  };
  const parseSalaryAmount = (value: string): number | null => {
    const amount = Number(value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  };
  const profileWarnings = [
    formData.personal.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personal.email.trim()) ? t('O e-mail parece estar incompleto.') : '',
    formData.experience.some((item) => Boolean(item.company.trim() || item.role.trim()) && (!item.company.trim() || !item.role.trim())) ? t('Há uma experiência sem empresa ou cargo.') : '',
    formData.experience.some((item) => {
      const start = parseYearMonth(item.startDate);
      const end = item.current ? null : parseYearMonth(item.endDate);
      return start !== null && end !== null && end < start;
    }) ? t('Uma experiência termina antes da data de início.') : '',
    (() => {
      const minimum = parseSalaryAmount(formData.salary.minimumSalary);
      const desired = parseSalaryAmount(formData.salary.desiredSalary);
      return minimum !== null && desired !== null && minimum > desired ? t('O salário mínimo está acima da pretensão salarial.') : '';
    })(),
  ].filter(Boolean);

  const vaultTabsContextValue: VaultManagerTabsContextValue = {
    activeTab,
    formData,
    setFormData,
    t,
    locale,
    setLocale,
    profileId,
    onSave,
    resolveUnconfirmedDefault,
    resumeInputRef,
    processResumeFileObject,
    handleResumeFileUpload,
    handleSelectResumeClick,
    handleRemoveResume,
    handleDownloadResume,
    isResumeDragging,
    setIsResumeDragging,
    openAiEnhancer,
    handleAddExperience,
    handleRemoveExperience,
    handleAddEducation,
    handleRemoveEducation,
    availableAiModels,
    modelsLoadedForProvider,
    isLoadingAiModels,
    isTestingAiModel,
    aiModelStatus,
    setAiModelStatus,
    handleLoadAiModels,
    handleTestAiModel,
    showApiKey,
    setShowApiKey,
    handleExportBackup,
    handleOpenCvImporter,
  };

  return (
    <div className="w-full h-full min-h-0 min-w-0 flex flex-col bg-app-ambient text-zinc-100 overflow-hidden">
      {/* Top Bar / App Header */}
      <div className="app-header px-3.5 py-2.5 sm:px-5 sm:py-3 header-glass flex items-center justify-between shrink-0 select-none">
        <div className="app-header-brand flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 pointer-events-none">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="app-header-copy truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-100 truncate pointer-events-none">CandiFill</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded-full pointer-events-none">
                {t("Vault")}
              </span>
            </div>
            <p className="app-header-status text-[10px] text-zinc-400 flex items-center gap-1.5 leading-tight pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-emerald-400/90 font-mono">{t("Sincronizado")}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onAutofillPage && (
            <button
              onClick={onAutofillPage}
              title={t("Preencher formulário na aba ativa (Ctrl+Shift+.)")}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{t("Preencher")}</span>
              <kbd className="hidden lg:inline-block font-mono text-[9px] text-emerald-950 bg-emerald-400/80 px-1 rounded">
                Ctrl+Shift+.
              </kbd>
            </button>
          )}

          {onOpenSpotlight && (
            <button
              onClick={onOpenSpotlight}
              title={t("Abrir Spotlight HUD (Alt+Shift+V)")}
              className="popup-hide-narrow px-2.5 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{t("Spotlight")}</span>
            </button>
          )}

          <button
            onClick={handleOpenCvImporter}
            title={t("Importar dados de currículo em PDF com IA ou restaurar backup")}
            className="popup-hide-narrow px-2.5 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition-colors"
          >
            <FileUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">{t("Importar CV")}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            title={saveError ? t(saveError) : `${t('Salvar alterações no cofre:')} Ctrl+S`}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            {saveSuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">{t("Salvo!")}</span>
              </>
            ) : saveError ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline text-rose-300">{t("Falha")}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">{t("Salvar")}</span>
              </>
            )}
          </button>

          {typeof chrome !== 'undefined' && (
            <button
              onClick={() => {
                if (chrome.tabs?.create) {
                  chrome.tabs.create({ url: chrome.runtime.getURL('index.html?view=tab') });
                } else if (chrome.runtime?.openOptionsPage) {
                  chrome.runtime.openOptionsPage();
                } else {
                  window.open('index.html?view=tab', '_blank');
                }
              }}
              title={t("Abrir Cofre em Aba Cheia")}
              className="p-1.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors ml-0.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area with Sidebar Tabs */}
      <div className="app-main-layout flex-1 min-h-0 min-w-0 flex overflow-hidden">
        {/* Navigation Sidebar (Responsiva: ícones em telas compactas, completa em telas médias/largas) */}
        <div className="app-sidebar w-14 sm:w-44 lg:w-56 xl:w-60 sidebar-glass p-2 sm:p-3 space-y-1.5 shrink-0 select-none transition-all duration-150">
          <button
            onClick={() => setActiveTab('personal')}
            title={t("Dados & Contato")}
            className={`w-full px-2 sm:px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-center sm:justify-start gap-2.5 border transition-colors duration-150 ${activeTab === 'personal'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t("Dados & Contato")}</span>
          </button>

          <button
            onClick={() => setActiveTab('summaries')}
            title={t("Resumos & Pitch (IA)")}
            className={`w-full px-2 sm:px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-center sm:justify-start gap-2.5 border transition-colors duration-150 ${activeTab === 'summaries'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t("Resumos & Pitch (IA)")}</span>
          </button>

          <button
            onClick={() => setActiveTab('experience')}
            title={t("Carreira & Formação")}
            className={`w-full px-2 sm:px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-center sm:justify-start gap-2.5 border transition-colors duration-150 ${activeTab === 'experience'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t("Carreira & Formação")}</span>
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            title={t('Acompanhamento de candidaturas')}
            className={`w-full px-2 sm:px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-center sm:justify-start gap-2.5 border transition-colors duration-150 ${activeTab === 'applications'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t('Candidaturas')}</span>
            {(profileCollection.applications?.length || 0) > 0 && <span className="hidden sm:inline-block ml-auto rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-300">{profileCollection.applications?.length}</span>}
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            title={t("Campos Customizados")}
            className={`w-full px-2 sm:px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-center sm:justify-start gap-2.5 border transition-colors duration-150 ${activeTab === 'custom'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t("Campos Custom")}</span>
            {formData.customFields.length + formData.savedAnswers.length > 0 && (
              <span className="hidden sm:inline-block ml-auto text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full font-mono">
                {formData.customFields.length + formData.savedAnswers.length}
              </span>
            )}
          </button>

          <div className="pt-3 border-t border-zinc-800/60 my-2" />

          <button
            onClick={() => setActiveTab('settings')}
            title={t("Configurações & IA")}
            className={`w-full px-2 sm:px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-center sm:justify-start gap-2.5 border transition-colors duration-150 ${activeTab === 'settings'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">{t("Configurações & IA")}</span>
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="app-tab-content min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <section className="mb-4 grid gap-3 xl:grid-cols-3" aria-label={t('Preparação do perfil')}>
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold text-emerald-100">{t('Prepare seu perfil')}</h2>
                  <p className="mt-0.5 text-[10px] text-zinc-400">{t('{done} de {total} itens básicos concluídos', { done: setupDone, total: setupItems.length })}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-300">{Math.round(setupDone / setupItems.length * 100)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${setupDone / setupItems.length * 100}%` }} /></div>
              {setupDone < setupItems.length && <div className="mt-2 flex flex-wrap gap-1.5">{setupItems.filter((item) => !item.done).map((item) => <button key={item.label} type="button" onClick={() => setActiveTab(item.tab)} className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-[10px] text-zinc-300 hover:border-emerald-600/70">＋ {item.label}</button>)}</div>}
              {setupDone === setupItems.length && <p className="mt-2 text-[10px] text-emerald-200">{t('Seu perfil já tem uma boa base para começar.')}</p>}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold text-zinc-100">{t('Revisão para esta vaga')}</h2>
                  <p className="mt-0.5 text-[10px] text-zinc-400">{activeEntry?.targetRole.trim() || t('Defina o cargo no perfil ativo para dar contexto a esta revisão.')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-medium ${vacancyGaps.length ? 'bg-amber-950/60 text-amber-200' : 'bg-emerald-950/60 text-emerald-200'}`}>{vacancyGaps.length ? t('{count} itens para revisar', { count: vacancyGaps.length }) : t('Perfil completo')}</span>
              </div>
              {vacancyGaps.length ? <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">{t('Antes de se candidatar, confira:')} {vacancyGaps.join(', ')}.</p> : <p className="mt-2 text-[10px] text-zinc-400">{t('Os dados básicos estão presentes. Revise cada resposta no site antes de enviar.')}</p>}
              <p className="mt-1.5 text-[9px] text-zinc-500">{t('Esta checagem usa apenas os dados do perfil selecionado; ela não avalia os requisitos da vaga.')}</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
              <h2 className="text-xs font-semibold text-zinc-100">{t('Consistência do perfil')}</h2>
              {profileWarnings.length ? <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-amber-200/90">{profileWarnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul> : <p className="mt-2 text-[10px] text-emerald-200">{t('Não encontrei inconsistências simples nos dados.')}</p>}
              <p className="mt-1.5 text-[9px] text-zinc-500">{t('A revisão é automática e pode não identificar todos os erros.')}</p>
            </div>
          </section>

          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5">
            <label htmlFor="active-candidate-profile" className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
              <Users className="h-3.5 w-3.5 text-emerald-400" />{t('Perfil ativo')}
            </label>
            <select
              id="active-candidate-profile"
              value={profileCollection.activeProfileId}
              onChange={(event) => handleSwitchProfile(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500/60"
            >
              {profileCollection.profiles.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.id === 'profile-default' && entry.name === 'Perfil principal' ? t('Perfil principal') : entry.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setProfileManagerOpen(true)}
              title={t('Gerenciar perfis')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
            >
              <Users className="h-3.5 w-3.5" /><span>{t('Perfis')}</span>
            </button>
          </div>

          <VaultManagerTabsProvider value={vaultTabsContextValue}>
            <PersonalTab />
            <SummariesTab />
            <ExperienceTab />
          {/* TAB 4: CAMPOS CUSTOMIZADOS */}
          {activeTab === 'applications' && (
            <ApplicationTracker
              applications={profileCollection.applications || []}
              profiles={profileCollection.profiles}
              activeProfileId={profileId}
              onChange={onUpdateApplications}
            />
          )}

          {activeTab === 'custom' && (
            <div className="w-full animate-fade-in">
              <CustomFieldsEditor
                fields={formData.customFields}
                onChange={(fields) => setFormData({ ...formData, customFields: fields })}
                savedAnswers={formData.savedAnswers}
                onSavedAnswersChange={(savedAnswers) => setFormData({ ...formData, savedAnswers })}
              />
              <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-zinc-100">{t('Mapeamentos por site')}</h3>
                  <p className="mt-1 text-[11px] text-zinc-500">{t('Regras locais que associam campos de um site a dados deste perfil.')}</p>
                </div>
                {(profileCollection.siteFieldMappings || []).filter((mapping) => mapping.profileId === profileId).length === 0 ? (
                  <p className="text-xs text-zinc-500">{t('Ainda não há mapeamentos para este perfil.')}</p>
                ) : (
                  <ul className="space-y-2">
                    {(profileCollection.siteFieldMappings || []).filter((mapping) => mapping.profileId === profileId).map((mapping) => (
                      <li key={mapping.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                        <span className="min-w-0 text-xs text-zinc-300"><strong className="text-emerald-300">{mapping.site}</strong><span className="mx-1 text-zinc-600">·</span>{mapping.selector.label || mapping.selector.name || mapping.selector.id}<span className="mx-1 text-zinc-600">→</span>{mapping.sourceLabel}</span>
                        <button type="button" aria-label={t('Remover mapeamento')} onClick={() => void onSaveProfileCollection({ ...profileCollection, siteFieldMappings: (profileCollection.siteFieldMappings || []).filter((item) => item.id !== mapping.id) })} className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-rose-950/40 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

            <SettingsTab />
          </VaultManagerTabsProvider>
        </div>
      </div>

      {/* Modal de Aprimoramento com IA */}
      {aiTargetField && (
        <AiEnhancerModal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          originalText={aiTargetField.text}
          fieldLabel={aiTargetField.label}
          aiConfig={formData.aiConfig}
          onApply={handleApplyAiEnhancement}
          onOpenSettings={() => setActiveTab('settings')}
        />
      )}

      {/* Modal de Importação de Currículo & Backup */}
      <CvImporterModal
        isOpen={cvImporterOpen}
        onClose={() => setCvImporterOpen(false)}
        currentProfile={formData}
        aiConfig={formData.aiConfig}
        onImport={handleImportProfile}
        onImportCollection={async (collection) => {
          await onImportProfileCollection(collection);
          setCvImporterOpen(false);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2500);
        }}
        onOpenSettings={() => setActiveTab('settings')}
      />

      <ProfileManagerModal
        isOpen={profileManagerOpen}
        collection={profileCollection}
        onClose={() => setProfileManagerOpen(false)}
        onSave={onSaveProfileCollection}
        onOpenSettings={() => {
          setProfileManagerOpen(false);
          setActiveTab('settings');
        }}
      />
    </div>
  );
};
