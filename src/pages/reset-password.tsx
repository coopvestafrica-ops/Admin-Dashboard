// Reset Password Page — handles Supabase recovery (password-reset) links
import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // The legacy client-side demo flow stores a token in sessionStorage and passes
  // it via ?token=. Supabase's real recovery flow puts the session in the URL
  // hash (#access_token=...&type=recovery). We support both.
  const demoToken = searchParams.get("token");

  useEffect(() => {
    const verify = async () => {
      // 1) Legacy client-side demo token (set by the login page's fallback)
      if (demoToken) {
        const storedEmail = sessionStorage.getItem(`reset_token_${demoToken}`);
        const storedExpiry = sessionStorage.getItem(`reset_expires_${demoToken}`);
        if (storedEmail && storedExpiry && Date.now() < parseInt(storedExpiry, 10)) {
          setEmail(storedEmail);
          setIsValidToken(true);
        } else {
          setError("Invalid or expired reset link. Please request a new password reset link.");
          setIsValidToken(false);
        }
        setIsVerifying(false);
        return;
      }

      // 2) Supabase recovery link — the hash fragment is parsed by the client
      //    automatically and exposed via getSession(). On a recovery callback the
      //    user has a valid (short-lived) session we can update the password on.
      if (!supabase) {
        setError("Authentication service not configured. Please contact support.");
        setIsVerifying(false);
        return;
      }

      try {
        // Supabase v2 reads the hash on init; detect the recovery session.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError("Invalid or expired reset link. Please request a new password reset link.");
          setIsValidToken(false);
        } else if (sessionData?.session) {
          setEmail(sessionData.session.user?.email || "");
          setIsValidToken(true);
        } else {
          setError("No reset session found. Please request a new password reset link.");
          setIsValidToken(false);
        }
      } catch {
        setError("Invalid or expired reset link. Please request a new password reset link.");
        setIsValidToken(false);
      }
      setIsVerifying(false);
    };

    verify();
  }, [demoToken]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // Legacy demo-token path: no real session, so we cannot set a password
      // server-side. Clear the demo token and prompt to use the email flow.
      if (demoToken) {
        sessionStorage.removeItem(`reset_token_${demoToken}`);
        sessionStorage.removeItem(`reset_expires_${demoToken}`);
        toast({
          title: "Demo link is not secure",
          description: "Demo reset links cannot set a real password. Use the password reset email flow instead.",
          variant: "destructive",
        });
        setLocation("/");
        return;
      }

      if (!supabase) {
        setError("Authentication service not configured.");
        return;
      }

      // The recovery link established a session; updateUser sets the new password
      // against that session.
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
      } else {
        // Sign out the recovery session so the user must sign in fresh.
        await supabase.auth.signOut();
        toast({
          title: "Password updated",
          description: "Your password has been changed. Please sign in.",
        });
        setLocation("/");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <span className="text-3xl font-bold">CA</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Coopvest Africa</h1>
          </div>
          <Card className="border-border shadow-xl">
            <CardContent className="py-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Verifying reset link...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isValidToken && !error) {
    setError("Invalid or expired reset token. Please request a new password reset link.");
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <span className="text-3xl font-bold">CA</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Coopvest Africa</h1>
          <p className="text-muted-foreground text-sm text-center">
            {isValidToken ? "Set a new password for your account" : "Password reset link invalid or expired"}
          </p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {email ? `Resetting password for ${email}` : "Choose a strong new password"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {isValidToken && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm new password</Label>
                    <Input
                      id="confirm"
                      name="confirm"
                      type="password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                    />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter>
              {isValidToken ? (
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Set new password"}
                  {!isLoading && <ShieldCheck className="ml-2 h-4 w-4" />}
                </Button>
              ) : (
                <Button type="button" className="w-full" onClick={() => setLocation("/")}>
                  Go to login
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
