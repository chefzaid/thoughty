import { describe, expect, it } from 'vitest';
import { hasCrisisSignal } from './crisisSignals';

describe('hasCrisisSignal', () => {
  it.each([
    'Some nights I think about suicide.',
    'I feel SUICIDAL again',
    "I just want to kill myself",
    'Maybe I should end it all.',
    'I wanted to die today',
    'Everyone would be better off dead without me',
    "I don’t want to wake up tomorrow",
    'The urge to self-harm came back',
    'I cut myself last night',
    "J'ai envie de mourir.",
    'Je veux me tuer',
    'Je pense à mettre fin à mes jours',
    "Je n'ai plus envie de vivre",
    "J’ai recommencé à me scarifier",
    "L'automutilation me revient",
    'Je voudrais me faire du mal',
  ])('finds a sign of crisis in %j', (text) => {
    expect(hasCrisisSignal(text)).toBe(true);
  });

  it.each([
    'A long, grey day at work.',
    'This deadline is killing me.',
    'I could die laughing at that film.',
    'Ce boulot va me tuer de fatigue, dit-il en riant.',
    'On a fini avec la vaisselle.',
    'Elle a envie de vivre à la mer.',
    '',
  ])('finds none in %j', (text) => {
    expect(hasCrisisSignal(text)).toBe(false);
  });

  it('checks every text it is given and skips missing ones', () => {
    expect(hasCrisisSignal(null, undefined, 'A title', 'I want to die')).toBe(true);
    expect(hasCrisisSignal(null, undefined)).toBe(false);
    expect(hasCrisisSignal()).toBe(false);
  });
});
