import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestFirefoxDataConsent } from './firefoxDataConsent';

describe('Firefox data-sharing consent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests only the data categories needed for the selected action', async () => {
    const request = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('browser', { permissions: { request } });

    await requestFirefoxDataConsent(['authenticationInfo', 'websiteContent']);

    expect(request).toHaveBeenCalledWith({
      data_collection: ['authenticationInfo', 'websiteContent'],
    });
  });

  it('rejects the AI action when consent is declined', async () => {
    vi.stubGlobal('browser', { permissions: { request: vi.fn().mockResolvedValue(false) } });

    await expect(requestFirefoxDataConsent(['personallyIdentifyingInfo']))
      .rejects.toThrow('Consent to send data to the provider was declined. Local features remain available.');
  });

  it('rejects the AI action if Firefox cannot show the consent prompt', async () => {
    vi.stubGlobal('browser', { permissions: { request: vi.fn().mockRejectedValue(new Error('denied')) } });

    await expect(requestFirefoxDataConsent(['authenticationInfo']))
      .rejects.toThrow('Firefox could not open the consent prompt. Please try again.');
  });

  it('keeps non-Firefox browsers compatible when the Mozilla API is absent', async () => {
    vi.stubGlobal('browser', undefined);

    await expect(requestFirefoxDataConsent(['authenticationInfo'])).resolves.toBeUndefined();
  });
});
