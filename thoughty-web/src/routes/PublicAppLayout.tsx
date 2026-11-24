import { useRef, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import VisitorPreferencesSwitch from '../components/VisitorPreferences/VisitorPreferencesSwitch';
import { usePublicPageLinks } from '../hooks/usePublicPageLinks';
import { useRouteChangeFocus } from '../hooks/useRouteChangeFocus';
import type { VisitorPreferences } from '../hooks/useVisitorPreferences';
import {
  DEFAULT_PAGE_LANGUAGE,
  getLocalizedPublicPage,
  getPublicPathForView,
  type TranslationFunction,
} from '../types';
import type { Language } from '../utils/translations';

interface PublicAppLayoutProps {
  readonly children: ReactNode;
  readonly t: TranslationFunction;
  /** The visitor's language and theme, with their switch; null for a signed-in writer, whose settings apply. */
  readonly visitorPreferences?: VisitorPreferences | null;
  /**
   * The language the reader reads in when the path says none (a visitor's pick or browser language, a
   * writer's settings), to which a localized page's English address sends them; null to stay.
   */
  readonly preferredLanguage?: Language | null;
}

function PublicAppLayout({ children, t, visitorPreferences, preferredLanguage = null }: Readonly<PublicAppLayoutProps>) {
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  // A localized public page is read in its path's language, and its English address is also every
  // other language's: a reader who reads another is sent to their own
  const page = getLocalizedPublicPage(location.pathname);
  const redirectTo = page?.language === DEFAULT_PAGE_LANGUAGE && preferredLanguage && preferredLanguage !== DEFAULT_PAGE_LANGUAGE
    ? getPublicPathForView(page.view, preferredLanguage)
    : null;

  // The same page in another language keeps its place and focus
  useRouteChangeFocus(page ? `page:${page.view}` : location.pathname, contentRef);
  usePublicPageLinks(redirectTo ? null : page);

  if (redirectTo) {
    return <Navigate to={{ pathname: redirectTo, search: location.search, hash: location.hash }} replace />;
  }

  // On a localized page the switch shows the path's language and opens the page's address in the other
  const switchPreferences = visitorPreferences && page
    ? {
      ...visitorPreferences,
      language: page.language,
      chooseLanguage: (language: Language) => {
        visitorPreferences.chooseLanguage(language);
        if (language !== page.language) {
          navigate({ pathname: getPublicPathForView(page.view, language), search: location.search, hash: location.hash });
        }
      },
    }
    : visitorPreferences;

  return (
    <>
      <a
        href="#public-page-content"
        className="skip-link"
        onClick={() => contentRef.current?.focus()}
      >
        {t('skipToContent')}
      </a>
      {switchPreferences && <VisitorPreferencesSwitch preferences={switchPreferences} t={t} />}
      <div id="public-page-content" ref={contentRef} tabIndex={-1}>
        {children}
      </div>
    </>
  );
}

export default PublicAppLayout;
