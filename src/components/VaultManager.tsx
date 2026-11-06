import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  FileText,
  Briefcase,
  Tag,
  Settings,
  Sparkles,
  Save,
  Plus,
  Trash2,
  Keyboard,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Palette,
  Check,
  FileUp,
  Download,
  Zap,
  ExternalLink,
  Globe,
  Paperclip,
  Eye,
  EyeOff,
  Users,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { CandidateProfile, CandidateProfileCollection, ExperienceItem, EducationItem } from '../types/profile';
import { THEMES } from '../types/theme';
import { createCandidateProfileCollectionBackup } from '../services/storage';
import { CustomFieldsEditor } from './CustomFieldsEditor';
import { AiEnhancerModal } from './AiEnhancerModal';
import { CvImporterModal } from './CvImporterModal';
import { useLocale } from '../contexts/LocaleContext';
import { Locale } from '../services/localization';
import { ProfileManagerModal } from './ProfileManagerModal';
import { AvailableAiModel, listAvailableAiModels, testAiModel } from '../services/aiModels';
import { getFirefoxDataConsentErrorMessage } from '../services/firefoxDataConsent';

interface VaultManagerProps {
  profile: CandidateProfile;
  profileId: string;
  profileCollection: CandidateProfileCollection;
  onSave: (updatedProfile: CandidateProfile, profileId?: string) => Promise<void>;
  onSaveProfileCollection: (collection: CandidateProfileCollection, sharedSourceId?: string) => Promise<void>;
  onImportProfileCollection: (collection: CandidateProfileCollection) => Promise<void>;
  onOpenSpotlight?: () => void;
  onAutofillPage?: () => void;
}

type TabType = 'personal' | 'summaries' | 'experience' | 'custom' | 'settings';

