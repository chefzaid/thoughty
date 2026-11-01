import { describe, expect, it } from 'vitest';

import { PROMPT_CARD_QUESTIONS, PROMPT_CARD_THEMES } from './promptCardDeck';
import { drawPromptCard, parseDrawnPromptCards, promptCardDeck } from './promptCards';

const english = promptCardDeck('en');
const first = () => 0;

describe('prompt card deck', () => {
  it.each(['en', 'fr'] as const)('holds twelve distinct, hand-written questions per theme in %s', (language) => {
    for (const theme of PROMPT_CARD_THEMES) {
      const questions = PROMPT_CARD_QUESTIONS[language][theme];
      expect(questions).toHaveLength(12);
      expect(new Set(questions).size).toBe(12);
      questions.forEach((question) => expect(question).toMatch(/[?.]$/));
    }
    expect(promptCardDeck(language)).toHaveLength(60);
  });

  it('numbers the cards by theme the same way in both languages, with questions of their own', () => {
    const french = promptCardDeck('fr');
    expect(french.map((card) => card.id)).toEqual(english.map((card) => card.id));
    expect(english[0]).toEqual({ id: 'gratitude-1', theme: 'gratitude', question: 'Who made today a little easier, even if they never knew it?' });
    expect(english.at(-1)?.id).toBe('smallJoys-12');
    french.forEach((card, index) => expect(card.question).not.toBe(english[index]?.question));
  });
});

describe('parseDrawnPromptCards', () => {
  it('keeps the known cards once each, in the order drawn', () => {
    expect(parseDrawnPromptCards('people-2,unknown-1,people-2,places-12,,places-13', english)).toEqual(['people-2', 'places-12']);
    expect(parseDrawnPromptCards(undefined, english)).toEqual([]);
    expect(parseDrawnPromptCards('', english)).toEqual([]);
  });
});

describe('drawPromptCard', () => {
  it('never draws a card twice until every card of the deck has been drawn', () => {
    let drawn: string[] = [];
    const seen = new Set<string>();
    for (let round = 0; round < 60; round += 1) {
      const draw = drawPromptCard(english, drawn, null);
      expect(seen.has(draw.card.id)).toBe(false);
      expect(draw.reshuffled).toBe(false);
      expect(draw.left).toBe(59 - round);
      seen.add(draw.card.id);
      drawn = draw.drawn;
    }
    expect(seen.size).toBe(60);
  });

  it('shuffles a used-up deck back in, never opening on the card just drawn', () => {
    const all = english.map((card) => card.id);
    const last = 'people-4';
    const drawn = [...all.filter((id) => id !== last), last];

    const draw = drawPromptCard(english, drawn, null, () => 0.999);

    expect(draw.reshuffled).toBe(true);
    expect(draw.card.id).not.toBe(last);
    expect(draw.drawn).toEqual([draw.card.id]);
    expect(draw.left).toBe(59);
    expect(drawPromptCard(english, drawn, null, first).card.id).toBe('gratitude-1');
  });

  it('draws within one theme and shuffles only that theme back in', () => {
    const gratitude = english.filter((card) => card.theme === 'gratitude').map((card) => card.id);
    const fresh = drawPromptCard(english, ['people-1'], 'places', first);
    expect(fresh.card).toMatchObject({ id: 'places-1', theme: 'places' });
    expect(fresh.drawn).toEqual(['people-1', 'places-1']);
    expect(fresh.left).toBe(11);

    const again = drawPromptCard(english, ['people-1', ...gratitude], 'gratitude', first);

    expect(again).toMatchObject({ reshuffled: true, left: 11 });
    expect(again.card.id).toBe('gratitude-1');
    expect(again.drawn).toEqual(['people-1', 'gratitude-1']);
    expect(drawPromptCard(english, ['people-1', ...gratitude], 'gratitude', () => 0.999).card.id).toBe('gratitude-11');
  });

  it('draws the only card of a one-card deck again, and refuses an empty deck', () => {
    const single = english.slice(0, 1);
    expect(drawPromptCard(single, ['gratitude-1'], null).card.id).toBe('gratitude-1');
    expect(() => drawPromptCard([], [], 'places')).toThrow('No prompt cards for places');
  });
});
