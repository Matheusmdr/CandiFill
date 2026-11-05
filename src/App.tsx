import React, { useState, useEffect } from 'react';
import { CandidateProfile } from './types/profile';
import { loadCandidateProfile, saveCandidateProfile, onProfileUpdated, DEFAULT_PROFILE } from './services/storage';
import { SpotlightOverlay } from './components/SpotlightOverlay';
import { VaultManager } from './components/VaultManager';
import { useLocale } from './contexts/LocaleContext';

export const App: React.FC = () => {
  const { t, tp } = useLocale();
  const [profile, setProfile] = useState<CandidateProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSpotlight, setShowSpotlight] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setStatusNotification({ message, type });
    setTimeout(() => setStatusNotification(null), 3000);
  };

  useEffect(() => {
    // Carrega dados iniciais do candidato
    loadCandidateProfile()
      .then((data) => {
        setProfile(data);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Falha ao carregar o perfil.');
        setIsLoading(false);
      });

    // Ouve atualizações de dados em tempo real (mudanças vindas de outras abas ou storage da extensão)
    const unsubscribe = onProfileUpdated((updatedProfile) => {
      setProfile(updatedProfile);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Aplica o tema visual no HTML raiz
  useEffect(() => {
    const theme = profile.theme || 'emerald';
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [profile.theme]);

  const handleSaveProfile = async (updated: CandidateProfile) => {
    await saveCandidateProfile(updated);
    setProfile(updated);
  };

  const handleAutofillActiveTab = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          showToast(t('Nenhuma aba ativa encontrada.'), 'error');
          return;
        }

        if (tab.url && /^(about:|chrome:|chrome-extension:|moz-extension:|edge:|brave:|opera:|vivaldi:)/i.test(tab.url)) {
          showToast(t('O navegador bloqueia o preenchimento em páginas internas. Abra uma página de candidatura.'), 'info');
          return;
        }

        // Higieniza o perfil removendo credenciais antes de despachar para o DOM da página
        const sanitizedProfile: CandidateProfile = {
          ...profile,
          aiConfig: { ...profile.aiConfig, apiKey: '' },
        };

        // Tenta enviar mensagem para o content script da aba
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'AUTOFILL', profile: sanitizedProfile },
          (response) => {
            if (chrome.runtime.lastError) {
              // Se o content script não estava pré-carregado nesta página
              chrome.scripting?.executeScript(
                {
                  target: { tabId: tab.id! },
                  files: ['content.js'],
                },
                () => {
                  if (chrome.runtime.lastError) {
                    showToast(t('Esta página protege o acesso a extensões.'), 'info');
                  } else {
                    chrome.tabs.sendMessage(tab.id!, { action: 'AUTOFILL', profile: sanitizedProfile });
                    showToast(t('CandiFill disparado na aba ativa!'), 'success');
                  }
                }
              );
            } else if (response && response.totalFilled !== undefined) {
              if (response.totalFilled > 0) {
                const skippedMessage = response.fieldsSkipped?.length
                  ? ` ${tp('{count} resposta existente preservada.', '{count} respostas existentes preservadas.', response.fieldsSkipped.length)}`
                  : '';
                const filledMessage = tp('✅ {count} campo preenchido.', '✅ {count} campos preenchidos.', response.totalFilled);
                showToast(`${filledMessage}${skippedMessage}`, 'success');
              } else if (response.fieldsSkipped?.length) {
                showToast(tp(
                  'Nenhum campo foi alterado; {count} resposta existente foi preservada.',
                  'Nenhum campo foi alterado; {count} respostas existentes foram preservadas.',
                  response.fieldsSkipped.length
                ), 'info');
              } else {
                showToast(t('Nenhum campo compatível foi preenchido. Você pode completar o formulário e revisar respostas novas.'), 'info');
              }
            } else {
              showToast(t('Comando de preenchimento enviado!'), 'success');
            }
          }
        );
      } catch (err: any) {
        showToast(t('Erro ao acionar preenchimento: ') + (err.message || err), 'error');
      }
    } else {
      showToast(t('⚡ Modo Web: Abra como extensão para preencher páginas.'), 'info');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-0 flex items-center justify-center bg-zinc-950 text-zinc-400 text-xs font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>{t("Carregando CandiFill...")}</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-zinc-300">
        <span className="text-sm font-semibold">{t("Não foi possível carregar seu cofre")}</span>
        <p className="max-w-md text-xs text-zinc-500">{t(loadError)}</p>
        <button onClick={() => window.location.reload()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
          {t("Tentar novamente")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden bg-zinc-950 relative select-none">
      {/* Toast flutuante de feedback */}
      {statusNotification && (
        <div className="fixed top-3 right-4 z-50 animate-scale-in">
          <div
            className={`px-3.5 py-2 rounded-xl text-xs font-medium shadow-2xl flex items-center gap-2 border backdrop-blur-md ${
              statusNotification.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60 shadow-emerald-950/50'
                : statusNotification.type === 'error'
                ? 'bg-rose-950/90 text-rose-300 border-rose-700/60 shadow-rose-950/50'
                : 'bg-zinc-900/90 text-zinc-300 border-zinc-700/60 shadow-black/50'
            }`}
          >
            {statusNotification.message}
          </div>
        </div>
      )}

      {/* Interface Principal do Cofre */}
      <VaultManager
        profile={profile}
        onSave={handleSaveProfile}
        onOpenSpotlight={() => setShowSpotlight(true)}
        onAutofillPage={handleAutofillActiveTab}
      />

      {/* Spotlight HUD Modal / Busca Rápida Raycast */}
      {showSpotlight && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="w-full max-w-xl h-[460px] max-h-[90vh]">
            <SpotlightOverlay
              profile={profile}
              onClose={() => setShowSpotlight(false)}
              onOpenVault={() => setShowSpotlight(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
