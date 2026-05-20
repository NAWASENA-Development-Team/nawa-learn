// components/ui/Toast.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  variant?: ToastVariant;
  title: string;
  message?: string;
  /** Duration in ms. 0 = stays until closed. Default: 4500 */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Variant config ────────────────────────────────────────────────────────────
const VARIANTS: Record<
  ToastVariant,
  { icon: React.ElementType; bar: string; iconCls: string; border: string; bg: string }
> = {
  success: {
    icon: CheckCircle2,
    bar: "bg-emerald-500",
    iconCls: "text-emerald-500",
    border: "border-l-emerald-500",
    bg: "bg-white dark:bg-zinc-900",
  },
  error: {
    icon: XCircle,
    bar: "bg-rose-500",
    iconCls: "text-rose-500",
    border: "border-l-rose-500",
    bg: "bg-white dark:bg-zinc-900",
  },
  warning: {
    icon: AlertTriangle,
    bar: "bg-amber-500",
    iconCls: "text-amber-500",
    border: "border-l-amber-500",
    bg: "bg-white dark:bg-zinc-900",
  },
  info: {
    icon: Info,
    bar: "bg-indigo-500",
    iconCls: "text-indigo-500",
    border: "border-l-indigo-500",
    bg: "bg-white dark:bg-zinc-900",
  },
};

// ── Single Toast ──────────────────────────────────────────────────────────────
function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { variant, title, message, duration = 4500 } = item;
  const cfg = VARIANTS[variant];
  const Icon = cfg.icon;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Progress bar + auto-dismiss
  useEffect(() => {
    if (duration === 0) return;
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed >= duration) {
        dismiss();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss(item.id), 300);
  }, [item.id, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        transform: visible ? "translateX(0) scale(1)" : "translateX(calc(100% + 1rem)) scale(0.96)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
      }}
      className={`relative w-full max-w-sm rounded-2xl shadow-xl shadow-zinc-900/10 dark:shadow-zinc-950/40
        border border-zinc-200/80 dark:border-zinc-700/60 border-l-4 overflow-hidden
        ${cfg.border} ${cfg.bg}`}
    >
      {/* Body */}
      <div className="flex items-start gap-3 px-4 py-3.5 pr-10">
        <div className={`mt-0.5 shrink-0 ${cfg.iconCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-snug">
            {title}
          </p>
          {message && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={dismiss}
        aria-label="Tutup notifikasi"
        className="absolute top-3 right-3 flex items-center justify-center h-5 w-5 rounded-full
          text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200
          hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-0.5 w-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full ${cfg.bar} transition-none`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      aria-label="Notifikasi"
      className="fixed top-20 right-4 z-[9999] flex flex-col gap-2.5 w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard item={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      variant: options.variant ?? "info",
      title: options.title,
      message: options.message,
      duration: options.duration ?? 4500,
      createdAt: Date.now(),
    };
    setToasts((prev) => [...prev.slice(-4), item]); // cap at 5 toasts
  }, []);

  const success = useCallback((title: string, message?: string) =>
    toast({ variant: "success", title, message }), [toast]);
  const error = useCallback((title: string, message?: string) =>
    toast({ variant: "error", title, message }), [toast]);
  const warning = useCallback((title: string, message?: string) =>
    toast({ variant: "warning", title, message }), [toast]);
  const info = useCallback((title: string, message?: string) =>
    toast({ variant: "info", title, message }), [toast]);

  const value: ToastContextValue = { toast, success, error, warning, info };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
