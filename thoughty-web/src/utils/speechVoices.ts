export function getSpeechLang(language: string): string {
  return language === 'fr' ? 'fr-FR' : 'en-US';
}

function getLanguagePrefix(language: string): string {
  return language === 'fr' ? 'fr' : 'en';
}

export function getSpeechVoicesForLanguage(
  voices: SpeechSynthesisVoice[],
  language: string,
): SpeechSynthesisVoice[] {
  const languagePrefix = getLanguagePrefix(language);

  return [...voices]
    .filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix))
    .sort((left, right) => {
      if (left.default !== right.default) {
        return left.default ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

export function getPreferredSpeechVoice(
  voices: SpeechSynthesisVoice[],
  language: string,
  preferredVoiceUri?: string,
): SpeechSynthesisVoice | null {
  if (preferredVoiceUri) {
    const preferredVoice = voices.find((voice) => voice.voiceURI === preferredVoiceUri);
    if (preferredVoice) {
      return preferredVoice;
    }
  }

  const matchingVoices = getSpeechVoicesForLanguage(voices, language);
  return matchingVoices[0] ?? null;
}