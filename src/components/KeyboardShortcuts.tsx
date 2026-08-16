import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS = [
  { keys: ["⌘/Ctrl", "K"], action: "Open command palette / search" },
  { keys: ["?"], action: "Show this keyboard shortcuts help" },
  { keys: ["g", "d"], action: "Go to Dashboard" },
  { keys: ["g", "m"], action: "Go to Members" },
  { keys: ["g", "l"], action: "Go to Loans" },
  { keys: ["g", "c"], action: "Go to Contributions" },
  { keys: ["g", "f"], action: "Go to Financial Dashboard" },
  { keys: ["g", "r"], action: "Go to Reports" },
  { keys: ["g", "a"], action: "Go to Audit Logs" },
  { keys: ["g", "s"], action: "Go to Settings" },
  { keys: ["?"], action: "Close this dialog (Esc)" },
];

/**
 * A "?" keyboard-shortcut help dialog. Activated by pressing the `?` key when
 * not typing in an input/textarea. Improves discoverability of keyboard nav.
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;

      if (isTyping) return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Keyboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
            <p className="text-xs text-muted-foreground">Press anytime outside text fields</p>
          </div>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{s.action}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
