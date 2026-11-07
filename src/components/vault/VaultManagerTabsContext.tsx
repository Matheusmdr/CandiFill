import React, { createContext, useContext } from 'react';
import { CandidateProfile } from '../../types/profile';
import { AvailableAiModel } from '../../services/aiModels';
import { Locale } from '../../services/localization';

export type VaultTab = 'personal' | 'summaries' | 'experience' | 'applications' | 'custom' | 'settings';
export type AiModelStatus = { message: string; type: 'success' | 'info' | 'error' } | null;

export interface VaultManagerTabsContextValue {
  activeTab: VaultTab;
  formData: CandidateProfile;
  setFormData: React.Dispatch<React.SetStateAction<CandidateProfile>>;
  t: (message: string, values?: Record<string, string | number>) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  profileId: string;
  onSave: (updatedProfile: CandidateProfile, profileId?: string) => Promise<void>;
  resolveUnconfirmedDefault: (key: string, keepValue: boolean) => void;
  resumeInputRef: React.RefObject<HTMLInputElement>;
  processResumeFileObject: (file: File) => void;
  handleResumeFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectResumeClick: () => void;
  handleRemoveResume: () => void;
  handleDownloadResume: () => void;
  isResumeDragging: boolean;
  setIsResumeDragging: React.Dispatch<React.SetStateAction<boolean>>;
  openAiEnhancer: (key: 'shortSummary' | 'longSummary' | 'coverLetterSnippet', label: string, text: string) => void;
  handleAddExperience: () => void;
  handleRemoveExperience: (id: string) => void;
  handleAddEducation: () => void;
  handleRemoveEducation: (id: string) => void;
  availableAiModels: AvailableAiModel[];
  modelsLoadedForProvider: 'gemini' | 'openai' | null;
  isLoadingAiModels: boolean;
  isTestingAiModel: boolean;
  aiModelStatus: AiModelStatus;
  setAiModelStatus: React.Dispatch<React.SetStateAction<AiModelStatus>>;
  handleLoadAiModels: () => void;
  handleTestAiModel: () => void;
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  handleExportBackup: () => void;
  handleOpenCvImporter: () => void;
}

const VaultManagerTabsContext = createContext<VaultManagerTabsContextValue | null>(null);

export const VaultManagerTabsProvider: React.FC<{
  value: VaultManagerTabsContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <VaultManagerTabsContext.Provider value={value}>
    {children}
  </VaultManagerTabsContext.Provider>
);

export function useVaultManagerTabs(): VaultManagerTabsContextValue {
  const context = useContext(VaultManagerTabsContext);
  if (!context) throw new Error('Vault tab components must be rendered inside VaultManagerTabsProvider');
  return context;
}
