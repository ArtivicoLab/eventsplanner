import { create } from "zustand";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red — use for destructive/hard-to-reverse actions. */
  danger?: boolean;
}
interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

interface ConfirmState {
  current: PendingConfirm | null;
  queue: PendingConfirm[];
  request: (opts: ConfirmRequest) => Promise<boolean>;
  resolve: (ok: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  current: null,
  queue: [],
  request: (opts) =>
    new Promise<boolean>((resolve) => {
      const pending: PendingConfirm = { ...opts, resolve };
      // A request while one's already showing queues instead of overwriting
      // `current` — the overwritten request's resolve() would otherwise never
      // fire, permanently hanging whatever action was awaiting it.
      if (get().current) set((s) => ({ queue: [...s.queue, pending] }));
      else set({ current: pending });
    }),
  resolve: (ok) => {
    get().current?.resolve(ok);
    const [next, ...rest] = get().queue;
    set({ current: next ?? null, queue: rest });
  },
}));

/** Drop-in, app-themed replacement for window.confirm() — never use the raw
    browser confirm()/alert() in this app; they can't be styled and look like
    a broken site on an installed PWA. Usage: `if (!(await confirmDialog({...
    }))) return;` */
export function confirmDialog(opts: ConfirmRequest): Promise<boolean> {
  return useConfirm.getState().request(opts);
}
