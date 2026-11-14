/** Whether the system asks for less motion (`prefers-reduced-motion: reduce`). */
export function prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * The behavior for a scroll the app starts itself (`scrollIntoView`, `scrollTo`): smooth, or a jump
 * when the system asks for less motion. A script's `behavior: 'smooth'` ignores the stylesheet's
 * `scroll-behavior`, so every such scroll goes through this instead.
 */
export function scrollBehavior(): ScrollBehavior {
    return prefersReducedMotion() ? 'auto' : 'smooth';
}
