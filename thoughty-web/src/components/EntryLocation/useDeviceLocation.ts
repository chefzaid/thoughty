import { useCallback, useEffect, useRef, useState } from 'react';

/** Where asking the device stands: not asked, waiting, answered, refused by the writer, or not found. */
export type DeviceLocationStatus = 'idle' | 'locating' | 'found' | 'denied' | 'unavailable';

export interface DeviceCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

// A position a minute old is still where the writer is; a slow fix gives up rather than leave the button waiting
const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 };

function deviceGeolocation(): Geolocation | null {
  return typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null;
}

/**
 * Asks the browser where the device is, only when the writer presses for it (the browser asks their permission
 * the first time). An answer that arrives after the field is gone is dropped.
 */
export function useDeviceLocation(onFound: (coordinates: DeviceCoordinates) => void) {
  const [status, setStatus] = useState<DeviceLocationStatus>('idle');
  const mounted = useRef(true);
  const found = useRef(onFound);
  found.current = onFound;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const geolocation = deviceGeolocation();
  const locate = useCallback(() => {
    if (!geolocation) return;
    setStatus('locating');
    geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mounted.current) return;
        found.current({ latitude: coords.latitude, longitude: coords.longitude });
        setStatus('found');
      },
      (error) => {
        if (!mounted.current) return;
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      POSITION_OPTIONS,
    );
  }, [geolocation]);

  return { supported: geolocation !== null, status, locate };
}
