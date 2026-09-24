import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ShieldCheck, Loader2 } from "lucide-react";
import { verifyChallenge } from "@/lib/mfa";

/**
 * Second-factor challenge, shown when the password has been accepted but the
 * session still sits at aal1.
 *
 * Kept separate from the login form because it is a distinct step with its own
 * failure modes: a wrong code, an expired window, or a factor that was removed
 * on another device. Mixing it into the password form made the two error paths
 * indistinguishable.
 */
export function MfaChallengeForm({
  factorId,
  onVerified,
  onCancel,
}: {
  factorId: string;
  onVerified: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = code.replace(/\s/g, "");
    if (entered.length < 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyChallenge(factorId, entered);
      await onVerified();
    } catch (err) {
      // Do not sign out on a bad code — a typo is the common case and the user
      // should be able to retry. The session is still only aal1, so nothing is
      // reachable until a correct code is given.
      setError(
        err instanceof Error
          ? err.message
          : "That code was not accepted. Check the app and try the next code.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Two-factor verification
        </CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app to finish signing in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification code</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              autoFocus
              className="font-mono tracking-widest text-center text-lg"
              data-testid="input-mfa-challenge"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy} data-testid="button-verify-mfa">
            {busy
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
              : "Verify and sign in"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => void onCancel()}
          >
            Use a different account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
