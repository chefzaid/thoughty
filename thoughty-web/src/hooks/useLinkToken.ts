import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The secret token of an emailed link (`?token=`: password reset, sign-up, email verification),
 * read once and removed from the address and its history entry at once (a replace), so it is not
 * left in the address bar, the history or the referrer of a later request. The production NGINX
 * also sends these pages without a referrer and keeps them out of its access log
 * (`$thoughty_secret_link` in nginx.conf). A reload after that finds no token.
 */
export function useLinkToken(): string {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token')?.trim() ?? '');

  useEffect(() => {
    if (!searchParams.has('token')) return;
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    setSearchParams(rest, { replace: true });
  }, [searchParams, setSearchParams]);

  return token;
}
