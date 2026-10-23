import type { Language } from './translations';

export type MoodTranslationKey =
  | 'moodLegend'
  | 'moodLabel'
  | 'moodLevel1'
  | 'moodLevel2'
  | 'moodLevel3'
  | 'moodLevel4'
  | 'moodLevel5'
  | 'moodClear'
  | 'moodOutOfFive'
  | 'feelingsLegend'
  | 'feelingsCustomLabel'
  | 'feelingsCustomPlaceholder'
  | 'feelingsAdd'
  | 'feelingsRemove'
  | 'feelingsLimit'
  | 'feelingsLabel'
  | 'feelingJoyful'
  | 'feelingGrateful'
  | 'feelingCalm'
  | 'feelingHopeful'
  | 'feelingProud'
  | 'feelingLoved'
  | 'feelingEnergized'
  | 'feelingContent'
  | 'feelingCurious'
  | 'feelingRelieved'
  | 'feelingTired'
  | 'feelingStressed'
  | 'feelingAnxious'
  | 'feelingSad'
  | 'feelingLonely'
  | 'feelingAngry'
  | 'feelingFrustrated'
  | 'feelingOverwhelmed'
  | 'feelingBored'
  | 'feelingConfused'
  | 'moodFilterLabel'
  | 'moodFilterAll'
  | 'moodFilterAny'
  | 'moodFilterNone'
  | 'moodFilterHigh'
  | 'moodFilterLow'
  | 'revisionMood'
  | 'statsMoodTitle'
  | 'statsMoodIntro'
  | 'statsMoodEmpty'
  | 'statsMoodAverage'
  | 'statsMoodRecorded'
  | 'statsMoodOverTime'
  | 'statsMoodMonthPoint'
  | 'statsMoodChartLabel'
  | 'statsMoodByWeekday'
  | 'statsMoodWeekdayRow'
  | 'statsMoodWeekdayEmpty'
  | 'statsTopFeelings'
  | 'statsTopFeelingsEmpty'
  | 'statsFeelingRow'
  | 'statsMoodEarlier'
  | 'statsMoodLater'
  | 'reviewMoodRecordedSource'
  | 'reviewMoodAiSource'
  | 'reviewMoodRecordedSummary'
  | 'reviewMoodRecordedChartLabel'
  | 'reviewMoodRecordedFeelings'
  | 'reviewMoodRecordHint';

