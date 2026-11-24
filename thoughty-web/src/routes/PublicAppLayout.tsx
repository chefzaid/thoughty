import { useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import VisitorPreferencesSwitch from '../components/VisitorPreferences/VisitorPreferencesSwitch';
import { useRouteChangeFocus } from '../hooks/useRouteChangeFocus';
import type { VisitorPreferences } from '../hooks/useVisitorPreferences';
import type { TranslationFunction } from '../types';

interface PublicAppLayoutProps {
  readonly children: ReactNode;
  readonly t: TranslationFunction;
  /** The visitor's language and theme, with their switch; null for a signed-in writer, whose settings apply. */
  readonly visitorPreferences?: VisitorPreferences | null;
}

function PublicAppLayout({ children, t, visitorPreferences }: Readonly<PublicAppLayoutProps>) {
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  useRouteChangeFocus(location.pathname, contentRef);

  return (
    <>
      <a
        href="#public-page-content"
        className="skip-link"
        onClick={() => contentRef.current?.focus()}
      >
        {t('skipToContent')}
      </a>
      {visitorPreferences && <VisitorPreferencesSwitch preferences={visitorPreferences} t={t} />}
      <div id="public-page-content" ref={contentRef} tabIndex={-1}>
        {children}
      </div>
    </>
  );
}

export default PublicAppLayout;
