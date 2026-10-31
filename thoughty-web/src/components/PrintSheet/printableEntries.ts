import type { Entry } from '../../types';

/** What a print shows beyond the date, title, text and pictures. */
export interface PrintOptions {
    readonly mood: boolean;
    readonly tags: boolean;
}

/** The entries a print may show: never a sealed time capsule. */
export function printableEntries(entries: readonly Entry[]): Entry[] {
    return entries.filter((entry) => !entry.sealed_until);
}
