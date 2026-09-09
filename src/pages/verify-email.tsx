import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/api";

const VERIFY_REDIRECT = "https://admin-dashboard-api-server.vercel.app/verify-email";

function decodeEmailFromJwt(token: string): string {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json?.email === "string" ? json.email : "";
  } catch {
    return "";
  }
}

async function syncSession(accessToken: string): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/auth/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* best-effort */ }
}

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string>("");
  const [errorKind, setErrorKind] = useState<"expired" | "incomplete" | "other">("other");
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    const type = params.get("type") ?? "signup";
    const email = decodeURIComponent(params.get("email") ?? "");
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const fragmentToken = hashParams.get("access_token") ?? "";
    const fragmentRefresh = hashParams.get("refresh_token") ?? "";
    const hashError = hashParams.get("error") ?? "";
    const hashErrorCode = hashParams.get("error_code") ?? "";

    async function verify() {
      if (hashError || hashErrorCode) {
        setErrorKind("expired");
        setError("This verification link has expired or is invalid. Please request a new verification link below.");
        const decoded = decodeEmailFromJwt(fragmentToken);
        if (decoded) setResendEmail(decoded);
        setStatus("error");
        return;
      }

      if (fragmentToken) {
        try {
          await supabase.auth.setSession({ access_token: fragmentToken, refresh_token: fragmentRefresh || "" });
          const { data: sess } = await supabase.auth.getSession();
          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (sess?.session && userData?.user && !userErr) {
            syncSession(sess.session.access_token);
            window.history.replaceState({}, "", window.location.pathname);
            setStatus("success");
            return;
          }
        } catch (e: any) {
          console.warn("verify-email: fragment session restore failed:", (e as any)?.message);
        }

        if (fragmentRefresh) {
          try {
            const { data: refreshed, error: refErr } = await supabase.auth.refreshSession({ refresh_token: fragmentRefresh });
            if (!refErr && refreshed?.session) {
              syncSession(refreshed.session.access_token);
              window.history.replaceState({}, "", window.location.pathname);
              setStatus("success");
              return;
            }
          } catch (e2: any) {
            console.warn("verify-email: refresh fallback failed:", (e2 as any)?.message);
          }
        }

        const decoded = decodeEmailFromJwt(fragmentToken);
        if (decoded) setResendEmail(decoded);
        setErrorKind("expired");
        setError("This verification link has expired or is invalid. Please request a new verification link below.");
        setStatus("error");
        return;
      }

      if (token && email) {
        setResendEmail(email);
        try {
          const otpType = type === "email_change" ? "email_change" : type === "recovery" ? "recovery" : "signup";
          const { data, error: verifyErr } = await supabase.auth.verifyOtp({ email, token, type: otpType as any });
          if (verifyErr) throw verifyErr;
          setStatus("success");
          if (data?.session) syncSession(data.session.access_token);
        } catch (e: any) {
          setErrorKind("expired");
          setError(e?.message || "We could not verify this email. The link may have expired — request a new one below.");
        }
        return;
      }

      try {
        const { data: existing } = await supabase.auth.getSession();
        const { data: existingUser, error: existingErr } = await supabase.auth.getUser();
        if (existing?.session && existingUser?.user && !existingErr) {
          setStatus("success");
          return;
        }
      } catch { /* ignore */ }

      const decoded = decodeEmailFromJwt(fragmentToken);
      if (decoded) setResendEmail(decoded);
      setErrorKind(fragmentToken ? "expired" : "incomplete");
      setStatus("error");
      setError(fragmentToken
        ? "This verification link has expired or is invalid. Please request a new verification link below."
        : "This verification link is incomplete (missing token or email. Please request a new one from the app.");
    }
    verify();
  }, []);

  const handleResend = async () => {
    const target = resendEmail.trim().toLowerCase();
    if (!target) {
      setResendMsg("Please enter your email address.");
      return;
    }
    setIsResending(true);
    setResendMsg("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: target, options: { emailRedirectTo: VERIFY_REDIRECT } });
      if (error) {
        setResendMsg(error.message);
      } else {
        setResendMsg("A new verification email has been sent — check your inbox (and spam folder.");
      }
    } catch (e: any) {
      setResendMsg(e?.message || "Failed to send verification email. Try again in a minute.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl border border-slate-100">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
          <span className="text-2xl font-bold text-white">C</span>
        </div>

        {status === "verifying" && (
          <>
            <h1 className="text-xl font-bold text-slate-900">Verifying your email...</h1>
            <p className="mt-2 text-sm text-slate-500">Hang tight, we're confirming your Coopvest account.</p>
            <div className="mt-6 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Email verified!</h1>
            <p className="mt-2 text-sm text-slate-500">Your Coopvest Africa account is confirmed. You can now sign inand continue your registration in the app.</p>
            <a href="coopvest://verify-email" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
              Continue in the Coopvest app
            </a>
            <p className="mt-3 text-xs text-slate-400">Didn't see the app? Sign in with your email and password in the app instead.</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Couldn't verify</h1>
            <p className="mt-2 text-sm text-slate-500">{error}</p>

            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-slate-800">Request a new verification link</p>
              <input type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="Enter your email address" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600" />
              <button type="button" onClick={handleResend} disabled={isResending} className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {isResending ? "Sending..." : "Send verification email"}
              </button>
              {resendMsg && (
                <p className={`mt-2 text-xs font-medium ${resendMsg.startsWith("A new") ? "text-emerald-600" : "text-red-600"}`}>
                  {resendMsg}
                </p>
              )}
            </div>

            <a href="https://admin-dashboard-api-server.vercel.app/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Go to Coopvest
            </a>
          </>
        )}
      </div>
    </div>
  );
}
