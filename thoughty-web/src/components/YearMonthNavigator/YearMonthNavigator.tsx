import React from 'react';
import type { Config } from '../../types';

interface YearMonthNavigatorProps {
  availableYears: number[];
  availableMonths: string[];
  navYear: string;
  setNavYear: (year: string) => void;
  navMonth: string;
  setNavMonth: (month: string) => void;
  onNavigate: (year: number, month: number | null) => void;
  config: Config;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const YearMonthNavigator: React.FC<YearMonthNavigatorProps> = ({
  availableYears,
  availableMonths,
  navYear,
  setNavYear,
  navMonth,
  setNavMonth,
  onNavigate,
  config,
  t
}) => {
  if (availableYears.length === 0) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="flex justify-center items-center gap-3 mt-4">
      <span className={`text-sm ${config.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
        {t('goToFirst')}:
      </span>
      <select
        value={navYear}
        onChange={(e) => { setNavYear(e.target.value); setNavMonth(''); }}
        className={`border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${
          config.theme === 'light'
            ? 'bg-gray-50 border-gray-300 text-gray-900'
            : 'bg-gray-900 border-gray-700 text-gray-100'
        }`}
      >
        <option value="">{t('year')}</option>
        {availableYears.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
      {navYear && availableMonths.some(m => m.startsWith(navYear)) && (
        <select
          value={navMonth}
          onChange={(e) => setNavMonth(e.target.value)}
          className={`border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${
            config.theme === 'light'
              ? 'bg-gray-50 border-gray-300 text-gray-900'
              : 'bg-gray-900 border-gray-700 text-gray-100'
          }`}
        >
          <option value="">{t('month')}</option>
          {availableMonths.filter(m => m.startsWith(navYear)).map(m => {
            const monthNum = Number.parseInt(m.split('-')[1] ?? '1', 10);
            return <option key={m} value={m}>{monthNames[monthNum - 1]}</option>;
          })}
        </select>
      )}
      <button
        onClick={() => navYear && onNavigate(
          Number.parseInt(navYear, 10),
          navMonth ? Number.parseInt(navMonth.split('-')[1] ?? '1', 10) : null
        )}
        disabled={!navYear}
        className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/50 rounded transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('go')}
      </button>
    </div>
  );
};

export default YearMonthNavigator;
