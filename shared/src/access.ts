import { z } from 'zod';

/** Верифікація Telegram-акаунта: none — ще не просив, pending — чекає адміна. */
export type AccessStatus = 'none' | 'pending' | 'approved' | 'rejected';

/**
 * Нікнейм для запиту доступу — саме ім'я користувача з Telegram (@username).
 * Повертає значення без «@». Сервер додатково звіряє його з підписаними даними Telegram.
 * Дзеркало сервера: AUTO_WORD_GENERATOR/src/journal/validation.js (validateTelegramUsername).
 */
export const telegramUsernameSchema = z
  .string()
  .transform((s) => s.trim().replace(/^@/, ''))
  .pipe(
    z
      .string()
      .min(1, 'Вкажіть свій нікнейм з Telegram (починається з @)')
      .regex(/^[A-Za-z0-9_]{5,32}$/, 'Нікнейм Telegram — 5–32 латинські літери, цифри або «_»'),
  );
