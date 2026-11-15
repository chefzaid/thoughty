import type { ReactNode, Ref } from 'react';

interface IconActionButtonProps {
    title: string;
    className: string;
    onClick: () => void;
    children: ReactNode;
    ariaLabel?: string;
    /** Set for a button that opens a menu, so the menu state is announced. */
    ariaExpanded?: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
    disabled?: boolean;
}

export function IconActionButton({
    title,
    className,
    onClick,
    children,
    ariaLabel,
    ariaExpanded,
    buttonRef,
    disabled,
}: Readonly<IconActionButtonProps>) {
    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${className} rounded transition-colors disabled:cursor-not-allowed disabled:opacity-60`}
            title={title}
            aria-label={ariaLabel ?? title}
            aria-haspopup={ariaExpanded === undefined ? undefined : 'menu'}
            aria-expanded={ariaExpanded}
        >
            {children}
        </button>
    );
}

interface MenuActionButtonProps {
    title: string;
    className: string;
    onClick: () => void;
    children: ReactNode;
}

export function MenuActionButton({
    title,
    className,
    onClick,
    children,
}: Readonly<MenuActionButtonProps>) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${className}`}
            title={title}
            aria-label={title}
        >
            {children}
        </button>
    );
}