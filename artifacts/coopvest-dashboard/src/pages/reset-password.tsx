// Reset Password Page — handles custom API password-reset tokens
import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const token = searchParams.get("token");

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        setError("No reset token provided. Please request a new password reset link.");
        return;
      }

      // First try custom API verification
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "";
        const response = await fetch(`${apiUrl}/api/password-reset/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.valid) {
          setEmail(data.email || "");
          setIsValidToken(true);
          setIsVerifying(false);
          return;
        }
      } catch {
        // API not available, continue to sessionStorage check
      }

      // Fall back to sessionStorage verification (demo mode)
      const storedEmail = sessionStorage.getItem(`reset_token_${token}`);
      const storedExpiry = sessionStorage.getItem(`reset_expires_${token}`);

      if (storedEmail && storedExpiry && Date.now() < parseInt(storedExpiry)) {
        setEmail(storedEmail);
        setIsValidToken(true);
      } else {
        setError("Invalid or expired reset token. Please request a new password reset link.");
        setIsValidToken(false);
      }
      setIsVerifying(false);
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("No reset token provided.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    // First try custom API
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${apiUrl}/api/password-reset/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (response.ok) {
        // Clear session storage
        sessionStorage.removeItem(`reset_token_${token}`);
        sessionStorage.removeItem(`reset_expires_${token}`);
        
        toast({
          title: "Password updated",
          description: "Your password has been changed. Please sign in.",
        });
        setLocation("/");
        setIsLoading(false);
        return;
      }
    } catch {
      // API not available, continue to Supabase
    }

    // Fall back to Supabase
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      
      if (updateError) {
        setError(updateError.message);
      } else {
        // Clear session storage
        sessionStorage.removeItem(`reset_token_${token}`);
        sessionStorage.removeItem(`reset_expires_${token}`);
        
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
