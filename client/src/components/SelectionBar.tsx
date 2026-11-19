import type { ReactNode } from 'react';
import { plural } from '../lib/format';

/** Панель масових дій знизу екрана (коли вибрано договори). */
export function SelectionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-card/95 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
      <div className="mx-auto max-w-xl space-y-2 px-4 pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            Вибрано: {count} {plural(count, 'договір', 'договори', 'договорів')}
          </span>
          <button type="button" onClick={onClear} className="text-hint">
            ✕ Зняти вибір
          </button>
        </div>
        <div className="flex gap-2">{children}</div>
      </div>
    </div>
  );
}
