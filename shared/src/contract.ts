import { z } from 'zod';

/**
 * Базовий формат номера договору.
 * Дозволено: літери (укр/лат), цифри, «/», «-», «.», «_» та пробіли; має бути хоча б одна цифра.
 * Приклади: «123», «123/45», «ГШР-2026/017», «А-15.3».
 * Змінюючи правило тут, змініть і на сервері: AUTO_WORD_GENERATOR/src/journal/validation.js
 */
export const CONTRACT_MAX_LENGTH = 30;
const CONTRACT_CHARS = /^[\p{L}\d][\p{L}\d/\-._ ]*$/u;

export function normalizeContractNumber(raw: string): string {
  return raw
    .trim()
    .replace(/^(№|N[o°]?\.?)\s*/iu, '') // прибираємо «№» / «No.» на початку
    .replace(/\s+/g, ' ')
    .replace(/\s*([/\-.])\s*/g, '$1') // «123 / 45» → «123/45»
    .toUpperCase();
}

export const contractNumberSchema = z
  .string()
  .transform(normalizeContractNumber)
  .pipe(
    z
      .string()
      .min(1, 'Вкажіть номер договору')
      .max(CONTRACT_MAX_LENGTH, `Номер не довший за ${CONTRACT_MAX_LENGTH} символів`)
      .regex(CONTRACT_CHARS, 'Дозволені лише літери, цифри та символи / - . _')
      .regex(/\d/, 'Номер має містити хоча б одну цифру'),
  );
