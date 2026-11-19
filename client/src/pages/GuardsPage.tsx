import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fullNameSchema, type GuardDto } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { confirmAsync, haptic } from '../lib/telegram';
import { Button, Card, ErrorNote, Spinner, cx } from '../components/ui';

export function GuardsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['guards', 'all'], queryFn: () => api<GuardDto[]>('/guards?all=1') });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['guards'] });

  const add = useMutation({
    mutationFn: (fullName: string) => api<GuardDto>('/guards', { method: 'POST', body: { fullName } }),
    onSuccess: () => {
      haptic.success();
      setName('');
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const p = fullNameSchema.safeParse(name);
    if (!p.success) return setError(p.error.issues[0]!.message);
    setError(null);
    add.mutate(p.data);
  }

  const active = q.data?.filter((g) => g.isActive) ?? [];
  const inactive = q.data?.filter((g) => !g.isActive) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={onAdd} className="space-y-2">
          <label htmlFor="newGuard" className="block text-sm text-hint">
            Додати охоронника (напр. для того, хто здає лише через планшет)
          </label>
          <div className="flex gap-2">
            <input
              id="newGuard"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Прізвище Ім’я По батькові"
              className="h-11 min-w-0 flex-1 rounded-xl border border-separator bg-card px-3 outline-none focus:border-accent"
            />
            <Button type="submit" loading={add.isPending}>
              Додати
            </Button>
          </div>
          <ErrorNote>{error}</ErrorNote>
        </form>
      </Card>

      {q.isLoading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {q.isError && <ErrorNote>{errorMessage(q.error)}</ErrorNote>}

      {q.data && (
        <>
          <p className="text-sm text-hint">
            Активні: {active.length} · 🔗 — прив’язаний Telegram (додав себе сам)
          </p>
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {active.map((g) => (
              <GuardRow key={g.id} g={g} onChanged={refresh} />
            ))}
          </div>
          {inactive.length > 0 && (
            <>
              <p className="pt-2 text-sm text-hint">Деактивовані (не показуються у списку для здачі)</p>
              <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
                {inactive.map((g) => (
                  <GuardRow key={g.id} g={g} onChanged={refresh} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function GuardRow({ g, onChanged }: { g: GuardDto; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(g.fullName);
  const patch = useMutation({
    mutationFn: (body: { fullName?: string; isActive?: boolean }) => api<GuardDto>(`/guards/${g.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  if (editing) {
    return (
      <form
        className="space-y-2 border-b border-separator p-3 last:border-b-0"
        onSubmit={(e) => {
          e.preventDefault();
          patch.mutate({ fullName: name });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-10 w-full rounded-lg border border-separator bg-card px-3 outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={patch.isPending}>
            Зберегти
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Скасувати
          </Button>
        </div>
        {patch.isError && <ErrorNote>{errorMessage(patch.error)}</ErrorNote>}
      </form>
    );
  }

  return (
    <div className={cx('flex items-center gap-2 border-b border-separator px-4 py-2 last:border-b-0', !g.isActive && 'opacity-60')}>
      <span className="min-w-0 flex-1 py-1 leading-snug break-words">
        {g.fullName} {g.hasTelegram && <span title="Прив’язаний Telegram">🔗</span>}
      </span>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Змінити
      </Button>
      <Button
        size="sm"
        variant={g.isActive ? 'danger' : 'secondary'}
        loading={patch.isPending}
        onClick={async () => {
          if (g.isActive && !(await confirmAsync(`Деактивувати «${g.fullName}»? Історія здач збережеться.`))) return;
          patch.mutate({ isActive: !g.isActive });
        }}
      >
        {g.isActive ? 'Вимкнути' : 'Увімкнути'}
      </Button>
    </div>
  );
}
