import React from 'react';
import { Check, CheckCircle, Download, Eye, EyeOff, FileUp, Keyboard, Loader2, Palette, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { THEMES } from '../../types/theme';
import { Locale } from '../../services/localization';
import { useVaultManagerTabs } from './VaultManagerTabsContext';

export const SettingsTab: React.FC = () => {
  const {
    activeTab, formData, setFormData, t, locale, setLocale, profileId, onSave,
    availableAiModels, modelsLoadedForProvider, isLoadingAiModels, isTestingAiModel,
    aiModelStatus, setAiModelStatus, handleLoadAiModels, handleTestAiModel,
    showApiKey, setShowApiKey, handleExportBackup, handleOpenCvImporter,
  } = useVaultManagerTabs();

  return (
    <>
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
    </>
  );
};
