import { CandidateProfile } from '../types/profile';
import { normalizeCandidateProfile } from './storage';

/**
 * Limpa resíduos de conversa de IA (introduções como "Aqui está:", aspas, blocos de citação, etc.)
 */
export function cleanAiOutput(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.trim();

  // 1. Remove blocos de código markdown (```texto``` ou ```markdown ... ```)
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // 2. Se a IA gerou formato com opções (ex: "**Opção 1:** ... \n\n**Opção 2:** ..."), extrai apenas a primeira
  const optionRegex = /(?:\*\*|\#\#)?\s*Opção\s*1[^:\n]*[:\*\#\-]*\s*([\s\S]*?)(?=(?:\n\s*(?:\*\*|\#\#)?\s*Opção\s*2|\n\s*(?:\*\*|\#\#)?\s*Opção\s*3|$))/i;
  const optionMatch = text.match(optionRegex);
  if (optionMatch && optionMatch[1]?.trim()) {
    text = optionMatch[1].trim();
  }

  // 3. Remove frases introdutórias comuns de IA nas primeiras linhas
  const introPatterns = [
    /^(?:Aqui está|Aqui estão|Segue|Segue abaixo|Com certeza|Claro|Com base no seu pedido|Abaixo está|Veja a versão|Sure|Here is|Here are)[^:\n]*:?\s*\n+/i,
    /^(?:\*\*|\#\#)?\s*(?:Versão aprimorada|Sugestão|Texto aprimorado|Opção sugerida|Opção única|Reescrita)[^:\n]*[:\*\#\-]*\s*\n+/i,
  ];

  for (const pattern of introPatterns) {
    text = text.replace(pattern, '').trim();
  }

  // 4. Remove citações markdown do início de linhas (ex: "> Texto...")
  text = text
    .split('\n')
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
    .trim();

  // 5. Remove aspas envolventes se o texto inteiro foi colocado entre aspas ("..." ou “...”)
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

export interface EnhanceAiPayload {
  provider: 'gemini' | 'openai';
  apiKey: string;
  model?: string;
  text: string;
  customPrompt?: string;
}

/**
 * Aprimora resumos ou textos profissionais com LLM (Gemini ou OpenAI)
 */
export async function enhanceTextWithAi(payload: EnhanceAiPayload): Promise<string> {
  const strictSystemInstruction =
    'Você é um assistente estritamente focado em aprimorar textos de candidatos para currículos e formulários de emprego.\n' +
    'REGRAS INEGOCIÁVEIS:\n' +
    '1. Responda APENAS com o texto reescrito final, pronto para ser copiado diretamente para a vaga.\n' +
    '2. NUNCA escreva saudações, cumprimentos, introduções ou notas (JAMAIS inclua frases como "Aqui está", "Com certeza", "Opção 1", "Segue o texto").\n' +
    '3. NUNCA gere múltiplas opções. Gere sempre e exclusivamente UMA ÚNICA versão definitiva.\n' +
    '4. NÃO use aspas ao redor do texto, NÃO use formatação de citação (>), NÃO use blocos de código (```).\n' +
    '5. Mantenha fidelidade factual total às informações e qualificações reais do texto original.\n\n' +
    `DIRETRIZ DE ESTILO:\n${payload.customPrompt || 'Aprimore este texto tornando-o conciso, profissional e impactante.'}`;

  if (payload.provider === 'gemini') {
    const model = payload.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${payload.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: strictSystemInstruction }],
        },
        contents: [{ parts: [{ text: payload.text }] }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Gemini retornou erro (${res.status}): ${err}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return cleanAiOutput(raw);
  } else {
    const model = payload.model || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: strictSystemInstruction },
          { role: 'user', content: payload.text },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI retornou erro (${res.status}): ${err}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    return cleanAiOutput(raw);
  }
}

export interface ParseResumePayload {
  provider: 'gemini' | 'openai';
  apiKey: string;
  model?: string;
  resumeText: string;
}

/**
 * Converte o texto extraído de um currículo PDF em um CandidateProfile estruturado
 */
export async function parseResumeWithAi(payload: ParseResumePayload): Promise<CandidateProfile> {
  const sysPrompt = `Você é um assistente especialista em recrutamento e RH. Use somente fatos presentes no currículo; não invente, infira nem complete dados ausentes. Para campos sem evidência explícita, retorne string vazia ou array vazio. Resumos e apresentação devem permanecer fiéis às experiências e qualificações descritas. Retorne ESTRITAMENTE um objeto JSON válido (sem comentários, sem blocos markdown extras) com o seguinte esquema:
{
  "personal": {
    "fullName": "Nome Completo",
    "headline": "Cargo Atual ou Título Profissional",
    "email": "email@exemplo.com",
    "phone": "+55 11 99999-9999",
    "location": "Cidade, UF - País",
    "nationality": "Nacionalidade se mencionada, senão string vazia",
    "linkedin": "url ou usuário do linkedin",
    "github": "url ou usuário do github",
    "portfolio": "site ou portfólio"
  },
  "salary": {
    "currency": "BRL (R$)",
    "desiredSalary": "valor se mencionado ou vazio",
    "minimumSalary": "",
    "contractType": "Tipo de contrato se mencionado, senão string vazia",
    "availability": "Disponibilidade se mencionada, senão string vazia"
  },
  "summary": {
    "shortSummary": "Resumo de 2-3 frases de alto impacto",
    "longSummary": "Resumo profissional completo",
    "coverLetterSnippet": "Apresentação padrão para vagas"
  },
  "education": [
    {
      "id": "edu-1",
      "institution": "Nome da Instituição",
      "degree": "Bacharelado / Tecnólogo / etc",
      "fieldOfStudy": "Curso",
      "startDate": "Ano início",
      "endDate": "Ano fim ou Atual",
      "description": ""
    }
  ],
  "experience": [
    {
      "id": "exp-1",
      "company": "Nome da Empresa",
      "role": "Cargo",
      "location": "Remoto ou Cidade",
      "startDate": "Mês/Ano início",
      "endDate": "Mês/Ano fim ou Presente",
      "current": false,
      "description": "Principais realizações e tecnologias"
    }
  ],
  "customFields": [
    {
      "id": "cf-1",
      "key": "habilidades",
      "label": "Principais Tecnologias",
      "value": "Lista de linguagens/ferramentas",
      "category": "Habilidades Técnicas"
    }
  ]
}`;

  let jsonString = '';

  if (payload.provider === 'gemini') {
    const model = payload.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${payload.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sysPrompt }] },
        contents: [{ parts: [{ text: `CURRÍCULO PARA EXTRAÇÃO:\n\n${payload.resumeText}` }] }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Gemini retornou erro (${res.status}): ${err}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    jsonString = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw;
  } else {
    const model = payload.model || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: payload.resumeText },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI retornou erro (${res.status}): ${err}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    jsonString = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw;
  }

  const parsedValue: unknown = JSON.parse(jsonString);
  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new Error('A IA retornou um perfil JSON inválido. Tente novamente ou revise o texto do currículo.');
  }
  const parsed = parsedValue as Record<string, any>;

  return normalizeCandidateProfile({
    schemaVersion: 2,
    unconfirmedDefaults: [],
    personal: {
      fullName: parsed.personal?.fullName || '',
      headline: parsed.personal?.headline || '',
      email: parsed.personal?.email || '',
      phone: parsed.personal?.phone || '',
      location: parsed.personal?.location || '',
      nationality: parsed.personal?.nationality || '',
      linkedin: parsed.personal?.linkedin || '',
      github: parsed.personal?.github || '',
      portfolio: parsed.personal?.portfolio || '',
    },
    salary: {
      currency: parsed.salary?.currency || 'BRL (R$)',
      desiredSalary: parsed.salary?.desiredSalary || '',
      minimumSalary: parsed.salary?.minimumSalary || '',
      contractType: parsed.salary?.contractType || '',
      availability: parsed.salary?.availability || '',
    },
    summary: {
      shortSummary: parsed.summary?.shortSummary || '',
      longSummary: parsed.summary?.longSummary || '',
      coverLetterSnippet: parsed.summary?.coverLetterSnippet || '',
    },
    education: Array.isArray(parsed.education) ? parsed.education : [],
    experience: Array.isArray(parsed.experience) ? parsed.experience : [],
    customFields: Array.isArray(parsed.customFields) ? parsed.customFields : [],
    savedAnswers: [],
    aiConfig: {
      provider: payload.provider,
      apiKey: payload.apiKey,
      model: payload.model || 'gemini-1.5-flash',
      customPrompt: '',
    },
  });
}

