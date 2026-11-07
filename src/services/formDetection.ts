import { isLikelyJobApplicationPage } from './pageDetection';
import { collectAutofillFields, getFormFieldLabel, queryDeepElements } from './formFields';

/** Determines whether the current page looks like a job application form. */
export function shouldSuggestAutofill(): boolean {
  const fields = collectAutofillFields();
  const visibleFields = [...fields, ...queryDeepElements<HTMLElement>(document, '[contenteditable="true"]')]
    .filter((field) => !field.matches('input[type="hidden"],input[type="submit"],input[type="button"],input[type="reset"],input[type="image"]'))
    .filter((field) => {
      if (('disabled' in field && Boolean((field as HTMLInputElement).disabled)) || field.getAttribute('aria-disabled') === 'true') return false;
      const style = window.getComputedStyle(field);
      return style.display !== 'none' && style.visibility !== 'hidden' && field.getClientRects().length > 0;
    });

  if (visibleFields.length < 2) return false;

  const fieldContext = visibleFields.map((field) => {
    const wrappingLabel = field.closest('label')?.innerText || '';
    return [
      field.getAttribute('name'),
      field.id,
      field.getAttribute('placeholder'),
      field.getAttribute('aria-label'),
      field.getAttribute('aria-labelledby'),
      field.getAttribute('autocomplete'),
      field.getAttribute('role'),
      getFormFieldLabel(field),
      wrappingLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  });

  const candidateFieldCount = fieldContext.filter((context) => {
    const normalized = context.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /name|nome|email|e-mail|phone|telefone|mobile|resume|curriculo|curriculum|\bcv\b|linkedin|cover.?letter|carta.?de.?apresent|portfolio|website|address|endereco|salary|salario|experience|experiencia|position|cargo/.test(normalized);
  }).length;
  if (candidateFieldCount < 2) return false;

  const formContext = queryDeepElements<HTMLFormElement>(document, 'form')
    .map((form) => `${form.getAttribute('action') || ''} ${form.innerText || ''}`)
    .join(' ')
    .slice(0, 10000);
  const pageContext = `${window.location.href} ${document.title} ${formContext}`.toLowerCase();
  return isLikelyJobApplicationPage(pageContext);
}
