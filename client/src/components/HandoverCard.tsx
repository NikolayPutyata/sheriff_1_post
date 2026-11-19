import type { ReactNode } from 'react';
import type { HandoverDto } from '@journal/shared';
import { fmtDateTime, fmtTime } from '../lib/format';
import { Card, StatusBadge, cx } from './ui';

interface Props {
  h: HandoverDto;
  actions?: ReactNode;
  showSubmitter?: boolean;
  /** Режим вибору (масові дії): чекбокс і клік по картці. */
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  /** Чому не можна вибрати (показується замість чекбокса). */
  lockedReason?: string;
  /** Виділити картку (напр. «вам сповіщено»). */
  highlight?: boolean;
}

export function HandoverCard({ h, actions, showSubmitter, selectable, selected, onToggle, lockedReason, highlight }: Props) {
  const clickable = selectable && !lockedReason && onToggle;
  return (
    <Card
      className={cx(
        'space-y-2 transition',
        selected && 'ring-2 ring-accent',
        highlight && !selected && 'ring-2 ring-amber-500/50',
        clickable && 'cursor-pointer',
      )}
    >
      <div
        className="flex items-start gap-3"
        onClick={clickable ? onToggle : undefined}
        role={clickable ? 'checkbox' : undefined}
        aria-checked={clickable ? !!selected : undefined}
      >
        {selectable && (
          <span
            className={cx(
              'mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-sm',
              lockedReason ? 'border-separator opacity-40' : selected ? 'border-accent bg-accent text-accent-text' : 'border-hint',
            )}
            aria-hidden
          >
            {selected ? '✓' : ''}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-hint">
            Заявка №{h.seq} · {fmtDateTime(h.submittedAt)}
          </div>
          <div className="truncate text-lg font-bold tracking-wide">{h.contractNumber}</div>
          {h.clientName && <div className="text-sm leading-snug font-medium break-words">{h.clientName}</div>}
          <div className="truncate text-sm text-hint">Працівник: {h.guardName}</div>
          {showSubmitter && (
            <div className="truncate text-xs text-hint">
              Надіслав: {h.submittedBy.nickname ? `${h.submittedBy.nickname} · ${h.submittedBy.name}` : h.submittedBy.name}
            </div>
          )}
        </div>
        <StatusBadge status={h.status} />
      </div>

      <div className="space-y-1 empty:hidden">
        {h.decidedAt && h.status === 'rejected' && (
          <Note>
            Рішення о {fmtTime(h.decidedAt)}
            {h.rejectReason && <> · {h.rejectReason}</>}
          </Note>
        )}
        {h.status === 'received' && h.decidedAt && <Note>Прийнято адміном: {fmtDateTime(h.decidedAt)}</Note>}
        {h.notifiedManager && h.status === 'received' && (
          <Note tone="amber">
            🔔 Сповіщено менеджера: {h.notifiedManager.name}
            {h.notifiedAt && ` · ${fmtDateTime(h.notifiedAt)}`}
          </Note>
        )}
        {h.pickup && <Note tone="accent">📦 Забирає {h.pickup.managerName} — чекає підтвердження адміна</Note>}
        {h.manager && h.status === 'with_manager' && (
          <Note tone="accent">
            📦 Забрав {h.manager.name}
            {h.finalAt && ` · ${fmtDateTime(h.finalAt)}`}
          </Note>
        )}
        {h.status === 'legal' && h.finalAt && <Note>⚖️ Передано ЮВ: {fmtDateTime(h.finalAt)}</Note>}
        {selectable && lockedReason && <Note>{lockedReason}</Note>}
      </div>
      {actions}
    </Card>
  );
}

function Note({ children, tone }: { children: ReactNode; tone?: 'amber' | 'accent' }) {
  return (
    <div
      className={cx(
        'text-xs',
        tone === 'amber' && 'font-medium text-amber-700 dark:text-amber-300',
        tone === 'accent' && 'font-medium text-accent',
        !tone && 'text-hint',
      )}
    >
      {children}
    </div>
  );
}
