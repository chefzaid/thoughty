import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

const AuthContext = createContext(null);

const API_BASE = '/api/auth';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Safe JSON parsing helper - returns null if parsing fails
const safeJsonParse = async (response) => {
    try {
        // If response has json method (including mocks), use it
        if (typeof response.json === 'function') {
            return await response.json();
        }
        // Otherwise, parse text manually
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get tokens from localStorage
    const getAccessToken = () => localStorage.getItem('accessToken');
    const getRefreshToken = () => localStorage.getItem('refreshToken');

    // Save tokens to localStorage
    const saveTokens = (accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
    };

    // Clear tokens from localStorage
    const clearTokens = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    };

    // Refresh access token
    const refreshAccessToken = useCallback(async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            return null;
        }

        try {
            const response = await fetch(`${API_BASE}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            return data.accessToken;
        } catch {
            clearTokens();
            setUser(null);
            return null;
        }
    }, []);

    // Fetch with auto token refresh
    const authFetch = useCallback(async (url, options = {}) => {
        let accessToken = getAccessToken();

        const makeRequest = async (token) => {
            const headers = {
                ...options.headers,
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            return fetch(url, { ...options, headers });
        };

        let response = await makeRequest(accessToken);

        // If token expired, try to refresh
        if (response.status === 401) {
            accessToken = await refreshAccessToken();
            if (accessToken) {
                response = await makeRequest(accessToken);
            }
        }

        return response;
    }, [refreshAccessToken]);

    // Check if user is logged in on mount
    useEffect(() => {
        const checkAuth = async () => {
            const accessToken = getAccessToken();
            if (!accessToken) {
                setLoading(false);
                return;
            }

            try {
                const response = await authFetch(`${API_BASE}/me`);
                if (response.ok) {
                    const userData = await safeJsonParse(response);
                    if (userData) {
                        setUser(userData);
                    } else {
                        clearTokens();
                    }
                } else {
                    clearTokens();
                }
            } catch (err) {
                console.error('Auth check failed:', err);
                clearTokens();
            }
            setLoading(false);
        };

        checkAuth();
    }, [authFetch]);

    // Register with email/password
    const register = async (email, password, username) => {
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, username })
            });

            const data = await safeJsonParse(response);

            if (!response.ok) {
                throw new Error(data?.error || 'Registration failed');
            }

            if (!data) {
                throw new Error('Server unavailable');
            }

            saveTokens(data.accessToken, data.refreshToken);
            setUser(data.user);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Login with email or username
    const login = async (identifier, password) => {
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await safeJsonParse(response);

            if (!response.ok) {
                throw new Error(data?.error || 'Login failed');
            }

            if (!data) {
                throw new Error('Server unavailable');
            }

            saveTokens(data.accessToken, data.refreshToken);
            setUser(data.user);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // OAuth login (Google/Facebook)
    const oauthLogin = async (provider, providerId, email, name, avatarUrl) => {
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/oauth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, providerId, email, name, avatarUrl })
            });

            const data = await safeJsonParse(response);

            if (!response.ok) {
                throw new Error(data?.error || 'OAuth login failed');
            }

            if (!data) {
                throw new Error('Server unavailable');
            }

            saveTokens(data.accessToken, data.refreshToken);
            setUser(data.user);
            return { success: true, isNewUser: data.user.isNewUser };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Google Sign In
    const signInWithGoogle = async () => {
        return new Promise((resolve, reject) => {
            if (!globalThis.google || !GOOGLE_CLIENT_ID) {
                reject(new Error('Google Sign-In not configured'));
                return;
            }

            globalThis.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response) => {
                    try {
                        // Decode JWT to get user info
                        const payload = JSON.parse(atob(response.credential.split('.')[1]));
                        const result = await oauthLogin(
                            'google',
                            payload.sub,
                            payload.email,
                            payload.name,
                            payload.picture
                        );
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                }
            });

            globalThis.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Fallback to popup
                    globalThis.google.accounts.id.renderButton(
                        document.getElementById('google-signin-btn'),
                        { theme: 'outline', size: 'large', width: '100%' }
                    );
                }
            });
        });
    };

    // Logout
    const logout = async () => {
        const refreshToken = getRefreshToken();
        try {
            await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
        } catch (err) {
            console.error('Logout error:', err);
        }
        clearTokens();
        setUser(null);
    };

    // Change password
    const changePassword = async (currentPassword, newPassword) => {
        setError(null);
        try {
            const response = await authFetch(`${API_BASE}/change-password`, {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await safeJsonParse(response);

            if (!response.ok) {
                throw new Error(data?.error || 'Password change failed');
            }

            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Forgot password - request reset email
    const forgotPassword = async (email) => {
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await safeJsonParse(response);

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to send reset email');
            }

            return { success: true, message: data?.message };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Reset password with token
    const resetPassword = async (token, newPassword) => {
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const data = await safeJsonParse(response);

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to reset password');
            }

            return { success: true, message: data?.message };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Delete account (flags for deletion)
    const deleteAccount = async (password) => {
        setError(null);
        try {
            const response = await authFetch(`${API_BASE}/delete-account`, {
                method: 'POST',
                body: JSON.stringify({ password })
            });

            const data = await safeJsonParse(response);

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to delete account');
            }

            // Log the user out after account deletion
            clearTokens();
            setUser(null);
            return { success: true, message: data?.message };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const value = useMemo(() => ({
        user,
        loading,
        error,
        isAuthenticated: !!user,
        register,
        login,
        logout,
        signInWithGoogle,
        changePassword,
        forgotPassword,
        resetPassword,
        deleteAccount,
        authFetch,
        getAccessToken,
        googleClientId: GOOGLE_CLIENT_ID
    }), [user, loading, error, authFetch]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
