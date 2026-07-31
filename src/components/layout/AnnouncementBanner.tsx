import { useState, useEffect } from "react";
import { X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Announcement {
  id: string;
  message: string;
  type?: "info" | "warning" | "success";
  dismissible?: boolean;
}

// This can be fetched from an API or defined statically
const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "maintenance",
    message: "Scheduled maintenance on Saturday 8PM - 10PM EST. Dashboard may be briefly unavailable.",
    type: "warning",
    dismissible: true,
  },
];

export function AnnouncementBanner() {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load dismissed state from localStorage
    const stored = localStorage.getItem("announcements-dismissed");
    if (stored) {
      setDismissed(JSON.parse(stored));
    }
    // Show all non-dismissed announcements
    const initial: Record<string, boolean> = {};
    ANNOUNCEMENTS.forEach((a) => {
      initial[a.id] = !dismissed[a.id];
    });
    setVisible(initial);
  }, [dismissed]);

  const handleDismiss = (id: string) => {
    const newDismissed = { ...dismissed, [id]: true };
    setDismissed(newDismissed);
    localStorage.setItem("announcements-dismissed", JSON.stringify(newDismissed));
  };

  const typeStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };

  return (
    <div className="flex flex-col">
      {ANNOUNCEMENTS.filter((a) => visible[a.id]).map((announcement) => (
        <div
          key={announcement.id}
          className={`flex items-center justify-between gap-2 border-b px-4 py-2 text-sm ${typeStyles[announcement.type || "info"]}`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 shrink-0" />
            <span>{announcement.message}</span>
          </div>
          {announcement.dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => handleDismiss(announcement.id)}
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}