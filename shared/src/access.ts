import { z } from 'zod';

/** Верифікація Telegram-акаунта: none — ще не просив, pending — чекає адміна. */
export type AccessStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Нікнейм для запиту доступу. Дзеркало сервера (AUTO_WORD_GENERATOR/src/journal/validation.js). */
export const nicknameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Вкажіть нікнейм (щонайменше 2 символи)')
      .max(32, 'Нікнейм не довший за 32 символи')
      .regex(/^@?[\p{L}\d][\p{L}\d ._’'-]*$/u, 'Нікнейм може містити лише літери, цифри та . _ - @'),
  );
