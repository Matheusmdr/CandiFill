import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useVaultManagerTabs } from './VaultManagerTabsContext';

export const ExperienceTab: React.FC = () => {
  const {
    activeTab, formData, setFormData, t,
    handleAddExperience, handleRemoveExperience, handleAddEducation, handleRemoveEducation,
  } = useVaultManagerTabs();

  return (
    <>
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

    </>
  );
};