import { useCallback, useMemo, useState } from 'react';

/** Набір вибраних id; allowed — які id зараз можна вибирати (решта відкидаються). */
export function useSelection(allowed: string[]) {
  const [raw, setRaw] = useState<Set<string>>(() => new Set());
  const allowedSet = useMemo(() => new Set(allowed), [allowed]);
  const ids = useMemo(() => [...raw].filter((id) => allowedSet.has(id)), [raw, allowedSet]);
  const toggle = useCallback(
    (id: string) =>
      setRaw((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setRaw(new Set()), []);
  const setAll = useCallback((list: string[]) => setRaw(new Set(list)), []);
  return { ids, has: (id: string) => ids.includes(id), toggle, clear, setAll };
}
