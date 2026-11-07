import React from 'react';
import { Briefcase, Download, FileUp, Globe, Paperclip, Trash2, User } from 'lucide-react';
import { useVaultManagerTabs } from './VaultManagerTabsContext';

export const PersonalTab: React.FC = () => {
  const {
    activeTab, formData, setFormData, t, resolveUnconfirmedDefault,
    resumeInputRef, processResumeFileObject, handleResumeFileUpload,
    handleSelectResumeClick, handleRemoveResume, handleDownloadResume,
    isResumeDragging, setIsResumeDragging,
  } = useVaultManagerTabs();

  return (
    <>
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

    </>
  );
};