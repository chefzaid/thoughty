import { useCallback, useId, useRef, type FocusEvent, type ReactNode } from 'react';
import type { ViewType } from '../../types';
import useDismissibleMenu, { type MenuDismissReason } from '../EntriesList/useDismissibleMenu';
import type { NavGroupItem } from './navGroups';
import './NavGroup.css';

interface NavGroupProps {
    readonly label: string;
    readonly icon: ReactNode;
    readonly items: readonly NavGroupItem[];
    readonly currentView: ViewType;
    readonly isOpen: boolean;
    readonly onToggle: () => void;
    readonly onClose: () => void;
    readonly onSelect: (view: ViewType) => void;
}

/**
 * One group of the main navigation as a disclosure: its button shows or hides the list of pages
 * under it (not an ARIA menu, so Tab moves through the pages like any other links).
 */
function NavGroup({ label, icon, items, currentView, isOpen, onToggle, onClose, onSelect }: NavGroupProps) {
    const panelId = useId();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const isActive = items.some((item) => item.view === currentView);

    const dismiss = useCallback((reason: MenuDismissReason) => {
        onClose();
        if (reason === 'escape') {
            buttonRef.current?.focus();
        }
    }, [onClose]);
    useDismissibleMenu(isOpen, wrapperRef, dismiss);

    // Tabbing past the last page (or back before the button) leaves the group, which closes it
    const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        if (isOpen && next instanceof Node && !wrapperRef.current?.contains(next)) {
            onClose();
        }
    };

    return (
        <div className="nav-group" ref={wrapperRef} onBlur={closeWhenFocusLeaves}>
            <button
                type="button"
                ref={buttonRef}
                className={`nav-item nav-group-btn ${isActive ? 'active' : ''}`}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={onToggle}
            >
                {icon}
                <span className="nav-group-label">{label}</span>
                <span className="codicon codicon-chevron-down nav-group-chevron" aria-hidden="true" />
            </button>
            <ul id={panelId} className="nav-group-panel" hidden={!isOpen}>
                {items.map((item) => {
                    const isCurrent = item.view === currentView;
                    return (
                        <li key={item.view}>
                            <button
                                type="button"
                                className={`nav-group-option ${isCurrent ? 'active' : ''}`}
                                aria-current={isCurrent ? 'page' : undefined}
                                onClick={() => onSelect(item.view)}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default NavGroup;
