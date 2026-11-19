import type { AccessStatus } from './access.js';
import type { HandoverStatus, RejectReasonCode, Role } from './status.js';

/** Типи відповідей API — спільні для фронту й сервера. */

export interface MeResponse {
  user: { id: number; firstName: string; username?: string };
  isAdmin: boolean;
  /** Спільний пристрій (планшет): ПІБ не підставляється, форма очищається після здачі. */
  isKiosk: boolean;
  /** Верифікація акаунта (адміну й планшету — завжди approved). */
  access: AccessStatus;
  /** admin | kiosk | worker | manager; null — ще не надсилав запит. */
  role: 'admin' | 'kiosk' | Role | null;
  /** ПІБ із запиту на доступ. */
  fullName: string | null;
  /** Нікнейм Telegram (@username), з яким надіслано запит на доступ. */
  nickname: string | null;
  /** Працівник, якого цей Telegram-акаунт додав (прив'язаний), або null. */
  ownGuard: GuardDto | null;
  /** Чи може цей акаунт додати працівника (себе — один раз; адмін — без обмежень; планшет — ні). */
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
  /** Повне найменування клієнта (у старих записах може бути відсутнє). */
  clientName?: string;
  guardId: string;
  guardName: string;
  submittedAt: string;
  submittedBy: { tgId: number; name: string; nickname?: string };
  status: HandoverStatus;
  decidedAt?: string;
  rejectReason?: string;
  /** Кого з менеджерів адмін сповістив. */
  notifiedManager?: { tgUserId: number; name: string };
  notifiedAt?: string;
  /** Активна заявка менеджера «Забрати». */
  pickup?: { id: string; managerTgId: number; managerName: string };
  /** Хто забрав (статус with_manager). */
  manager?: { tgUserId: number; name: string };
  /** Коли договір отримав фінальний статус. */
  finalAt?: string;
}

export interface ManagerDto {
  tgUserId: number;
  name: string;
  nickname: string;
  /** > 0 — раніше відповідав за клієнтів обраних договорів. */
  suggested: number;
}

export interface PickupDto {
  id: string;
  manager: { tgUserId: number; name: string; nickname?: string };
  status: 'pending' | 'confirmed' | 'partial' | 'declined' | 'cancelled' | 'processing';
  createdAt: string;
  decidedAt?: string;
  confirmedIds: string[];
  items: HandoverDto[];
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
  clientName: string;
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
  fullName: string | null;
  role: Role;
  tgName: string;
  tgUsername?: string;
  status: Exclude<AccessStatus, 'none'>;
  /** Після підтвердження: ПІБ у списку вже прив'язане до іншого акаунта. */
  linkConflict?: string;
  requestedAt: string;
  decidedAt?: string;
}

export interface ApiError {
  error: string;
}
