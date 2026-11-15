/**
 * The API's password rule for every password a writer chooses (`@StrongPassword()` in
 * thoughty-server, which refuses one that breaks it with `AUTH_WEAK_PASSWORD`): at least 8
 * characters, with a lowercase and an uppercase letter, a digit and one of `PASSWORD_SYMBOLS`.
 */
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

/** The symbols the rule counts, spaced out for reading. */
export const PASSWORD_SYMBOLS = '! @ # $ % ^ & * ( ) , . ? " : { } | < >';

export const isStrongPassword = (password: string): boolean => STRONG_PASSWORD.test(password);
