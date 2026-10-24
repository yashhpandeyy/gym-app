import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Hours } from '@/config/brand';

/**
 * Talks to the gym server in /server. In development the server runs on the same computer as
 * Expo, so the phone reaches it at the Expo host's address on port 8787. Set
 * EXPO_PUBLIC_API_URL for a deployed server.
 */
export function apiBase() {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web') return 'http://localhost:8787';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8787`;
}

const TOKEN_KEY = 'gym.token';

export const tokenStore = {
  async get() {
    try {
      return Platform.OS === 'web' ? await AsyncStorage.getItem(TOKEN_KEY) : await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async set(token: string) {
    if (Platform.OS === 'web') await AsyncStorage.setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clear() {
    try {
      if (Platform.OS === 'web') await AsyncStorage.removeItem(TOKEN_KEY);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // Nothing stored, nothing to clear.
    }
  },
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; message: string; status: number };

let onUnauthorized: (() => void) | undefined;
/** Called when the server says the saved session is no longer valid, so the app can go back to sign-in. */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, opts: { body?: unknown; auth?: boolean } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth) {
    const token = await tokenStore.get();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(apiBase() + path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: ctl.signal });
    // The server swaps in a fresh token shortly before the old one expires. Keep it, and the person never notices.
    const renewed = res.headers.get('x-session-token');
    if (renewed && opts.auth && res.ok) await tokenStore.set(renewed);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data: json as T };
    if (res.status === 401 && opts.auth) {
      await tokenStore.clear();
      onUnauthorized?.();
    }
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === 'string' ? json.error : 'error',
      message: typeof json.message === 'string' ? json.message : 'Something went wrong. Try again.',
    };
  } catch {
    return { ok: false, status: 0, error: 'network', message: 'Can’t reach the gym server. Check your connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}

export type GymProfile = {
  contact: { phone: string; phoneDisplay: string; whatsapp: string; email: string; instagram: string };
  address: { line1: string; line2: string; mapsQuery: string };
  hours: Hours[];
  amenities: string[];
  currency: { code: string; locale: string; symbol: string };
  referral: { reward: string };
};

export type GymStatus = 'pending' | 'active' | 'suspended';

/** What the gym code alone reveals: branding. Signed-in people also get `id`, `status` and `profile`. */
export type PublicGym = {
  code: string;
  name: string;
  tagline: string;
  primaryColor: string;
  logoUrl: string | null;
  features: Record<string, boolean>;
  id?: string;
  status?: GymStatus;
  profile?: GymProfile | null;
};

export type FullGym = PublicGym & { status: GymStatus };
export type Invite = { inviteCode: string; expiresInDays: number; whatsapp: { phone: string; text: string } };
export type OwnerSession = { token: string; role: 'owner'; name: string; gym: FullGym };
export type AdminSession = { token: string; role: 'admin'; name: string };
export type AdminGym = { id: string; code: string; name: string; status: GymStatus; created_at: string; members: number; owner_email: string | null; owner_name: string | null; owner_phone: string | null };

export type SyncDoc = { kind: string; id: string; seq: number; deleted: boolean; data?: unknown };
export type SyncOp = { kind: string; id: string; data: unknown | null };
export type PushResult = { kind: string; id: string; ok: boolean; error?: string; data?: unknown };

export const api = {
  // sign-in
  gymPublic: (code: string) => request<PublicGym>('GET', `/v1/gyms/${encodeURIComponent(code.trim().toUpperCase())}/public`),
  ownerSignup: (b: { gymName: string; ownerName: string; email: string; password: string; phone?: string }) =>
    request<{ gym: { id: string; code: string; status: string }; token: string }>('POST', '/v1/gyms', { body: b }),
  ownerLogin: (email: string, password: string) => request<OwnerSession | AdminSession>('POST', '/v1/auth/owner-login', { body: { email, password } }),
  login: (gymCode: string, phone: string, secret: string) =>
    request<{ token: string; role: 'owner' | 'staff'; name: string; gymStatus: string }>('POST', '/v1/auth/login', { body: { gymCode, phone, secret } }),
  memberLogin: (phone: string, code: string) =>
    request<{ token: string; name: string; memberId: string; gym: FullGym }>('POST', '/v1/auth/member-login', { body: { phone, code } }),
  redeem: (gymCode: string, phone: string, code: string) => request<{ token: string; name: string; memberId: string }>('POST', '/v1/auth/redeem', { body: { gymCode, phone, code } }),
  pair: (gymCode: string, name: string, phone: string) => request<{ pairingId: string; secret: string; qr: string }>('POST', '/v1/pair', { body: { gymCode, name, phone } }),
  pairStatus: (id: string, secret: string) => request<{ status: 'waiting' | 'approved'; token?: string; memberId?: string }>('GET', `/v1/pair/${id}?secret=${encodeURIComponent(secret)}`),
  logout: () => request<{ ok: true }>('POST', '/v1/auth/logout', { auth: true }),

  // the signed-in person's gym
  me: () => request<{ role: string; memberId?: string | null; name?: string; email?: string | null; gym: FullGym }>('GET', '/v1/me', { auth: true }),
  bootstrap: () => request<{ role: string; memberId: string | null; gym: FullGym }>('GET', '/v1/bootstrap', { auth: true }),
  updateGym: (patch: { name?: string; tagline?: string; primaryColor?: string; features?: Record<string, boolean>; logo?: string; profile?: GymProfile }) =>
    request<{ ok: true }>('PATCH', '/v1/gym', { auth: true, body: patch }),

  // people
  createMember: (m: { name: string; phone: string; email?: string; member: Record<string, unknown> }) =>
    request<{ member: Record<string, unknown> & { id: string; code: string; name: string; phone: string } } & Invite>('POST', '/v1/members', { auth: true, body: m }),
  reinvite: (memberId: string) => request<Invite>('POST', `/v1/members/${memberId}/invite`, { auth: true }),
  approvePairing: (qr: string, memberId?: string) =>
    request<{ ok: true; member: { id: string; name: string; phone: string } }>('POST', '/v1/pairings/approve', { auth: true, body: { qr, memberId } }),
  previewPairing: (qr: string) =>
    request<{ preview: true; request: { name: string; phone: string }; member: { id: string; name: string; phone: string } | null }>('POST', '/v1/pairings/approve', { auth: true, body: { qr, preview: true } }),
  addStaff: (s: { name: string; phone: string; pin: string }) => request<{ id: string }>('POST', '/v1/staff', { auth: true, body: s }),
  staff: () => request<{ staff: { id: string; name: string; phone: string }[] }>('GET', '/v1/staff', { auth: true }),
  removeStaff: (id: string) => request<{ ok: true }>('DELETE', `/v1/staff/${id}`, { auth: true }),
  setStaffPin: (id: string, pin: string) => request<{ ok: true }>('PATCH', `/v1/staff/${id}`, { auth: true, body: { pin } }),

  // keeping every device in step
  syncPull: (since: number) => request<{ seq: number; more: boolean; docs: SyncDoc[] }>('GET', `/v1/sync?since=${since}`, { auth: true }),
  syncPush: (ops: SyncOp[]) => request<{ seq?: number; results: PushResult[] }>('POST', '/v1/sync/push', { auth: true, body: { ops } }),
  syncGet: (keys: string[]) => request<{ docs: SyncDoc[] }>('POST', '/v1/sync/get', { auth: true, body: { keys } }),
  openChest: (id: string) => request<{ prize: { kind: string; amount: number; label: string } }>('POST', `/v1/chests/${id}/open`, { auth: true }),

  // the platform admin (you)
  adminGyms: () => request<{ gyms: AdminGym[] }>('GET', '/v1/admin/gyms', { auth: true }),
  adminCreateGym: (b: { gymName: string; ownerName: string; email: string; password: string; phone?: string }) =>
    request<{ id: string; code: string; status: string }>('POST', '/v1/admin/gyms', { auth: true, body: b }),
  adminSetStatus: (id: string, status: GymStatus) => request<{ ok: true }>('POST', `/v1/admin/gyms/${id}/status`, { auth: true, body: { status } }),
  adminOpenGym: (id: string) => request<{ token: string; name: string; gym: FullGym }>('POST', `/v1/admin/gyms/${id}/open`, { auth: true }),
  adminResetPassword: (id: string, password: string) => request<{ ok: true }>('POST', `/v1/admin/gyms/${id}/password`, { auth: true, body: { password } }),
};
