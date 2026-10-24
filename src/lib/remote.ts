import AsyncStorage from '@react-native-async-storage/async-storage';

import { toast } from '@/components/ui/Toast';
import { setBeforeLeave, useApp } from '@/store';
import type { Gender, Member, PayMethod } from '@/store/types';

import { api, setUnauthorizedHandler, tokenStore, type Invite } from './api';
import { termEnd, type ISODate } from './date';
import { brandFromGym } from './gymBrand';
import { forgetSync, markSynced, refreshNow } from './sync';

// When the app signs out for any reason, the sync engine stops first so emptying the store isn't read as deleting the gym.
setBeforeLeave(() => {
  void forgetSync();
});
setUnauthorizedHandler(() => {
  toast.info('You’ve been signed out. Sign in again to continue.');
  useApp.getState().leaveRemote();
});

/** Ends the session on the server and on this phone, then returns to the first screen. */
export async function signOut() {
  await api.logout();
  await tokenStore.clear();
  useApp.getState().leaveRemote();
}

/** Opens a chest. The server draws the prize, then everything it changed is read back. */
export async function openChestRemote(chestId: string) {
  const r = await api.openChest(chestId);
  if (!r.ok) return { ok: false as const, message: r.message };
  await refreshNow();
  return { ok: true as const, prize: r.data.prize };
}

export type NewMember = {
  name: string;
  phone: string;
  email?: string;
  gender: Gender;
  planId: string;
  startDate: ISODate;
  paid: number;
  method: PayMethod;
  leadId?: string;
};

/**
 * Adds a person to the gym. The server creates their identity and invite and hands back their full
 * record; then the payment, the lead and any referral reward are recorded like any other change.
 */
export async function createMember(input: NewMember): Promise<{ ok: true; member: Member; invite: Invite } | { ok: false; message: string }> {
  const s = useApp.getState();
  const plan = s.plans.find((p) => p.id === input.planId);
  if (!plan) return { ok: false, message: 'Pick a plan first.' };
  const r = await api.createMember({
    name: input.name.trim(),
    phone: input.phone,
    email: input.email?.trim() || undefined,
    member: {
      gender: input.gender,
      joinedOn: input.startDate,
      planId: plan.id,
      startDate: input.startDate,
      endDate: termEnd(input.startDate, plan.months),
      pauseAllowance: plan.pauseDays,
      dues: Math.max(0, plan.price - input.paid),
      weeklyGoal: 4,
    },
  });
  if (!r.ok) return { ok: false, message: r.message };
  const member = r.data.member as unknown as Member;
  markSynced('members', member.id, member);
  useApp.getState().addMember({ paid: input.paid, method: input.method, leadId: input.leadId }, member);
  return { ok: true, member, invite: { inviteCode: r.data.inviteCode, expiresInDays: r.data.expiresInDays, whatsapp: r.data.whatsapp } };
}

/** A fresh invite for someone whose first code expired, locked or got lost. */
export async function reinvite(memberId: string) {
  return api.reinvite(memberId);
}


const RETURN_KEY = 'gym.admin.return';

/** Opens a gym as its owner so the platform admin can set it up on the spot. Remembers the way back. */
export async function openGymAsOwner(gymId: string) {
  const r = await api.adminOpenGym(gymId);
  if (!r.ok) return { ok: false as const, message: r.message };
  const adminToken = await tokenStore.get();
  await AsyncStorage.setItem(RETURN_KEY, JSON.stringify({ token: adminToken, name: useApp.getState().session?.staffName ?? 'Admin' }));
  await tokenStore.set(r.data.token);
  useApp.getState().joinRemote(
    'manager',
    { gymCode: r.data.gym.code, gymName: r.data.gym.name, name: r.data.name, status: r.data.gym.status === 'active' ? 'active' : 'pending' },
    brandFromGym(r.data.gym),
  );
  return { ok: true as const };
}

export async function canReturnToAdmin() {
  return !!(await AsyncStorage.getItem(RETURN_KEY));
}

/** Leaves the gym the admin was setting up and goes back to the platform screen. */
export async function backToAdmin() {
  const saved = await AsyncStorage.getItem(RETURN_KEY);
  if (!saved) return false;
  const { token, name } = JSON.parse(saved) as { token: string; name: string };
  await AsyncStorage.removeItem(RETURN_KEY);
  await tokenStore.set(token);
  useApp.getState().joinAdmin(name);
  return true;
}
