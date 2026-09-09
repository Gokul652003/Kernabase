import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  onClick: () => void;
  /** Spins the icon and blocks repeat clicks while a load is in flight. */
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  /** Icon-only by default; pass a label to show text beside it. */
  showLabel?: boolean;
  className?: string;
}

export function RefreshButton({
  onClick,
  busy = false,
  disabled = false,
  label = 'Refresh',
  showLabel = false,
  className = '',
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={label}
      aria-label={label}
      className={`flex items-center gap-1.5 rounded-md border border-border text-text-subtle transition-colors hover:bg-overlay-3 hover:text-text disabled:opacity-40 ${
        showLabel ? 'px-3 py-1.5 text-xs' : 'h-7 w-7 justify-center'
      } ${className}`}
    >
      <RefreshCw size={showLabel ? 14 : 13} className={busy ? 'animate-spin motion-reduce:animate-none' : ''} />
      {showLabel && <span>{busy ? 'Refreshing…' : label}</span>}
    </button>
  );
}
