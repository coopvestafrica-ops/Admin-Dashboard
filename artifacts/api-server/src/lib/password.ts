/**
 * Enterprise password policy + expiration helpers.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_EXPIRY_DAYS = 90;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string, opts: { email?: string; name?: string } = {}): PasswordValidationResult {
  const errors: string[] = [];
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(password)) errors.push("Password must contain an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain a digit");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must contain a symbol");
  if (/(.)\1{2,}/.test(password)) errors.push("Password may not contain 3+ repeating characters");
  const lower = password.toLowerCase();
  for (const banned of ["password", "qwerty", "letmein", "admin", "coopvest", "welcome"]) {
    if (lower.includes(banned)) {
      errors.push("Password is too common");
      break;
    }
  }
  if (opts.email) {
    const local = opts.email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 4 && lower.includes(local)) {
      errors.push("Password may not contain your email username");
    }
  }
  if (opts.name && opts.name.length >= 4 && lower.includes(opts.name.toLowerCase())) {
    errors.push("Password may not contain your name");
  }
  return { valid: errors.length === 0, errors };
}

export function isPasswordExpired(passwordChangedAt: Date | null | undefined): boolean {
  if (!passwordChangedAt) return false;
  const ageMs = Date.now() - passwordChangedAt.getTime();
  return ageMs > PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}
