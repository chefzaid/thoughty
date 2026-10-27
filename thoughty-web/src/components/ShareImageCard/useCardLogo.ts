import { useEffect, useState } from 'react';

/** The app's own logo, served with the app, so drawing it never taints the canvas. */
export const CARD_LOGO_SRC = '/thoughty-logo.svg';

/** Loads the logo for the card's mark; until it has loaded (or if it fails) the mark is text only. */
export function useCardLogo(): HTMLImageElement | null {
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setLogo(image);
    };
    image.src = CARD_LOGO_SRC;
    return () => {
      active = false;
      image.onload = null;
    };
  }, []);

  return logo;
}
