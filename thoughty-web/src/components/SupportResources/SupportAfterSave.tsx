import { useState } from 'react';

import type { TranslationFunction } from '../../types';
import type { SavedEntry } from '../ComfortReads/comfortReadsState';
import SupportResourcesCard from './SupportResourcesCard';

interface SupportAfterSaveProps {
  /** The entry the composer saved last, or null before any. */
  readonly saved: SavedEntry | null;
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/**
 * Below the composer, after every save whose words carry a sign of crisis: the support card, until the writer
 * closes it. A later save that carries one shows it again; a save that carries none takes it away.
 */
function SupportAfterSave({ saved, theme, t }: SupportAfterSaveProps) {
  const [closedFor, setClosedFor] = useState<SavedEntry | null>(null);
  if (!saved?.crisisSignal || closedFor === saved) return null;
  return <SupportResourcesCard onClose={() => setClosedFor(saved)} theme={theme} t={t} className="mb-4" />;
}

export default SupportAfterSave;
