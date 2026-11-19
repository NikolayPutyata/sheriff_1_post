import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fullNameSchema,
  ROLE_LABELS,
  telegramUsernameSchema,
  type AccessDto,
  type MeResponse,
  type Role,
} from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { haptic } from '../lib/telegram';
import { Button, Card, ErrorNote, cx } from '../components/ui';

/**
 * Верифікація нового телефона: працівник вводить свій нікнейм з Telegram і надсилає запит,
 * потім пише адміну особисто — адмін вручну підтверджує доступ.
 */
export function AccessGate({ me, onRefresh, refreshing }: { me: MeResponse; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-8">
      {me.access === 'none' && (me.user.username ? <RequestForm me={me} /> : <NoUsername />)}
      {me.access === 'pending' && (
        <Card className="space-y-3 text-center">
          <div className="text-5xl">⏳</div>
          <h1 className="text-xl font-semibold">Запит надіслано</h1>
          <div className="rounded-xl bg-bg p-3 text-left text-sm">
            {me.fullName && (
              <div className="flex justify-between gap-3 py-0.5">
                <span className="text-hint">ПІБ</span>
                <b>{me.fullName}</b>
              </div>
            )}
            {me.role && (me.role === 'worker' || me.role === 'manager') && (
              <div className="flex justify-between gap-3 py-0.5">
                <span className="text-hint">Посада</span>
                <b>{ROLE_LABELS[me.role]}</b>
              </div>
            )}
            <div className="flex justify-between gap-3 py-0.5">
              <span className="text-hint">Нікнейм</span>
              <b>{me.nickname}</b>
            </div>
          </div>
          <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-text">
            👉 Тепер <b>напишіть адміністратору особисто</b> в Telegram з цього акаунта, що це ви. Після перевірки він
            підтвердить доступ, а бот надішле вам повідомлення.
          </p>
          <Button variant="secondary" className="w-full" onClick={onRefresh} loading={refreshing}>
            Перевірити ще раз
          </Button>
        </Card>
      )}
      {me.access === 'rejected' && (
        <Card className="space-y-3 text-center">
          <div className="text-5xl">⛔</div>
          <h1 className="text-xl font-semibold">Доступ відхилено</h1>
          <p className="text-hint">Якщо це помилка — зверніться до адміністратора особисто.</p>
        </Card>
      )}
    </div>
  );
}

function NoUsername() {
  return (
    <Card className="space-y-3 text-center">
      <div className="text-5xl">🪪</div>
      <h1 className="text-xl font-semibold">Потрібен нікнейм у Telegram</h1>
      <p className="text-hint">
        Для верифікації потрібне ім’я користувача (нікнейм) у Telegram — за ним адміністратор вас впізнає.
      </p>
      <ol className="space-y-1 rounded-xl bg-bg p-3 text-left text-sm">
        <li>1. Telegram → Налаштування → «Ім’я користувача».</li>
        <li>2. Задайте нікнейм і збережіть.</li>
        <li>3. Закрийте журнал і відкрийте його знову через бота.</li>
      </ol>
    </Card>
  );
}

function RequestForm({ me }: { me: MeResponse }) {
  const qc = useQueryClient();
  const [nickname, setNickname] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (body: { nickname: string; fullName: string; role: Role }) =>
      api<AccessDto>('/access/request', { method: 'POST', body }),
    onSuccess: () => {
      haptic.success();
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => {
      haptic.error();
      setError(errorMessage(e));
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = telegramUsernameSchema.safeParse(nickname);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    if (parsed.data.toLowerCase() !== me.user.username!.toLowerCase()) {
      return setError('Нікнейм не збігається з вашим у Telegram. Перевірте: Налаштування → Ім’я користувача.');
    }
    const name = fullNameSchema.safeParse(fullName);
    if (!name.success) return setError(name.error.issues[0]!.message);
    if (!role) return setError('Оберіть посаду');
    setError(null);
    send.mutate({ nickname: parsed.data, fullName: name.data, role });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2 text-center">
        <div className="text-5xl">🔐</div>
        <h1 className="text-xl font-semibold">Верифікація</h1>
        <p className="text-hint">
          Щоб користуватися журналом, надішліть адміністратору запит на доступ зі своїм нікнеймом з Telegram.
        </p>
      </div>
      <Card className="space-y-2">
        <label htmlFor="nickname" className="block text-sm text-hint">
          Ваш нікнейм у Telegram
        </label>
        <div className="flex h-12 items-center rounded-xl border border-separator bg-card px-4 focus-within:border-accent">
          <span className="text-lg text-hint">@</span>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.replace(/^@/, ''))}
            maxLength={33}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="nickname"
            className="h-full min-w-0 flex-1 bg-transparent pl-0.5 text-lg outline-none"
          />
        </div>
        <p className="text-xs text-hint">Саме той, що в Telegram: Налаштування → «Ім’я користувача».</p>
      </Card>
      <Card className="space-y-2">
        <label htmlFor="fullName" className="block text-sm text-hint">
          Прізвище, ім’я та по батькові
        </label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Іваненко Петро Олегович"
          className="h-12 w-full rounded-xl border border-separator bg-card px-4 text-lg outline-none focus:border-accent"
        />
        <p className="text-xs text-hint">Пишіть уважно — так вас бачитимуть у журналі.</p>
      </Card>
      <Card className="space-y-2">
        <span className="block text-sm text-hint">Посада</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Посада">
          {(['worker', 'manager'] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={cx(
                'min-h-12 rounded-xl border px-3 py-2 text-sm font-medium transition',
                role === r ? 'border-accent bg-accent text-accent-text' : 'border-separator bg-card',
              )}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </Card>
      <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm">
        Після надсилання <b>напишіть адміністратору особисто</b> з цього акаунта — так він переконається, що це ви.
      </p>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" size="lg" className="w-full" loading={send.isPending}>
        Надіслати запит
      </Button>
    </form>
  );
}
