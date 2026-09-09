import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, variant: ToastItem['variant']) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Memoized so `toast` has a stable identity across renders — otherwise every
  // consumer with `toast` in a useCallback/useEffect dependency array refetches
  // whenever ANY toast is shown or expires anywhere in the app, causing infinite
  // fetch-fail-toast-refetch loops.
  const success = useCallback((message: string) => push(message, 'success'), [push]);
  const error = useCallback((message: string) => push(message, 'error'), [push]);
  const value = useMemo<ToastContextValue>(() => ({ success, error }), [success, error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
              t.variant === 'success'
                ? 'border-accent/40 bg-surface text-text'
                : 'border-danger/40 bg-surface text-text'
            }`}
          >
            {t.variant === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 text-accent" />
            ) : (
              <XCircle size={16} className="shrink-0 text-danger" />
            )}
            <span className="max-w-sm">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
