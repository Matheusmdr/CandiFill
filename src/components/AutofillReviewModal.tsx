import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';

export interface AutofillPreview {
  totalFilled: number;
  fieldsFilled: string[];
  fillableFields: Array<{ id: string; label: string }>;
  fieldsSkipped: string[];
  fieldsSkippedCount: number;
  fieldsDetected: number;
  unmatchedFields: string[];
  usedSavedAnswerIds: string[];
}

interface Props {
  preview: AutofillPreview;
  site: string;
  onContinue: (selectedFieldIds: string[]) => void;
  onClose: () => void;
  onReport: () => void;
  onMapFields: () => void;
}

export const AutofillReviewModal: React.FC<Props> = ({ preview, site, onContinue, onClose, onReport, onMapFields }) => {
  const { t } = useLocale();
  const [selectedFieldIds, setSelectedFieldIds] = useState(() => new Set(preview.fillableFields.map((field) => field.id)));
  const unrecognizedCount = Math.max(0, preview.fieldsDetected - preview.totalFilled - preview.fieldsSkippedCount);
  const toggleField = (id: string) => setSelectedFieldIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="autofill-review-title" className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="autofill-review-title" className="text-base font-semibold">{t('Revise o preenchimento')}</h2>
            <p className="mt-1 text-xs text-zinc-400">{site}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Fechar')} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <p className="mt-4 text-xs leading-relaxed text-zinc-300">{t('Esta prévia só analisa os campos. Nada será alterado até você continuar. O CandiFill não envia o formulário.')}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3"><strong className="block text-lg text-emerald-300">{preview.totalFilled}</strong><span className="text-[10px] text-zinc-400">{t('Podem ser preenchidos')}</span></div>
          <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-3"><strong className="block text-lg text-amber-200">{preview.fieldsSkippedCount}</strong><span className="text-[10px] text-zinc-400">{t('Já têm resposta')}</span></div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3"><strong className="block text-lg text-zinc-200">{unrecognizedCount}</strong><span className="text-[10px] text-zinc-400">{t('Sem correspondência')}</span></div>
        </div>

        {preview.fillableFields.length > 0 && <div className="mt-4"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />{t('Escolha os campos para preencher')}</h3><button type="button" onClick={() => setSelectedFieldIds(selectedFieldIds.size === preview.fillableFields.length ? new Set() : new Set(preview.fillableFields.map((field) => field.id)))} className="text-[10px] text-zinc-400 underline underline-offset-2 hover:text-zinc-200">{selectedFieldIds.size === preview.fillableFields.length ? t('Desmarcar todos') : t('Selecionar todos')}</button></div><ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-zinc-300">{preview.fillableFields.map((field) => <li key={field.id}><label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-900"><input type="checkbox" checked={selectedFieldIds.has(field.id)} onChange={() => toggleField(field.id)} className="h-3.5 w-3.5 accent-emerald-500" /><span>{field.label}</span></label></li>)}</ul><p className="mt-1 text-[10px] text-zinc-500">{t('{count} selecionados', { count: selectedFieldIds.size })}</p></div>}
        {preview.fieldsSkipped.length > 0 && <p className="mt-3 text-[11px] text-amber-200/80">{t('Respostas que já existem serão mantidas.')}</p>}
        {preview.unmatchedFields.length > 0 && <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5"><summary className="cursor-pointer text-[11px] font-medium text-zinc-300">{t('Diagnóstico: {count} campos sem correspondência', { count: preview.unmatchedFields.length })}</summary><ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[10px] text-zinc-500">{preview.unmatchedFields.map((field, index) => <li key={`${field}-${index}`}>• {field}</li>)}</ul></details>}
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('A prévia não consegue avaliar todos os controles personalizados do site. Confira o formulário antes de enviar.')}</p>

        <footer className="mt-5 flex flex-wrap justify-between gap-2 border-t border-zinc-800 pt-4">
          <div className="flex flex-wrap gap-1"><button type="button" onClick={onReport} className="rounded-lg px-2 py-2 text-xs text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200">{t('Relatar incompatibilidade')}</button>{preview.unmatchedFields.length > 0 && <button type="button" onClick={onMapFields} className="rounded-lg px-2 py-2 text-xs text-emerald-300 underline decoration-emerald-800 underline-offset-2 hover:text-emerald-200">{t('Mapear um campo')}</button>}</div>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900">{t('Cancelar')}</button><button type="button" disabled={selectedFieldIds.size === 0} onClick={() => onContinue(Array.from(selectedFieldIds))} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">{t('Preencher {count} campos', { count: selectedFieldIds.size })}</button></div>
        </footer>
      </section>
    </div>
  );
};
