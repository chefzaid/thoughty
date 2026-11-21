import type { Language } from './translations';

/**
 * The names and text of the built-in entry templates (`utils/entryTemplates.ts`). A template is filled in
 * the interface's language at the moment it is applied; what the writer then keeps is their own text.
 */
export type BuiltInTemplatesTranslationKey =
  | 'templateGratitudeName'
  | 'templateGratitudeText'
  | 'templateDailyReflectionName'
  | 'templateDailyReflectionText'
  | 'templateMorningIntentionsName'
  | 'templateMorningIntentionsText'
  | 'templateWeeklyReviewName'
  | 'templateWeeklyReviewText'
  | 'templateDecisionNotesName'
  | 'templateDecisionNotesText'
  | 'templateRantName'
  | 'templateRantText'
  | 'templateWorryCheckName'
  | 'templateWorryCheckText'
  | 'templatePhilosophicalMusingName'
  | 'templatePhilosophicalMusingText'
  | 'templateLifeCheckInName'
  | 'templateLifeCheckInText'
  | 'templateValuesReflectionName'
  | 'templateValuesReflectionText'
  | 'templateLetterToFutureSelfName'
  | 'templateLetterToFutureSelfText'
  | 'templateUnsentLetterName'
  | 'templateUnsentLetterText'
  | 'templateDreamLogName'
  | 'templateDreamLogText';

