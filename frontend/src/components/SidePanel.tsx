import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}

export function SidePanel({ title, onClose, children, footer, widthClassName = 'w-[440px]' }: SidePanelProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative flex h-full ${widthClassName} max-w-full flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-200 ease-out ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <h3 className="text-sm font-medium text-text">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-subtle hover:bg-overlay-3 hover:text-text"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
