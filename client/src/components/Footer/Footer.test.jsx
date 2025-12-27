import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';

describe('Footer', () => {
    const defaultProps = {
        t: (key) => {
            const translations = {
                copyright: '© 2024 My Journal',
                madeWithLove: 'Made with ❤️',
                privacy: 'Privacy Policy',
                terms: 'Terms of Service',
                contact: 'Contact Us'
            };
            return translations[key] || key;
        },
        theme: 'dark'
    };

    it('renders copyright and additional text', () => {
        render(<Footer {...defaultProps} />);
        expect(screen.getByText('© 2024 My Journal')).toBeInTheDocument();
        expect(screen.getByText('Made with ❤️')).toBeInTheDocument();
    });

    it('renders all links', () => {
        render(<Footer {...defaultProps} />);
        expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
        expect(screen.getByText('Terms of Service')).toBeInTheDocument();
        expect(screen.getByText('Contact Us')).toBeInTheDocument();
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
