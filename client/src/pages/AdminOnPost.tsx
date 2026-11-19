import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HandoverDto, ManagerDto, PickupDto } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime, plural } from '../lib/format';
import { confirmAsync, haptic, useTgBackButton } from '../lib/telegram';
import { useSelection } from '../lib/selection';
import { HandoverCard } from '../components/HandoverCard';
import { SelectionBar } from '../components/SelectionBar';
import { Button, Card, ErrorNote, Spinner, cx } from '../components/ui';
import { DecisionActions } from '../components/DecisionActions';

const contracts = (n: number) => `${n} ${plural(n, 'договір', 'договори', 'договорів')}`;

export function useRefreshBoard() {
  const qc = useQueryClient();
  return useCallback(() => {
    for (const key of ['board', 'pickups', 'journal', 'taken']) qc.invalidateQueries({ queryKey: [key] });
  }, [qc]);
}

/** Адмін: що зараз на посту — нові заявки, прийняті договори, заявки менеджерів «забрати». */
export function AdminOnPost() {
  const refresh = useRefreshBoard();
  const [search, setSearch] = useState('');
  const [picker, setPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const q = search.trim();

  const board = useQuery({
    queryKey: ['board', q],
    queryFn: () => api<HandoverDto[]>(`/board${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
  const pickups = useQuery({
    queryKey: ['pickups'],
    queryFn: () => api<PickupDto[]>('/pickups'),
    refetchInterval: 15_000,
  });

  const items = board.data ?? [];
  const pending = items.filter((h) => h.status === 'pending');
  const received = items.filter((h) => h.status === 'received');
  const selectable = useMemo(() => received.filter((h) => !h.pickup).map((h) => h.id), [received]);
  const sel = useSelection(selectable);

  const show = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 5000);
  };

  const legal = useMutation({
    mutationFn: (handoverIds: string[]) =>
      api<{ updated: number; skipped: number }>('/board/legal', { method: 'POST', body: { handoverIds } }),
    onSuccess: (r) => {
      haptic.success();
      sel.clear();
      show(`⚖️ Передано ЮВ: ${contracts(r.updated)}`);
      refresh();
    },
    onError: (e) => show(errorMessage(e)),
  });

  return (
    <div className={cx('space-y-3', sel.ids.length > 0 && 'pb-32')}>
      {(pickups.data?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">📦 Менеджери хочуть забрати · {pickups.data!.length}</h2>
          {pickups.data!.map((p) => (
            <PickupRequestCard key={p.id} p={p} onDone={refresh} />
          ))}
        </section>
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

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">⏳ Нові заявки — звірте папір · {pending.length}</h2>
          {pending.map((h) => (
            <HandoverCard key={h.id} h={h} showSubmitter actions={<DecisionActions h={h} onDone={refresh} />} />
          ))}
        </section>
      )}

      {board.data && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-hint">✅ Прийняті, на посту · {received.length}</h2>
            {selectable.length > 0 && (
              <button
                type="button"
                className="text-sm text-accent"
                onClick={() => (sel.ids.length === selectable.length ? sel.clear() : sel.setAll(selectable))}
              >
                {sel.ids.length === selectable.length ? 'Зняти всі' : 'Вибрати всі'}
              </button>
            )}
          </div>
          {received.length === 0 && <p className="rounded-2xl bg-card p-4 text-center text-hint shadow-sm">На посту договорів немає</p>}
          {received.map((h) => (
            <HandoverCard
              key={h.id}
              h={h}
              selectable
              selected={sel.has(h.id)}
              onToggle={() => sel.toggle(h.id)}
              lockedReason={h.pickup ? 'Не можна вибрати — менеджер уже подав заявку' : undefined}
            />
          ))}
        </section>
      )}

      <SelectionBar count={sel.ids.length} onClear={sel.clear}>
        <Button className="flex-1" onClick={() => setPicker(true)}>
          🔔 Сповістити менеджера
        </Button>
        <Button
          variant="secondary"
          loading={legal.isPending}
          onClick={async () => {
            if (await confirmAsync(`Позначити ${contracts(sel.ids.length)} як «Передано ЮВ»?`)) legal.mutate(sel.ids);
          }}
        >
          ⚖️ ЮВ
        </Button>
      </SelectionBar>

      {picker &&
        createPortal(
          <ManagerPicker
            ids={sel.ids}
            onClose={() => setPicker(false)}
            onDone={(text) => {
              setPicker(false);
              sel.clear();
              show(text);
              refresh();
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/** Заявка менеджера: адмін відмічає, що саме передав. */
function PickupRequestCard({ p, onDone }: { p: PickupDto; onDone: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(p.items.map((h) => h.id)));
  const decide = useMutation({
    mutationFn: (body: { decision: 'confirm' | 'decline'; handoverIds?: string[] }) =>
      api(`/pickups/${p.id}/decision`, { method: 'POST', body }),
    onSuccess: () => {
      haptic.success();
      onDone();
    },
    onError: onDone,
  });
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card className="space-y-3 ring-2 ring-accent/40">
      <div>
        <div className="font-semibold">
          {p.manager.name}
          {p.manager.nickname && <span className="font-normal text-hint"> · {p.manager.nickname}</span>}
        </div>
        <div className="text-xs text-hint">
          Хоче забрати {contracts(p.items.length)} · {fmtDateTime(p.createdAt)}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-separator">
        {p.items.map((h) => (
          <label key={h.id} className="flex cursor-pointer items-start gap-3 border-b border-separator px-3 py-2 last:border-b-0">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--color-accent)]" checked={chosen.has(h.id)} onChange={() => toggle(h.id)} />
            <span className="min-w-0 flex-1 text-sm">
              <b>{h.contractNumber}</b>
              {h.clientName && <span className="block break-words text-hint">{h.clientName}</span>}
              {h.notifiedManager && h.notifiedManager.tgUserId !== p.manager.tgUserId && (
                <span className="block text-xs text-amber-700 dark:text-amber-300">⚠️ Сповіщали іншому: {h.notifiedManager.name}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="success"
          disabled={!chosen.size}
          loading={decide.isPending && decide.variables?.decision === 'confirm'}
          onClick={() => decide.mutate({ decision: 'confirm', handoverIds: [...chosen] })}
        >
          ✅ Передав {chosen.size === p.items.length ? 'усі' : `${chosen.size}`}
        </Button>
        <Button
          variant="danger"
          loading={decide.isPending && decide.variables?.decision === 'decline'}
          onClick={() => decide.mutate({ decision: 'decline' })}
        >
          ❌ Не передав
        </Button>
      </div>
      {decide.isError && <ErrorNote>{errorMessage(decide.error)}</ErrorNote>}
    </Card>
  );
}

/** Вибір менеджера для сповіщення (з підказкою за клієнтом). */
function ManagerPicker({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: (text: string) => void }) {
  useTgBackButton(true, onClose);
  const [managerTgId, setManagerTgId] = useState<number | null>(null);
  const managers = useQuery({
    queryKey: ['managers', ids.join(',')],
    queryFn: () => api<ManagerDto[]>(`/managers?for=${ids.join(',')}`),
  });
  const notify = useMutation({
    mutationFn: () =>
      api<{ notified: number; skipped: number }>('/board/notify', { method: 'POST', body: { handoverIds: ids, managerTgId } }),
    onSuccess: (r) => {
      haptic.success();
      const m = managers.data?.find((x) => x.tgUserId === managerTgId);
      onDone(`🔔 ${m?.name ?? 'Менеджера'} сповіщено: ${contracts(r.notified)}`);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 pt-3 pb-2">
        <button type="button" onClick={onClose} className="h-10 rounded-lg px-2 text-accent">
          ← Назад
        </button>
        <h2 className="flex-1 text-center font-semibold">Кого сповістити?</h2>
        <span className="w-16" />
      </div>
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        <p className="text-sm text-hint">
          {contracts(ids.length)}. Перевірте в CRM відповідального менеджера — йому прийде повідомлення в боті з кнопкою «Забрати».
        </p>
        {managers.isLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {managers.isError && <ErrorNote>{errorMessage(managers.error)}</ErrorNote>}
        {managers.data?.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-center text-hint shadow-sm">
            Немає підтверджених менеджерів. Вони мають надіслати запит на доступ з посадою «Менеджер».
          </p>
        )}
        {(managers.data?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {managers.data!.map((m) => (
              <button
                key={m.tgUserId}
                type="button"
                onClick={() => setManagerTgId(m.tgUserId)}
                className={cx(
                  'flex min-h-14 w-full items-center justify-between gap-3 border-b border-separator px-4 py-2 text-left last:border-b-0',
                  managerTgId === m.tgUserId && 'bg-accent/10',
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{m.name}</span>
                  <span className="block text-xs text-hint">
                    {m.nickname}
                    {m.suggested > 0 && <span className="text-amber-700 dark:text-amber-300"> · 💡 уже відповідав за цього клієнта</span>}
                  </span>
                </span>
                {managerTgId === m.tgUserId && <span className="text-accent">✓</span>}
              </button>
            ))}
          </div>
        )}
        {notify.isError && <ErrorNote>{errorMessage(notify.error)}</ErrorNote>}
        <Button size="lg" className="w-full" disabled={!managerTgId} loading={notify.isPending} onClick={() => notify.mutate()}>
          Надіслати сповіщення
        </Button>
      </div>
    </div>
  );
}
