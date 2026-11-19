import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessDto } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { confirmAsync, haptic, openTelegramLink } from '../lib/telegram';
import { Button, Card, ErrorNote, Spinner } from '../components/ui';

export const accessQuery = {
  queryKey: ['access'],
  queryFn: () => api<AccessDto[]>('/access'),
  refetchInterval: 20_000,
};

/** Адмін: запити на доступ від телефонів працівників. */
export function AccessPage() {
  const q = useQuery(accessQuery);
  if (q.isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  if (q.isError) return <ErrorNote>{errorMessage(q.error)}</ErrorNote>;

  const items = q.data!;
  const pending = items.filter((a) => a.status === 'pending').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const approved = items.filter((a) => a.status === 'approved');
  const rejected = items.filter((a) => a.status === 'rejected');

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-hint">Очікують підтвердження · {pending.length}</h2>
        {pending.length === 0 && <p className="rounded-2xl bg-card p-4 text-center text-hint shadow-sm">Нових запитів немає</p>}
        {pending.map((a) => (
          <PendingCard key={a.id} a={a} />
        ))}
      </section>

      {approved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">Підтверджені · {approved.length}</h2>
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {approved.map((a) => (
              <Row key={a.id} a={a} action="rejected" />
            ))}
          </div>
        </section>
      )}

      {rejected.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-hint">Відхилені · {rejected.length}</h2>
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {rejected.map((a) => (
              <Row key={a.id} a={a} action="approved" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function useDecision(a: AccessDto) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      api<AccessDto>(`/access/${a.id}/decision`, { method: 'POST', body: { decision } }),
    onSuccess: () => haptic.success(),
    onSettled: () => qc.invalidateQueries({ queryKey: ['access'] }),
  });
}

function Who({ a }: { a: AccessDto }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold">{a.nickname}</div>
      <div className="truncate text-sm text-hint">{a.tgName}</div>
    </div>
  );
}

function ChatButton({ a }: { a: AccessDto }) {
  if (!a.tgUsername) return null;
  return (
    <Button size="sm" variant="ghost" onClick={() => openTelegramLink(`https://t.me/${a.tgUsername}`)}>
      💬 Написати
    </Button>
  );
}

function PendingCard({ a }: { a: AccessDto }) {
  const decide = useDecision(a);
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Who a={a} />
        <span className="shrink-0 text-xs text-hint">{fmtDateTime(a.requestedAt)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-hint">Telegram ID: {a.tgUserId}</span>
        <ChatButton a={a} />
      </div>
      <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
        Працівник має написати вам особисто з акаунта {a.nickname}. Підтверджуйте, лише коли переконались, що це він.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="success" loading={decide.isPending && decide.variables === 'approved'} onClick={() => decide.mutate('approved')}>
          ✅ Підтвердити
        </Button>
        <Button variant="danger" loading={decide.isPending && decide.variables === 'rejected'} onClick={() => decide.mutate('rejected')}>
          ❌ Відхилити
        </Button>
      </div>
      {decide.isError && <ErrorNote>{errorMessage(decide.error)}</ErrorNote>}
    </Card>
  );
}

function Row({ a, action }: { a: AccessDto; action: 'approved' | 'rejected' }) {
  const decide = useDecision(a);
  return (
    <div className="flex items-center gap-3 border-b border-separator px-4 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Who a={a} />
      </div>
      <ChatButton a={a} />
      <Button
        size="sm"
        variant={action === 'rejected' ? 'danger' : 'secondary'}
        loading={decide.isPending}
        onClick={async () => {
          if (action === 'rejected' && !(await confirmAsync(`Закрити доступ для «${a.nickname}»?`))) return;
          decide.mutate(action);
        }}
      >
        {action === 'rejected' ? 'Закрити доступ' : 'Підтвердити'}
      </Button>
    </div>
  );
}
