import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonalSection from './PersonalSection';
import type { ProfileConfig } from './types';

describe('PersonalSection', () => {
  const defaultProps = {
    localConfig: {
      name: 'John Doe',
      bio: 'A short bio',
      email: 'john@example.com',
      birthday: '1990-05-15',
    } as ProfileConfig,
    handleChange: vi.fn(),
    setLocalConfig: vi.fn(),
    isDark: true,
    t: (key: string) => key,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section header', () => {
    render(<PersonalSection {...defaultProps} />);
    expect(screen.getByText('personalInfo')).toBeInTheDocument();
  });

  it('renders name input with current value', () => {
    render(<PersonalSection {...defaultProps} />);
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('renders bio textarea with current value', () => {
    render(<PersonalSection {...defaultProps} />);
    expect(screen.getByDisplayValue('A short bio')).toBeInTheDocument();
  });

  it('renders email input as disabled', () => {
    render(<PersonalSection {...defaultProps} />);
    const emailInput = screen.getByDisplayValue('john@example.com');
    expect(emailInput).toBeDisabled();
  });

  it('renders birthday input with value', () => {
    render(<PersonalSection {...defaultProps} />);
    expect(screen.getByDisplayValue('1990-05-15')).toBeInTheDocument();
  });

  it('calls handleChange when name is typed', async () => {
    const user = userEvent.setup();
    render(<PersonalSection {...defaultProps} />);

    const nameInput = screen.getByDisplayValue('John Doe');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane');
    expect(defaultProps.handleChange).toHaveBeenCalled();
  });

  it('calls handleChange when bio is typed', async () => {
    const user = userEvent.setup();
    render(<PersonalSection {...defaultProps} />);

    const bioInput = screen.getByDisplayValue('A short bio');
    await user.clear(bioInput);
    await user.type(bioInput, 'New bio');
    expect(defaultProps.handleChange).toHaveBeenCalled();
  });

  it('sets default birthday on focus when birthday is empty', () => {
    const { container } = render(
      <PersonalSection
        {...defaultProps}
        localConfig={{ ...defaultProps.localConfig, birthday: '' }}
      />
    );

    const birthdayInput = container.querySelector('input[name="birthday"]')!;
    fireEvent.focus(birthdayInput);
    expect(defaultProps.setLocalConfig).toHaveBeenCalled();
  });

  it('does not set default birthday on focus when birthday already set', () => {
    render(<PersonalSection {...defaultProps} />);

    const birthdayInput = screen.getByDisplayValue('1990-05-15');
    fireEvent.focus(birthdayInput);
    expect(defaultProps.setLocalConfig).not.toHaveBeenCalled();
  });

  it('renders with empty values gracefully', () => {
    render(
      <PersonalSection
        {...defaultProps}
        localConfig={{}}
      />
    );
    expect(screen.getByPlaceholderText('enterYourFullName')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('writeSomethingAboutYourself')).toBeInTheDocument();
  });

  it('renders dark theme classes', () => {
    render(<PersonalSection {...defaultProps} isDark={true} />);
    const nameInput = screen.getByDisplayValue('John Doe');
    expect(nameInput.className).toContain('dark');
  });

  it('renders light theme classes', () => {
    render(<PersonalSection {...defaultProps} isDark={false} />);
    const nameInput = screen.getByDisplayValue('John Doe');
    expect(nameInput.className).toContain('light');
  });
});
