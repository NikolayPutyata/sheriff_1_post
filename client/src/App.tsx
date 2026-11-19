import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@journal/shared';
import { api, ApiError, errorMessage } from './lib/api';
import { inTelegram } from './lib/telegram';
import { Button, FullScreenMessage, Spinner, cx } from './components/ui';
import { DevBar } from './components/DevBar';
import { SubmitPage } from './pages/SubmitPage';
import { MinePage } from './pages/MinePage';
import { JournalPage } from './pages/JournalPage';
import { GuardsPage } from './pages/GuardsPage';
import { AccessGate } from './pages/AccessGate';
import { AccessPage, accessQuery } from './pages/AccessPage';
import { ManagerBoard, ManagerMine } from './pages/ManagerPages';

type Tab = 'submit' | 'mine' | 'journal' | 'guards' | 'access' | 'board' | 'taken';
const TAB_LABELS: Record<Tab, string> = {
  submit: 'Здати',
  mine: 'Мої здачі',
  journal: 'Журнал',
  guards: 'Працівники',
  access: 'Доступи',
  board: '📍 На посту',
  taken: '📦 Мої',
};
const TAB_KEY = 'last-tab';

function tabsFor(me: MeResponse): Tab[] {
  if (me.isAdmin) return ['submit', 'journal', 'guards', 'access'];
  if (me.isKiosk) return ['submit'];
  if (me.role === 'manager') return ['board', 'taken'];
  return ['submit', 'mine'];
}

function whoLabel(me: MeResponse) {
  if (me.isAdmin) return '🛡 Адміністратор';
  if (me.isKiosk) return '📟 Планшет';
  if (me.role === 'manager') return `💼 ${me.fullName ?? 'Менеджер'}`;
  return me.ownGuard?.fullName ?? me.fullName ?? me.user.firstName;
}

export function App() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/me'),
    // поки запит на доступ чекає — періодично перевіряємо, чи адмін уже підтвердив
    refetchInterval: (q) => (q.state.data?.access === 'pending' ? 15_000 : false),
  });
  const showDev = import.meta.env.DEV && !inTelegram;

  return (
    <div className="min-h-dvh">
      {showDev && <DevBar />}
      {me.isLoading ? (
        <div className="flex min-h-dvh items-center justify-center text-hint">
          <Spinner />
        </div>
      ) : me.isError ? (
        <FullScreenMessage
          icon={(me.error as ApiError).status === 401 ? '🔒' : '⚠️'}
          title={(me.error as ApiError).status === 401 ? 'Відкрийте через Telegram' : 'Не вдалося завантажити'}
          text={errorMessage(me.error)}
          action={<Button onClick={() => me.refetch()}>Спробувати ще раз</Button>}
        />
      ) : me.data!.access !== 'approved' ? (
        <AccessGate me={me.data!} onRefresh={() => me.refetch()} refreshing={me.isFetching} />
      ) : (
        <Shell me={me.data!} />
      )}
    </div>
  );
}

function Shell({ me }: { me: MeResponse }) {
  const tabs = tabsFor(me);
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && tabs.includes(saved)) return saved;
    } catch {
      /* ignore */
    }
    return tabs[0]!;
  });
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);
  const current = tabs.includes(tab) ? tab : tabs[0]!;
  const access = useQuery({ ...accessQuery, enabled: me.isAdmin });
  const pendingAccess = access.data?.filter((a) => a.status === 'pending').length ?? 0;

  return (
    <>
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pt-3 pb-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h1 className="text-lg font-bold">Журнал договорів</h1>
            <span className="truncate pl-3 text-xs text-hint">
              {whoLabel(me)}
            </span>
          </div>
          {tabs.length > 1 && (
            <nav className="flex gap-1 rounded-xl bg-card p-1 shadow-sm">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cx(
                    'h-9 flex-1 rounded-lg text-sm font-medium transition',
                    current === t ? 'bg-accent text-accent-text' : 'text-hint',
                  )}
                >
                  {TAB_LABELS[t]}
                  {t === 'access' && pendingAccess > 0 && (
                    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs text-white">
                      {pendingAccess}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-2 pb-10">
        {current === 'submit' && <SubmitPage me={me} />}
        {current === 'mine' && <MinePage />}
        {current === 'journal' && <JournalPage />}
        {current === 'guards' && <GuardsPage />}
        {current === 'access' && <AccessPage />}
        {current === 'board' && <ManagerBoard me={me} />}
        {current === 'taken' && <ManagerMine />}
      </main>
    </>
  );
}
