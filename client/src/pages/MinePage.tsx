import { useQuery } from '@tanstack/react-query';
import type { HandoverDto } from '@journal/shared';
import { api, errorMessage } from '../lib/api';
import { HandoverCard } from '../components/HandoverCard';
import { ErrorNote, Spinner } from '../components/ui';

export function MinePage() {
  const q = useQuery({
    queryKey: ['mine'],
    queryFn: () => api<HandoverDto[]>('/handovers/mine'),
    refetchInterval: 20_000,
  });
  if (q.isLoading) return <Center><Spinner /></Center>;
  if (q.isError) return <ErrorNote>{errorMessage(q.error)}</ErrorNote>;
  if (!q.data!.length) return <Center><p className="text-hint">За останні 14 днів здач немає.</p></Center>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-hint">Ваші здачі за останні 14 днів</p>
      {q.data!.map((h) => (
        <HandoverCard key={h.id} h={h} />
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-center py-16">{children}</div>;
}
