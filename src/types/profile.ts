import { ThemeId } from './theme';

export interface PersonalInfo {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  nationality: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface SalaryExpectation {
  currency: string;
  desiredSalary: string;
  minimumSalary: string;
  contractType: string; // CLT, PJ, Contractor, Freelance
  availability: string; // Imediata, 15 dias, 30 dias
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface ProfessionalSummary {
  shortSummary: string; // Pitch de 2-3 frases
  longSummary: string;  // Resumo executivo completo
  coverLetterSnippet: string; // Parágrafo introdutório padrão
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  value: string;
  category: 'Pessoal' | 'Documento' | 'Links' | 'Diversos';
}

export interface AiConfig {
  provider: 'gemini' | 'openai';
  apiKey: string;
  model: string;
  customPrompt?: string;
}

export interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  site: string;
  reuseOnAnySite: boolean;
  createdAt: string;
}

export interface UnconfirmedProfileValue {
  key: string;
  label: string;
  value: string;
}

export interface ResumeFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  base64: string;
}

export interface CandidateProfile {
  schemaVersion: number;
  unconfirmedDefaults: UnconfirmedProfileValue[];
  personal: PersonalInfo;
  salary: SalaryExpectation;
  summary: ProfessionalSummary;
  education: EducationItem[];
  experience: ExperienceItem[];
  customFields: CustomField[];
  savedAnswers: SavedAnswer[];
  aiConfig: AiConfig;
  theme?: ThemeId;
  resumeFile?: ResumeFile;
}

export interface CandidateProfileEntry {
  id: string;
  name: string;
  targetRole: string;
  description: string;
  createdAt: string;
  profile: CandidateProfile;
}

export interface CandidateProfileCollection {
  schemaVersion: 1;
  activeProfileId: string;
  profiles: CandidateProfileEntry[];
}

export interface FlattenedSearchItem {
  id: string;
  label: string;
  category: 'Contato' | 'Links' | 'Salário' | 'Resumo' | 'Experiência' | 'Formação' | 'Custom';
  value: string;
  preview?: string;
  keywords: string[];
}
