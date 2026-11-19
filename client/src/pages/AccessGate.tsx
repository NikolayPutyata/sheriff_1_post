import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { telegramUsernameSchema, type AccessDto, type MeResponse } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { haptic } from '../lib/telegram';
import { Button, Card, ErrorNote } from '../components/ui';

/**
 * Верифікація нового телефона: охоронник вводить свій нікнейм з Telegram і надсилає запит,
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
          <p className="text-hint">
            Ваш нікнейм: <b className="text-text">{me.nickname}</b>
          </p>
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
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (value: string) => api<AccessDto>('/access/request', { method: 'POST', body: { nickname: value } }),
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
    setError(null);
    send.mutate(parsed.data);
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
