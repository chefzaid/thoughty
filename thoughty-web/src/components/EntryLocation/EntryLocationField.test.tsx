import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import EntryLocationField from './EntryLocationField';
import { getTranslation } from '../../utils/translations';
import { NO_LOCATION, type EntryLocationDraft } from '../../utils/entryLocation';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

type Success = (position: { coords: { latitude: number; longitude: number } }) => void;
type Failure = (error: { code: number; PERMISSION_DENIED: number }) => void;

/** A device whose location the test answers, after the writer asked for it. */
function fakeGeolocation() {
  const pending: Array<{ success: Success; failure: Failure }> = [];
  const getCurrentPosition = vi.fn((success: Success, failure: Failure) => pending.push({ success, failure }));
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
  return {
    getCurrentPosition,
    answer: (latitude: number, longitude: number) => act(() => pending.shift()?.success({ coords: { latitude, longitude } })),
    fail: (code: number) => act(() => pending.shift()?.failure({ code, PERMISSION_DENIED: 1 })),
  };
}

function Field({ initial = NO_LOCATION }: { initial?: EntryLocationDraft }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EntryLocationField id="place" value={value} onChange={setValue} inputClass="" theme="light" language="en" t={t} />
      <div data-testid="value">{JSON.stringify(value)}</div>
    </>
  );
}

const value = () => JSON.parse(screen.getByTestId('value').textContent ?? '{}') as EntryLocationDraft;

describe('EntryLocationField', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('takes a typed place, asking nothing of the device until the writer presses for their location', () => {
    const device = fakeGeolocation();
    render(<Field />);

    fireEvent.change(screen.getByLabelText('Place'), { target: { value: 'Lake Annecy' } });

    expect(value()).toEqual({ name: 'Lake Annecy', latitude: null, longitude: null });
    expect(device.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('adds the device coordinates beside the typed name, says so, and removes them on request', () => {
    const device = fakeGeolocation();
    render(<Field initial={{ name: 'Café', latitude: null, longitude: null }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByRole('status')).toHaveTextContent('Finding your location…');
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeDisabled();
    // Typing while the device answers keeps what was typed
    fireEvent.change(screen.getByLabelText('Place'), { target: { value: 'Café de Flore' } });
    device.answer(48.854, 2.3325);

    expect(value()).toEqual({ name: 'Café de Flore', latitude: 48.854, longitude: 2.3325 });
    expect(screen.getByRole('status')).toHaveTextContent('Your location was added');
    expect(screen.getByText('Coordinates: 48.854° N, 2.3325° E')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove coordinates' }));
    expect(value()).toEqual({ name: 'Café de Flore', latitude: null, longitude: null });
  });

  it('says when location access was refused or the device could not tell', () => {
    const device = fakeGeolocation();
    render(<Field />);

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    device.fail(1);
    expect(screen.getByRole('status')).toHaveTextContent('Location access was refused. You can still type the place.');

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    device.fail(3);
    expect(screen.getByRole('status')).toHaveTextContent('Your location could not be found. You can still type the place.');
    expect(value()).toEqual(NO_LOCATION);
  });

  it('drops an answer that arrives after the field is gone', () => {
    const device = fakeGeolocation();
    const onChange = vi.fn();
    const { unmount } = render(
      <EntryLocationField id="place" value={NO_LOCATION} onChange={onChange} inputClass="" language="en" t={t} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
    unmount();
    device.answer(1, 2);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers no location button on a device without geolocation', () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    render(<Field />);

    expect(screen.queryByRole('button', { name: 'Use my location' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Place')).toBeInTheDocument();
  });
});
