import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clientNameSchema,
  CLIENT_NAME_MAX_LENGTH,
  contractNumberSchema,
  normalizeContractNumber,
  CONTRACT_MAX_LENGTH,
  type CreateHandoverResponse,
  type GuardDto,
  type MeResponse,
} from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { haptic } from '../lib/telegram';
import { GuardPicker } from '../components/GuardPicker';
import { Button, Card, ErrorNote, Spinner } from '../components/ui';

const KIOSK_RESET_SEC = 10;

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function SubmitPage({ me }: { me: MeResponse }) {
  const qc = useQueryClient();
  // спільний пристрій: адмінський планшет або акаунт з KIOSK_TG_IDS
  const shared = me.isAdmin || me.isKiosk;
  const guards = useQuery({ queryKey: ['guards'], queryFn: () => api<GuardDto[]>('/guards') });

  const [number, setNumber] = useState('');
  const [client, setClient] = useState('');
  const [guardId, setGuardId] = useState<string | null>(me.ownGuard?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CreateHandoverResponse | null>(null);
  const now = useNow();

  useEffect(() => {
    if (!guardId && me.ownGuard) setGuardId(me.ownGuard.id);
  }, [me.ownGuard, guardId]);

  const submit = useMutation({
    mutationFn: (body: { contractNumber: string; clientName: string; guardId: string }) =>
      api<CreateHandoverResponse>('/handovers', { method: 'POST', body }),
    onSuccess: (res) => {
      haptic.success();
      setDone(res);
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['journal'] });
    },
    onError: (e) => {
      haptic.error();
      setError(errorMessage(e));
    },
  });

  function reset() {
    setDone(null);
    setNumber('');
    setClient('');
    setError(null);
    if (shared) setGuardId(null); // наступний працівник обирає себе сам
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contractNumberSchema.safeParse(number);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    const clientParsed = clientNameSchema.safeParse(client);
    if (!clientParsed.success) return setError(clientParsed.error.issues[0]!.message);
    if (!guardId) return setError('Оберіть себе зі списку');
    setError(null);
    submit.mutate({ contractNumber: parsed.data, clientName: clientParsed.data, guardId });
  }

  if (done) return <SuccessView res={done} shared={shared} onNext={reset} />;

  const normalized = normalizeContractNumber(number);
  const addMode = me.isAdmin ? 'admin' : me.canAddGuard ? 'self' : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="num" className="block text-sm text-hint">
            Номер договору
          </label>
          <input
            id="num"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            maxLength={CONTRACT_MAX_LENGTH + 10}
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="done"
            placeholder="Напр. 123/45"
            className="h-14 w-full rounded-xl border border-separator bg-card px-4 text-xl font-semibold tracking-wide outline-none focus:border-accent"
          />
          {number.trim() && normalized !== number.trim() && <p className="text-xs text-hint">Буде записано як: {normalized}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="client" className="block text-sm text-hint">
            Повне найменування клієнта
          </label>
          <textarea
            id="client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            maxLength={CLIENT_NAME_MAX_LENGTH + 20}
            rows={2}
            autoComplete="off"
            autoCapitalize="sentences"
            placeholder="Напр. ТОВ «Альфа-Сервіс» або ФОП Іваненко Петро Олегович"
            className="w-full resize-none rounded-xl border border-separator bg-card px-4 py-3 text-base leading-snug outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm text-hint">Працівник</span>
          {guards.isLoading ? (
            <div className="flex h-14 items-center justify-center">
              <Spinner />
            </div>
          ) : guards.isError ? (
            <ErrorNote>{errorMessage(guards.error)}</ErrorNote>
          ) : (
            <GuardPicker guards={guards.data!} value={guardId} onChange={setGuardId} addMode={addMode} />
          )}
          {me.isKiosk && <p className="text-xs text-hint">Немає у списку? Додайте себе зі свого телефона або зверніться до адміністратора.</p>}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-bg px-4 py-3 text-sm">
          <span className="text-hint">Дата здачі</span>
          <span className="font-medium">{fmtDateTime(now)}</span>
        </div>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      <Button type="submit" size="lg" className="w-full" loading={submit.isPending}>
        Здав
      </Button>
      <p className="text-center text-xs text-hint">Дата і час фіксуються автоматично в момент натискання.</p>
    </form>
  );
}

function SuccessView({ res, shared, onNext }: { res: CreateHandoverResponse; shared: boolean; onNext: () => void }) {
  const [left, setLeft] = useState(KIOSK_RESET_SEC);
  useEffect(() => {
    if (!shared) return;
    if (left <= 0) return onNext();
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [shared, left, onNext]);

  const h = res.handover;
  return (
    <div className="space-y-4">
      <Card className="space-y-3 text-center">
        <div className="text-5xl">📨</div>
        <h2 className="text-xl font-semibold">Передано адміністратору</h2>
        <p className="text-hint">Очікує підтвердження після перевірки паперового примірника.</p>
        <div className="rounded-xl bg-bg p-3 text-left text-sm">
          <Row k="Заявка" v={`№${h.seq}`} />
          <Row k="Договір" v={h.contractNumber} />
          {h.clientName && <Row k="Клієнт" v={h.clientName} />}
          <Row k="Працівник" v={h.guardName} />
          <Row k="Здано" v={fmtDateTime(h.submittedAt)} />
        </div>
        {res.duplicates > 0 && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Цей номер договору вже здавали раніше — адміністратор побачить попередження.
          </p>
        )}
        {!shared && <p className="text-sm text-hint">Результат перевірки прийде вам повідомленням від бота.</p>}
      </Card>
      <Button size="lg" variant="secondary" className="w-full" onClick={onNext}>
        Здати ще один договір{shared && ` (${left})`}
      </Button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-hint">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
