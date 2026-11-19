import { z } from 'zod';

const APOSTROPHES = /['’ʼ`´]/g;

// Дзеркало сервера: AUTO_WORD_GENERATOR/src/journal/validation.js

/** «  іваненко   петро-олег  » → «Іваненко Петро-Олег» */
export function normalizeFullName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(APOSTROPHES, '’')
    .toLocaleLowerCase('uk-UA')
    .replace(/(^|[\s.-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('uk-UA'));
}

/** Ключ для перевірки дублікатів (без урахування регістру й видів апострофа). */
export function fullNameKey(raw: string): string {
  return normalizeFullName(raw).toLocaleLowerCase('uk-UA');
}

export const fullNameSchema = z
  .string()
  .transform(normalizeFullName)
  .pipe(
    z
      .string()
      .min(5, 'Вкажіть прізвище та ім’я повністю')
      .max(80, 'Задовге ПІБ')
      .regex(/^[\p{L}’.\- ]+$/u, 'ПІБ може містити лише літери, пробіли, дефіс, апостроф і крапку')
      .refine((s) => s.split(' ').length >= 2, 'Вкажіть щонайменше прізвище та ім’я'),
  );
