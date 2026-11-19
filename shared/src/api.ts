import type { AccessStatus } from './access.js';
import type { HandoverStatus, RejectReasonCode } from './status.js';

/** Типи відповідей API — спільні для фронту й сервера. */

export interface MeResponse {
  user: { id: number; firstName: string; username?: string };
  isAdmin: boolean;
  /** Спільний пристрій (планшет): ПІБ не підставляється, форма очищається після здачі. */
  isKiosk: boolean;
  /** Верифікація акаунта (адміну й планшету — завжди approved). */
  access: AccessStatus;
  /** Нікнейм Telegram (@username), з яким надіслано запит на доступ. */
  nickname: string | null;
  /** Охоронник, якого цей Telegram-акаунт додав (прив'язаний), або null. */
  ownGuard: GuardDto | null;
  /** Чи може цей акаунт додати охоронника (себе — один раз; адмін — без обмежень; планшет — ні). */
  canAddGuard: boolean;
}

export interface GuardDto {
  id: string;
  fullName: string;
  isActive: boolean;
  hasTelegram: boolean;
  /** Лише для адміна: нікнейм Telegram того, хто додав себе. */
  tgUsername?: string;
}

export interface HandoverDto {
  id: string;
  seq: number;
  contractNumber: string;
  guardId: string;
  guardName: string;
  submittedAt: string;
  submittedBy: { tgId: number; name: string; nickname?: string };
  status: HandoverStatus;
  decidedAt?: string;
  rejectReason?: string;
}

export type Period = 'today' | 'yesterday' | 'week' | 'range';

export interface HandoverListResponse {
  items: HandoverDto[];
  counts: Partial<Record<HandoverStatus, number>>;
  total: number;
  range: { from: string; to: string };
}

export interface CreateHandoverRequest {
  contractNumber: string;
  guardId: string;
}

export interface CreateHandoverResponse {
  handover: HandoverDto;
  /** Попередні здачі з тим самим номером (для попередження). */
  duplicates: number;
}

export interface DecisionRequest {
  decision: 'received' | 'rejected';
  reason?: RejectReasonCode;
}

export interface AccessDto {
  id: string;
  tgUserId: number;
  nickname: string;
  tgName: string;
  tgUsername?: string;
  status: Exclude<AccessStatus, 'none'>;
  requestedAt: string;
  decidedAt?: string;
}

export interface ApiError {
  error: string;
}
