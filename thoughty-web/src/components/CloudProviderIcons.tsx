import type { FC, SVGProps } from 'react';

const GoogleDriveIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L29 52.2H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
    <path d="M43.65 25.15L29 1.2C27.65 2 26.5 3.1 25.7 4.5L1.2 46.85c-.75 1.35-1.2 2.85-1.2 4.35h29z" fill="#00AC47" />
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H58.3L73.55 76.8z" fill="#EA4335" />
    <path d="M43.65 25.15L58.9 1.2C57.55.4 56 0 54.4 0H32.9c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D" />
    <path d="M58.3 52.2H29l-15.25 24.6c1.35.8 2.9 1.2 4.5 1.2h50.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684FC" />
    <path d="M73.4 26.5L60.1 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.15l14.65 27.05H87.3c0-1.5-.4-3-1.2-4.5z" fill="#FFBA00" />
  </svg>
);

const OneDriveIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M10.5 7.5C11.4 5.5 13.5 4 16 4c1.4 0 2.7.5 3.7 1.3C20.5 3.3 22.5 2 25 2c3.3 0 6 2.7 6 6 0 .3 0 .7-.1 1C33.7 9.6 36 12.2 36 15.5 36 19.1 33.1 22 29.5 22h-18C8.5 22 6 19.5 6 16.5c0-2.5 1.7-4.6 4-5.2.1-1.3.6-2.6 1.5-3.8z" fill="#0364B8" transform="scale(0.667)" />
    <path d="M10.5 7.5c-.5.7-.9 1.4-1.2 2.2l-.3.8C6.7 11 5 13.1 5 15.5 5 18.5 7.5 21 10.5 21h19c3.6 0 6.5-2.9 6.5-6.5 0-3.3-2.4-6-5.6-6.5.1-.3.1-.7.1-1 0-3.3-2.7-6-6-6-2.5 0-4.5 1.5-5.5 3.5L17.5 5C15 5 12.5 6 10.5 7.5z" fill="#0078D4" transform="scale(0.667)" />
    <path d="M9 10.5C7 11 5.5 12.8 5.5 15c0 2.5 2 4.5 4.5 4.5h18.5c3 0 5.5-2.5 5.5-5.5 0-2.8-2.1-5.1-4.8-5.4l-.2-.1c-.7-2.3-2.8-4-5.3-4-1.8 0-3.4.9-4.4 2.2C17.5 5.6 15.8 5 14 5c-2.8 0-5 1.8-5.7 4.3l-.3.2z" fill="#1490DF" transform="scale(0.667)" />
    <path d="M9.5 10.5c-.5.1-1 .3-1.5.5C6 12 5 13.8 5 16c0 2.8 2.2 5 5 5h18c2.8 0 5-2.2 5-5 0-2.6-2-4.8-4.6-5-.8-2-2.8-3.5-5.1-3.5-1.5 0-2.8.6-3.8 1.5C18 7.6 16.2 7 14.5 7c-2.3 0-4.2 1.3-5 3.5z" fill="#28A8EA" transform="scale(0.667)" />
  </svg>
);

const DropboxIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 43 40" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12.6 0L0 8.1l8.7 7 12.5-7.8z" fill="#0061FF" />
    <path d="M0 22.1L12.6 30l8.6-7.8-12.5-7z" fill="#0061FF" />
    <path d="M21.2 22.2L29.8 30l12.6-7.9-8.7-7z" fill="#0061FF" />
    <path d="M42.4 8.1L29.8 0l-8.6 7.3 12.5 7z" fill="#0061FF" />
    <path d="M21.3 23.7L12.6 31.5l-3.9-2.6v2.9l12.6 7.5 12.6-7.5v-2.9l-3.9 2.6z" fill="#0061FF" />
  </svg>
);

export const CLOUD_PROVIDER_ICONS: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  google_drive: GoogleDriveIcon,
  onedrive: OneDriveIcon,
  dropbox: DropboxIcon,
};

export const CLOUD_PROVIDER_NAMES = {
  google_drive: 'Google Drive',
  onedrive: 'OneDrive',
  dropbox: 'Dropbox',
} as const;
