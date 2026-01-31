import React, { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthPage.css';

type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;

interface AuthResult {
    success: boolean;
    error?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateForgotPassword = ({ email, t }: { email: string; t: TranslationFunction }): string => {
    if (!email) return t('enterEmail');
    if (!emailRegex.test(email)) return t('invalidEmail');
    return '';
};

const validateLogin = ({ identifier, password, t }: { identifier: string; password: string; t: TranslationFunction }): string => {
    if (!identifier) return t('enterEmailOrUsername');
    if (!password) return t('enterPassword');
    return '';
};

const validateRegister = ({
    username,
    email,
    password,
    confirmPassword,
    t
}: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    t: TranslationFunction;
}): string => {
    const checks: [boolean, string][] = [
        [!username, t('enterUsername')],
        [!email, t('enterEmail')],
        [Boolean(email) && !emailRegex.test(email), t('invalidEmail')],
        [!password, t('enterPassword')],
        [!confirmPassword, t('confirmPasswordPlaceholder')],
        [Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword, t('passwordsDoNotMatch')]
    ];
    const failedCheck = checks.find(([condition]) => condition);
    return failedCheck ? failedCheck[1] : '';
};

interface ValidateAuthFormParams {
    showForgotPassword: boolean;
    isLogin: boolean;
    identifier: string;
    email: string;
    password: string;
    confirmPassword: string;
    username: string;
    t: TranslationFunction;
}

const validateAuthForm = ({
    showForgotPassword,
    isLogin,
    identifier,
    email,
    password,
    confirmPassword,
    username,
    t
}: ValidateAuthFormParams): string => {
    if (showForgotPassword) {
        return validateForgotPassword({ email, t });
    }
    if (isLogin) {
        return validateLogin({ identifier, password, t });
    }
    return validateRegister({ username, email, password, confirmPassword, t });
};

const getAuthSubtitleText = ({
    showForgotPassword,
    isLogin,
    t
}: {
    showForgotPassword: boolean;
    isLogin: boolean;
    t: TranslationFunction;
}): string => {
    if (showForgotPassword) return t('resetYourPassword');
    return isLogin ? t('welcomeBack') : t('createAccount');
};

interface ForgotPasswordFormProps {
    email: string;
    setEmail: (email: string) => void;
    isDark: boolean;
    t: TranslationFunction;
    loading: boolean;
    handleBackToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
    email,
    setEmail,
    isDark,
    t,
    loading,
    handleBackToLogin
}) => (
    <>
        <div className="form-group">
            <label htmlFor="email">{t('email')}</label>
            <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('enterEmail')}
                className={isDark ? 'dark' : 'light'}
                required
            />
        </div>

        <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <span className="loading-spinner"></span> : t('sendResetLink')}
        </button>

        <button type="button" className="back-to-login-btn" onClick={handleBackToLogin}>
            {t('backToLogin')}
        </button>
    </>
);

interface LoginRegisterFormProps {
    isLogin: boolean;
    isDark: boolean;
    t: TranslationFunction;
    loading: boolean;
    identifier: string;
    setIdentifier: (value: string) => void;
    email: string;
    setEmail: (value: string) => void;
    password: string;
    setPassword: (value: string) => void;
    confirmPassword: string;
    setConfirmPassword: (value: string) => void;
    username: string;
    setUsername: (value: string) => void;
    showPassword: boolean;
    setShowPassword: (value: boolean) => void;
    handleForgotPassword: () => void;
}

