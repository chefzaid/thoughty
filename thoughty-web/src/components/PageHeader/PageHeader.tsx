import type { ReactNode, Ref } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  readonly title: ReactNode;
  readonly theme?: 'light' | 'dark';
  readonly subtitle?: ReactNode;
  /** Shown above the title, so titles start at the same place on every page. */
  readonly back?: { readonly label: string; readonly onClick: () => void };
  /** The page's own controls: beside the title on wide screens, under it on narrow ones. */
  readonly actions?: ReactNode;
  readonly titleId?: string;
  /** A title that takes focus (after a deletion, say) gets tabIndex -1. */
  readonly titleRef?: Ref<HTMLHeadingElement>;
  readonly className?: string;
}

/** The title block every signed-in page opens with, so pages share one heading style. */
function PageHeader({ title, theme = 'dark', subtitle, back, actions, titleId, titleRef, className }: Readonly<PageHeaderProps>) {
  return (
    <header className={`page-header ${theme}${className ? ` ${className}` : ''}`}>
      <div className="page-header-text">
        {back && (
          <button type="button" className="page-back" onClick={back.onClick}>
            <span className="codicon codicon-arrow-left" aria-hidden="true" />
            {back.label}
          </button>
        )}
        <h1 id={titleId} ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
