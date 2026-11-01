/** Words and small pure checks the account screens share. No DOM. */

/** Matches the Worker's `MIN_PASSWORD`. */
const MIN_PASSWORD_LENGTH = 8;

export const NETWORK_TEXT = "Can't reach the sync service. Check your connection and try again.";

const ERROR_TEXT: Record<string, string> = {
  invalid: 'Check the email, and use at least 8 characters for the password.',
  exists: 'That email already has an account. Try signing in.',
  bad_credentials: 'The email or password is wrong.',
  rate_limited: 'Too many tries. Wait a few minutes and try again.',
  unauthorized: 'You were signed out. Sign in again and retry.',
};

/** The sentence for an `ApiError` code (anything unknown reads as a network problem). */
export function errorText(code: string): string {
  return ERROR_TEXT[code] ?? NETWORK_TEXT;
}

/** The sentence for a failed password change or reset, where the codes mean other things. */
export function passwordErrorText(code: string): string {
  if (code === 'bad_credentials') return 'The current password is wrong.';
  if (code === 'invalid')
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`;
  return errorText(code);
}

export const PASSWORD_MISMATCH_TEXT = 'The two new passwords are not the same.';

/** The reason a typed new password (and its repeat) cannot be sent, or null when it can. */
export function newPasswordProblem(next: string, repeat: string): string | null {
  if (next.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`;
  }
  if (next.length > 128) return 'Use at most 128 characters for the new password.';
  return next === repeat ? null : PASSWORD_MISMATCH_TEXT;
}

/** True when the typed email is the account's (ignoring case and spaces); gates "Delete account". */
export function confirmsEmail(typed: string, email: string): boolean {
  return typed.trim().toLowerCase() === email.trim().toLowerCase() && email !== '';
}

export type LinkAction = { kind: 'verify' | 'reset'; token: string };

/** The `?verify=<token>` or `?reset=<token>` the mailed links open the menu with, or null. */
export function linkAction(search: string): LinkAction | null {
  const params = new URLSearchParams(search);
  for (const kind of ['verify', 'reset'] as const) {
    const token = params.get(kind)?.trim();
    if (token) return { kind, token };
  }
  return null;
}
