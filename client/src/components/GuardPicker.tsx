import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fullNameSchema, normalizeFullName, type GuardDto } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { haptic, useTgBackButton } from '../lib/telegram';
import { Button, ErrorNote, cx } from './ui';

const collator = new Intl.Collator('uk');
const searchKey = (s: string) => s.toLocaleLowerCase('uk-UA').replace(/['’ʼ`]/g, '');

interface Props {
  guards: GuardDto[];
  value: string | null;
  onChange: (id: string) => void;
  /** null — додавання недоступне; 'self' — себе (один раз); 'admin' — будь-кого */
  addMode: 'self' | 'admin' | null;
}

export function GuardPicker({ guards, value, onChange, addMode }: Props) {
  const [open, setOpen] = useState(false);
  const selected = guards.find((g) => g.id === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          'flex h-14 w-full items-center justify-between rounded-xl border border-separator bg-card px-4 text-left',
          !selected && 'text-hint',
        )}
      >
        <span className="truncate text-base">{selected ? selected.fullName : 'Оберіть себе зі списку'}</span>
        <span className="text-hint">▾</span>
      </button>
      {open &&
        createPortal(
        <GuardSheet
          guards={guards}
          value={value}
          addMode={addMode}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            haptic.tap();
            onChange(id);
            setOpen(false);
          }}
        />,
          document.body,
        )}
    </>
  );
}

function GuardSheet({
  guards,
  value,
  addMode,
  onClose,
  onPick,
}: {
  guards: GuardDto[];
  value: string | null;
  addMode: Props['addMode'];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const back = useCallback(() => (adding ? setAdding(false) : onClose()), [adding, onClose]);
  useTgBackButton(true, back);

  const groups = useMemo(() => {
    const k = searchKey(q.trim());
    const list = guards.filter((g) => !k || searchKey(g.fullName).includes(k)).sort((a, b) => collator.compare(a.fullName, b.fullName));
    const map = new Map<string, GuardDto[]>();
    for (const g of list) {
      const letter = g.fullName[0]!.toLocaleUpperCase('uk-UA');
      map.set(letter, [...(map.get(letter) ?? []), g]);
    }
    return [...map.entries()];
  }, [guards, q]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 pt-3 pb-2">
        <button type="button" onClick={back} className="h-10 rounded-lg px-2 text-accent">
          ← Назад
        </button>
        <h2 className="flex-1 text-center font-semibold">{adding ? (addMode === 'self' ? 'Додати себе' : 'Новий працівник') : 'Оберіть себе'}</h2>
        <span className="w-16" />
      </div>

      {adding && addMode ? (
        <AddGuardForm
          mode={addMode}
          onAdded={(g) => onPick(g.id)}
        />
      ) : (
        <>
          <div className="mx-auto w-full max-w-xl px-4 pb-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 Пошук за прізвищем"
              className="h-11 w-full rounded-xl border border-separator bg-card px-4 outline-none focus:border-accent"
            />
          </div>
          <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-4 pb-6">
            {addMode && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mb-3 flex h-12 w-full items-center gap-2 rounded-xl border border-dashed border-accent/50 px-4 font-medium text-accent"
              >
                ＋ {addMode === 'self' ? 'Мене немає у списку — додати себе' : 'Додати працівника'}
              </button>
            )}
            {groups.length === 0 && (
              <p className="py-10 text-center text-hint">{guards.length ? 'Нічого не знайдено' : 'Список поки порожній'}</p>
            )}
            {groups.map(([letter, items]) => (
              <section key={letter} className="mb-2">
                <div className="sticky top-0 bg-bg py-1 text-xs font-semibold text-hint">{letter}</div>
                <div className="overflow-hidden rounded-xl bg-card">
                  {items.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onPick(g.id)}
                      className={cx(
                        'flex min-h-12 w-full items-center justify-between border-b border-separator px-4 py-2 text-left last:border-b-0',
                        g.id === value && 'font-semibold text-accent',
                      )}
                    >
                      <span>{g.fullName}</span>
                      {g.id === value && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AddGuardForm({ mode, onAdded }: { mode: 'self' | 'admin'; onAdded: (g: GuardDto) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const preview = normalizeFullName(name);

  const add = useMutation({
    mutationFn: (fullName: string) => api<GuardDto>('/guards', { method: 'POST', body: { fullName } }),
    onSuccess: async (g) => {
      haptic.success();
      await Promise.all([qc.invalidateQueries({ queryKey: ['guards'] }), qc.invalidateQueries({ queryKey: ['me'] })]);
      onAdded(g);
    },
    onError: (e) => {
      haptic.error();
      setError(errorMessage(e));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // вікно рендериться через портал, але React-події спливають деревом компонентів — не даємо дійти до форми здачі
    e.stopPropagation();
    const parsed = fullNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setError(null);
    add.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl space-y-3 px-4">
      <label className="block text-sm text-hint" htmlFor="fullName">
        Прізвище, ім’я та по батькові
      </label>
      <input
        id="fullName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        autoComplete="name"
        autoCapitalize="words"
        placeholder="Іваненко Петро Олегович"
        className="h-12 w-full rounded-xl border border-separator bg-card px-4 outline-none focus:border-accent"
      />
      {name.trim() && preview !== name.trim() && <p className="text-sm text-hint">Буде збережено як: «{preview}»</p>}
      {mode === 'self' && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          ⚠️ Додати себе можна <b>лише один раз</b>. Перевірте ПІБ — виправити його зможе тільки адміністратор.
        </p>
      )}
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" size="lg" className="w-full" loading={add.isPending}>
        {mode === 'self' ? 'Додати себе' : 'Додати'}
      </Button>
    </form>
  );
}
