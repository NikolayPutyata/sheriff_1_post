import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fullNameSchema, ROLE_LABELS, type AccessDto, type Role } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { confirmAsync, haptic, openTelegramLink } from '../lib/telegram';
import { Button, Card, ErrorNote, Spinner, cx } from '../components/ui';

export const accessQuery = {
  queryKey: ['access'],
  queryFn: () => api<AccessDto[]>('/access'),
  refetchInterval: 20_000,
};

/** Адмін: запити на доступ від телефонів працівників і менеджерів. */
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
  const managers = approved.filter((a) => a.role === 'manager');
  const workers = approved.filter((a) => a.role !== 'manager');
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

      <Group title="Менеджери" items={managers} action="rejected" />
      <Group title="Інженери/охоронники" items={workers} action="rejected" />
      <Group title="Відхилені" items={rejected} action="approved" />
    </div>
  );
}

function Group({ title, items, action }: { title: string; items: AccessDto[]; action: 'approved' | 'rejected' }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-hint">
        {title} · {items.length}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {items.map((a) => (
          <Row key={a.id} a={a} action={action} />
        ))}
      </div>
    </section>
  );
}

function useAccessMutations(a: AccessDto) {
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const onDone = (res: AccessDto) => {
    haptic.success();
    setNotice(
      res.linkConflict
        ? `ПІБ «${res.linkConflict}» у списку працівників уже прив’язане до іншого акаунта — перевірте у вкладці «Працівники».`
        : null,
    );
    qc.invalidateQueries({ queryKey: ['access'] });
    qc.invalidateQueries({ queryKey: ['guards'] });
  };
  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      api<AccessDto>(`/access/${a.id}/decision`, { method: 'POST', body: { decision } }),
    onSuccess: onDone,
    onError: () => qc.invalidateQueries({ queryKey: ['access'] }),
  });
  const update = useMutation({
    mutationFn: (body: { fullName?: string; role?: Role }) => api<AccessDto>(`/access/${a.id}`, { method: 'PATCH', body }),
    onSuccess: onDone,
  });
  return { decide, update, notice };
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
        role === 'manager' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300' : 'bg-accent/10 text-accent',
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function Who({ a }: { a: AccessDto }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="font-semibold break-words">{a.fullName ?? a.tgName}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-hint">
        <RoleBadge role={a.role} />
        <span className="truncate">{a.nickname}</span>
      </div>
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

type UpdateMutation = ReturnType<typeof useAccessMutations>['update'];

function EditForm({ a, update, onClose }: { a: AccessDto; update: UpdateMutation; onClose: () => void }) {
  const [fullName, setFullName] = useState(a.fullName ?? '');
  const [role, setRole] = useState<Role>(a.role);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        const name = fullNameSchema.safeParse(fullName);
        if (!name.success) return setError(name.error.issues[0]!.message);
        setError(null);
        update.mutate({ fullName: name.data, role }, { onSuccess: onClose });
      }}
    >
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        aria-label="ПІБ"
        placeholder="Прізвище Ім’я По батькові"
        className="h-10 w-full rounded-lg border border-separator bg-card px-3 outline-none focus:border-accent"
      />
      <div className="grid grid-cols-2 gap-2">
        {(['worker', 'manager'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={cx(
              'h-9 rounded-lg border text-sm font-medium',
              role === r ? 'border-accent bg-accent text-accent-text' : 'border-separator',
            )}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={update.isPending}>
          Зберегти
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Скасувати
        </Button>
      </div>
      <ErrorNote>{error ?? (update.isError ? errorMessage(update.error) : null)}</ErrorNote>
    </form>
  );
}

function PendingCard({ a }: { a: AccessDto }) {
  const { decide, update, notice } = useAccessMutations(a);
  const [editing, setEditing] = useState(false);
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Who a={a} />
        <span className="shrink-0 text-xs text-hint">{fmtDateTime(a.requestedAt)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-hint">
          {a.tgName} · ID {a.tgUserId}
        </span>
        <div className="flex shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            ✏️
          </Button>
          <ChatButton a={a} />
        </div>
      </div>
      {editing && <EditForm a={a} update={update} onClose={() => setEditing(false)} />}
      <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
        Має написати вам особисто з акаунта {a.nickname}. Підтверджуйте, лише коли переконались, що це він.
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
      {notice && <ErrorNote>{notice}</ErrorNote>}
    </Card>
  );
}

function Row({ a, action }: { a: AccessDto; action: 'approved' | 'rejected' }) {
  const { decide, update, notice } = useAccessMutations(a);
  const [editing, setEditing] = useState(false);
  return (
    <div className="border-b border-separator px-4 py-2.5 last:border-b-0">
      <Who a={a} />
      <div className="mt-1.5 flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} aria-label="Змінити ПІБ або посаду">
          ✏️
        </Button>
        <ChatButton a={a} />
        <Button
          size="sm"
          variant={action === 'rejected' ? 'danger' : 'secondary'}
          loading={decide.isPending}
          onClick={async () => {
            if (action === 'rejected' && !(await confirmAsync(`Закрити доступ для «${a.fullName ?? a.nickname}»?`))) return;
            decide.mutate(action);
          }}
        >
          {action === 'rejected' ? 'Закрити' : 'Підтвердити'}
        </Button>
      </div>
      {editing && <EditForm a={a} update={update} onClose={() => setEditing(false)} />}
      {notice && <ErrorNote>{notice}</ErrorNote>}
    </div>
  );
}
