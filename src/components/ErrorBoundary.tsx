// Fix #6: Top-level React error boundary for graceful degradation
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Detects errors caused by a stale cached index.html referencing chunk
   * files that no longer exist after a redeploy ("Failed to fetch dynamically
   * imported module", "Loading chunk ... failed", etc.). In that case the only
   * reliable recovery is to reload the page so the browser fetches the fresh
   * index.html with the current chunk hashes. We guard with sessionStorage so
   * a genuinely broken deploy can't loop the reload forever.
   */
  private isChunkLoadError(error: Error): boolean {
    const msg = error?.message ?? "";
    return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|error loading chunk|Unable to preload CSS/i.test(
      msg,
    );
  }

  private handleStaleChunkReload() {
    const KEY = "__chunk_reload_attempted";
    try {
      if (sessionStorage.getItem(KEY)) {
        // Already reloaded once and it still failed — stop the loop and let
        // the normal error fallback render so the user can act manually.
        sessionStorage.removeItem(KEY);
        return;
      }
      sessionStorage.setItem(KEY, "1");
      console.warn("[ErrorBoundary] Stale chunk detected, reloading to fetch fresh assets…");
      window.location.reload();
    } catch {
      // sessionStorage unavailable (e.g. private mode) — skip auto-reload.
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.isChunkLoadError(error)) {
      this.handleStaleChunkReload();
      return;
    }

    // Log to console (useful for development)
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);

    // Support production error reporting services dynamically in production
    try {
      if ((window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          extra: { componentStack: info.componentStack },
        });
      }
      if ((window as any).LogRocket) {
        (window as any).LogRocket.captureException(error, {
          extra: { componentStack: info.componentStack },
        });
      }
      // Safe fallback - send crash diagnostics back to API logger if endpoint exists
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          error: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently swallow network errors if logger endpoint doesn't exist
      });
    } catch (e) {
      // Prevent crash reporting failures from taking down the application
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            An unexpected error occurred. Please try refreshing the page. If the
            problem persists, contact support.
          </p>
          {this.state.error && (
            <pre className="mt-2 max-w-xl overflow-auto rounded bg-muted px-4 py-2 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="mt-2 rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
