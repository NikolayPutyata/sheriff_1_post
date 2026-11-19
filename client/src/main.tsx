import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ApiError } from './lib/api';
import { applyColorScheme, initTelegram } from './lib/telegram';
import './index.css';

initTelegram();
applyColorScheme();

const onApiError = (err: unknown) => {
  if (err instanceof ApiError && err.code === 'access_required') queryClient.invalidateQueries({ queryKey: ['me'] });
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      // 4xx (немає доступу, помилка вводу) не повторюємо; мережеві/5xx — до 2 разів
      retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
      staleTime: 10_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
