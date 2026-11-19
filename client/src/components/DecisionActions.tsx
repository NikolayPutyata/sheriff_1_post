import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  REJECT_REASON_CODES,
  REJECT_REASONS,
  type DecisionRequest,
  type HandoverDto,
  type RejectReasonCode,
} from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { haptic } from '../lib/telegram';
import { Button, ErrorNote } from './ui';

/** Кнопки адміна під новою заявкою: Отримано / Відмовлено (з причиною). */
export function DecisionActions({ h, onDone }: { h: HandoverDto; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const decide = useMutation({
    mutationFn: (body: DecisionRequest) => api<HandoverDto>(`/handovers/${h.id}/decision`, { method: 'POST', body }),
    onSuccess: () => {
      haptic.success();
      onDone();
    },
    onError: () => {
      haptic.error();
      onDone(); // напр. вже оброблено в боті — просто оновимо список
    },
  });

  if (rejecting) {
    return (
      <div className="space-y-2 border-t border-separator pt-3">
        <p className="text-sm text-hint">Причина відмови:</p>
        {REJECT_REASON_CODES.map((code: RejectReasonCode) => (
          <Button
            key={code}
            size="sm"
            variant="danger"
            className="w-full justify-start"
            loading={decide.isPending && decide.variables?.reason === code}
            onClick={() => decide.mutate({ decision: 'rejected', reason: code })}
          >
            {REJECT_REASONS[code]}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="w-full" onClick={() => setRejecting(false)}>
          Скасувати
        </Button>
        {decide.isError && <ErrorNote>{errorMessage(decide.error)}</ErrorNote>}
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t border-separator pt-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="success"
          loading={decide.isPending && decide.variables?.decision === 'received'}
          onClick={() => decide.mutate({ decision: 'received' })}
        >
          ✅ Отримано
        </Button>
        <Button variant="danger" onClick={() => setRejecting(true)}>
          ❌ Відмовлено
        </Button>
      </div>
      {decide.isError && <ErrorNote>{errorMessage(decide.error)}</ErrorNote>}
    </div>
  );
}

