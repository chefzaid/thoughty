import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';
import { DisplayLanguageContext } from '../../contexts/displayLanguage';

describe('Footer', () => {
    const defaultProps = {
        t: (key: string): string => {
            const translations: Record<string, string> = {
                copyright: '© 2024 My Journal',
                madeWithLove: 'Made with ❤️',
                about: 'About',
                privacy: 'Privacy Policy',
                terms: 'Terms of Service',
                contact: 'Contact Us',
                footerMemoirQuestions: 'Memoir questions',
                footerJournalTemplates: 'Journal templates',
            };
            return translations[key] || key;
        },
        theme: 'dark' as const
    };

    it('renders copyright and additional text', () => {
        render(<Footer {...defaultProps} />);
        expect(screen.getByText('© 2024 My Journal')).toBeInTheDocument();
        expect(screen.getByText('Made with ❤️')).toBeInTheDocument();
    });

    it('renders all links', () => {
        render(<Footer {...defaultProps} />);
        expect(screen.getByText('About')).toBeInTheDocument();
        expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
        expect(screen.getByText('Terms of Service')).toBeInTheDocument();
        expect(screen.getByText('Contact Us')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Memoir questions' })).toHaveAttribute('href', '/memoir-questions');
        expect(screen.getByRole('link', { name: 'Journal templates' })).toHaveAttribute('href', '/journal-templates');
    });

    it('leads to the public pages in the language being read', () => {
        render(<DisplayLanguageContext.Provider value="fr"><Footer {...defaultProps} /></DisplayLanguageContext.Provider>);
        expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/fr/about');
        expect(screen.getByRole('link', { name: 'Memoir questions' })).toHaveAttribute('href', '/fr/memoir-questions');
        expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/fr/contact');
    });

    it('applies dark theme styles correctly', () => {
        render(<Footer {...defaultProps} theme="dark" />);
        const footer = screen.getByRole('contentinfo'); // footer element
        expect(footer).toHaveClass('border-gray-800');
        expect(footer).toHaveClass('bg-gray-900/50');
    });

    it('applies light theme styles correctly', () => {
        render(<Footer {...defaultProps} theme="light" />);
        const footer = screen.getByRole('contentinfo');
        expect(footer).toHaveClass('border-gray-200');
        expect(footer).toHaveClass('bg-gray-50/50');
    });
});
