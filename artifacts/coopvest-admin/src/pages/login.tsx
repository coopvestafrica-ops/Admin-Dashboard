import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await login(email, password, requiresMfa ? mfaCode : undefined);
      if (result.requiresMfa) {
        setRequiresMfa(true);
      } else if (!result.success) {
        setError(result.error || "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">CoopVest Africa</h1>
          <p className="text-slate-400 text-sm mt-1">Cooperative Management Platform</p>
        </div>

        <Card className="border-slate-700 bg-slate-900/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {requiresMfa ? "Two-Factor Authentication" : "Admin Sign In"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {requiresMfa
                ? "Enter the 6-digit code from your authenticator app"
                : "Secure access — all login attempts are monitored and logged"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!requiresMfa && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@coopvest.africa" required autoComplete="email"
                      className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-300">Password</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password}
                        onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                        autoComplete="current-password"
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 pr-10" />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {requiresMfa && (
                <div className="space-y-2">
                  <Label htmlFor="mfa" className="text-slate-300">Authentication Code</Label>
                  <Input id="mfa" type="text" value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6} autoComplete="one-time-code"
                    className="bg-slate-800 border-slate-600 text-white text-center text-2xl tracking-[0.5em] placeholder:text-slate-600" autoFocus />
                  <p className="text-xs text-slate-500 text-center">Enter the 6-digit code from your authenticator app</p>
                </div>
              )}
              {error && (
                <Alert variant="destructive" className="border-red-800 bg-red-950/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Authenticating...</> : requiresMfa ? "Verify Code" : "Sign In Securely"}
              </Button>
              {requiresMfa && (
                <Button type="button" variant="ghost" className="w-full text-slate-400"
                  onClick={() => { setRequiresMfa(false); setMfaCode(""); }}>
                  Back to Login
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-600">
          Protected by enterprise-grade security · All access is logged and monitored
        </p>
      </div>
    </div>
  );
}
