import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface SessionTimeoutContextType {
  extendSession: () => void;
  resetSession: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType>({
  extendSession: () => {},
  resetSession: () => {},
});

export function useSessionTimeout() {
  return useContext(SessionTimeoutContext);
}

interface SessionTimeoutProviderProps {
  children: ReactNode;
  timeoutMinutes?: number;
  warningMinutes?: number;
}

export function SessionTimeoutProvider({
  children,
  timeoutMinutes = 30,
  warningMinutes = 5,
}: SessionTimeoutProviderProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(warningMinutes * 60);

  const resetSession = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
    setTimeRemaining(warningMinutes * 60);
  }, [warningMinutes]);

  const extendSession = useCallback(() => {
    resetSession();
  }, [resetSession]);

  // Track user activity
  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    
    const handleActivity = () => {
      if (!showWarning) {
        setLastActivity(Date.now());
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [showWarning]);

  // Check session timeout
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivity;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

      if (elapsed >= timeoutMs) {
        // Session expired - redirect to login
        window.location.href = "/";
      } else if (elapsed >= warningMs) {
        // Show warning
        setShowWarning(true);
        setTimeRemaining(Math.ceil((timeoutMs - elapsed) / 1000));
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [lastActivity, timeoutMinutes, warningMinutes]);

  // Countdown timer when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          window.location.href = "/";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showWarning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <SessionTimeoutContext.Provider value={{ extendSession, resetSession }}>
      {children}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center">Session Expiring Soon</DialogTitle>
            <DialogDescription className="text-center">
              Your session will expire in{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatTime(timeRemaining)}
              </span>
              . Click below to continue your session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
              Log Out
            </Button>
            <Button onClick={extendSession}>
              Continue Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionTimeoutContext.Provider>
  );
}