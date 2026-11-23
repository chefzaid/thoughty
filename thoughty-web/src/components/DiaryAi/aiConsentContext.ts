import { createContext, useContext } from 'react';
import type { RequestAiConsent } from './aiConsent';

/**
 * Opens the consent dialog of the signed-in app, for the parts that ask before an AI request without receiving
 * it (a recording's transcription, the memoir's follow-ups and transcription). None outside the signed-in app,
 * where a diary that asks each time sends nothing.
 */
export const AiConsentContext = createContext<RequestAiConsent | undefined>(undefined);

/** The signed-in app's consent dialog, if any. */
export function useRequestAiConsent(): RequestAiConsent | undefined {
  return useContext(AiConsentContext);
}
