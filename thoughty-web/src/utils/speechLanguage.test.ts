import { describe, expect, it } from 'vitest';

import { detectSpeechLanguage } from './speechLanguage';

describe('detectSpeechLanguage', () => {
  it('recognises English text', () => {
    expect(detectSpeechLanguage('Today I walked to the river and it was calm.')).toBe('en');
  });

  it('recognises French text, accents included', () => {
    expect(detectSpeechLanguage("Aujourd'hui je suis allé à la rivière avec mes amis.")).toBe('fr');
    expect(detectSpeechLanguage('Très été réussi')).toBe('fr');
  });

  it('gives no answer when the text has too little signal', () => {
    expect(detectSpeechLanguage('')).toBeNull();
    expect(detectSpeechLanguage('Paris 2026')).toBeNull();
    expect(detectSpeechLanguage('the')).toBeNull();
  });

  it('gives no answer when both languages score the same', () => {
    expect(detectSpeechLanguage('the and le et')).toBeNull();
  });
});
