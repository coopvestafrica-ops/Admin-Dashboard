import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  beginTotpEnrolment, confirmEnrolment, listFactors, removeFactor,
  getAssurance, type TotpEnrolment,
} from "@/lib/mfa";
import {
  ShieldCheck, ShieldAlert, Loader2, KeyRound, Trash2, Copy, CheckCircle2, AlertTriangle,
} from "lucide-react";

/**
 * Two-factor authentication setup for the signed-in admin.
 *
 * Before this, `mfa_enabled` was only used to choose an icon on the Security
 * page — nothing enforced it and Supabase's MFA API was never called, so an
 * account that can move money and change roles was protected by a password
 * alone.
 *
 * Deliberately no QR-code dependency: the otpauth:// URI and the manual secret
 * are both shown as selectable text, which every authenticator app accepts.
 * Adding a QR library purely for presentation would be a dependency for
 * cosmetics, and the manual key path works everywhere.
 */
export function MfaSetup() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<{ id: string; status: string; friendly_name?: string; created_at?: string }[]>([]);
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [assurance, setAssurance] = useState<{ currentLevel: string | null; nextLevel: string | null } | null>(null);

  const refresh = async () => {
    try {
      const [f, a] = await Promise.all([listFactors(), getAssurance()]);
      setFactors(f.totp);
      setAssurance(a);
    } catch (e) {
      toast({
        title: "Could not load MFA status",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // Load once on mount; the buttons below refresh explicitly after changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = factors.filter((f) => f.status === "verified");
  const isProtected = verified.length > 0;

  const startEnrolment = async () => {
    setBusy(true);
    try {
      setEnrolment(await beginTotpEnrolment());
      setCode("");
    } catch (err) {
      toast({
        title: "Could not start setup",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!enrolment) return;
    const entered = code.replace(/\s/g, "");
    if (entered.length < 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await confirmEnrolment(enrolment.factorId, entered);
      toast({
        title: "Two-factor authentication enabled",
        description: "You will be asked for a code the next time you sign in.",
      });
      setEnrolment(null);
      setCode("");
      await refresh();
    } catch (err) {
      toast({
        title: "That code was not accepted",
        description: err instanceof Error ? err.message : "Check the code and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const disable = async (factorId: string) => {
    setBusy(true);
    try {
      await removeFactor(factorId);
      toast({
        title: "Two-factor authentication removed",
        description: "This account is now protected by its password alone.",
        variant: "destructive",
      });
      await refresh();
    } catch (err) {
      toast({
        title: "Could not remove",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the text and copy manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className={isProtected ? "border-emerald-200" : "border-amber-300"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {isProtected
              ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
              : <ShieldAlert className="h-4 w-4 text-amber-600" />}
            Two-Factor Authentication
            <Badge variant={isProtected ? "default" : "destructive"} className="ml-auto">
              {isProtected ? "Enabled" : "Not enabled"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {isProtected
              ? "A code from your authenticator app is required at sign-in."
              : "This account can move money, change roles and edit settings. It is currently protected by a password alone."}
          </CardDescription>
        </CardHeader>
        {assurance && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Session assurance: <code className="bg-muted px-1 rounded">{assurance.currentLevel ?? "unknown"}</code>
              {assurance.nextLevel && assurance.nextLevel !== assurance.currentLevel && (
                <span className="text-amber-700 ml-2">
                  — this session has not completed a second factor
                </span>
              )}
            </p>
          </CardContent>
        )}
      </Card>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : factors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registered authenticators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5" />
                    {f.friendly_name || "Authenticator app"}
                    {f.status === "verified" ? (
                      <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />verified
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">not confirmed</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {f.created_at ? new Date(f.created_at).toLocaleDateString() : "unknown"}
                  </p>
                </div>
                <Button
                  variant="ghost" size="sm" className="text-destructive shrink-0"
                  disabled={busy}
                  onClick={() => void disable(f.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {enrolment ? (
        <Card className="border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Finish setting up</CardTitle>
            <CardDescription>
              Add this account to your authenticator app (Google Authenticator, Authy, 1Password),
              then enter the 6-digit code it shows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Manual setup key</Label>
              <div className="flex gap-2">
                <Input readOnly value={enrolment.secret} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => void copy(enrolment.secret, "Key")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block">
                Or add this link in your authenticator app
              </Label>
              <div className="flex gap-2">
                <Input readOnly value={enrolment.uri} className="font-mono text-[10px]" />
                <Button variant="outline" size="icon" onClick={() => void copy(enrolment.uri, "Link")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Both work. The key is easier to type; the link can be shared to the app directly.
              </p>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block">Verification code</Label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={7}
                  className="font-mono tracking-widest"
                  data-testid="input-mfa-code"
                />
                <Button onClick={() => void confirm()} disabled={busy} data-testid="button-confirm-mfa">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                </Button>
              </div>
              <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                The factor is not active until a code is confirmed. Until then this account is still password-only.
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={() => { setEnrolment(null); setCode(""); }}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      ) : (
        !loading && !isProtected && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button onClick={() => void startEnrolment()} disabled={busy} data-testid="button-enable-mfa">
                {busy
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</>
                  : <><ShieldCheck className="h-4 w-4 mr-2" />Enable two-factor authentication</>}
              </Button>
              <p className="text-xs text-muted-foreground">
                You will need an authenticator app on your phone. This takes about a minute.
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
