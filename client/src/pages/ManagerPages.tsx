import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { HandoverDto, MeResponse, PickupDto } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime, plural } from '../lib/format';
import { confirmAsync, haptic } from '../lib/telegram';
import { useSelection } from '../lib/selection';
import { HandoverCard } from '../components/HandoverCard';
import { SelectionBar } from '../components/SelectionBar';
import { Button, Card, ErrorNote, Spinner, cx } from '../components/ui';
import { useRefreshBoard } from './AdminOnPost';

const contracts = (n: number) => `${n} ${plural(n, 'договір', 'договори', 'договорів')}`;

/** Менеджер: усі договори на посту. Забрати можна лише прийняті адміном. */
export function ManagerBoard({ me }: { me: MeResponse }) {
  const refresh = useRefreshBoard();
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const q = search.trim();
  const board = useQuery({
    queryKey: ['board', q],
    queryFn: () => api<HandoverDto[]>(`/board${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });

  const items = board.data ?? [];
  const forMe = (h: HandoverDto) => h.notifiedManager?.tgUserId === me.user.id;
  // спершу — ті, про які адмін сповістив саме вас
  const received = [...items.filter((h) => h.status === 'received')].sort((a, b) => Number(forMe(b)) - Number(forMe(a)));
  const pending = items.filter((h) => h.status === 'pending');
  const selectable = useMemo(() => received.filter((h) => !h.pickup).map((h) => h.id), [received]);
  const sel = useSelection(selectable);
  const mineCount = received.filter(forMe).length;

  const take = useMutation({
    mutationFn: (handoverIds: string[]) =>
      api<{ id: string; count: number; skipped: number }>('/pickups', { method: 'POST', body: { handoverIds } }),
    onSuccess: (r) => {
      haptic.success();
      sel.clear();
      setToast(
        `📦 Заявку надіслано адміністратору: ${contracts(r.count)}${r.skipped ? ` (${r.skipped} вже недоступні)` : ''}. Він підтвердить передачу.`,
      );
      setTimeout(() => setToast(null), 6000);
      refresh();
    },
    onError: (e) => {
      haptic.error();
      setToast(errorMessage(e));
      refresh();
    },
  });

  return (
    <div className={cx('space-y-3', sel.ids.length > 0 && 'pb-32')}>
      {mineCount > 0 && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          🔔 Адміністратор сповістив вас про {contracts(mineCount)} — вони вгорі списку.
        </p>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Пошук за номером або клієнтом"
        className="h-11 w-full rounded-xl border border-separator bg-card px-4 outline-none focus:border-accent"
      />
      {toast && <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{toast}</p>}
      {board.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {board.isError && <ErrorNote>{errorMessage(board.error)}</ErrorNote>}

      {board.data && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">✅ Прийняті адміном — можна забрати · {received.length}</h2>
          {received.length === 0 && <p className="rounded-2xl bg-card p-4 text-center text-hint shadow-sm">Немає прийнятих договорів</p>}
          {received.map((h) => (
            <HandoverCard
              key={h.id}
              h={h}
              selectable
              highlight={forMe(h)}
              selected={sel.has(h.id)}
              onToggle={() => sel.toggle(h.id)}
              lockedReason={
                h.pickup ? (h.pickup.managerTgId === me.user.id ? 'Ви вже подали заявку' : `Забирає ${h.pickup.managerName}`) : undefined
              }
            />
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">⏳ Принесли, але ще не прийнято адміном · {pending.length}</h2>
          {pending.map((h) => (
            <HandoverCard key={h.id} h={h} />
          ))}
        </section>
      )}

      <SelectionBar count={sel.ids.length} onClear={sel.clear}>
        <Button className="flex-1" loading={take.isPending} onClick={() => take.mutate(sel.ids)}>
          📦 Забрати
        </Button>
      </SelectionBar>
    </div>
  );
}

const PICKUP_LABELS: Record<PickupDto['status'], string> = {
  pending: '⏳ Чекає підтвердження адміна',
  processing: '⏳ Обробляється',
  confirmed: '✅ Передано',
  partial: '✅ Передано частково',
  declined: '❌ Адмін не підтвердив',
  cancelled: '🚫 Скасовано',
};

/** Менеджер: мої заявки і договори, які я забрав. */
export function ManagerMine() {
  const refresh = useRefreshBoard();
  const pickups = useQuery({ queryKey: ['pickups'], queryFn: () => api<PickupDto[]>('/pickups'), refetchInterval: 20_000 });
  const taken = useQuery({ queryKey: ['taken'], queryFn: () => api<HandoverDto[]>('/handovers/taken'), refetchInterval: 30_000 });
  const active = pickups.data?.filter((p) => p.status === 'pending') ?? [];
  const recent = pickups.data?.filter((p) => p.status !== 'pending').slice(0, 5) ?? [];

  if (pickups.isLoading || taken.isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-4">
      {(pickups.isError || taken.isError) && <ErrorNote>{errorMessage(pickups.error ?? taken.error)}</ErrorNote>}
      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">Мої заявки · {active.length}</h2>
          {active.map((p) => (
            <PickupCard key={p.id} p={p} onDone={refresh} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-hint">📦 У мене · {taken.data?.length ?? 0}</h2>
        {taken.data?.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-center text-hint shadow-sm">
            Тут з’являться договори, які адміністратор вам передав. Зберігаються 3 місяці.
          </p>
        )}
        {taken.data?.map((h) => (
          <HandoverCard key={h.id} h={h} />
        ))}
      </section>

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">Останні рішення адміна</h2>
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {recent.map((p) => (
              <div key={p.id} className="border-b border-separator px-4 py-2.5 text-sm last:border-b-0">
                <div className="font-medium">{PICKUP_LABELS[p.status]}</div>
                <div className="text-xs text-hint">
                  {p.items.map((h) => h.contractNumber).join(', ')} · {fmtDateTime(p.decidedAt ?? p.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PickupCard({ p, onDone }: { p: PickupDto; onDone: () => void }) {
  const cancel = useMutation({
    mutationFn: () => api(`/pickups/${p.id}/cancel`, { method: 'POST', body: {} }),
    onSettled: onDone,
  });
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{PICKUP_LABELS[p.status]}</span>
        <span className="text-xs text-hint">{fmtDateTime(p.createdAt)}</span>
      </div>
      <ul className="space-y-1 text-sm">
        {p.items.map((h) => (
          <li key={h.id}>
            <b>{h.contractNumber}</b>
            {h.clientName && <span className="text-hint"> — {h.clientName}</span>}
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        loading={cancel.isPending}
        onClick={async () => {
          if (await confirmAsync('Скасувати заявку?')) cancel.mutate();
        }}
      >
        Скасувати заявку
      </Button>
      {cancel.isError && <ErrorNote>{errorMessage(cancel.error)}</ErrorNote>}
    </Card>
  );
}
