import { CandidateProfile } from '../types/profile';
import { getFieldDescriptor, getProfileFieldChoices } from './siteFieldMappings';

export function startFieldMapping(profile: CandidateProfile, profileId: string, t: (message: string, values?: Record<string, string | number>) => string, showFloatingToast: (message: string, isSuccess?: boolean) => void): void {
  document.getElementById('candifill-field-mapping')?.remove();
  const choices = getProfileFieldChoices(profile);
  if (choices.length === 0) {
    showFloatingToast(t('Adicione dados ao perfil antes de criar um mapeamento.'), false);
    return;
  }

  const host = document.createElement('div');
  host.id = 'candifill-field-mapping';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const panel = document.createElement('section');
  panel.style.cssText = 'pointer-events:auto;position:fixed;right:20px;top:20px;width:min(360px,calc(100vw - 40px));padding:16px;border:1px solid #3f3f46;border-radius:16px;background:#09090b;color:#f4f4f5;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.6);';
  const heading = document.createElement('strong');
  heading.textContent = t('Mapeamento de campo');
  heading.style.cssText = 'display:block;font-size:14px;margin-bottom:6px;';
  const instruction = document.createElement('p');
  instruction.textContent = t('Clique em um campo vazio que o CandiFill não reconheceu.');
  instruction.style.cssText = 'margin:0 0 12px;color:#a1a1aa;line-height:1.5;';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = t('Cancelar');
  cancel.style.cssText = 'border:1px solid #3f3f46;border-radius:8px;background:#18181b;color:#d4d4d8;padding:7px 10px;cursor:pointer;';
  cancel.onclick = () => { document.removeEventListener('click', pickField, true); host.remove(); };
  panel.append(heading, instruction, cancel);
  shadow.append(panel);
  document.documentElement.append(host);

  const pickField = (event: MouseEvent) => {
    const selector = 'input,textarea,select,[role="combobox"]';
    const target = event.composedPath()
      .filter((entry): entry is Element => entry instanceof Element)
      .map((entry) => entry.matches(selector) ? entry : entry.closest(selector))
      .find((entry): entry is HTMLElement => Boolean(entry));
    if (!target || ('disabled' in target && Boolean((target as HTMLInputElement).disabled)) || target.getAttribute('aria-disabled') === 'true' ||
      ('readOnly' in target && Boolean((target as HTMLInputElement).readOnly)) || target.getAttribute('aria-readonly') === 'true' ||
      (target instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset', 'file', 'password', 'checkbox', 'radio'].includes(target.type))) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    document.removeEventListener('click', pickField, true);
    instruction.textContent = t('Campo selecionado: {label}', { label: getFieldDescriptor(target).label || t('Campo sem rótulo') });

    const select = document.createElement('select');
    select.setAttribute('aria-label', t('Qual dado do perfil deve preencher este campo?'));
    select.style.cssText = 'display:block;width:100%;margin:10px 0;padding:9px;border:1px solid #3f3f46;border-radius:8px;background:#18181b;color:#f4f4f5;';
    for (const choice of choices) {
      const option = document.createElement('option');
      option.value = choice.key;
      option.textContent = `${choice.label} — ${choice.value.slice(0, 70)}`;
      select.append(option);
    }
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = t('Salvar mapeamento');
    save.style.cssText = 'border:0;border-radius:8px;background:#10b981;color:#022c22;padding:8px 11px;font-weight:700;cursor:pointer;margin-right:8px;';
    save.onclick = () => {
      const choice = choices.find((item) => item.key === select.value);
      if (!choice) return;
      save.disabled = true;
      save.textContent = t('Salvando…');
      chrome.runtime.sendMessage({
        action: 'SAVE_SITE_FIELD_MAPPING',
        mapping: {
          id: globalThis.crypto?.randomUUID?.() || `mapping-${Date.now()}`,
          site: window.location.hostname.toLowerCase(),
          profileId,
          selector: getFieldDescriptor(target),
          sourceKey: choice.key,
          sourceLabel: choice.label,
          createdAt: new Date().toISOString(),
        },
      }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) showFloatingToast(t('Não foi possível salvar o mapeamento.'), false);
        else showFloatingToast(t('Mapeamento salvo para este site.'), true);
        host.remove();
      });
    };
    const chooseAgain = document.createElement('button');
    chooseAgain.type = 'button';
    chooseAgain.textContent = t('Escolher outro campo');
    chooseAgain.style.cssText = 'border:1px solid #3f3f46;border-radius:8px;background:#18181b;color:#d4d4d8;padding:8px 10px;cursor:pointer;';
    chooseAgain.onclick = () => {
      select.remove();
      save.remove();
      chooseAgain.remove();
      instruction.textContent = t('Clique em um campo vazio que o CandiFill não reconheceu.');
      document.addEventListener('click', pickField, true);
    };
    panel.append(select, save, chooseAgain);
  };
  document.addEventListener('click', pickField, true);
}
