import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthPage from './AuthPage';
import { useAuth } from '../../contexts/AuthContext';
import { SIGN_UP_RESEND_SECONDS } from './SignUpEmailSent';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const t = (key: string, params?: Record<string, string | number>): string =>
    params ? `${key} ${JSON.stringify(params)}` : key;

function fillSignUp() {
    fireEvent.change(screen.getByLabelText('username'), { target: { value: 'newbie' } });
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'Pass123!@' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'Pass123!@' } });
    fireEvent.click(screen.getByRole('button', { name: 'signUp' }));
}

describe('AuthPage verify-first sign-up', () => {
    let register: ReturnType<typeof vi.fn>;
    let onAuthSuccess: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
        register = vi.fn().mockResolvedValue({ success: true, verificationRequired: true });
        onAuthSuccess = vi.fn<() => void>();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            login: vi.fn(),
            register,
            signInWithGoogle: vi.fn(),
            forgotPassword: vi.fn(),
            verifyTwoFactor: vi.fn(),
            resendTwoFactor: vi.fn(),
            googleClientId: 'google-client',
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('asks the writer to check their email instead of signing in, whatever the address', async () => {
        render(<AuthPage t={t} theme="dark" mode="register" onAuthSuccess={onAuthSuccess} />);
        fillSignUp();

        expect(await screen.findByText('signUpCheckEmailBody {"email":"new@example.com"}')).toBeInTheDocument();
        expect(register).toHaveBeenCalledWith('new@example.com', 'Pass123!@', 'newbie', '');
        expect(onAuthSuccess).not.toHaveBeenCalled();
        expect(screen.getByText('signUpCheckEmailTitle', { selector: '.auth-subtitle' })).toBeInTheDocument();
        expect(screen.getByText('signUpCheckEmailPassword')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /continueWithGoogle/ })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('password')).not.toBeInTheDocument();
    });

    it('lets the writer ask for the email again once a minute has passed', async () => {
        vi.useFakeTimers();
        render(<AuthPage t={t} theme="light" mode="register" />);
        fillSignUp();
        await act(async () => { await Promise.resolve(); });

        const waiting = screen.getByRole('button', { name: `signUpResendIn {"seconds":${SIGN_UP_RESEND_SECONDS}}` });
        expect(waiting).toBeDisabled();
        act(() => { vi.advanceTimersByTime(1000); });
        expect(screen.getByRole('button', { name: `signUpResendIn {"seconds":${SIGN_UP_RESEND_SECONDS - 1}}` })).toBeDisabled();
        act(() => { vi.advanceTimersByTime(SIGN_UP_RESEND_SECONDS * 1000); });

        fireEvent.click(screen.getByRole('button', { name: 'signUpResendEmail' }));
        await act(async () => { await Promise.resolve(); });

        expect(register).toHaveBeenCalledTimes(2);
        expect(screen.getByText('signUpEmailResent')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: `signUpResendIn {"seconds":${SIGN_UP_RESEND_SECONDS}}` })).toBeDisabled();
    });

    it('shows why asking again failed', async () => {
        vi.useFakeTimers();
        render(<AuthPage t={t} theme="dark" mode="register" />);
        fillSignUp();
        await act(async () => { await Promise.resolve(); });
        act(() => { vi.advanceTimersByTime(SIGN_UP_RESEND_SECONDS * 1000); });
        register.mockResolvedValueOnce({ success: false, error: 'apiError_RATE_LIMITED' });

        fireEvent.click(screen.getByRole('button', { name: 'signUpResendEmail' }));
        await act(async () => { await Promise.resolve(); });

        expect(screen.getByText('apiError_RATE_LIMITED')).toBeInTheDocument();
    });

    it('falls back to a generic message when asking again fails without one', async () => {
        vi.useFakeTimers();
        render(<AuthPage t={t} theme="dark" mode="register" />);
        fillSignUp();
        await act(async () => { await Promise.resolve(); });
        act(() => { vi.advanceTimersByTime(SIGN_UP_RESEND_SECONDS * 1000); });
        register.mockResolvedValueOnce({ success: false });

        fireEvent.click(screen.getByRole('button', { name: 'signUpResendEmail' }));
        await act(async () => { await Promise.resolve(); });

        expect(screen.getByText('authFailed')).toBeInTheDocument();
    });

    it('goes back to the filled form to use another email', async () => {
        render(<AuthPage t={t} theme="dark" mode="register" />);
        fillSignUp();
        fireEvent.click(await screen.findByRole('button', { name: 'signUpUseAnotherEmail' }));

        expect(screen.getByLabelText('email')).toHaveValue('new@example.com');
        expect(screen.getByRole('button', { name: /continueWithGoogle/ })).toBeInTheDocument();
    });

    it('drops the step when the route switches to sign-in', async () => {
        const { rerender } = render(<AuthPage t={t} theme="dark" mode="register" />);
        fillSignUp();
        await screen.findByRole('button', { name: 'signUpUseAnotherEmail' });

        rerender(<AuthPage t={t} theme="dark" mode="login" />);

        await waitFor(() => expect(screen.getByLabelText('emailOrUsername')).toBeInTheDocument());
        expect(screen.queryByText('signUpCheckEmailPassword')).not.toBeInTheDocument();
    });

    it('still signs in at once when the server answers with a session', async () => {
        register.mockResolvedValue({ success: true });
        render(<AuthPage t={t} theme="dark" mode="register" onAuthSuccess={onAuthSuccess} />);
        fillSignUp();

        await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
        expect(screen.queryByText('signUpCheckEmailPassword')).not.toBeInTheDocument();
    });
});