const LoginRegisterForm: React.FC<LoginRegisterFormProps> = ({
    isLogin,
    isDark,
    t,
    loading,
    identifier,
    setIdentifier,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    username,
    setUsername,
    showPassword,
    setShowPassword,
    handleForgotPassword
}) => {
    const submitLabel = isLogin ? t('signIn') : t('signUp');
    const passwordType = showPassword ? 'text' : 'password';

    return (
        <>
            {!isLogin && (
                <div className="form-group">
                    <label htmlFor="username">{t('username')}</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('enterUsername')}
                        className={isDark ? 'dark' : 'light'}
                    />
                </div>
            )}

            {isLogin ? (
                <div className="form-group">
                    <label htmlFor="identifier">{t('emailOrUsername')}</label>
                    <input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t('enterEmailOrUsername')}
                        className={isDark ? 'dark' : 'light'}
                        required
                    />
                </div>
            ) : (
                <div className="form-group">
                    <label htmlFor="email">{t('email')}</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('enterEmail')}
                        className={isDark ? 'dark' : 'light'}
                        required
                    />
                </div>
            )}

            <div className="form-group">
                <label htmlFor="password">{t('password')}</label>
                <div className="password-input-wrapper">
                    <input
                        id="password"
                        type={passwordType}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('enterPassword')}
                        className={isDark ? 'dark' : 'light'}
                        required
                    />
                    <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    >
                        {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        )}
                    </button>
                </div>
                {isLogin && (
                    <button type="button" className="forgot-password-link" onClick={handleForgotPassword}>
                        {t('forgotPassword')}
                    </button>
                )}
            </div>

            {!isLogin && (
                <div className="form-group">
                    <label htmlFor="confirmPassword">{t('confirmPassword')}</label>
                    <input
                        id="confirmPassword"
                        type={passwordType}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('confirmPasswordPlaceholder')}
                        className={isDark ? 'dark' : 'light'}
                        required
                    />
                </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="loading-spinner"></span> : submitLabel}
            </button>
        </>
    );
};

interface AuthFormContentProps extends LoginRegisterFormProps {
    showForgotPassword: boolean;
    handleBackToLogin: () => void;
}

const AuthFormContent: React.FC<AuthFormContentProps> = ({
    showForgotPassword,
    handleBackToLogin,
    ...props
}) =>
    showForgotPassword ? (
        <ForgotPasswordForm
            email={props.email}
            setEmail={props.setEmail}
            isDark={props.isDark}
            t={props.t}
            loading={props.loading}
            handleBackToLogin={handleBackToLogin}
        />
    ) : (
        <LoginRegisterForm {...props} />
    );

interface AuthStatusMessagesProps {
    error?: string;
    successMessage?: string;
}

