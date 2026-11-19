import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  STATUS_LABELS,
  type HandoverListResponse,
  type HandoverStatus,
  type Period,
} from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { fmtDay, isoDay, plural } from '../lib/format';
import { haptic } from '../lib/telegram';
import { HandoverCard } from '../components/HandoverCard';
import { AdminOnPost } from './AdminOnPost';
import { DecisionActions } from '../components/DecisionActions';
import { Button, ErrorNote, Segmented, Spinner, cx } from '../components/ui';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Сьогодні' },
  { value: 'yesterday', label: 'Вчора' },
  { value: 'week', label: 'Тиждень' },
  { value: 'range', label: 'Період' },
];
const STATUS_FILTERS: HandoverStatus[] = ['pending', 'received', 'with_manager', 'legal', 'rejected'];

type View = 'post' | 'history';
const VIEW_KEY = 'journal-view';

/** Адмін: «На посту» (робочий екран) та «Історія» (періоди, звіти). */
export function JournalPage() {
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'history' ? 'history' : 'post';
    } catch {
      return 'post';
    }
  });
  const change = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-3">
      <Segmented
        options={[
          { value: 'post', label: '📍 На посту' },
          { value: 'history', label: '🗂 Історія' },
        ]}
        value={view}
        onChange={change}
      />
      {view === 'post' ? <AdminOnPost /> : <HistoryView />}
    </div>
  );
}

function HistoryView() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [from, setFrom] = useState(isoDay());
  const [to, setTo] = useState(isoDay());
  const [status, setStatus] = useState<HandoverStatus | ''>('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const params = new URLSearchParams({ period });
  if (period === 'range') {
    params.set('from', from);
    params.set('to', to);
  }
  if (status) params.set('status', status);
  if (search.trim()) params.set('q', search.trim());

  const list = useQuery({
    queryKey: ['journal', params.toString()],
    queryFn: () => api<HandoverListResponse>(`/handovers?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const exportCsv = useMutation({
    mutationFn: () =>
      api<{ count: number }>('/handovers/export', {
        method: 'POST',
        body: Object.fromEntries(params),
      }),
    onSuccess: (r) => {
      haptic.success();
      setToast(`Файл (${r.count} ${plural(r.count, 'запис', 'записи', 'записів')}) надіслано вам у чат з ботом`);
      setTimeout(() => setToast(null), 4000);
    },
    onError: (e) => setToast(errorMessage(e)),
  });

  const data = list.data;
  return (
    <div className="space-y-3">
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      {period === 'range' && (
        <div className="grid grid-cols-2 gap-2">
          <DateInput label="З" value={from} onChange={setFrom} max={to} />
          <DateInput label="По" value={to} onChange={setTo} min={from} max={isoDay()} />
          <p className="col-span-2 text-xs text-hint">
            Завершені договори (у менеджера, передано ЮВ, відмовлено) видаляються через 3 місяці.
          </p>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Пошук за номером або клієнтом"
        className="h-11 w-full rounded-xl border border-separator bg-card px-4 outline-none focus:border-accent"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={status === ''} onClick={() => setStatus('')}>
          Усі {data ? data.total : ''}
        </Chip>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)} highlight={s === 'pending' && !!data?.counts.pending}>
            {STATUS_LABELS[s]} {data?.counts[s] ?? 0}
          </Chip>
        ))}
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-hint">
          <span>
            {fmtDay(data.range.from)}
            {fmtDay(data.range.from) !== fmtDay(new Date(new Date(data.range.to).getTime() - 1)) &&
              ` – ${fmtDay(new Date(new Date(data.range.to).getTime() - 1))}`}
          </span>
          <Button size="sm" variant="ghost" onClick={() => exportCsv.mutate()} loading={exportCsv.isPending} disabled={!data.items.length}>
            📤 Звіт у Telegram
          </Button>
        </div>
      )}
      {toast && <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{toast}</p>}

      {list.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {list.isError && <ErrorNote>{errorMessage(list.error)}</ErrorNote>}
      {data && !data.items.length && <p className="py-12 text-center text-hint">Здач за цей період немає</p>}
      <div className={cx('space-y-3', list.isFetching && list.isPlaceholderData && 'opacity-60')}>
        {data?.items.map((h) => (
          <HandoverCard
            key={h.id}
            h={h}
            showSubmitter
            actions={h.status === 'pending' ? <DecisionActions h={h} onDone={() => qc.invalidateQueries({ queryKey: ['journal'] })} /> : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({ active, highlight, onClick, children }: { active: boolean; highlight?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'h-8 shrink-0 rounded-full px-3 text-sm font-medium whitespace-nowrap',
        active ? 'bg-accent text-accent-text' : 'bg-card text-text shadow-sm',
        highlight && !active && 'ring-2 ring-amber-500/60',
      )}
    >
      {children}
    </button>
  );
}

function DateInput({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl border border-separator bg-card px-3">
      <span className="text-sm text-hint">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent outline-none"
      />
    </label>
  );
}
