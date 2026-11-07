export type NativeFormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export type AutofillField = NativeFormField | HTMLElement;

const NATIVE_FIELD_SELECTOR = 'input, textarea, select';

/**
 * Queries a document or an element tree, including every open Shadow Root below it.
 * Native fields in the document are returned before fields nested in shadow trees so
 * existing preview field IDs keep their order when a page has no Shadow DOM.
 */
export function queryDeepElements<T extends Element>(root: ParentNode, selector: string): T[] {
  const results: T[] = [];
  const seenElements = new Set<Element>();
  const seenRoots = new Set<ParentNode>();

  const visit = (currentRoot: ParentNode) => {
    if (seenRoots.has(currentRoot)) return;
    seenRoots.add(currentRoot);

    if (currentRoot instanceof Element && currentRoot.matches(selector) && !seenElements.has(currentRoot)) {
      results.push(currentRoot as T);
      seenElements.add(currentRoot);
    }

    currentRoot.querySelectorAll<T>(selector).forEach((element) => {
      if (!seenElements.has(element)) {
        results.push(element);
        seenElements.add(element);
      }
    });

    const elements = currentRoot instanceof Element
      ? [currentRoot, ...Array.from(currentRoot.querySelectorAll<HTMLElement>('*'))]
      : Array.from(currentRoot.querySelectorAll<HTMLElement>('*'));
    elements.forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };

  visit(root);
  return results;
}

export function isNativeFormField(element: Element): element is NativeFormField {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

export function collectAutofillFields(root: ParentNode = document): AutofillField[] {
  const nativeFields = queryDeepElements<NativeFormField>(root, NATIVE_FIELD_SELECTOR);
  const nativeSet = new Set<Element>(nativeFields);
  const customComboboxes = queryDeepElements<HTMLElement>(root, '[role="combobox"]')
    .filter((combobox) => {
      if (nativeSet.has(combobox)) return false;
      // If the widget exposes a real nested form control, filling that control is
      // more reliable and avoids presenting the same widget twice.
      return !queryDeepElements<NativeFormField>(combobox, NATIVE_FIELD_SELECTOR).some((field) =>
        !(field instanceof HTMLInputElement && field.type === 'hidden'),
      );
    });

  return [...nativeFields, ...customComboboxes];
}

export function observeOpenShadowRoots(
  observer: MutationObserver,
  root: ParentNode,
  observedRoots: WeakSet<ShadowRoot>,
): void {
  const elements = root instanceof Element
    ? [root as HTMLElement, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    : Array.from(root.querySelectorAll<HTMLElement>('*'));
  elements.forEach((element) => {
    const shadowRoot = element.shadowRoot;
    if (!shadowRoot || observedRoots.has(shadowRoot)) return;
    observedRoots.add(shadowRoot);
    observer.observe(shadowRoot, { childList: true, subtree: true });
    observeOpenShadowRoots(observer, shadowRoot, observedRoots);
  });
}

function getReferencedLabelText(element: HTMLElement, attribute: 'aria-labelledby'): string {
  const ids = element.getAttribute(attribute)?.split(/\s+/).filter(Boolean) || [];
  if (ids.length === 0) return '';

  const root = element.getRootNode();
  const searchRoot = root instanceof Document || root instanceof ShadowRoot ? root : element.ownerDocument;
  const idElements = queryDeepElements<HTMLElement>(searchRoot, '[id]');
  return ids
    .map((id) => idElements.find((candidate) => candidate.id === id)?.textContent?.trim() || element.ownerDocument.getElementById(id)?.textContent?.trim() || '')
    .filter(Boolean)
    .join(' ');
}

function getExplicitFormFieldLabel(element: HTMLElement): string {
  const nativeLabels = isNativeFormField(element)
    ? Array.from(element.labels || []).map((label) => label.textContent?.trim() || '').filter(Boolean).join(' ')
    : '';

  return nativeLabels ||
    element.getAttribute('aria-label')?.trim() ||
    getReferencedLabelText(element, 'aria-labelledby') ||
    element.getAttribute('placeholder')?.trim() ||
    element.getAttribute('data-placeholder')?.trim() ||
    element.getAttribute('title')?.trim() || '';
}

export function getFormFieldLabel(element: HTMLElement): string {
  const ownLabel = getExplicitFormFieldLabel(element);
  if (ownLabel) return ownLabel;

  const combobox = element.closest<HTMLElement>('[role="combobox"]');
  if (combobox && combobox !== element) {
    const comboboxLabel = getExplicitFormFieldLabel(combobox);
    if (comboboxLabel) return comboboxLabel;
  }

  return element.getAttribute('name')?.trim() || element.id || '';
}
