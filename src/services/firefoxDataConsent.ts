type FirefoxDataCategory = 'authenticationInfo' | 'personallyIdentifyingInfo' | 'websiteContent';

interface FirefoxPermissionsApi {
  request: (permissions: { data_collection: FirefoxDataCategory[] }) => Promise<boolean>;
}

interface FirefoxExtensionApi {
  permissions?: Partial<FirefoxPermissionsApi>;
  runtime?: { getBrowserInfo?: () => Promise<unknown> };
}

const consentErrorMessages: Record<string, string> = {
  FIREFOX_DATA_CONSENT_DECLINED: 'O consentimento para enviar dados ao provedor foi recusado. Os recursos locais continuam disponíveis.',
  FIREFOX_DATA_CONSENT_UNAVAILABLE: 'O Firefox não conseguiu abrir o pedido de consentimento. Tente novamente.',
};

export function getFirefoxDataConsentErrorMessage(
  errorCode: string,
  translate: (message: string) => string
): string | null {
  const message = consentErrorMessages[errorCode];
  return message ? translate(message) : null;
}

/** Requests Firefox's built-in disclosure before sending data to an AI provider. */
export async function requestFirefoxDataConsent(categories: FirefoxDataCategory[]): Promise<void> {
  const browserApi = (globalThis as typeof globalThis & { browser?: FirefoxExtensionApi }).browser;
  const request = browserApi?.permissions?.request;

  // Chromium added the `browser` namespace too. Detect Firefox specifically so
  // its Gecko-only data_collection permission is never sent to other browsers.
  if (typeof browserApi?.runtime?.getBrowserInfo !== 'function' || typeof request !== 'function') return;

  let granted = false;
  try {
    granted = await request.call(browserApi.permissions, { data_collection: categories });
  } catch {
    throw new Error('FIREFOX_DATA_CONSENT_UNAVAILABLE');
  }
  if (!granted) throw new Error('FIREFOX_DATA_CONSENT_DECLINED');
}
