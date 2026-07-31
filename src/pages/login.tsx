import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { isValidAdminRole } from "@/lib/permissions";

// Helper to parse user agent for device info
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  let browser = 'unknown';
  let os = 'unknown';
  
  if (/mobile/i.test(ua)) deviceType = 'mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';
  
  if (/edge/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS';
  
  return { deviceType, browser, os };
}

// Log login attempt to backend
async function logLoginAttempt(email: string, success: boolean, failureReason?: string) {
  try {
    const deviceInfo = getDeviceInfo();
    await fetch('/api/login-history/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        success,
        failure_reason: failureReason,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      }),
    });
  } catch (err) {
    console.error('Failed to log login attempt:', err);
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if supabase is available on mount and handle redirect errors
  useEffect(() => {
    if (!supabase) {
      setError("Authentication service not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.");
      return;
    }
    
    // Check for redirect error
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'unauthorized' || error === 'not_admin') {
      setError("Access denied. Only authorized administrators can access this dashboard.");
      window.history.replaceState({}, '', '/');
    } else if (error === 'no_permission') {
      setError("You don't have permission to access this page.");
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!supabase) {
      setError("Authentication service not configured. Please contact support.");
      setIsLoading(false);
      return;
    }

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const { data: sessionData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Log failed login
      logLoginAttempt(email, false, authError.message);
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    // Check if user has admin role (must be super_admin, admin, operator, or viewer)
    if (sessionData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, id')
        .eq('id', sessionData.user.id)
        .maybeSingle();

      if (!isValidAdminRole(profile?.role ?? null)) {
        // Sign out and show error - only admins, operators, and viewers can access
        await supabase.auth.signOut();
        // Log failed login - not admin
        logLoginAttempt(email, false, 'Not an admin user');
        setError("Access denied. Only authorized administrators can access this dashboard.");
        setIsLoading(false);
        return;
      }
      
      // Log successful login
      logLoginAttempt(email, true);
    }

    setLocation("/dashboard");
  };

  const handleForgotPassword = async () => {
    if (!supabase) {
      setError("Authentication service not configured. Please contact support.");
      return;
    }
    
    const email = (document.getElementById("email") as HTMLInputElement)?.value;
    if (!email) {
      setError("Please enter your email address first, then click Forgot password.");
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Try Supabase password reset first
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (resetError) {
        // Supabase failed - use demo mode with client-side token
        const demoToken = generateDemoToken(email);
        const demoLink = `${window.location.origin}/reset-password?token=${demoToken}`;
        
        toast({
          title: "Demo mode active",
          description: "Email service unavailable. Use the link below to reset.",
          duration: 10000,
        });
        
        // Show demo link prominently
        setError(`Demo Mode:\n\nClick here to reset: ${demoLink}`);
      } else {
        toast({
          title: "Password reset email sent",
          description: "Check your email for the reset link. Check your spam folder if you don't see it.",
          duration: 5000,
        });
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate a demo token for testing when email service is unavailable
  function generateDemoToken(email: string): string {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);
    const token = btoa(`${email}:${timestamp}:${randomPart}`).replace(/[+/=]/g, '');
    // Store in sessionStorage for verification
    sessionStorage.setItem(`reset_token_${token}`, email);
    sessionStorage.setItem(`reset_expires_${token}`, String(Date.now() + 3600000)); // 1 hour
    return token;
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
            Cooperative Operations Dashboard
          </p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>Enter your operator credentials</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="Enter your email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Authenticating..." : "Sign In"}
                {!isLoading && <ShieldCheck className="ml-2 h-4 w-4" />}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
