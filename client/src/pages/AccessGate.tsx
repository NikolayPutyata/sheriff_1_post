import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nicknameSchema, type AccessDto, type MeResponse } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { haptic } from '../lib/telegram';
import { Button, Card, ErrorNote } from '../components/ui';

/** Екран верифікації: телефон охоронника спершу надсилає адміну запит з нікнеймом. */
export function AccessGate({ me, onRefresh, refreshing }: { me: MeResponse; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-8">
      {me.access === 'none' && <RequestForm me={me} />}
      {me.access === 'pending' && (
        <Card className="space-y-3 text-center">
          <div className="text-5xl">⏳</div>
          <h1 className="text-xl font-semibold">Запит надіслано</h1>
          <p className="text-hint">
            Нікнейм: <b className="text-text">{me.nickname}</b>
          </p>
          <p className="text-hint">Адміністратор перевірить і підтвердить доступ. Бот надішле вам повідомлення.</p>
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

function RequestForm({ me }: { me: MeResponse }) {
  const qc = useQueryClient();
  const [nickname, setNickname] = useState(me.user.username ? `@${me.user.username}` : '');
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
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setError(null);
    send.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2 text-center">
        <div className="text-5xl">🔐</div>
        <h1 className="text-xl font-semibold">Верифікація</h1>
        <p className="text-hint">
          Щоб користуватися журналом, надішліть адміністратору запит на доступ. Вкажіть нікнейм, за яким він вас
          впізнає.
        </p>
      </div>
      <Card className="space-y-2">
        <label htmlFor="nickname" className="block text-sm text-hint">
          Ваш нікнейм
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={40}
          autoComplete="nickname"
          placeholder="Напр. Сокіл або @petro"
          className="h-12 w-full rounded-xl border border-separator bg-card px-4 text-lg outline-none focus:border-accent"
        />
        <p className="text-xs text-hint">
          Адміністратор також побачить ваше ім’я в Telegram: {me.user.firstName}
          {me.user.username && ` (@${me.user.username})`}
        </p>
      </Card>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" size="lg" className="w-full" loading={send.isPending}>
        Надіслати запит
      </Button>
    </form>
  );
}
