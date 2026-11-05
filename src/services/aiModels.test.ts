import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAvailableAiModels, testAiModel } from './aiModels';

describe('AI model discovery and compatibility checks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists only Gemini models that support generateContent and follows pagination', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [
          { name: 'models/gemini-fast', displayName: 'Gemini Fast', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
        ],
        nextPageToken: 'next-page',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [
          { name: 'models/gemini-pro', displayName: 'Gemini Pro', supportedGenerationMethods: ['generateContent'] },
        ],
      })));
    vi.stubGlobal('fetch', fetchMock);

    const models = await listAvailableAiModels('gemini', 'gemini-secret');

    expect(models.map((model) => model.id)).toEqual(['gemini-fast', 'gemini-pro']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { 'x-goog-api-key': 'gemini-secret' },
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageToken=next-page');
  });

  it('lists key-accessible OpenAI chat model families and excludes non-chat models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'gpt-4o-mini' },
        { id: 'o3-mini' },
        { id: 'ft:gpt-4o-mini:org:custom' },
        { id: 'gpt-4o-realtime-preview' },
        { id: 'gpt-image-1' },
        { id: 'text-embedding-3-large' },
        { id: 'whisper-1' },
      ],
    }))));

    const models = await listAvailableAiModels('openai', 'openai-secret');

    expect(models.map((model) => model.id)).toEqual([
      'ft:gpt-4o-mini:org:custom',
      'gpt-4o-mini',
      'o3-mini',
    ]);
  });

  it('checks the selected OpenAI model through the same chat endpoint used by the app', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    })));
    vi.stubGlobal('fetch', fetchMock);

    await testAiModel('openai', 'openai-secret', 'gpt-4o-mini');

    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer openai-secret' }),
      body: expect.stringContaining('gpt-4o-mini'),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).messages[0].role).toBe('system');
  });

  it('checks Gemini models through generateContent with a system instruction', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'OK' }] } }],
    })));
    vi.stubGlobal('fetch', fetchMock);

    await testAiModel('gemini', 'gemini-secret', 'gemini-fast');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/models/gemini-fast:generateContent');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { 'x-goog-api-key': 'gemini-secret' },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toHaveProperty('systemInstruction');
  });

  it('returns a useful key status without including the key in the error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    await expect(listAvailableAiModels('gemini', 'invalid-secret')).rejects.toThrow('gemini:API_KEY_OR_ACCESS:401');
  });
});
