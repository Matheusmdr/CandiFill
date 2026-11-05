export interface AvailableAiModel {
  id: string;
  displayName: string;
}

interface GeminiModelResponse {
  models?: Array<{
    name?: unknown;
    displayName?: unknown;
    supportedGenerationMethods?: unknown;
  }>;
  nextPageToken?: unknown;
}

interface OpenAiModelResponse {
  data?: Array<{
    id?: unknown;
    shutdown_date?: unknown;
  }>;
}

function readApiError(provider: 'gemini' | 'openai', status: number): Error {
  if (status === 401 || status === 403) {
    return new Error(`${provider}:API_KEY_OR_ACCESS:${status}`);
  }
  if (status === 429) return new Error(`${provider}:RATE_LIMIT:${status}`);
  return new Error(`${provider}:MODEL_REQUEST_FAILED:${status}`);
}

function isCompatibleOpenAiChatModel(id: string): boolean {
  const normalized = id.toLowerCase();
  if (/audio|realtime|image|transcri|\btts\b|embedding|moderation|computer|deep-research|codex/.test(normalized)) {
    return false;
  }

  return /^(gpt-|chatgpt-)|^(o1|o3|o4)(-|$)|^ft:(gpt-|o1|o3|o4)/.test(normalized);
}

function isShutDown(shutdownDate: unknown): boolean {
  if (typeof shutdownDate !== 'string') return false;
  const timestamp = Date.parse(shutdownDate);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

/** Lists models available to the supplied key that fit CandiFill's text-generation requests. */
export async function listAvailableAiModels(
  provider: 'gemini' | 'openai',
  apiKey: string
): Promise<AvailableAiModel[]> {
  if (!apiKey.trim()) throw new Error('API_KEY_REQUIRED');

  if (provider === 'gemini') {
    const models = new Map<string, AvailableAiModel>();
    let pageToken = '';
    const visitedTokens = new Set<string>();

    for (let page = 0; page < 20; page += 1) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await fetch(url, {
        headers: { 'x-goog-api-key': apiKey.trim() },
      });
      if (!response.ok) throw readApiError(provider, response.status);

      const data = await response.json() as GeminiModelResponse;
      for (const model of Array.isArray(data.models) ? data.models : []) {
        if (typeof model.name !== 'string') continue;
        const supportsGeneration = Array.isArray(model.supportedGenerationMethods)
          && model.supportedGenerationMethods.includes('generateContent');
        if (!supportsGeneration) continue;

        const id = model.name.replace(/^models\//, '');
        if (!id) continue;
        models.set(id, {
          id,
          displayName: typeof model.displayName === 'string' && model.displayName.trim()
            ? model.displayName.trim()
            : id,
        });
      }

      const nextPageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      if (!nextPageToken || visitedTokens.has(nextPageToken)) break;
      visitedTokens.add(nextPageToken);
      pageToken = nextPageToken;
    }

    return [...models.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  });
  if (!response.ok) throw readApiError(provider, response.status);

  const data = await response.json() as OpenAiModelResponse;
  const models = (Array.isArray(data.data) ? data.data : [])
    .filter((model): model is { id: string; shutdown_date?: unknown } =>
      typeof model.id === 'string' && isCompatibleOpenAiChatModel(model.id) && !isShutDown(model.shutdown_date)
    )
    .map(({ id }) => ({ id, displayName: id }));
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/** Sends a tiny request to the same generation endpoint CandiFill uses to verify the selected model. */
export async function testAiModel(
  provider: 'gemini' | 'openai',
  apiKey: string,
  model: string
): Promise<void> {
  if (!apiKey.trim()) throw new Error('API_KEY_REQUIRED');
  if (!model.trim()) throw new Error('MODEL_REQUIRED');

  let response: Response;
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.trim())}:generateContent`;
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Responda somente com OK.' }] },
        contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
        generationConfig: { maxOutputTokens: 4 },
      }),
    });
  } else {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: 'Você está verificando compatibilidade. Responda somente OK.' },
          { role: 'user', content: 'Responda apenas: OK' },
        ],
        max_completion_tokens: 8,
      }),
    });
  }

  if (!response.ok) throw readApiError(provider, response.status);
  const data = await response.json() as Record<string, unknown>;
  const hasOutput = provider === 'gemini'
    ? Boolean((data.candidates as Array<{ content?: { parts?: Array<{ text?: unknown }> } }> | undefined)?.[0]?.content?.parts?.some((part) => typeof part.text === 'string'))
    : Boolean((data.choices as Array<{ message?: { content?: unknown } }> | undefined)?.[0]?.message?.content);
  if (!hasOutput) throw new Error(`${provider}:EMPTY_MODEL_RESPONSE`);
}
