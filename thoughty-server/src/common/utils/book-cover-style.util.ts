export type BookCoverTheme = 'classic' | 'ocean' | 'forest' | 'rose';

export interface BookCoverImage {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
}

export interface BookCover {
  theme: BookCoverTheme;
  image?: BookCoverImage;
}

export interface BookCoverPalette {
  background: string;
  foreground: string;
  accent: string;
}

export const BOOK_COVER_PALETTES: Record<BookCoverTheme, BookCoverPalette> = {
  classic: { background: '#fffaf0', foreground: '#292524', accent: '#b45309' },
  ocean: { background: '#e0f2fe', foreground: '#0c4a6e', accent: '#0284c7' },
  forest: { background: '#ecfdf5', foreground: '#14532d', accent: '#16a34a' },
  rose: { background: '#fdf2f8', foreground: '#831843', accent: '#db2777' },
};
