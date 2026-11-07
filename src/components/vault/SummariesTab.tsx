import React from 'react';
import { Sparkles } from 'lucide-react';
import { useVaultManagerTabs } from './VaultManagerTabsContext';

export const SummariesTab: React.FC = () => {
  const { activeTab, formData, setFormData, t, openAiEnhancer } = useVaultManagerTabs();

  return (
    <>
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

    </>
  );
};