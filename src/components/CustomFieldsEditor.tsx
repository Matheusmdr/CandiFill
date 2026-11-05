import React, { useState } from 'react';
import { Plus, Trash2, Tag, Pencil, Check, X } from 'lucide-react';
import { CustomField, SavedAnswer } from '../types/profile';

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  savedAnswers: SavedAnswer[];
  onSavedAnswersChange: (answers: SavedAnswer[]) => void;
}

const CATEGORIES: Array<CustomField['category']> = ['Pessoal', 'Documento', 'Links', 'Diversos'];

export const CustomFieldsEditor: React.FC<CustomFieldsEditorProps> = ({ fields, onChange, savedAnswers, onSavedAnswersChange }) => {
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<CustomField['category']>('Diversos');
  const [isAdding, setIsAdding] = useState(false);

  // Estado para edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState<CustomField['category']>('Diversos');
  const [editValue, setEditValue] = useState('');

  const handleAddField = () => {
    if (!newLabel.trim() || !newValue.trim()) return;

    const generatedKey = newKey.trim()
      ? newKey.trim().toLowerCase().replace(/\s+/g, '_')
      : newLabel.trim().toLowerCase().replace(/\s+/g, '_');

    const newField: CustomField = {
      id: `cf-${Date.now()}`,
      label: newLabel.trim(),
      key: generatedKey,
      value: newValue.trim(),
      category: newCategory,
    };

    onChange([...fields, newField]);
    setNewLabel('');
    setNewKey('');
    setNewValue('');
    setNewCategory('Diversos');
    setIsAdding(false);
  };

  const handleStartEdit = (field: CustomField) => {
    setEditingId(field.id);
    setEditLabel(field.label);
    setEditCategory(field.category);
    setEditValue(field.value);
  };

  const handleSaveEdit = (id: string) => {
    if (!editLabel.trim() || !editValue.trim()) return;

    onChange(
      fields.map((f) =>
        f.id === id
          ? {
              ...f,
              label: editLabel.trim(),
              category: editCategory,
              value: editValue.trim(),
            }
          : f
      )
    );
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleRemoveField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-400" />
            Campos Customizados (Chave & Valor)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cadastre perguntas frequentes de formulários da Gupy, Greenhouse, Lever ou Workday.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar Campo
        </button>
      </div>

      {/* Formulário de Novo Campo */}
      {isAdding && (
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/40 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-xs font-semibold text-emerald-400">Novo Dado Customizado</span>
            <button
              onClick={() => setIsAdding(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Rótulo / Nome da Pergunta *</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  if (!newKey) {
                    setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                  }
                }}
                placeholder="Ex: Nível de Inglês, CPF, RG..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Chave Interna (Opcional)</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Ex: english_level"
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Categoria</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as CustomField['category'])}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">Resposta / Valor a Preencher *</label>
            <textarea
              rows={2}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Digite exatamente o texto que deseja colar nos formulários..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={handleAddField}
              disabled={!newLabel.trim() || !newValue.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
            >
              Salvar Campo
            </button>
          </div>
        </div>
      )}

      {/* Lista de Campos Cadastrados */}
      {fields.length === 0 ? (
        <div className="p-8 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
          Nenhum campo customizado cadastrado ainda. Clique em &quot;Adicionar Campo&quot; acima.
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => {
            const isEditing = editingId === field.id;

            if (isEditing) {
              return (
                <div
                  key={field.id}
                  className="p-4 rounded-xl bg-zinc-900/90 border border-emerald-500/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">Editando Campo: {field.key}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSaveEdit(field.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white flex items-center gap-1 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-zinc-400 block mb-1">Nome / Rótulo</label>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-400 block mb-1">Categoria</label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as CustomField['category'])}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-zinc-400 block mb-1">Valor</label>
                    <textarea
                      rows={2}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={field.id}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-200">{field.label}</span>
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                      {field.key}
                    </span>
                    <span className="text-[10px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded-full">
                      {field.category}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono bg-zinc-950/60 px-2.5 py-1.5 rounded border border-zinc-800/60 truncate">
                    {field.value}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(field)}
                    title="Editar campo"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field.id)}
                    title="Remover campo"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="space-y-3 border-t border-zinc-800 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Respostas salvas de formulários</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Respostas revisadas e salvas por site. Por padrão, só são reutilizadas no mesmo domínio; você pode liberar cada resposta para outros sites.
          </p>
        </div>
        {savedAnswers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-5 text-center text-xs text-zinc-500">
            Nenhuma resposta salva ainda. O CandiFill pode sugerir respostas novas depois de um preenchimento.
          </div>
        ) : (
          <div className="space-y-2">
            {savedAnswers.map((answer) => (
              <article key={answer.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="min-w-0">
                  <h4 className="text-xs font-medium text-zinc-200">{answer.question}</h4>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-zinc-400">{answer.answer}</p>
                  {answer.site && <p className="mt-1 text-[10px] text-zinc-500">Salva em {answer.site}</p>}
                  <label className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={answer.reuseOnAnySite}
                      onChange={(event) => onSavedAnswersChange(savedAnswers.map((item) => item.id === answer.id ? { ...item, reuseOnAnySite: event.target.checked } : item))}
                    />
                    Reutilizar em outros sites
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onSavedAnswersChange(savedAnswers.filter((item) => item.id !== answer.id))}
                  aria-label={`Remover resposta salva: ${answer.question}`}
                  title="Remover resposta salva"
                  className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
