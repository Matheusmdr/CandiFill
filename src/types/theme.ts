export type ThemeId = 'emerald' | 'midnight' | 'amethyst' | 'amber' | 'oled' | 'light';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  previewColor: string;
  accentColor: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'emerald',
    name: 'Emerald Forest',
    description: 'Preto grafite com acentos verde esmeralda (padrão)',
    previewColor: '#10b981',
    accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    id: 'midnight',
    name: 'Midnight Cyber',
    description: 'Azul marinho espacial com acentos em ciano elétrico',
    previewColor: '#38bdf8',
    accentColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  {
    id: 'amethyst',
    name: 'Neon Amethyst',
    description: 'Roxo e fúcsia estilo cyberpunk',
    previewColor: '#c084fc',
    accentColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  },
  {
    id: 'amber',
    name: 'Amber Sunset',
    description: 'Tons quentes em dourado e âmbar executivo',
    previewColor: '#f59e0b',
    accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'oled',
    name: 'Pure OLED',
    description: 'Preto absoluto (#000) com alto contraste nítido',
    previewColor: '#ffffff',
    accentColor: 'text-zinc-100 bg-zinc-800/60 border-zinc-600/50',
  },
  {
    id: 'light',
    name: 'Clean Light',
    description: 'Visual diurno claro e suave para trabalho sob luz natural',
    previewColor: '#0284c7',
    accentColor: 'text-sky-600 bg-sky-100 border-sky-300',
  },
];

