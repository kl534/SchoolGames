import type { PlayerProgress } from '../progress';

/** A player as it travels between a device and the sync service. */
export interface WirePlayer {
  id: string;
  name: string;
  avatar: string;
  deleted?: true;
}

export interface SyncRequest {
  /** The client's cursor: the highest server `updatedAt` it has pulled. */
  since: number;
  /** Dirty players, plus removed ones with `deleted: true`. */
  players: WirePlayer[];
  /** By player id, for dirty players only. */
  progress: Record<string, PlayerProgress>;
}

export interface SyncResponse {
  /** The new cursor: the highest `updated_at` over the account. */
  cursor: number;
  /** Every player with `updated_at >= since` (the merged result). */
  players: WirePlayer[];
  /** Same rule. */
  progress: Record<string, PlayerProgress>;
}

export type AuthResponse = { token: string; email: string };

export interface ServerConfig {
  emailEnabled: boolean;
  googleClientId: string | null;
}

export type ApiErrorCode =
  | 'invalid'
  | 'bad_credentials'
  | 'exists'
  | 'rate_limited'
  | 'unauthorized'
  | 'too_large'
  | 'limit';