const AuthStatusMessages: React.FC<AuthStatusMessagesProps> = ({ error, successMessage }) => {
    if (!error && !successMessage) return null;
    return (
        <>
            {error && (
                <div className="auth-error">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}
            {successMessage && (
                <div className="auth-success">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {successMessage}
                </div>
            )}
        </>
    );
};

interface AuthAuxiliaryProps {
    showForgotPassword: boolean;
    googleClientId?: string;
    loading: boolean;
    handleGoogleSignIn: () => void;
    isLogin: boolean;
    switchMode: () => void;
    t: TranslationFunction;
}

const AuthAuxiliary: React.FC<AuthAuxiliaryProps> = ({
    showForgotPassword,
    googleClientId,
    loading,
    handleGoogleSignIn,
    isLogin,
    switchMode,
    t
}) => {
    if (showForgotPassword) return null;

    const switchPrompt = isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount');
    const switchAction = isLogin ? t('signUp') : t('signIn');

    return (
        <>
            <div className="auth-divider">
                <span>{t('orContinueWith')}</span>
            </div>

            <div className="social-buttons">
                {googleClientId && (
                    <button
                        type="button"
                        className="social-btn google-btn"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                    >
                        <svg viewBox="0 0 24 24" className="social-icon">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>{t('continueWithGoogle')}</span>
                    </button>
                )}
            </div>

            <div className="auth-switch">
                <p>
                    {switchPrompt}{' '}
                    <button type="button" onClick={switchMode} className="switch-btn">
                        {switchAction}
                    </button>
                </p>
            </div>
        </>
    );
};

interface AuthPageProps {
    readonly t: TranslationFunction;
    readonly theme?: 'light' | 'dark';
    readonly onAuthSuccess?: () => void;
}

function AuthPage({ t, theme, onAuthSuccess }: AuthPageProps): React.ReactElement {
    const [isLogin, setIsLogin] = useState<boolean>(true);
    const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
    const [identifier, setIdentifier] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [username, setUsername] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);

    const { login, register, signInWithGoogle, forgotPassword, googleClientId } = useAuth();

    const isDark = theme !== 'light';

    // Load Google SDK
    useEffect(() => {
        if (googleClientId && !(globalThis as { google?: unknown }).google) {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
        }
    }, [googleClientId]);

    const validateForm = (): boolean => {
        const validationError = validateAuthForm({
            showForgotPassword,
            isLogin,
            identifier,
            email,
            username,
            password,
            confirmPassword,
            t
        });
        if (validationError) {
            setError(validationError);
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (!validateForm()) return;

        setLoading(true);

        try {
            if (showForgotPassword) {
                const result = await forgotPassword(email);
                if (result.success) {
                    setSuccessMessage(t('resetEmailSent'));
                } else {
                    setError(result.error || t('forgotPasswordFailed'));
                }
                setLoading(false);
                return;
            }

            let result: AuthResult;
            if (isLogin) {
                result = await login(identifier, password);
            } else {
                result = await register(email, password, username);
            }

            if (result.success) {
                onAuthSuccess?.();
            } else {
                setError(result.error || t('authFailed'));
            }
        } catch (err) {
            setError((err as Error).message || t('authFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async (): Promise<void> => {
        setError('');
        setLoading(true);

        try {
            const result = await signInWithGoogle();
            if (result.success) {
                onAuthSuccess?.();
            } else {
                setError(result.error || t('googleSignInFailed'));
            }
        } catch (err) {
            setError((err as Error).message || t('googleSignInFailed'));
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (): void => {
        setIsLogin(!isLogin);
        setShowForgotPassword(false);
        setError('');
        setSuccessMessage('');
        setPassword('');
        setConfirmPassword('');
        setIdentifier('');
        setEmail('');
    };

    const handleForgotPassword = (): void => {
        setShowForgotPassword(true);
        setError('');
        setSuccessMessage('');
    };

    const handleBackToLogin = (): void => {
        setShowForgotPassword(false);
        setError('');
        setSuccessMessage('');
    };

    const getAuthSubtitle = (): string => getAuthSubtitleText({ showForgotPassword, isLogin, t });

    return (
        <div className={`auth-page ${isDark ? 'dark' : 'light'}`}>
            <div className="auth-container">
                <div className="auth-header">
                    <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
                    <h1 className="auth-title">Thoughty</h1>
                    <p className="auth-subtitle">{getAuthSubtitle()}</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <AuthStatusMessages error={error} successMessage={successMessage} />
                    <AuthFormContent
                        showForgotPassword={showForgotPassword}
                        isLogin={isLogin}
                        isDark={isDark}
                        t={t}
                        loading={loading}
                        identifier={identifier}
                        setIdentifier={setIdentifier}
                        email={email}
                        setEmail={setEmail}
                        password={password}
                        setPassword={setPassword}
                        confirmPassword={confirmPassword}
                        setConfirmPassword={setConfirmPassword}
                        username={username}
                        setUsername={setUsername}
                        showPassword={showPassword}
                        setShowPassword={setShowPassword}
                        handleForgotPassword={handleForgotPassword}
                        handleBackToLogin={handleBackToLogin}
                    />
                </form>

                <AuthAuxiliary
                    showForgotPassword={showForgotPassword}
                    googleClientId={googleClientId}
                    loading={loading}
                    handleGoogleSignIn={handleGoogleSignIn}
                    isLogin={isLogin}
                    switchMode={switchMode}
                    t={t}
                />

                <div id="google-signin-btn" style={{ display: 'none' }}></div>
            </div>
        </div>
    );
}

export default AuthPage;
