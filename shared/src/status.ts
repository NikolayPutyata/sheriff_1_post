// Дзеркало сервера: AUTO_WORD_GENERATOR/src/journal/statuses.js

/**
 * pending      — працівник натиснув «Здав», чекає на адміна
 * received     — адмін підтвердив отримання паперового примірника
 * rejected     — адмін відмовив (заявку скасовано)
 * scanned      — (фаза 2) відскановано
 * transferred  — (фаза 2) передано у відділ
 */
export const HANDOVER_STATUSES = ['pending', 'received', 'rejected', 'scanned', 'transferred'] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export const STATUS_LABELS: Record<HandoverStatus, string> = {
  pending: 'Очікує',
  received: 'Отримано',
  rejected: 'Відмовлено',
  scanned: 'Відскановано',
  transferred: 'Передано',
};

export const STATUS_EMOJI: Record<HandoverStatus, string> = {
  pending: '⏳',
  received: '✅',
  rejected: '❌',
  scanned: '🖨',
  transferred: '📦',
};

/** Шаблони причин відмови (код короткий, бо йде в callback_data Telegram — ліміт 64 байти). */
export const REJECT_REASONS = {
  n: 'Немає паперового примірника',
  w: 'Невірний номер договору',
  g: 'Невірно вказано працівника',
  o: 'Інше',
} as const;
export type RejectReasonCode = keyof typeof REJECT_REASONS;
export const REJECT_REASON_CODES = Object.keys(REJECT_REASONS) as RejectReasonCode[];
