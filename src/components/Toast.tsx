import { useToast } from "../stores/useToast";

// Global toast stack, rendered once at the app shell.
export function Toaster() {
  const { toasts, dismiss } = useToast();
  // Always mounted, even with nothing to show: an aria-live region only
  // announces content that's ADDED to it, so unmounting it between toasts
  // (returning null here) means AT can miss the very first toast after a
  // quiet stretch, since the region wouldn't exist yet when it appears.
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast__msg">{t.message}</span>
          {t.actionLabel && (
            <button
              className="toast__action"
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
