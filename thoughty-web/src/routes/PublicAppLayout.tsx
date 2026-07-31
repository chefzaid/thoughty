import { useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { useRouteChangeFocus } from '../hooks/useRouteChangeFocus';

interface PublicAppLayoutProps {
  readonly children: ReactNode;
  readonly t: (key: string) => string;
}

function PublicAppLayout({ children, t }: Readonly<PublicAppLayoutProps>) {
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
      <div id="public-page-content" ref={contentRef} tabIndex={-1}>
        {children}
      </div>
    </>
  );
}

export default PublicAppLayout;
