import React, { useState } from 'react';
import { Sparkles, Check, Copy, AlertCircle, RefreshCw, X, ArrowRight } from 'lucide-react';
import { AiConfig } from '../types/profile';
import { enhanceTextWithAi, cleanAiOutput } from '../services/ai';

interface AiEnhancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  fieldLabel: string;
  aiConfig: AiConfig;
  onApply: (enhancedText: string) => void;
  onOpenSettings?: () => void;
}

const TONE_PRESETS = [
  {
    id: 'concise',
    label: 'Mais Conciso & Direto',
    prompt: 'Reescreva este resumo tornando-o extremamente conciso, direto e sem jargões desnecessários, ideal para leitura rápida por recrutadores.',
  },
  {
    id: 'impact',
    label: 'Alto Impacto & Resultados',
    prompt: 'Aprimore este texto focando em verbos de ação fortes, impacto nos negócios e liderança técnica, no estilo de executivos de tecnologia.',
  },
  {
    id: 'formal',
    label: 'Corporativo & Formal',
    prompt: 'Ajuste a redação para um tom corporativo, polido e elegante, com precisão gramatical impecável.',
  },
  {
    id: 'english',
    label: 'Traduzir para Inglês Tech',
    prompt: 'Translate and polish this professional summary into fluent, natural US English tailored for Silicon Valley tech applications and recruiters.',
  },
];

export const AiEnhancerModal: React.FC<AiEnhancerModalProps> = ({
  isOpen,
  onClose,
  originalText,
  fieldLabel,
  aiConfig,
  onApply,
  onOpenSettings,
}) => {
  const [selectedPreset, setSelectedPreset] = useState(TONE_PRESETS[0].id);
  const [enhancedText, setEnhancedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hasApiKey = Boolean(aiConfig.apiKey && aiConfig.apiKey.trim().length > 0);

  const handleGenerate = async () => {
    if (!hasApiKey) {
      setErrorMessage('Configure sua chave de API nas configurações para ativar o assistente de IA.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const preset = TONE_PRESETS.find((p) => p.id === selectedPreset);
    const customPrompt = preset?.prompt || TONE_PRESETS[0].prompt;

    try {
      const result = await enhanceTextWithAi({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        text: originalText,
        customPrompt,
      });

      setEnhancedText(cleanAiOutput(result));
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      setErrorMessage(errStr || 'Falha ao processar solicitação com a IA.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!enhancedText) return;
    navigator.clipboard.writeText(enhancedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (!enhancedText) return;
    onApply(enhancedText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl glass-panel rounded-2xl overflow-hidden border border-zinc-700/80 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 flex items-center gap-2 text-base">
                Refinar com IA
                <span className="text-xs font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                  {aiConfig.provider.toUpperCase()} ({aiConfig.model})
                </span>
              </h3>
              <p className="text-xs text-zinc-400">Aprimorando: <span className="text-zinc-300 font-medium">{fieldLabel}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Se não houver API key */}
          {!hasApiKey ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-300">Chave de API não configurada</p>
                <p className="text-xs text-amber-200/80 mt-1">
                  Para utilizar o aprimoramento inteligente com Gemini ou OpenAI, informe sua API Key na aba de Configurações.
                </p>
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-medium text-amber-200 flex items-center gap-1.5 transition-colors"
                  >
                    Ir para Configurações de IA <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Seletor de Estilo / Tom */}
              <div>
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">
                  Escolha o Objetivo do Aprimoramento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPreset(preset.id)}
                      className={`px-3 py-2.5 rounded-xl text-left border text-xs transition-all ${
                        selectedPreset === preset.id
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 font-medium'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comparativo de Texto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Texto Original */}
                <div>
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Original
                  </label>
                  <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300 leading-relaxed max-h-44 overflow-y-auto whitespace-pre-wrap select-text">
                    {originalText || <span className="text-zinc-500 italic">Nenhum texto preenchido ainda.</span>}
                  </div>
                </div>

                {/* Versão Aprimorada */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Sugestão da IA
                    </label>
                    {enhancedText && (
                      <button
                        onClick={handleCopy}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    )}
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs text-zinc-200 leading-relaxed min-h-[110px] max-h-44 overflow-y-auto whitespace-pre-wrap select-text">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-28 text-emerald-400 gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="text-xs text-zinc-400">Refinando com inteligência artificial...</span>
                      </div>
                    ) : enhancedText ? (
                      enhancedText
                    ) : (
                      <span className="text-zinc-500 italic">
                        Clique em &quot;Processar com IA&quot; para gerar a sugestão aprimorada.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  {errorMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={isLoading || !hasApiKey || !originalText.trim()}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium text-zinc-200 flex items-center gap-2 border border-zinc-700 transition-colors"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {enhancedText ? 'Gerar Novamente' : 'Processar com IA'}
                </>
              )}
            </button>

            {enhancedText && (
              <button
                onClick={handleApply}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Aplicar no Perfil
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
