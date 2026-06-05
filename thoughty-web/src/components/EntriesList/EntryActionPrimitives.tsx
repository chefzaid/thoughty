import type { ReactNode } from 'react';

interface IconActionButtonProps {
    title: string;
    className: string;
    onClick: () => void;
    children: ReactNode;
    ariaLabel?: string;
}

export function IconActionButton({
    title,
    className,
    onClick,
    children,
    ariaLabel,
}: Readonly<IconActionButtonProps>) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${className} rounded transition-colors`}
            title={title}
            aria-label={ariaLabel ?? title}
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