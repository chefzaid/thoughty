export type MetricLabelValue = string | number;
export type MetricLabels = Record<string, MetricLabelValue>;

function escapeLabel(value: MetricLabelValue): string {
  return String(value).replaceAll('\\', String.raw`\\`).replaceAll('\n', String.raw`\n`).replaceAll('"', String.raw`\"`);
}

/** One sample in the Prometheus text exposition format; a value that is not a finite number reads as 0. */
export function metricLine(name: string, value: number, labels: MetricLabels = {}): string {
  const labelEntries = Object.entries(labels);
  const formattedLabels = labelEntries.map(([key, labelValue]) => `${key}="${escapeLabel(labelValue)}"`).join(',');
  const labelText = labelEntries.length > 0 ? `{${formattedLabels}}` : '';

  return `${name}${labelText} ${Number.isFinite(value) ? value : 0}`;
}
