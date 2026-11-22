import type { TranslationFunction } from '../../types';
import type { SupportResourcesTranslationKey } from '../../utils/translations.supportResources';

interface SupportResource {
  readonly region: SupportResourcesTranslationKey;
  readonly detail: SupportResourcesTranslationKey;
  readonly href: string;
  readonly label: string;
}

/**
 * Where to turn in a crisis, the emergency number first, then free lines that answer day and night in the
 * countries Thoughty is written for, then a directory for everywhere else.
 */
const SUPPORT_RESOURCES: readonly SupportResource[] = [
  { region: 'supportEmergencyRegion', detail: 'supportEmergencyDetail', href: 'tel:112', label: '112' },
  { region: 'supportFranceRegion', detail: 'supportFranceDetail', href: 'tel:3114', label: '3114' },
  { region: 'supportUkIrelandRegion', detail: 'supportUkIrelandDetail', href: 'tel:116123', label: '116 123' },
  { region: 'supportUsCanadaRegion', detail: 'supportUsCanadaDetail', href: 'tel:988', label: '988' },
  { region: 'supportElsewhereRegion', detail: 'supportElsewhereDetail', href: 'https://findahelpline.com', label: 'findahelpline.com' },
];

interface SupportResourceListProps {
  readonly t: TranslationFunction;
  readonly className?: string;
  readonly linkClassName?: string;
}

/** The support lines as a list, each number a link that calls it and the directory a link that opens it. */
function SupportResourceList({ t, className, linkClassName }: SupportResourceListProps) {
  return (
    <ul className={className}>
      {SUPPORT_RESOURCES.map(({ region, detail, href, label }) => {
        const external = href.startsWith('https:');
        return (
          <li key={region}>
            <span className="font-semibold">{t(region)}</span>
            {': '}
            <a
              href={href}
              className={linkClassName}
              {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              {label}
            </a>
            {', '}
            {t(detail)}
          </li>
        );
      })}
    </ul>
  );
}

export default SupportResourceList;
