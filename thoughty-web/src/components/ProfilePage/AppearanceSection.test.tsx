import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppearanceSection from './AppearanceSection';
import type { ProfileConfig } from './types';

describe('AppearanceSection', () => {
  const defaultProps = {
    localConfig: {
      theme: 'dark' as const,
      entriesPerPage: '10',
      language: 'en',
      readDates: true,
    } as ProfileConfig,
    handleChange: vi.fn(),
    handleThemeToggle: vi.fn(),
    isDark: true,
    isLight: false,
    t: (key: string) => key,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByText('appearance')).toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  it('calls handleThemeToggle when theme button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection {...defaultProps} />);

    await user.click(screen.getByLabelText('Toggle theme'));
    expect(defaultProps.handleThemeToggle).toHaveBeenCalledTimes(1);
  });

  it('renders entries per page select with current value', () => {
    render(<AppearanceSection {...defaultProps} />);
    const select = screen.getByDisplayValue('10');
    expect(select).toBeInTheDocument();
  });

  it('calls handleChange when entries per page changes', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection {...defaultProps} />);

    await user.selectOptions(screen.getByDisplayValue('10'), '25');
    expect(defaultProps.handleChange).toHaveBeenCalled();
  });

  it('renders language buttons', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByTitle('English')).toBeInTheDocument();
    expect(screen.getByTitle('Français')).toBeInTheDocument();
  });

  it('renders font customization controls and preview', () => {
    render(<AppearanceSection {...defaultProps} />);

    expect(screen.getByLabelText('fontType')).toBeInTheDocument();
    expect(screen.getByLabelText('fontSize')).toBeInTheDocument();
    expect(screen.getByLabelText('fontColor')).toBeInTheDocument();
    expect(screen.getByTestId('font-preview')).toBeInTheDocument();
  });

  it('calls handleChange when font family changes', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection {...defaultProps} />);

    await user.selectOptions(screen.getByLabelText('fontType'), 'serif');
    expect(defaultProps.handleChange).toHaveBeenCalled();
  });

  it('shows the current font size value', async () => {
    render(<AppearanceSection {...defaultProps} />);

    expect(screen.getAllByText('16px')).toHaveLength(2);
  });

  it('shows the resolved default font color when no custom color is set', async () => {
    render(<AppearanceSection {...defaultProps} />);

    expect(screen.getByText('#F3F4F6')).toBeInTheDocument();
  });

  it('highlights active language button', () => {
    render(<AppearanceSection {...defaultProps} />);
    const enBtn = screen.getByTitle('English');
    expect(enBtn.className).toContain('active');
  });

  it('calls handleChange when language is clicked', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection {...defaultProps} />);

    await user.click(screen.getByTitle('Français'));
    expect(defaultProps.handleChange).toHaveBeenCalledWith({
      target: { name: 'language', value: 'fr' },
    });
  });

  it('renders readDates toggle', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByText('readDates')).toBeInTheDocument();
    expect(screen.getByText('readDatesDescription')).toBeInTheDocument();
  });

  it('calls handleChange to toggle readDates off', async () => {
    const user = userEvent.setup();
    render(<AppearanceSection {...defaultProps} />);

    const toggle = screen.getByLabelText('readDates');
    await user.click(toggle);
    expect(defaultProps.handleChange).toHaveBeenCalledWith({
      target: { name: 'readDates', value: 'false' },
    });
  });

  it('calls handleChange to toggle readDates on when currently false', async () => {
    const user = userEvent.setup();
    render(
      <AppearanceSection
        {...defaultProps}
        localConfig={{ ...defaultProps.localConfig, readDates: false }}
      />
    );

    const toggle = screen.getByLabelText('readDates');
    await user.click(toggle);
    expect(defaultProps.handleChange).toHaveBeenCalledWith({
      target: { name: 'readDates', value: 'true' },
    });
  });

  it('renders with light theme classes', () => {
    render(
      <AppearanceSection {...defaultProps} isDark={false} isLight={true} />
    );
    const themeBtn = screen.getByLabelText('Toggle theme');
    expect(themeBtn.className).toContain('light');
  });

  it('shows dark class on theme switch when isDark', () => {
    render(<AppearanceSection {...defaultProps} />);
    const themeBtn = screen.getByLabelText('Toggle theme');
    expect(themeBtn.className).toContain('dark');
  });

  it('defaults entriesPerPage to 10 when not set', () => {
    render(
      <AppearanceSection
        {...defaultProps}
        localConfig={{ ...defaultProps.localConfig, entriesPerPage: undefined }}
      />
    );
    const select = screen.getByDisplayValue('10');
    expect(select).toBeInTheDocument();
  });

  it('uses the selected font settings in the preview', () => {
    render(
      <AppearanceSection
        {...defaultProps}
        localConfig={{
          ...defaultProps.localConfig,
          fontFamily: 'serif',
          fontSize: '18',
          fontColor: '#123456',
        }}
      />
    );

    expect(screen.getByTestId('font-preview')).toHaveStyle({
      fontSize: '18px',
      color: 'rgb(18, 52, 86)',
    });
  });
});
