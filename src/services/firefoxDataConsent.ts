type FirefoxDataCategory = 'authenticationInfo' | 'personallyIdentifyingInfo' | 'websiteContent';
import { getBrowserLocale, translate } from './localization';

interface FirefoxPermissionsApi {
  request: (permissions: { data_collection: FirefoxDataCategory[] }) => Promise<boolean>;
}

/** Requests Firefox's built-in disclosure before sending data to an AI provider. */
export async function requestFirefoxDataConsent(categories: FirefoxDataCategory[]): Promise<void> {
  const browserApi = (globalThis as typeof globalThis & {
    browser?: { permissions?: Partial<FirefoxPermissionsApi> };
  }).browser;
  const request = browserApi?.permissions?.request;

  // Other browsers do not expose Mozilla's data_collection permission API.
  if (typeof request !== 'function') return;

  let granted = false;
  try {
    granted = await request.call(browserApi.permissions, { data_collection: categories });
  } catch {
    throw new Error(translate(getBrowserLocale(), 'O Firefox não conseguiu abrir o pedido de consentimento. Tente novamente.'));
  }
  if (!granted) {
    throw new Error(translate(getBrowserLocale(), 'O consentimento para enviar dados ao provedor foi recusado. Os recursos locais continuam disponíveis.'));
  }
}
