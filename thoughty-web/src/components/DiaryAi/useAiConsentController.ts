import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiConsentRequest, RequestAiConsent } from './aiConsent';

/**
 * The consent dialog of the signed-in app: `requestConsent` opens it on what a request would send and resolves
 * with the writer's answer. A new request answers the one still open with no, and so does leaving the app.
 */
export function useAiConsentController() {
  const [request, setRequest] = useState<AiConsentRequest | null>(null);
  const resolver = useRef<((agreed: boolean) => void) | null>(null);

  const settle = useCallback((agreed: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(agreed);
  }, []);

  const requestConsent = useCallback<RequestAiConsent>((next) => {
    settle(false);
    setRequest(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [settle]);

  const answer = useCallback((agreed: boolean) => {
    setRequest(null);
    settle(agreed);
  }, [settle]);

  useEffect(() => () => settle(false), [settle]);

  return { requestConsent, request, answer };
}
