interface RereadIconProps {
    readonly className?: string;
}

/** An open book with a circling arrow: reading an entry again. */
export default function RereadIcon({ className = 'h-4 w-4 flex-shrink-0' }: RereadIconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.5 8.5 5 6 5H3v12h3c2.5 0 4.5.5 6 1.5m0-12c1.5-1 3.5-1.5 6-1.5h3v6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5v12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 16a3.5 3.5 0 11-1.1-2.55M21 12.5V15h-2.5" />
        </svg>
    );
}
