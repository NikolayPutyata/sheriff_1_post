import type { ReactNode } from 'react';
import type { HandoverDto } from '@journal/shared';
import { fmtDateTime, fmtTime } from '../lib/format';
import { Card, StatusBadge } from './ui';

export function HandoverCard({ h, actions, showSubmitter }: { h: HandoverDto; actions?: ReactNode; showSubmitter?: boolean }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-hint">
            Заявка №{h.seq} · {fmtDateTime(h.submittedAt)}
          </div>
          <div className="truncate text-lg font-bold tracking-wide">{h.contractNumber}</div>
          <div className="truncate text-sm">{h.guardName}</div>
          {showSubmitter && (
            <div className="truncate text-xs text-hint">
              Надіслав: {h.submittedBy.nickname ? `${h.submittedBy.nickname} · ${h.submittedBy.name}` : h.submittedBy.name}
            </div>
          )}
        </div>
        <StatusBadge status={h.status} />
      </div>
      {h.decidedAt && h.status !== 'pending' && (
        <div className="text-xs text-hint">
          Рішення о {fmtTime(h.decidedAt)}
          {h.rejectReason && <> · {h.rejectReason}</>}
        </div>
      )}
      {actions}
    </Card>
  );
}