export const builtInTemplatesTranslations: Record<Language, Record<BuiltInTemplatesTranslationKey, string>> = {
  en: {
    templateGratitudeName: 'Gratitude journal',
    templateGratitudeText: 'Today I am grateful for:\n\n1. \n2. \n3. \n\nOne small moment I want to remember:',
    templateDailyReflectionName: 'Daily reflection',
    templateDailyReflectionText: 'What happened today?\n\nWhat did I learn?\n\nWhat should I carry into tomorrow?',
    templateMorningIntentionsName: 'Morning intentions',
    templateMorningIntentionsText: "How I feel as I start the day:\n\nThe one thing that would make today a good day:\n\nWhat might get in the way, and how I'll handle it:\n\nHow I want to show up for the people around me:",
    templateWeeklyReviewName: 'Weekly review',
    templateWeeklyReviewText: "## Wins\n- \n\n## What was hard\n- \n\n## What I learned\n- \n\n## What I'm letting go of\n- \n\n## Focus for next week\n1. \n2. \n3. ",
    templateDecisionNotesName: 'Decision notes',
    templateDecisionNotesText: "## The decision\n\n## Context\n\n## Options I considered\n- \n\n## What I chose and why\n\n## What I'm giving up\n\n## What would change my mind\n\n## Revisit on\n",
    templateRantName: 'Rant it out',
    templateRantText: "What's bothering me (no filter, no judgment):\n\n\nWhat's really underneath it:\n\nWhat's in my control, and what isn't:\n\nOne kind thing I can do for myself now:",
    templateWorryCheckName: 'Worry check',
    templateWorryCheckText: 'The situation:\n\nThe thought running through my head:\n\nHow it makes me feel (and how strongly, 0–10):\n\nEvidence that supports it:\n\nEvidence against it:\n\nA more balanced way to see it:',
    templatePhilosophicalMusingName: 'Philosophical musing',
    templatePhilosophicalMusingText: "A question I keep coming back to:\n\nWhat I currently believe, and why:\n\nThe strongest argument against my view:\n\nIf I'm wrong, what changes?\n\nWhere I've landed for now:",
    templateLifeCheckInName: 'Life check-in',
    templateLifeCheckInText: "Rate each area from 1 to 10, then add a note.\n\n- **Health:** \n- **Relationships:** \n- **Work or purpose:** \n- **Money:** \n- **Growth:** \n- **Fun and rest:** \n\nThe area that needs the most attention:\n\nOne step I'll take this month:",
    templateValuesReflectionName: 'Values reflection',
    templateValuesReflectionText: 'Three values that matter most to me right now:\n\n1. \n2. \n3. \n\nWhere I lived them recently:\n\nWhere I drifted from them:\n\nWhat living them more fully would look like:',
    templateLetterToFutureSelfName: 'Letter to my future self',
    templateLetterToFutureSelfText: "Dear future me,\n\nRight now, my life looks like this:\n\nWhat I'm hoping for:\n\nWhat I'm afraid of:\n\nWhat I want you to remember:\n\n",
    templateUnsentLetterName: 'Unsent letter',
    templateUnsentLetterText: 'Dear ,\n\nWhat I never got to say:\n\n',
    templateDreamLogName: 'Dream log',
    templateDreamLogText: 'What happened in the dream:\n\nPeople, places, and symbols:\n\nHow I felt when I woke up:\n\nWhat it might be connected to in my life:',
  },
  fr: {
    templateGratitudeName: 'Journal de gratitude',
    templateGratitudeText: "Aujourd'hui, je dis merci pour :\n\n1. \n2. \n3. \n\nUn petit moment dont je veux me souvenir :",
    templateDailyReflectionName: 'Réflexion du jour',
    templateDailyReflectionText: "Que s'est-il passé aujourd'hui ?\n\nQu'ai-je appris ?\n\nQue vais-je garder pour demain ?",
    templateMorningIntentionsName: 'Intentions du matin',
    templateMorningIntentionsText: "Comment je me sens en commençant la journée :\n\nLa chose qui ferait de cette journée une bonne journée :\n\nCe qui pourrait me freiner, et comment j'y ferai face :\n\nCe que je veux apporter aux gens qui m'entourent :",
    templateWeeklyReviewName: 'Bilan de la semaine',
    templateWeeklyReviewText: "## Réussites\n- \n\n## Ce qui a été difficile\n- \n\n## Ce que j'ai appris\n- \n\n## Ce que je laisse derrière moi\n- \n\n## Priorités de la semaine prochaine\n1. \n2. \n3. ",
    templateDecisionNotesName: 'Notes de décision',
    templateDecisionNotesText: "## La décision\n\n## Contexte\n\n## Les options envisagées\n- \n\n## Mon choix et pourquoi\n\n## Ce à quoi je renonce\n\n## Ce qui me ferait changer d'avis\n\n## À revoir le\n",
    templateRantName: 'Vider son sac',
    templateRantText: "Ce qui me pèse (sans filtre, sans jugement) :\n\n\nCe qu'il y a vraiment en dessous :\n\nCe qui dépend de moi, et ce qui n'en dépend pas :\n\nUne chose bienveillante que je peux faire pour moi maintenant :",
    templateWorryCheckName: 'Examiner une inquiétude',
    templateWorryCheckText: 'La situation :\n\nLa pensée qui me trotte dans la tête :\n\nCe que je ressens (et avec quelle intensité, de 0 à 10) :\n\nCe qui va dans son sens :\n\nCe qui va contre elle :\n\nUne façon plus nuancée de voir les choses :',
    templatePhilosophicalMusingName: 'Réflexion philosophique',
    templatePhilosophicalMusingText: "Une question à laquelle je reviens sans cesse :\n\nCe que je crois aujourd'hui, et pourquoi :\n\nL'argument le plus fort contre mon point de vue :\n\nSi j'ai tort, qu'est-ce qui change ?\n\nOù j'en suis pour l'instant :",
    templateLifeCheckInName: 'Bilan de vie',
    templateLifeCheckInText: "Notez chaque domaine de 1 à 10, puis ajoutez une remarque.\n\n- **Santé :** \n- **Relations :** \n- **Travail ou raison d'être :** \n- **Argent :** \n- **Croissance personnelle :** \n- **Loisirs et repos :** \n\nLe domaine qui demande le plus d'attention :\n\nUn pas que je ferai ce mois-ci :",
    templateValuesReflectionName: 'Réflexion sur mes valeurs',
    templateValuesReflectionText: 'Trois valeurs qui comptent le plus pour moi en ce moment :\n\n1. \n2. \n3. \n\nOù je les ai vécues récemment :\n\nOù je les ai perdues de vue :\n\nCe que ce serait de les vivre plus pleinement :',
    templateLetterToFutureSelfName: 'Lettre à mon moi futur',
    templateLetterToFutureSelfText: "Cher moi du futur,\n\nEn ce moment, ma vie ressemble à ceci :\n\nCe que j'espère :\n\nCe qui me fait peur :\n\nCe dont je veux que tu te souviennes :\n\n",
    templateUnsentLetterName: 'Lettre jamais envoyée',
    templateUnsentLetterText: "À ,\n\nCe que je n'ai jamais pu te dire :\n\n",
    templateDreamLogName: 'Journal de rêves',
    templateDreamLogText: "Ce qui s'est passé dans le rêve :\n\nPersonnes, lieux et symboles :\n\nCe que j'ai ressenti au réveil :\n\nCe à quoi cela pourrait être lié dans ma vie :",
  },
};
