import { useEffect } from 'react';

/** Мінімальні типи Telegram WebApp API (скрипт telegram-web-app.js підключено в index.html). */
type Haptic = {
  notificationOccurred(t: 'error' | 'success' | 'warning'): void;
  impactOccurred(s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  selectionChanged(): void;
};

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string } };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  disableVerticalSwipes?(): void;
  onEvent(e: string, cb: () => void): void;
  offEvent(e: string, cb: () => void): void;
  showConfirm(message: string, cb: (ok: boolean) => void): void;
  HapticFeedback: Haptic;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp };
  }
}

export const tg: TgWebApp | undefined = window.Telegram?.WebApp;
/** Відкрито всередині Telegram (є підписані дані користувача). */
export const inTelegram = !!tg?.initData;

export function initTelegram() {
  if (!tg || !inTelegram) return;
  tg.ready();
  tg.expand();
  // щоб прокрутка списку не закривала застосунок
  if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.();
}

export function applyColorScheme() {
  const set = () => {
    const dark = inTelegram ? tg!.colorScheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  };
  set();
  if (inTelegram) tg!.onEvent('themeChanged', set);
  else window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', set);
}

export const haptic = {
  success: () => inTelegram && tg!.isVersionAtLeast('6.1') && tg!.HapticFeedback.notificationOccurred('success'),
  error: () => inTelegram && tg!.isVersionAtLeast('6.1') && tg!.HapticFeedback.notificationOccurred('error'),
  tap: () => inTelegram && tg!.isVersionAtLeast('6.1') && tg!.HapticFeedback.selectionChanged(),
};

export function confirmAsync(message: string): Promise<boolean> {
  if (inTelegram && tg!.isVersionAtLeast('6.2')) return new Promise((r) => tg!.showConfirm(message, r));
  return Promise.resolve(window.confirm(message));
}

/** Системна кнопка «Назад» Telegram (для закриття вікна вибору). */
export function useTgBackButton(active: boolean, onBack: () => void) {
  useEffect(() => {
    if (!active || !inTelegram || !tg!.isVersionAtLeast('6.1')) return;
    tg!.BackButton.onClick(onBack);
    tg!.BackButton.show();
    return () => {
      tg!.BackButton.offClick(onBack);
      tg!.BackButton.hide();
    };
  }, [active, onBack]);
}