export const VaultManager: React.FC<VaultManagerProps> = ({
  profile,
  profileId,
  profileCollection,
  onSave,
  onSaveProfileCollection,
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
          <section className="mb-4 grid gap-3 xl:grid-cols-2" aria-label={t('Preparação do perfil')}>
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

          {/* TAB 1: DADOS PESSOAIS */}
          {activeTab === 'personal' && (
            <div className="w-full space-y-6 animate-fade-in">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">{t("Informações Pessoais & Contato")}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t("Dados essenciais utilizados na maioria das triagens de vagas e formulários de candidatura.")}
                </p>
              </div>

              {formData.unconfirmedDefaults.length > 0 && (
                <section role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold text-amber-200">{t("Revise respostas padrão antigas")}</h3>
                    <p className="mt-1 text-[11px] text-amber-100/70">{t("Elas não serão usadas no preenchimento até você confirmar cada valor.")}</p>
                  </div>
                  {formData.unconfirmedDefaults.map((item) => (
                    <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/20 pt-2">
                      <p className="min-w-0 flex-1 text-xs text-zinc-200"><strong>{t(item.label)}:</strong> {item.value}</p>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => resolveUnconfirmedDefault(item.key, true)} className="rounded-lg bg-emerald-600/80 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500">{t("Confirmar")}</button>
                        <button type="button" onClick={() => resolveUnconfirmedDefault(item.key, false)} className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700">{t("Limpar")}</button>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Coluna Esquerda: Dados Principais e Links */}
                <div className="xl:col-span-7 space-y-5">
                  {/* Informações Básicas */}
                  <div className="p-5 rounded-2xl card-elevated space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <User className="w-4 h-4" /> {t("Dados Pessoais Principais")}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Nome Completo")}</label>
                        <input
                          type="text"
                          value={formData.personal.fullName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, fullName: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Título Profissional (Headline)")}</label>
                        <input
                          type="text"
                          value={formData.personal.headline}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, headline: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("Ex: Desenvolvedor Full Stack Senior | React & Node")}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("E-mail Principal")}</label>
                        <input
                          type="email"
                          value={formData.personal.email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, email: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Telefone / WhatsApp")}</label>
                        <input
                          type="text"
                          value={formData.personal.phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, phone: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Localização (Cidade, UF - País)")}</label>
                        <input
                          type="text"
                          value={formData.personal.location}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, location: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Nacionalidade")}</label>
                        <input
                          type="text"
                          value={formData.personal.nationality}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, nationality: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Links e Redes */}
                  <div className="p-5 rounded-2xl card-elevated space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Globe className="w-4 h-4" /> {t("Links & Portfólio")}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("LinkedIn URL")}</label>
                        <input
                          type="url"
                          value={formData.personal.linkedin}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, linkedin: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("linkedin.com/in/...")}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("GitHub URL")}</label>
                        <input
                          type="url"
                          value={formData.personal.github}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, github: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("github.com/...")}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Site / Portfólio")}</label>
                        <input
                          type="url"
                          value={formData.personal.portfolio}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              personal: { ...formData.personal, portfolio: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("https://...")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Anexo do Currículo e Pretensão Salarial */}
                <div className="xl:col-span-5 space-y-5">
                  {/* Card de Auto-Anexo de Currículo (PDF) */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsResumeDragging(true);
                    }}
                    onDragLeave={() => setIsResumeDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsResumeDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processResumeFileObject(file);
                    }}
                    className={`p-5 rounded-2xl card-elevated space-y-3.5 border transition-all ${
                      isResumeDragging
                        ? 'border-emerald-400 bg-emerald-500/20 scale-[1.01]'
                        : 'border-emerald-500/25 bg-emerald-950/15'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                        <Paperclip className="w-4 h-4" /> {t("Anexo Automático de Currículo (PDF)")}
                      </div>
                      {formData.resumeFile && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                          {t("Auto-attach ativo")}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {t("Ao preencher vagas com")} <strong>Ctrl + Shift + .</strong>{t(", o CandiFill anexará este arquivo diretamente no campo de currículo!")}
                    </p>

                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleResumeFileUpload}
                      className="hidden"
                    />

                    {formData.resumeFile ? (
                      <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-xs shrink-0">
                            {t("PDF")}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-100 truncate">{formData.resumeFile.name}</p>
                            <p className="text-[11px] text-zinc-400">
                              {(formData.resumeFile.size / 1024).toFixed(1)} {t("KB • Pronto para auto-anexo")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleDownloadResume}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 flex items-center gap-1 transition-colors"
                            title={t("Baixar ou visualizar PDF salvo")}
                          >
                            <Download className="w-3.5 h-3.5" /> {t("Baixar")}
                          </button>
                          <button
                            type="button"
                            onClick={handleSelectResumeClick}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
                          >
                            {t("Trocar")}
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveResume}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title={t("Remover anexo do cofre")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={handleSelectResumeClick}
                        className="p-5 rounded-xl border border-dashed border-zinc-700/80 hover:border-emerald-500/60 bg-zinc-950/40 hover:bg-zinc-950/70 text-center cursor-pointer transition-all space-y-2"
                      >
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                          <FileUp className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">
                            {t("Arraste seu PDF aqui ou clique para selecionar")}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {t("O arquivo será salvo no cofre e anexado automaticamente em formulários de vagas")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expectativa Salarial */}
                  <div className="p-5 rounded-2xl card-elevated space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Briefcase className="w-4 h-4" /> {t("Pretensão Salarial & Regime")}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Pretensão Desejada")}</label>
                        <input
                          type="text"
                          value={formData.salary.desiredSalary}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              salary: { ...formData.salary, desiredSalary: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("Ex: 18.000")}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Pretensão Mínima")}</label>
                        <input
                          type="text"
                          value={formData.salary.minimumSalary}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              salary: { ...formData.salary, minimumSalary: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("Ex: 15.000")}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Moeda / Formato")}</label>
                        <input
                          type="text"
                          value={formData.salary.currency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              salary: { ...formData.salary, currency: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("Ex: BRL (R$) ou USD ($)")}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Modelo de Contratação")}</label>
                        <input
                          type="text"
                          value={formData.salary.contractType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              salary: { ...formData.salary, contractType: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("Ex: PJ, CLT ou Ambos")}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Disponibilidade de Início")}</label>
                        <input
                          type="text"
                          value={formData.salary.availability}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              salary: { ...formData.salary, availability: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl text-xs text-zinc-100"
                          placeholder={t("Ex: Imediata ou 15 dias de aviso prévio")}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESUMOS PROFISSIONAIS & IA */}
          {activeTab === 'summaries' && (
            <div className="w-full space-y-6 animate-fade-in">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">{t("Resumos Profissionais & Apresentações")}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t("Textos longos para campos de bio, cover letters e introduções. Use o botão")}{' '}
                  <span className="text-emerald-400 font-medium">{t("✨ Refinar com IA")}</span> {t("para otimizar tom e impacto.")}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                <div className="space-y-5">
                  {/* Resumo Curto */}
                  <div className="p-5 rounded-2xl card-elevated space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-zinc-200">{t("Resumo Curto / Pitch de Apresentação")}</span>
                        <p className="text-[11px] text-zinc-400">{t("Ideal para campos de bio limitados (2 a 3 frases).")}</p>
                      </div>
                      <button
                        onClick={() =>
                          openAiEnhancer(
                            'shortSummary',
                            'Resumo Curto / Pitch',
                            formData.summary.shortSummary
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> {t("Refinar com IA")}
                      </button>
                    </div>

                    <textarea
                      rows={4}
                      value={formData.summary.shortSummary}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          summary: { ...formData.summary, shortSummary: e.target.value },
                        })
                      }
                      className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 leading-relaxed"
                    />
                  </div>

                  {/* Carta de Apresentação Snippet */}
                  <div className="p-5 rounded-2xl card-elevated space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-zinc-200">{t("Snippet de Carta de Apresentação")}</span>
                        <p className="text-[11px] text-zinc-400">{t("Texto padrão para colar no campo de motivação da vaga.")}</p>
                      </div>
                      <button
                        onClick={() =>
                          openAiEnhancer(
                            'coverLetterSnippet',
                            'Carta de Apresentação',
                            formData.summary.coverLetterSnippet
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> {t("Refinar com IA")}
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={formData.summary.coverLetterSnippet}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          summary: { ...formData.summary, coverLetterSnippet: e.target.value },
                        })
                      }
                      className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 leading-relaxed"
                    />
                  </div>
                </div>

                {/* Resumo Completo / Longo */}
                <div className="p-5 rounded-2xl card-elevated space-y-3 flex flex-col h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200">{t("Resumo Profissional Completo")}</span>
                      <p className="text-[11px] text-zinc-400">{t("Histórico detalhado, realizações e stack tecnológica.")}</p>
                    </div>
                    <button
                      onClick={() =>
                        openAiEnhancer(
                          'longSummary',
                          'Resumo Profissional Completo',
                          formData.summary.longSummary
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> {t("Refinar com IA")}
                    </button>
                  </div>

                  <textarea
                    rows={12}
                    value={formData.summary.longSummary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        summary: { ...formData.summary, longSummary: e.target.value },
                      })
                    }
                    className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 leading-relaxed flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXPERIÊNCIAS & FORMAÇÃO */}
          {activeTab === 'experience' && (
            <div className="w-full space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Experiências Profissionais */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <h2 className="text-base font-semibold text-zinc-100">{t("Experiências Profissionais")}</h2>
                      <p className="text-xs text-zinc-400">{t("Organize os cargos mais recentes para inserção rápida.")}</p>
                    </div>
                    <button
                      onClick={handleAddExperience}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t("Adicionar")}
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {formData.experience.map((exp, idx) => (
                      <div
                        key={exp.id}
                        className="p-4 rounded-xl card-elevated space-y-3 relative group"
                      >
                        <button
                          onClick={() => handleRemoveExperience(exp.id)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title={t("Excluir experiência")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Empresa")}</label>
                            <input
                              type="text"
                              value={exp.company}
                              onChange={(e) => {
                                const updated = [...formData.experience];
                                updated[idx].company = e.target.value;
                                setFormData({ ...formData, experience: updated });
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Cargo")}</label>
                            <input
                              type="text"
                              value={exp.role}
                              onChange={(e) => {
                                const updated = [...formData.experience];
                                updated[idx].role = e.target.value;
                                setFormData({ ...formData, experience: updated });
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Período")}</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={exp.startDate}
                                placeholder="2021"
                                onChange={(e) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    experience: prev.experience.map((item, i) =>
                                      i === idx ? { ...item, startDate: e.target.value } : item
                                    ),
                                  }));
                                }}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                              />
                              <input
                                type="text"
                                value={exp.endDate}
                                placeholder={t("Presente")}
                                disabled={exp.current}
                                onChange={(e) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    experience: prev.experience.map((item, i) =>
                                      i === idx ? { ...item, endDate: e.target.value } : item
                                    ),
                                  }));
                                }}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                              />
                            </div>
                            <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={exp.current}
                                onChange={(e) => {
                                  const isCurrent = e.target.checked;
                                  setFormData((prev) => ({
                                    ...prev,
                                    experience: prev.experience.map((item, i) =>
                                      i === idx ? { ...item, current: isCurrent, endDate: isCurrent ? 'Presente' : '' } : item
                                    ),
                                  }));
                                }}
                                className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0"
                              />
                              <span className="text-[11px] text-zinc-300">{t("Cargo atual")}</span>
                            </label>
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Localização")}</label>
                            <input
                              type="text"
                              value={exp.location}
                              placeholder={t("Remoto / Híbrido")}
                              onChange={(e) => {
                                const updated = [...formData.experience];
                                updated[idx].location = e.target.value;
                                setFormData({ ...formData, experience: updated });
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                              {t("Principais Atividades & Conquistas")}
                            </label>
                            <textarea
                              rows={3}
                              value={exp.description}
                              onChange={(e) => {
                                const updated = [...formData.experience];
                                updated[idx].description = e.target.value;
                                setFormData({ ...formData, experience: updated });
                              }}
                              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {formData.experience.length === 0 && (
                      <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                        {t("Nenhuma experiência cadastrada. Clique no botão acima para adicionar.")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Formação Acadêmica */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <h2 className="text-base font-semibold text-zinc-100">{t("Formação Acadêmica")}</h2>
                      <p className="text-xs text-zinc-400">{t("Graduações, cursos superiores e pós-graduações.")}</p>
                    </div>
                    <button
                      onClick={handleAddEducation}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t("Adicionar")}
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {formData.education.map((edu, idx) => (
                      <div
                        key={edu.id}
                        className="p-4 rounded-xl card-elevated space-y-3 relative group"
                      >
                        <button
                          onClick={() => handleRemoveEducation(edu.id)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title={t("Excluir formação")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Instituição")}</label>
                            <input
                              type="text"
                              value={edu.institution}
                              onChange={(e) => {
                                const updated = [...formData.education];
                                updated[idx].institution = e.target.value;
                                setFormData({ ...formData, education: updated });
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Grau / Nível")}</label>
                            <input
                              type="text"
                              value={edu.degree}
                              placeholder={t("Bacharelado, Pós...")}
                              onChange={(e) => {
                                const updated = [...formData.education];
                                updated[idx].degree = e.target.value;
                                setFormData({ ...formData, education: updated });
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Curso / Área")}</label>
                            <input
                              type="text"
                              value={edu.fieldOfStudy}
                              placeholder={t("Ciência da Computação...")}
                              onChange={(e) => {
                                const updated = [...formData.education];
                                updated[idx].fieldOfStudy = e.target.value;
                                setFormData({ ...formData, education: updated });
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Ano de Conclusão / Período")}</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={edu.startDate}
                                placeholder={t("Início (ex: 2018)")}
                                onChange={(e) => {
                                  const updated = [...formData.education];
                                  updated[idx].startDate = e.target.value;
                                  setFormData({ ...formData, education: updated });
                                }}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                              />
                              <input
                                type="text"
                                value={edu.endDate}
                                placeholder={t("Fim (ex: 2022)")}
                                onChange={(e) => {
                                  const updated = [...formData.education];
                                  updated[idx].endDate = e.target.value;
                                  setFormData({ ...formData, education: updated });
                                }}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {formData.education.length === 0 && (
                      <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                        {t("Nenhuma formação cadastrada.")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CAMPOS CUSTOMIZADOS */}
          {activeTab === 'custom' && (
            <div className="w-full animate-fade-in">
              <CustomFieldsEditor
                fields={formData.customFields}
                onChange={(fields) => setFormData({ ...formData, customFields: fields })}
                savedAnswers={formData.savedAnswers}
                onSavedAnswersChange={(savedAnswers) => setFormData({ ...formData, savedAnswers })}
              />
            </div>
          )}

          {/* TAB 5: CONFIGURAÇÕES & IA */}
          {activeTab === 'settings' && (
            <div className="w-full space-y-6 animate-fade-in">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">{t("Configurações & Inteligência Artificial")}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t("Gerencie sua chave de API, modelos de linguagem e temas visuais da extensão.")}
                </p>
              </div>

              <div className="p-4 rounded-2xl card-elevated flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <label htmlFor="candifill-language" className="text-xs font-semibold text-zinc-100">{t('Idioma da interface')}</label>
                  <p className="mt-1 text-[11px] text-zinc-400">{t('Escolha o idioma exibido no CandiFill.')}</p>
                </div>
                <select
                  id="candifill-language"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as Locale)}
                  className="w-full sm:w-56 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* Coluna 1: IA e Atalhos */}
                <div className="space-y-5">
                  {/* Box de IA */}
                  <div className="p-5 rounded-2xl card-elevated space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" /> {t("Provedor de IA (Gemini / OpenAI)")}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Provedor")}</label>
                        <select
                          value={formData.aiConfig.provider}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              aiConfig: {
                                ...formData.aiConfig,
                                provider: e.target.value as 'gemini' | 'openai',
                                model:
                                  e.target.value === 'gemini'
                                    ? 'gemini-1.5-flash'
                                    : 'gpt-4o-mini',
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="gemini">{t("Google Gemini (Recomendado - Grátis/Rápido)")}</option>
                          <option value="openai">{t("OpenAI (ChatGPT / GPT-4o)")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t("Modelo Selecionado")}</label>
                        <select
                          value={formData.aiConfig.model}
                          onChange={(e) =>
                            {
                              setFormData({
                                ...formData,
                                aiConfig: { ...formData.aiConfig, model: e.target.value },
                              });
                              setAiModelStatus(null);
                            }
                          }
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                        >
                          {!formData.aiConfig.model && <option value="">{t('Carregue a lista e selecione um modelo')}</option>}
                          {formData.aiConfig.model && !availableAiModels.some((model) => model.id === formData.aiConfig.model) && (
                            <option value={formData.aiConfig.model}>
                              {modelsLoadedForProvider === formData.aiConfig.provider
                                ? `${formData.aiConfig.model} (${t('não listado para esta chave')})`
                                : `${formData.aiConfig.model} (${t('ainda não verificado')})`}
                            </option>
                          )}
                          {availableAiModels.some((model) => model.recommended) && (
                            <optgroup label={t('Recomendados: rápidos e econômicos')}>
                              {availableAiModels.filter((model) => model.recommended).map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.displayName === model.id ? model.id : `${model.displayName} · ${model.id}`}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {availableAiModels.some((model) => !model.recommended) && (
                            <optgroup label={t('Outros modelos de texto compatíveis')}>
                              {availableAiModels.filter((model) => !model.recommended).map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.displayName === model.id ? model.id : `${model.displayName} · ${model.id}`}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] leading-relaxed text-zinc-500">
                        {t('A lista mostra modelos de texto adequados para aprimorar textos, analisar currículos e adaptar perfis. Ao clicar em Buscar modelos, sua chave é enviada ao provedor escolhido para consultar os modelos disponíveis. Testar compatibilidade envia uma solicitação curta ao modelo selecionado. Essas ações podem gerar cobrança.')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleLoadAiModels}
                          disabled={!formData.aiConfig.apiKey.trim() || isLoadingAiModels || isTestingAiModel}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[11px] font-medium text-zinc-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isLoadingAiModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          {isLoadingAiModels ? t('Buscando modelos...') : t('Buscar modelos compatíveis')}
                        </button>
                        <button
                          type="button"
                          onClick={handleTestAiModel}
                          disabled={!formData.aiConfig.apiKey.trim() || !formData.aiConfig.model.trim() || isLoadingAiModels || isTestingAiModel}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isTestingAiModel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          {isTestingAiModel ? t('Testando...') : t('Testar compatibilidade')}
                        </button>
                      </div>
                      {!formData.aiConfig.apiKey.trim() && (
                        <p className="text-[10px] text-amber-300/80">{t('Informe a chave de API antes de buscar modelos.')}</p>
                      )}
                      {aiModelStatus && (
                        <p role="status" aria-live="polite" className={`text-[10px] leading-relaxed ${aiModelStatus.type === 'success' ? 'text-emerald-300' : aiModelStatus.type === 'error' ? 'text-rose-300' : 'text-zinc-400'}`}>
                          {aiModelStatus.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-zinc-400">{t("API Key *")}</label>
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors"
                        >
                          {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-emerald-400" />}
                          <span>{showApiKey ? 'Ocultar Chave' : 'Mostrar Chave'}</span>
                        </button>
                      </div>
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={formData.aiConfig.apiKey}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            aiConfig: { ...formData.aiConfig, apiKey: e.target.value },
                          })
                        }
                        placeholder="AIzaSy... ou sk-proj-..."
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {t("A chave fica no armazenamento local da extensão e é enviada ao provedor escolhido quando você usa recursos de IA. Ela não é enviada às páginas de candidatura.")}
                      </p>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                        {t("Instruções Adicionais para IA (Opcional)")}
                      </label>
                      <textarea
                        rows={2}
                        value={formData.aiConfig.customPrompt || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            aiConfig: { ...formData.aiConfig, customPrompt: e.target.value },
                          })
                        }
                        placeholder={t("Ex: Foque sempre em métricas quantitativas, liderança técnica e resultados ágeis...")}
                        className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Informações de Atalhos da Extensão */}
                  <div className="p-5 rounded-2xl card-elevated space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      <Keyboard className="w-4 h-4 text-emerald-400" /> {t("Atalhos Globais da Extensão")}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80">
                        <span className="text-zinc-300">{t("Preencher formulário na aba ativa:")}</span>
                        <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-emerald-400 font-mono text-[11px]">
                          Ctrl + Shift + .
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80">
                        <span className="text-zinc-300">{t("Abrir busca rápida Spotlight HUD:")}</span>
                        <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-emerald-400 font-mono text-[11px]">
                          Alt + Shift + V
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80">
                        <span className="text-zinc-300">{t("Salvar alterações no cofre:")}</span>
                        <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-emerald-400 font-mono text-[11px]">
                          Ctrl + S
                        </kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Temas e Backup */}
                <div className="space-y-5">
                  {/* Seletor de Temas */}
                  <div className="p-5 rounded-2xl card-elevated space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Palette className="w-4 h-4" /> {t("Personalização de Tema")}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {THEMES.map((th) => {
                        const isSelected = (formData.theme || 'emerald') === th.id;
                        return (
                          <button
                            key={th.id}
                            type="button"
                            onClick={() => {
                              const updated = { ...formData, theme: th.id };
                              setFormData(updated);
                              document.documentElement.setAttribute('data-theme', th.id);
                              if (th.id === 'light') {
                                document.documentElement.classList.remove('dark');
                              } else {
                                document.documentElement.classList.add('dark');
                              }
                              onSave(updated, profileId);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                                : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                                style={{ backgroundColor: th.previewColor }}
                              />
                              <span className="text-xs font-semibold text-zinc-200 truncate">{th.name}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
                              {t(th.description)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Box de Instruções da Extensão */}
                  <div className="p-5 rounded-2xl card-elevated space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Zap className="w-4 h-4" /> {t("Preenchimento Automático em Vagas")}
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {t("O CandiFill detecta formulários em sites como")} <strong>{t("Gupy, Inhire, Greenhouse, Lever, Workday")}</strong> {t("e carreiras personalizadas.")}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                        <div className="flex items-center gap-2 font-medium text-zinc-200">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold">1</span>
                          <span>{t("Atalho do Teclado")}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {t("Pressione")} <kbd className="text-emerald-400 font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">Ctrl+Shift+.</kbd> {t("em qualquer formulário de vaga.")}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                        <div className="flex items-center gap-2 font-medium text-zinc-200">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold">2</span>
                          <span>{t("Botão Flutuante")}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {t("O botão flutuante")} <strong>{t("⚡ Preencher")}</strong> {t("surge automaticamente no canto de formulários de candidatura.")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Box de Backup & Restauração */}
                  <div className="p-5 rounded-2xl card-elevated space-y-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Download className="w-4 h-4" /> {t("Backup & Portabilidade do Cofre")}
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {t("O backup inclui todos os perfis, respostas salvas e currículos anexados, mas remove as chaves de API. Guarde o arquivo em um local privado.")}
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 flex items-center gap-2 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" /> {t("Exportar Backup (.json)")}
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenCvImporter}
                        className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium flex items-center gap-2 transition-colors"
                      >
                        <FileUp className="w-3.5 h-3.5 text-emerald-400" /> {t("Importar Currículo ou Backup")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
