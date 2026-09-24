import { supabase } from "@/lib/supabase";

/**
 * Multi-factor authentication for admin accounts.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Security page displayed an `mfa_enabled` column but nothing enforced it:
 * the value was only used to pick an icon, `login.tsx` never checked it, and
 * Supabase's MFA API was never called. So an admin account that could move
 * money, change roles and edit settings was protected by a password alone.
 *
 * Supabase issues an Authenticator Assurance Level (AAL) on every session:
 *
 *   aal1 — signed in with a password only
 *   aal2 — a second factor has been verified this session
 *
 * A user who has enrolled a factor but not yet verified it for this session
 * sits at aal1 with `nextLevel === 'aal2'`. That combination is the signal to
 * demand the second factor, and it is what this module gates on.
 */

export interface TotpEnrolment {
  factorId: string;
  /** otpauth:// URI — render as a QR code for the authenticator app. */
  uri: string;
  /** The shared secret, for manual entry when a camera is unavailable. */
  secret: string;
}

export interface AuthAssurance {
  currentLevel: string | null;
  nextLevel: string | null;
  /** True when the session must complete a second factor before continuing. */
  requiresChallenge: boolean;
}

/** Which factors this account has set up. */
export async function listFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return {
    totp: data?.totp ?? [],
    all: data?.all ?? [],
  };
}

/**
 * Has this account enrolled at least one verified factor?
 *
 * Only *verified* factors count. An enrolment that was never confirmed (the
 * user closed the QR screen) is returned by `listFactors` but must not be
 * treated as protection.
 */
export async function hasVerifiedFactor(): Promise<boolean> {
  const { totp } = await listFactors();
  return totp.some((f) => f.status === "verified");
}

/**
 * The assurance level of the current session, and whether a challenge is owed.
 */
export async function getAssurance(): Promise<AuthAssurance> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message);

  const currentLevel = data?.currentLevel ?? null;
  const nextLevel = data?.nextLevel ?? null;

  return {
    currentLevel,
    nextLevel,
    // nextLevel is 'aal2' only when a verified factor exists but this session
    // has not satisfied it yet — exactly the case that must be challenged.
    requiresChallenge: nextLevel === "aal2" && currentLevel !== nextLevel,
  };
}

/**
 * Begin TOTP enrolment.
 *
 * Returns the otpauth URI and secret so the UI can show a QR code. The factor
 * is NOT active until `confirmEnrolment` succeeds — an unconfirmed factor adds
 * no protection, and Supabase will not challenge it.
 */
export async function beginTotpEnrolment(): Promise<TotpEnrolment> {

  // Remove any stale unverified enrolment first. Supabase rejects a second
  // enrol with the same friendly name, and abandoned attempts are common
  // (user closes the dialog), so clear them rather than failing with a
  // confusing error.
  try {
    const { totp } = await listFactors();
    for (const f of totp.filter((x) => x.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  } catch {
    // Best effort — proceed to enrol regardless.
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Coopvest Admin ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw new Error(error.message);

  return {
    factorId: data.id,
    uri: data.totp.uri,
    secret: data.totp.secret,
  };
}

/** Confirm an enrolment with a code from the authenticator app, activating it. */
export async function confirmEnrolment(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new Error(error.message);
}

/** Answer the challenge for an existing factor, raising the session to aal2. */
export async function verifyChallenge(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new Error(error.message);
}

/** Remove a factor. The account loses that second factor immediately. */
export async function removeFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);
}

/**
 * The factor id to challenge when the session needs a second factor.
 * Returns null when nothing is enrolled, which the caller treats as
 * "cannot challenge" rather than "let them through".
 */
export async function pendingFactorId(): Promise<string | null> {
  const { totp } = await listFactors();
  const verified = totp.find((f) => f.status === "verified");
  return verified?.id ?? null;
}
