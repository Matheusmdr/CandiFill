import { CandidateProfile } from '../types/profile';
import { getFormFieldLabel } from './formFields';

export interface ProfileFieldChoice {
  key: string;
  label: string;
  value: string;
}

const PHONE_COUNTRY_ALIASES: Record<string, string[]> = {
  '1': ['United States', 'Canada', 'US', 'CA'], '44': ['United Kingdom', 'UK', 'GB'],
  '33': ['France', 'FR'], '34': ['Spain', 'ES'], '49': ['Germany', 'DE'],
  '55': ['Brasil', 'Brazil', 'BR'], '61': ['Australia', 'AU'], '81': ['Japan', 'JP'],
  '351': ['Portugal', 'PT'], '358': ['Finland', 'FI'],
};

function phoneCountrySelectionValue(phone: string, nationality = ''): string {
  const normalized = phone.trim().replace(/[^\d+]/g, '');
  const digits = normalized.startsWith('00') ? normalized.slice(2) : normalized.startsWith('+') ? normalized.slice(1) : '';
  const country = nationality.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const countryDialCodes: Record<string, string> = {
    brazil: '55', brasil: '55', br: '55', portugal: '351', pt: '351',
    'united states': '1', usa: '1', us: '1', canada: '1', ca: '1',
    'united kingdom': '44', uk: '44', gb: '44', france: '33', fr: '33',
    spain: '34', es: '34', germany: '49', de: '49', italy: '39', it: '39',
    australia: '61', au: '61', japan: '81', jp: '81', india: '91', in: '91',
  };
  const dialCode = digits
    ? Object.keys(PHONE_COUNTRY_ALIASES).sort((a, b) => b.length - a.length).find((code) => digits.startsWith(code)) || digits.slice(0, 3)
    : countryDialCodes[country];
  if (!dialCode) return '';
  return [`+${dialCode}`, dialCode, ...(PHONE_COUNTRY_ALIASES[dialCode] || [])].join(' ');
}

const STANDARD_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'personal.fullName', label: 'Nome completo' },
  { key: 'personal.headline', label: 'Título profissional' },
  { key: 'personal.email', label: 'E-mail' },
  { key: 'personal.phone', label: 'Telefone' },
  { key: 'personal.location', label: 'Localização' },
  { key: 'personal.nationality', label: 'Nacionalidade' },
  { key: 'personal.linkedin', label: 'LinkedIn' },
  { key: 'personal.github', label: 'GitHub' },
  { key: 'personal.portfolio', label: 'Portfólio' },
  { key: 'salary.desiredSalary', label: 'Pretensão salarial' },
  { key: 'salary.contractType', label: 'Tipo de contrato' },
  { key: 'salary.availability', label: 'Disponibilidade' },
  { key: 'summary.shortSummary', label: 'Resumo curto' },
  { key: 'summary.longSummary', label: 'Resumo profissional' },
  { key: 'summary.coverLetterSnippet', label: 'Apresentação para a vaga' },
];

export function getProfileFieldChoices(profile: CandidateProfile): ProfileFieldChoice[] {
  const choices = STANDARD_FIELDS.flatMap(({ key, label }) => {
    if (profile.unconfirmedDefaults.some((item) => item.key === key)) return [];
    const value = key.split('.').reduce<unknown>((current, part) =>
      typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[part] : undefined, profile);
    return typeof value === 'string' && value.trim() ? [{ key, label, value }] : [];
  });
  for (const field of profile.customFields) {
    if (profile.unconfirmedDefaults.some((item) => item.key === `customFields.${field.id}`)) continue;
    if (field.value.trim()) choices.push({ key: `customFields.${field.id}`, label: field.label, value: field.value });
  }
  const phoneCountryValue = phoneCountrySelectionValue(profile.personal.phone, profile.personal.nationality);
  if (phoneCountryValue) choices.push({ key: 'personal.phoneCountryCode', label: 'Código do país do telefone', value: phoneCountryValue.split(' ')[0] });
  return choices;
}

export function getProfileFieldValue(profile: CandidateProfile, key: string): string {
  if (profile.unconfirmedDefaults.some((item) => item.key === key)) return '';
  if (key === 'personal.phoneCountryCode') return phoneCountrySelectionValue(profile.personal.phone, profile.personal.nationality);
  const customPrefix = 'customFields.';
  if (key.startsWith(customPrefix)) {
    return profile.customFields.find((field) => field.id === key.slice(customPrefix.length))?.value || '';
  }
  const value = key.split('.').reduce<unknown>((current, part) =>
    typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[part] : undefined, profile);
  return typeof value === 'string' ? value : '';
}

function normalizeLabel(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function getFieldDescriptor(element: HTMLElement) {
  const role = element.getAttribute('role') || '';
  const label = getFormFieldLabel(element);
  return {
    id: element.id,
    name: element.getAttribute('name') || '',
    label: label.slice(0, 300),
    tagName: element.tagName.toLowerCase(),
    inputType: element instanceof HTMLInputElement ? element.type.toLowerCase() : role || element.tagName.toLowerCase(),
    role,
  };
}

export function matchesMappedField(element: HTMLElement, selector: {
  id: string; name: string; label: string; tagName: string; inputType: string;
  role?: string;
}): boolean {
  const elementRole = element.getAttribute('role') || '';
  if (selector.role ? elementRole !== selector.role : element.tagName.toLowerCase() !== selector.tagName) return false;
  const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : element.tagName.toLowerCase();
  if (selector.inputType && inputType !== selector.inputType && !(selector.role && selector.inputType === selector.role)) return false;
  const actualLabel = normalizeLabel(getFieldDescriptor(element).label);
  return Boolean(
    (selector.id && element.id === selector.id) ||
    (selector.name && element.getAttribute('name') === selector.name && (!selector.label || actualLabel === normalizeLabel(selector.label))) ||
    (selector.label && actualLabel === normalizeLabel(selector.label))
  );
}
