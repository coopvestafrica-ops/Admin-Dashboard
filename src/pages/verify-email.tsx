import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/api";

/**
 * Public email-verification landing page.
 *
 * Supabase confirmation emails link to
 *   /verify-email?token=...&type=signup&redirect_to=...
 * This page exchanges that token via supabase-js (verifyOtp) to confirm the
 * user's email, then shows a success screen with a link back to the app.
 *
 * It's intentionally OUTSIDE the admin auth guard — members tap this link
 * from their inbox without being logged in.
 */
export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string>("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Supabase's confirmation email links to its own /auth/v1/verify endpoint,
    // which after confirming redirects back with EITHER:
    //   a) query params:  ?token=…&type=signup&email=…   (when the full
    //      /verify-email path is in the project's Redirect URL allowlist. or
    //   b) a hash fragment:   #access_token=…&type=signup&refresh_token=…
    //      (when the redirect falls back to the bare Site URL).
    // Handle both forms, plus any session Supabase already set.

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    const type = params.get("type") ?? "signup";
    // On email signup confirmations the address arrives in `email` (query form).
    const email = decodeURIComponent(params.get("email") ?? "");

    async function verify() {
      // Form (b): Supabase redirected with a full session in the URL hash fragment —
      // restore it and claim it on the backend.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const fragmentToken = hashParams.get("access_token") ?? "";
      const fragmentRefresh = hashParams.get("refresh_token") ?? "";

      if (fragmentToken) {
        try {
          await supabase.auth.setSession({
            access_token: fragmentToken,
            refresh_token: fragmentRefresh || "",
          });
          // Clear the fragment so the success state isn't re-evaluated on reload.

          window.history.replaceState({}, "", window.location.pathname);
          const { data: sess } = await supabase.auth.getSession();
          if (sess?.session) {
            // Use the absolute backend URL — a relative path would hit the Vercel
            // origin and fall through to the SPA catch-all (index.html).
            await fetch(`${getApiBaseUrl()}/auth/sync`, {
              method: "POST",
              headers: { Authorization: `Bearer ${sess.session.access_token}` },
            }).catch(() => {});
          }
          setStatus("success");
          return;
        } catch (e: any) {
          // Fragment session may be expired — fall through to query-param path.

          console.warn("verify-email: fragment session restore failed:", (e as any)?.message);
        }
      }

      if (!token || !email) {
        setStatus("error");
        setError("This verification link is incomplete (missing token or email). Please request a new one from the app.");
        return;
      }

      try {
        // `signup` confirmation links carry type=signup and must be verified
        // with type: 'signup' (verifyOtp accepts 'signup' | 'email' | ...).
        const otpType = type === "email_change" ? "email_change" : type === "recovery" ? "recovery" : "signup";
        const { data, error: verifyErr } = await supabase.auth.verifyOtp({
          email,
          token,
          type: otpType as any,
        });
        if (verifyErr) throw verifyErr;
        // Optionally mark the session as confirmed on the backend profile.
        if (data?.session) {
          // Use the absolute backend URL. A relative path would hit the Vercel
          // origin and fall through to the SPA catch-all (index.html) instead of
          // the Render backend, so the session-claim would silently fail.
          await fetch(`${getApiBaseUrl()}/auth/sync`, {
            method: "POST",
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          }).catch(() => {});
        }
        setStatus("success");
      } catch (e: any) {
        setStatus("error");
        setError(e?.message || "We could not verify this email. The link may have expired — request a new one from the app.");
      }
    }
    verify();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl border border-slate-100">
        {/* Brand */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
          <span className="text-2xl font-bold text-white">C</span>
        </div>

        {status === "verifying" && (
          <>
            <h1 className="text-xl font-bold text-slate-900">Verifying your email…</h1>
            <p className="mt-2 text-sm text-slate-500">
              Hang tight, we're confirming your Coopvest account.
            </p>
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
            <p className="mt-2 text-sm text-slate-500">
              Your Coopvest Africa account is confirmed. You can now sign in and continue your registration in the app.
            </p>
            <a
              href="coopvest://verify-email"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continue in the Coopvest app
            </a>
            <p className="mt-3 text-xs text-slate-400">
              Didn't see the app? Sign in with your email and password in the app instead.
            </p>
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
            <a
              href="https://admin-dashboard-api-server.vercel.app/"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Go to Coopvest
            </a>
          </>
        )}
      </div>
    </div>
  );
}