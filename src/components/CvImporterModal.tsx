import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Upload,
  Check,
  AlertCircle,
  RefreshCw,
  Briefcase,
  GraduationCap,
  User,
  ArrowRight,
  Database,
  FileCheck2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CandidateProfile, CandidateProfileCollection, AiConfig, ResumeFile } from '../types/profile';
import { parseCandidateProfileImport } from '../services/storage';
import { parseResumeWithAi } from '../services/ai';
import { getFirefoxDataConsentErrorMessage } from '../services/firefoxDataConsent';
import { useLocale } from '../contexts/LocaleContext';

interface CvImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: CandidateProfile;
  aiConfig: AiConfig;
  onImport: (newProfile: CandidateProfile) => void;
  onImportCollection?: (collection: CandidateProfileCollection) => void | Promise<void>;
  onOpenSettings: () => void;
}

interface PdfMeta {
  name: string;
  size: string;
  pages: number;
}

export const CvImporterModal: React.FC<CvImporterModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  aiConfig,
  onImport,
  onImportCollection,
  onOpenSettings,
}) => {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'ai' | 'backup'>('ai');
  const [rawText, setRawText] = useState('');
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedProfile, setExtractedProfile] = useState<CandidateProfile | null>(null);
  const [uploadedResumeFile, setUploadedResumeFile] = useState<ResumeFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement>) => {
    const isPopup = !document.body.classList.contains('tab-mode') && window.innerWidth <= 800;
    if (isPopup && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html?mode=tab&modal=import-cv') });
      onClose();
      return;
    }
    ref.current?.click();
  };

  if (!isOpen) return null;

  const hasApiKey = Boolean(aiConfig.apiKey && aiConfig.apiKey.trim().length > 0);

  const processFile = async (file: File) => {
    setErrorMessage(null);

    // Converte o arquivo para base64 para habilitar auto-anexo futuro
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const dataUrl = fileReader.result as string;
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        setUploadedResumeFile({
          name: file.name,
          size: file.size,
          type: file.type || 'application/pdf',
          lastModified: file.lastModified,
          base64,
        });
      }
    };
    fileReader.readAsDataURL(file);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      setIsReadingPdf(true);
      try {
        const buffer = await file.arrayBuffer();
        const { extractText } = await import('unpdf');
        const { text, totalPages } = await extractText(buffer);
        const fullText = Array.isArray(text) ? text.join('\n\n') : String(text || '');

        if (!fullText.trim()) {
          throw new Error('Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada sem camada de texto OCR.');
        }

        setPdfMeta({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          pages: totalPages || 1,
        });
        setRawText(fullText.trim());
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Erro ao ler arquivo PDF.'
        );
      } finally {
        setIsReadingPdf(false);
      }
    } else {
      // Arquivo de texto (.txt, .md)
      try {
        const text = await file.text();
        setPdfMeta(null);
        setRawText(text.trim());
      } catch (err: unknown) {
        setErrorMessage('Erro ao ler arquivo de texto.');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleJsonBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCandidateProfileImport(JSON.parse(text));
        if (parsed.kind === 'collection') {
          if (!onImportCollection) throw new Error('A restauração de múltiplos perfis não está disponível nesta janela.');
          await onImportCollection(parsed.collection);
        } else {
          onImport(parsed.profile);
        }
        onClose();
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'O arquivo JSON selecionado não é um backup válido do CandiFill.'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleProcessAi = async () => {
    if (!hasApiKey) {
      setErrorMessage('Configure sua chave de API nas configurações para usar o extrator de currículos.');
      return;
    }

    if (!rawText.trim()) {
      setErrorMessage('Por favor, carregue seu currículo em PDF ou cole o texto.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const extracted = await parseResumeWithAi({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        resumeText: rawText,
      });

      // Preserva chaves de configuração e tema atual
      extracted.aiConfig = currentProfile.aiConfig;
      extracted.theme = currentProfile.theme;

      setExtractedProfile(extracted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const consentMessage = getFirefoxDataConsentErrorMessage(message, t);
      if (consentMessage) {
        setErrorMessage(consentMessage);
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao processar o currículo com a IA.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFull = () => {
    if (!extractedProfile) return;
    onImport({
      ...extractedProfile,
      savedAnswers: currentProfile.savedAnswers,
      unconfirmedDefaults: currentProfile.unconfirmedDefaults,
      resumeFile: uploadedResumeFile || currentProfile.resumeFile,
    });
    onClose();
  };

  const handleApplyMerge = () => {
    if (!extractedProfile) return;

    const merged: CandidateProfile = {
      ...currentProfile,
      resumeFile: uploadedResumeFile || currentProfile.resumeFile,
      personal: {
        fullName: extractedProfile.personal.fullName || currentProfile.personal.fullName,
        headline: extractedProfile.personal.headline || currentProfile.personal.headline,
        email: extractedProfile.personal.email || currentProfile.personal.email,
        phone: extractedProfile.personal.phone || currentProfile.personal.phone,
        location: extractedProfile.personal.location || currentProfile.personal.location,
        nationality: extractedProfile.personal.nationality || currentProfile.personal.nationality,
        linkedin: extractedProfile.personal.linkedin || currentProfile.personal.linkedin,
        github: extractedProfile.personal.github || currentProfile.personal.github,
        portfolio: extractedProfile.personal.portfolio || currentProfile.personal.portfolio,
      },
      salary: {
        currency: extractedProfile.salary.currency || currentProfile.salary.currency,
        desiredSalary: extractedProfile.salary.desiredSalary || currentProfile.salary.desiredSalary,
        minimumSalary: extractedProfile.salary.minimumSalary || currentProfile.salary.minimumSalary,
        contractType: extractedProfile.salary.contractType || currentProfile.salary.contractType,
        availability: extractedProfile.salary.availability || currentProfile.salary.availability,
      },
      summary: {
        shortSummary: extractedProfile.summary.shortSummary || currentProfile.summary.shortSummary,
        longSummary: extractedProfile.summary.longSummary || currentProfile.summary.longSummary,
        coverLetterSnippet:
          extractedProfile.summary.coverLetterSnippet || currentProfile.summary.coverLetterSnippet,
      },
      education: [
        ...extractedProfile.education,
        ...currentProfile.education.filter(
          (curr) => !extractedProfile.education.some((ext) => ext.institution === curr.institution)
        ),
      ],
      experience: [
        ...extractedProfile.experience,
        ...currentProfile.experience.filter(
          (curr) => !extractedProfile.experience.some((ext) => ext.company === curr.company)
        ),
      ],
      customFields: [
        ...currentProfile.customFields,
        ...extractedProfile.customFields.filter(
          (ext) => !currentProfile.customFields.some((curr) => curr.key === ext.key)
        ),
      ],
      savedAnswers: currentProfile.savedAnswers,
      unconfirmedDefaults: currentProfile.unconfirmedDefaults,
    };

    onImport(merged);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-2xl lg:max-w-3xl glass-panel rounded-2xl overflow-hidden border border-zinc-700/80 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-2">
                {t("Importar Currículo em PDF")}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("Extraia contatos, histórico e resumos automaticamente com inteligência artificial.")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas */}
        <div className="px-5 pt-2 flex items-center gap-2 border-b border-zinc-800/80 bg-zinc-900/30 text-xs">
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("Extração de Currículo (PDF)")}
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'backup'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            {t("Restaurar Backup JSON")}
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'ai' && (
            <>
              {!hasApiKey && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-300">{t("Chave de API não configurada")}</p>
                    <p className="mt-0.5 text-amber-200/80 text-[11px]">
                      {t("Para extrair os dados do seu PDF com Gemini ou OpenAI, informe sua API Key na aba de configurações.")}
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                      className="mt-2 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-medium flex items-center gap-1 transition-colors"
                    >
                      {t("Configurações")} <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {!extractedProfile ? (
                <div className="space-y-3.5">
                  {/* Dropzone PDF */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => triggerFileInput(fileInputRef)}
                    className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                      isDragging
                        ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                        : pdfMeta
                        ? 'border-emerald-500/40 bg-zinc-900/60'
                        : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/30 hover:bg-zinc-900/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />

                    {isReadingPdf ? (
                      <div className="flex flex-col items-center gap-2 text-emerald-400 py-3">
                        <RefreshCw className="w-7 h-7 animate-spin" />
                        <span className="text-xs font-medium">{t("Extraindo texto do arquivo PDF...")}</span>
                      </div>
                    ) : pdfMeta ? (
                      <div className="w-full flex items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 font-bold text-xs">
                            {t("PDF")}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-100 truncate">{pdfMeta.name}</p>
                            <p className="text-[11px] text-zinc-400">
                              {pdfMeta.size} • {pdfMeta.pages} {pdfMeta.pages === 1 ? 'página' : 'páginas'} •{' '}
                              <span className="text-emerald-400 font-medium">{t("Texto extraído com sucesso")}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => triggerFileInput(fileInputRef)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 transition-colors"
                          >
                            {t("Trocar PDF")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPdfMeta(null);
                              setRawText('');
                            }}
                            className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title={t("Remover arquivo")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-100">
                            {t("Arraste e solte seu currículo em PDF aqui")}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {t("ou clique para navegar no seu computador")}
                          </p>
                        </div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono border border-zinc-700/60">
                          {t("Suporta PDF nativo (.pdf), Word exportado, .txt")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Visualizador/Editor do Texto Extraído */}
                  {rawText && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setShowTextPreview(!showTextPreview)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-medium transition-colors"
                      >
                        {showTextPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {showTextPreview ? 'Ocultar texto extraído do PDF' : 'Ver ou ajustar texto extraído do PDF'}
                      </button>

                      {showTextPreview && (
                        <textarea
                          rows={6}
                          value={rawText}
                          onChange={(e) => setRawText(e.target.value)}
                          placeholder={t("Texto extraído do PDF...")}
                          className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed select-text"
                        />
                      )}
                    </div>
                  )}

                  {/* Fallback de Colar Texto se não tiver arquivo */}
                  {!pdfMeta && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowTextPreview(!showTextPreview)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {showTextPreview ? 'Fechar caixa de texto' : 'Ou colar texto do LinkedIn / currículo manualmente'}
                      </button>

                      {showTextPreview && (
                        <div className="mt-2">
                          <textarea
                            rows={7}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder={t("Cole aqui o texto completo do seu currículo ou seções do LinkedIn...")}
                            className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed select-text"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      {t(errorMessage)}
                    </div>
                  )}
                </div>
              ) : (
                /* Card de Pré-visualização dos Dados Extraídos */
                <div className="space-y-4 animate-scale-in">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <FileCheck2 className="w-4 h-4" /> {t("Currículo analisado e estruturado com sucesso!")}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
                          <User className="w-3.5 h-3.5 text-blue-400" /> {t("Identificação & Contato")}
                        </span>
                        <p className="font-semibold text-zinc-100 truncate">
                          {extractedProfile.personal.fullName || '(Nome não identificado)'}
                        </p>
                        <p className="text-zinc-400 text-[11px] truncate">
                          {extractedProfile.personal.headline || '(Sem headline)'}
                        </p>
                        <p className="text-zinc-500 text-[10px] mt-1 truncate">
                          {extractedProfile.personal.email} • {extractedProfile.personal.phone}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
                          <Briefcase className="w-3.5 h-3.5 text-rose-400" /> {t("Histórico Profissional")}
                        </span>
                        <p className="font-semibold text-zinc-100">
                          {extractedProfile.experience.length} {t("experiência(s) identificada(s)")}
                        </p>
                        <div className="text-[11px] text-zinc-400 truncate mt-1">
                          {extractedProfile.experience.map((e) => e.role + ' @ ' + e.company).join('; ') || 'Nenhuma'}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
                          <GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> {t("Formação Acadêmica")}
                        </span>
                        <p className="font-semibold text-zinc-100">
                          {extractedProfile.education.length} {t("curso(s) identificado(s)")}
                        </p>
                        <div className="text-[11px] text-zinc-400 truncate mt-1">
                          {extractedProfile.education.map((e) => e.fieldOfStudy + ' (' + e.institution + ')').join('; ') || 'Nenhuma'}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
                          <FileText className="w-3.5 h-3.5 text-amber-400" /> {t("Resumos & Pitch")}
                        </span>
                        <p className="font-semibold text-zinc-100 truncate">{t("Pitch & Resumos Estruturados")}</p>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                          {extractedProfile.summary.shortSummary}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    {t("Como deseja salvar estes dados no seu cofre?")}
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-center space-y-3">
                <Database className="w-8 h-8 text-emerald-400 mx-auto" />
                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">{t("Restaurar do Arquivo de Backup")}</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                    {t("Selecione um arquivo")} <code>.json</code> {t("exportado do CandiFill para recuperar todas as suas informações instantaneamente.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => triggerFileInput(jsonFileInputRef)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white inline-flex items-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" /> {t("Escolher Arquivo JSON")}
                </button>
                <input
                  ref={jsonFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleJsonBackupUpload}
                  className="hidden"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  {t(errorMessage)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-800/80 bg-zinc-900/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {t("Cancelar")}
          </button>

          {activeTab === 'ai' && (
            <div className="flex items-center gap-2">
              {!extractedProfile ? (
                <button
                  onClick={handleProcessAi}
                  disabled={isLoading || isReadingPdf || !hasApiKey || !rawText.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-medium text-white flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-colors"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t("Analisando Currículo...")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" /> {t("Analisar com IA")}
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setExtractedProfile(null)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
                  >
                    {t("Voltar")}
                  </button>
                  <button
                    onClick={handleApplyMerge}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-emerald-300 border border-emerald-500/30 transition-colors"
                    title={t("Mantém os dados atuais e adiciona as novas experiências e formações")}
                  >
                    {t("Mesclar com Perfil Atual")}
                  </button>
                  <button
                    onClick={handleApplyFull}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> {t("Substituir Perfil Completo")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
