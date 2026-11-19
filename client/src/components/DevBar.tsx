import { useQueryClient } from '@tanstack/react-query';
import { getDevUserId, setDevUserId } from '../lib/api';

/** Лише в режимі розробки поза Telegram: перемикання користувача (сервер з DEV_AUTH=true). */
const USERS = [
  { id: '1000', label: 'Адмін (1000)' },
  { id: '2001', label: 'Працівник 2001' },
  { id: '2002', label: 'Працівник 2002' },
  { id: '3000', label: 'Планшет (3000)' },
  { id: '4004', label: 'Новий телефон 4004' },
  { id: '5005', label: 'Менеджер 5005' },
  { id: '5006', label: 'Менеджер 5006' },
];

export function DevBar() {
  const qc = useQueryClient();
  return (
    <div className="flex items-center gap-2 bg-amber-400 px-3 py-1 text-xs text-black">
      <b>DEV</b>
      <select
        defaultValue={getDevUserId()}
        onChange={(e) => {
          setDevUserId(e.target.value);
          qc.resetQueries();
        }}
        className="rounded bg-white/70 px-1"
      >
        {USERS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
      <span>(поза Telegram, DEV_AUTH)</span>
    </div>
  );
}
