import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthPage from './AuthPage';
import { useAuth } from '../../contexts/AuthContext';
import { startKeycloakSso } from '../../utils/keycloakSso';
import { SIGN_UP_RESEND_SECONDS } from './SignUpEmailSent';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../utils/keycloakSso', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils/keycloakSso')>()),
    startKeycloakSso: vi.fn(),
}));

const t = (key: string): string => key;
const FRENCH_LIGHT = { language: 'fr', theme: 'light' };

function fillSignUp() {
    fireEvent.change(screen.getByLabelText('username'), { target: { value: 'camille' } });
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'camille@example.com' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'Ecrire123!' } });
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: 'Ecrire123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'signUp' }));
}

describe('AuthPage sends the visitor’s language and theme for a new account', () => {
    let register: ReturnType<typeof vi.fn>;
    let signInWithGoogle: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        register = vi.fn().mockResolvedValue({ success: true, verificationRequired: true });
        signInWithGoogle = vi.fn().mockResolvedValue({ success: true, isNewUser: true });
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            login: vi.fn(),
            register,
            signInWithGoogle,
            forgotPassword: vi.fn(),
            verifyTwoFactor: vi.fn(),
            resendTwoFactor: vi.fn(),
            googleClientId: 'google-client',
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('with the sign-up form, and again when the email is asked for again', async () => {
        vi.useFakeTimers();
        render(<AuthPage t={t} theme="light" language="fr" mode="register" />);
        fillSignUp();
        await act(async () => { await Promise.resolve(); });

        expect(register).toHaveBeenCalledWith('camille@example.com', 'Ecrire123!', 'camille', '', FRENCH_LIGHT);
        act(() => { vi.advanceTimersByTime(SIGN_UP_RESEND_SECONDS * 1000); });
        fireEvent.click(screen.getByRole('button', { name: 'signUpResendEmail' }));
        await act(async () => { await Promise.resolve(); });

        expect(register).toHaveBeenCalledTimes(2);
        expect(register).toHaveBeenLastCalledWith('camille@example.com', 'Ecrire123!', 'camille', '', FRENCH_LIGHT);
        vi.useRealTimers();
    });

    it('with Google', async () => {
        const onAuthSuccess = vi.fn();
        render(<AuthPage t={t} theme="dark" language="fr" onAuthSuccess={onAuthSuccess} />);

        fireEvent.click(screen.getByText('continueWithGoogle'));

        await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
        expect(signInWithGoogle).toHaveBeenCalledWith({ language: 'fr', theme: 'dark' });
    });

    it('with Keycloak, kept for the way back', () => {
        vi.stubEnv('PROD', true);
        render(<AuthPage t={t} theme="light" language="fr" mode="register" />);

        fireEvent.click(screen.getByRole('button', { name: /continueWithSso/ }));

        expect(startKeycloakSso).toHaveBeenCalledWith(globalThis.location.href, FRENCH_LIGHT);
    });

    it('sends nothing it was not given', async () => {
        render(<AuthPage t={t} mode="register" />);
        fillSignUp();

        await waitFor(() => expect(register).toHaveBeenCalledWith('camille@example.com', 'Ecrire123!', 'camille', '', {}));
    });
});
