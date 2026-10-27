import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

import StatsBarChart from './StatsBarChart';
import { getTranslation, type Language } from '../../utils/translations';

// A canvas stand-in that keeps the attributes the chart passes on to its <canvas>
vi.mock('react-chartjs-2', () => ({
    Bar: ({ data, options: _options, ...canvasProps }: { data: unknown; options: unknown }) => (
        createElement('canvas', { role: 'img', 'data-chart': JSON.stringify(data), ...canvasProps })
    ),
}));

const points = [{ label: '2024', value: 1 }, { label: '2025', value: 1200 }];

function renderChart(language: Language, controls?: React.ReactNode) {
    return render(
        <StatsBarChart
            title={getTranslation(language, 'thoughtsPerYear')}
            labelHeader={getTranslation(language, 'year')}
            points={points}
            backgroundColor="blue"
            borderColor="navy"
            options={{}}
            themeClass="dark"
            language={language}
            t={(key, params) => getTranslation(language, key, params)}
            controls={controls}
        />,
    );
}

describe('StatsBarChart', () => {
    it('names the chart by its title and describes it by its values', () => {
        renderChart('en', <button type="button">Next page</button>);

        const chart = screen.getByRole('img', { name: 'Entries per Year' });
        expect(chart).toHaveAccessibleDescription('2024: 1 entry; 2025: 1,200 entries');
        expect(JSON.parse(chart.dataset['chart'] ?? '{}')).toEqual(expect.objectContaining({ labels: ['2024', '2025'] }));
        expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    });

    it.each([
        ['en', 'Show as table', 'Year', 'Entries'],
        ['fr', 'Afficher en tableau', 'Année', 'Entrées'],
    ] as const)('switches between the chart and a table of its values in %s', async (language, toggleName, labelHeader, valueHeader) => {
        const user = userEvent.setup();
        renderChart(language);
        const toggle = screen.getByRole('button', { name: toggleName });
        expect(toggle).toHaveAttribute('aria-pressed', 'false');

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('img')).toBeNull();
        const table = screen.getByRole('table', { name: getTranslation(language, 'thoughtsPerYear') });
        expect(screen.getByRole('columnheader', { name: labelHeader })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: valueHeader })).toBeInTheDocument();
        expect(screen.getByRole('rowheader', { name: '2025' })).toBeInTheDocument();
        expect(table.querySelector('tbody tr:last-child td')?.textContent).toBe((1200).toLocaleString(language));

        await user.click(toggle);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });
});
