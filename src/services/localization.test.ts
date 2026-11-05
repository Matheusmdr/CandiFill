import { describe, expect, it } from 'vitest';
import { translate, translatePlural } from './localization';

describe('localization', () => {
  it('uses the Portuguese source text for pt-BR', () => {
    expect(translate('pt-BR', 'Idioma da interface')).toBe('Idioma da interface');
  });

  it('translates interface labels into English', () => {
    expect(translate('en', 'Idioma da interface')).toBe('Interface language');
  });

  it('interpolates values into translated messages', () => {
    expect(translatePlural('en', 'Revisar {count} resposta nova', 'Revisar {count} respostas novas', 3)).toBe('Review 3 new answers');
    expect(translatePlural('en', 'Revisar {count} resposta nova', 'Revisar {count} respostas novas', 1)).toBe('Review 1 new answer');
  });

  it('keeps unknown text unchanged', () => {
    expect(translate('en', 'A custom profile value')).toBe('A custom profile value');
  });
});
