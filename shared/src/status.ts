// Дзеркало сервера: AUTO_WORD_GENERATOR/src/journal/statuses.js

/**
 * pending       — працівник натиснув «Здав», чекає на адміна
 * received      — адмін прийняв паперовий примірник (договір на посту)
 * rejected      — адмін відмовив (фінал)
 * with_manager  — менеджер забрав, адмін підтвердив передачу (фінал)
 * legal         — адмін передав у ЮВ (фінал)
 * Фінальні статуси зберігаються 3 місяці, потім видаляються.
 */
export const HANDOVER_STATUSES = ['pending', 'received', 'rejected', 'with_manager', 'legal'] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export const STATUS_LABELS: Record<HandoverStatus, string> = {
  pending: 'Очікує',
  received: 'Отримано',
  rejected: 'Відмовлено',
  with_manager: 'У менеджера',
  legal: 'Передано ЮВ',
};

export const STATUS_EMOJI: Record<HandoverStatus, string> = {
  pending: '⏳',
  received: '✅',
  rejected: '❌',
  with_manager: '📦',
  legal: '⚖️',
};

/** Посади при верифікації. */
export const ROLES = ['worker', 'manager'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { worker: 'Інженер/охоронник', manager: 'Менеджер' };

/** Шаблони причин відмови (код короткий, бо йде в callback_data Telegram — ліміт 64 байти). */
export const REJECT_REASONS = {
  n: 'Немає паперового примірника',
  w: 'Невірний номер договору',
  g: 'Невірно вказано працівника',
  o: 'Інше',
} as const;
export type RejectReasonCode = keyof typeof REJECT_REASONS;
export const REJECT_REASON_CODES = Object.keys(REJECT_REASONS) as RejectReasonCode[];