export const moodTranslations: Record<Language, Record<MoodTranslationKey, string>> = {
  en: {
    moodLegend: 'Mood (optional)',
    moodLabel: 'Mood',
    moodLevel1: 'Very low',
    moodLevel2: 'Low',
    moodLevel3: 'Okay',
    moodLevel4: 'Good',
    moodLevel5: 'Very good',
    moodClear: 'Remove the mood',
    moodOutOfFive: '{value} out of 5',
    feelingsLegend: 'Feelings (optional)',
    feelingsCustomLabel: 'Add a feeling in your own words',
    feelingsCustomPlaceholder: 'Another feeling…',
    feelingsAdd: 'Add',
    feelingsRemove: 'Remove the feeling {feeling}',
    feelingsLimit: 'Up to {count} feelings per entry.',
    feelingsLabel: 'Feelings',
    feelingJoyful: 'joyful',
    feelingGrateful: 'grateful',
    feelingCalm: 'calm',
    feelingHopeful: 'hopeful',
    feelingProud: 'proud',
    feelingLoved: 'loved',
    feelingEnergized: 'energized',
    feelingContent: 'content',
    feelingCurious: 'curious',
    feelingRelieved: 'relieved',
    feelingTired: 'tired',
    feelingStressed: 'stressed',
    feelingAnxious: 'anxious',
    feelingSad: 'sad',
    feelingLonely: 'lonely',
    feelingAngry: 'angry',
    feelingFrustrated: 'frustrated',
    feelingOverwhelmed: 'overwhelmed',
    feelingBored: 'bored',
    feelingConfused: 'confused',
    moodFilterLabel: 'Filter by mood',
    moodFilterAll: 'All moods',
    moodFilterAny: 'With a mood',
    moodFilterNone: 'Without a mood',
    moodFilterHigh: 'Good or very good',
    moodFilterLow: 'Low or very low',
    revisionMood: 'Mood: {mood}',
    statsMoodTitle: 'Recorded moods',
    statsMoodIntro: 'From the moods you chose for your entries, on a scale from 1 (very low) to 5 (very good). No AI is involved.',
    statsMoodEmpty: 'Choose a mood when you write an entry to see how it changes over time.',
    statsMoodAverage: 'Average mood',
    statsMoodRecorded: 'Entries with a mood',
    statsMoodOverTime: 'Mood over time',
    statsMoodMonthPoint: '{month}: average {average} out of 5 ({label}) from {entries} entries',
    statsMoodChartLabel: 'Average mood by month, from 1 (very low) to 5 (very good): {months}',
    statsMoodByWeekday: 'Mood by weekday',
    statsMoodWeekdayRow: '{weekday}: average {average} out of 5 from {entries} entries',
    statsMoodWeekdayEmpty: '{weekday}: no mood recorded',
    statsTopFeelings: 'Most frequent feelings',
    statsTopFeelingsEmpty: 'Name a feeling with your entries to see the ones you come back to.',
    statsFeelingRow: '{feeling}: {count} entries',
    statsMoodEarlier: 'Earlier months',
    statsMoodLater: 'Later months',
    reviewMoodRecordedSource: 'From the moods you recorded, without AI',
    reviewMoodAiSource: 'AI reading of a sample of your entries',
    reviewMoodRecordedSummary: 'Your average mood was {average} out of 5 ({label}), across {entries} with a mood.',
    reviewMoodRecordedChartLabel: 'Average recorded mood by month, from very low to very good: {moods}',
    reviewMoodRecordedFeelings: 'Feelings you named most: {feelings}',
    reviewMoodRecordHint: 'Choose a mood when you write, and the year in review draws this arc from your own moods, without AI.',
  },
  fr: {
    moodLegend: 'Humeur (facultative)',
    moodLabel: 'Humeur',
    moodLevel1: 'Très basse',
    moodLevel2: 'Basse',
    moodLevel3: 'Moyenne',
    moodLevel4: 'Bonne',
    moodLevel5: 'Très bonne',
    moodClear: 'Retirer l’humeur',
    moodOutOfFive: '{value} sur 5',
    feelingsLegend: 'Ressentis (facultatifs)',
    feelingsCustomLabel: 'Ajouter un ressenti avec vos mots',
    feelingsCustomPlaceholder: 'Un autre ressenti…',
    feelingsAdd: 'Ajouter',
    feelingsRemove: 'Retirer le ressenti {feeling}',
    feelingsLimit: 'Jusqu’à {count} ressentis par entrée.',
    feelingsLabel: 'Ressentis',
    feelingJoyful: 'joie',
    feelingGrateful: 'gratitude',
    feelingCalm: 'calme',
    feelingHopeful: 'espoir',
    feelingProud: 'fierté',
    feelingLoved: 'amour',
    feelingEnergized: 'énergie',
    feelingContent: 'contentement',
    feelingCurious: 'curiosité',
    feelingRelieved: 'soulagement',
    feelingTired: 'fatigue',
    feelingStressed: 'stress',
    feelingAnxious: 'anxiété',
    feelingSad: 'tristesse',
    feelingLonely: 'solitude',
    feelingAngry: 'colère',
    feelingFrustrated: 'frustration',
    feelingOverwhelmed: 'accablement',
    feelingBored: 'ennui',
    feelingConfused: 'confusion',
    moodFilterLabel: 'Filtrer par humeur',
    moodFilterAll: 'Toutes les humeurs',
    moodFilterAny: 'Avec une humeur',
    moodFilterNone: 'Sans humeur',
    moodFilterHigh: 'Bonne ou très bonne',
    moodFilterLow: 'Basse ou très basse',
    revisionMood: 'Humeur : {mood}',
    statsMoodTitle: 'Humeurs notées',
    statsMoodIntro: 'D’après les humeurs que vous avez choisies pour vos entrées, sur une échelle de 1 (très basse) à 5 (très bonne). Aucune IA n’intervient.',
    statsMoodEmpty: 'Choisissez une humeur en écrivant une entrée pour voir comment elle évolue.',
    statsMoodAverage: 'Humeur moyenne',
    statsMoodRecorded: 'Entrées avec une humeur',
    statsMoodOverTime: 'Humeur au fil du temps',
    statsMoodMonthPoint: '{month} : moyenne de {average} sur 5 ({label}) sur {entries} entrées',
    statsMoodChartLabel: 'Humeur moyenne par mois, de 1 (très basse) à 5 (très bonne) : {months}',
    statsMoodByWeekday: 'Humeur par jour de la semaine',
    statsMoodWeekdayRow: '{weekday} : moyenne de {average} sur 5 sur {entries} entrées',
    statsMoodWeekdayEmpty: '{weekday} : aucune humeur notée',
    statsTopFeelings: 'Ressentis les plus fréquents',
    statsTopFeelingsEmpty: 'Nommez un ressenti avec vos entrées pour voir ceux qui reviennent.',
    statsFeelingRow: '{feeling} : {count} entrées',
    statsMoodEarlier: 'Mois précédents',
    statsMoodLater: 'Mois suivants',
    reviewMoodRecordedSource: 'D’après les humeurs que vous avez notées, sans IA',
    reviewMoodAiSource: 'Lecture par l’IA d’un échantillon de vos entrées',
    reviewMoodRecordedSummary: 'Votre humeur moyenne était de {average} sur 5 ({label}), sur {entries} avec une humeur.',
    reviewMoodRecordedChartLabel: 'Humeur notée moyenne par mois, de très basse à très bonne : {moods}',
    reviewMoodRecordedFeelings: 'Les ressentis que vous avez le plus nommés : {feelings}',
    reviewMoodRecordHint: 'Choisissez une humeur en écrivant, et le bilan de l’année trace cette courbe à partir de vos propres humeurs, sans IA.',
  },
};
