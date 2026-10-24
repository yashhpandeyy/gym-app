// End-to-end checks against a running `wrangler dev`. Run: npm run db:local && npm run dev, then npm test.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const API = process.env.API ?? 'http://127.0.0.1:8787';
const MASTER = process.env.ADMIN_TOKEN ?? 'dev-admin-token';
const tag = String(Date.now()).slice(-6);

// Earlier runs leave sign-in and sign-up counters behind. Start each run clean.
const sql = (q) => spawnSync('npx', ['wrangler', 'd1', 'execute', 'gym-db', '--local', '--command', `"${q}"`], { cwd: new URL('..', import.meta.url), shell: true, encoding: 'utf8' });
sql('DELETE FROM attempts');

let passed = 0;
let failed = 0;
function check(name, ok, extra = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${extra}`}`);
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data, headers: res.headers };
}
const phone = (n) => `9${tag}${String(n).padStart(3, '0')}`.slice(0, 10);
const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const hashOf = (t) => createHash('sha256').update(t).digest('hex');
const setExpiry = (token, days) => sql(`UPDATE sessions SET expires_at = ${Math.floor(Date.now() / 1000) + Math.round(days * 86400)}, renewed_at = NULL WHERE token_hash = '${hashOf(token)}'`);

const pull = async (token, since = 0) => (await call('GET', `/v1/sync?since=${since}`, { token })).data;
const push = (token, ...ops) => call('POST', '/v1/sync/push', { token, body: { ops } });
const put = (kind, id, data) => ({ kind, id, data });
const find = (docs, kind, id) => docs.find((d) => d.kind === kind && d.id === id);
const first = (r) => r.data.results[0];

// =============================================================================================
// Gym lifecycle: sign up, wait for activation, readable code, platform admins
// =============================================================================================
const signup = await call('POST', '/v1/gyms', { body: { gymName: `Iron Temple ${tag}`, ownerName: 'Asha Rao', email: `asha${tag}@example.com`, phone: phone(1), password: 'correct-horse-9' } });
check('owner can sign up', signup.status === 201 && signup.data.gym?.status === 'pending', JSON.stringify(signup.data));
const gymA = signup.data.gym;
const ownerA = signup.data.token;
check('gym code is short and readable', /^[A-Z]{2}\d{2,4}$/.test(gymA.code), gymA.code);
check('the same email can’t open a second gym', (await call('POST', '/v1/gyms', { body: { gymName: 'Another One', ownerName: 'Asha', email: `ASHA${tag}@example.com`, password: 'correct-horse-9' } })).data.error === 'email_taken');
check('a bad email is refused', (await call('POST', '/v1/gyms', { body: { gymName: 'Bad Mail', ownerName: 'Asha', email: 'not-an-email', password: 'correct-horse-9' } })).status === 400);
check('weak password is rejected', (await call('POST', '/v1/gyms', { body: { gymName: 'X Gym', ownerName: 'Bob', email: `bob${tag}@example.com`, password: 'short' } })).status === 400);
check('pending gym is invisible by code', (await call('GET', `/v1/gyms/${gymA.code}/public`)).status === 404);
check('pending gym can’t sync yet', (await call('GET', '/v1/sync?since=0', { token: ownerA })).data.error === 'gym_pending');

const PROFILE = { contact: { phone: '+919811100000', phoneDisplay: '+91 98111 00000', whatsapp: '919811100000', email: 'hello@irontemple.test', instagram: '@irontemple' }, address: { line1: '12 MG Road', line2: 'Pune 411001', mapsQuery: 'MG Road Pune' }, hours: [{ label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6], open: '05:30', close: '22:00' }], amenities: ['Lockers', 'Showers'], referral: { reward: 'Both of you get 10 extra days.' } };
check('pending owner can set up branding and business details', (await call('PATCH', '/v1/gym', { token: ownerA, body: { tagline: 'Lift heavy', primaryColor: '#E4572E', features: { nutrition: false }, profile: PROFILE } })).status === 200);
const meA = await call('GET', '/v1/me', { token: ownerA });
check('the owner reads their business details back', meA.data.gym?.profile?.address?.line1 === '12 MG Road' && meA.data.gym.profile.contact.instagram === 'irontemple' && meA.data.gym.profile.hours.length === 1, JSON.stringify(meA.data.gym?.profile).slice(0, 160));

check('admin routes reject no token', (await call('GET', '/v1/admin/gyms')).status === 401);
check('an owner token is not an admin token', (await call('GET', '/v1/admin/gyms', { token: ownerA })).status === 401);
const adminEmail = `boss${tag}@gmail.test`;
check('the master token creates an admin account', (await call('POST', '/v1/admin/accounts', { token: MASTER, body: { email: adminEmail, name: 'The Boss', password: 'boss-pass-123' } })).status === 201);
const adminLogin = await call('POST', '/v1/auth/owner-login', { body: { email: adminEmail.toUpperCase(), password: 'boss-pass-123' } });
check('the admin signs in with their own email and password', adminLogin.status === 200 && adminLogin.data.role === 'admin' && adminLogin.data.token.startsWith('adm.'), JSON.stringify(adminLogin.data));
const admin = adminLogin.data.token;
check('a wrong admin password is refused', (await call('POST', '/v1/auth/owner-login', { body: { email: adminEmail, password: 'nope-nope-nope' } })).status === 401);
check('an admin can’t create other admins', (await call('POST', '/v1/admin/accounts', { token: admin, body: { email: `x${tag}@g.test`, name: 'X Y', password: 'xxxxxxxx1' } })).status === 403);
const listed = (await call('GET', '/v1/admin/gyms', { token: admin })).data.gyms ?? [];
check('the admin sees every gym with its owner’s email', listed.some((g) => g.code === gymA.code && g.owner_email === `asha${tag}@example.com`));
check('admin activates the gym', (await call('POST', `/v1/admin/gyms/${gymA.id}/status`, { token: admin, body: { status: 'active' } })).status === 200);

const ol = await call('POST', '/v1/auth/owner-login', { body: { email: `Asha${tag}@Example.com`, password: 'correct-horse-9' } });
check('owner signs in with email alone, no gym code', ol.status === 200 && ol.data.role === 'owner' && ol.data.gym?.code === gymA.code && ol.data.gym?.primaryColor === '#E4572E');
check('wrong owner password is refused', (await call('POST', '/v1/auth/owner-login', { body: { email: `asha${tag}@example.com`, password: 'wrong-password' } })).status === 401);
check('unknown email looks the same as a wrong password', (await call('POST', '/v1/auth/owner-login', { body: { email: 'nobody@example.com', password: 'wrong-password' } })).data.message === (await call('POST', '/v1/auth/owner-login', { body: { email: `asha${tag}@example.com`, password: 'wrong-password-2' } })).data.message);

const pub = await call('GET', `/v1/gyms/${gymA.code}/public`);
check('the gym code shows branding only', pub.status === 200 && JSON.stringify(Object.keys(pub.data).sort()) === JSON.stringify(['code', 'features', 'logoUrl', 'name', 'primaryColor', 'tagline']), JSON.stringify(Object.keys(pub.data)));
check('unknown gym code is a plain 404', (await call('GET', '/v1/gyms/ZZZZZZ/public')).status === 404);

const opened = await call('POST', `/v1/admin/gyms/${gymA.id}/open`, { token: admin });
check('the admin can open a gym as its owner to set it up on the spot', opened.status === 200 && (await call('GET', '/v1/me', { token: opened.data.token })).data.role === 'owner');
check('the admin can reset a forgotten owner password', (await call('POST', `/v1/admin/gyms/${gymA.id}/password`, { token: admin, body: { password: 'fresh-pass-77' } })).status === 200);
check('the old owner session is signed out by the reset', (await call('GET', '/v1/me', { token: ownerA })).status === 401);
check('and the new password works', (await call('POST', '/v1/auth/owner-login', { body: { email: `asha${tag}@example.com`, password: 'fresh-pass-77' } })).status === 200);
const ownerToken = (await call('POST', '/v1/auth/owner-login', { body: { email: `asha${tag}@example.com`, password: 'fresh-pass-77' } })).data.token;

// =============================================================================================
// A new gym starts with rules and plan shapes, but no people, prices or timetable
// =============================================================================================
const start = await pull(ownerToken);
check('a new gym starts with its rules and four unpriced plans', start.docs.length === 5 && !!find(start.docs, 'settings', 'gym') && start.docs.filter((d) => d.kind === 'plans').every((d) => d.data.price === 0 && d.data.active === false), JSON.stringify(start.docs.map((d) => d.kind)));
check('and nothing else: no members, bookings or fake data', start.docs.every((d) => d.kind === 'settings' || d.kind === 'plans'));
check('the owner prices a plan', first(await push(ownerToken, put('plans', 'plan-monthly', { id: 'plan-monthly', name: 'Monthly', months: 1, price: 2000, pauseDays: 5, perks: [], active: true }))).ok);

// =============================================================================================
// Staff, members, invites
// =============================================================================================
check('owner adds a staff PIN', (await call('POST', '/v1/staff', { token: ownerToken, body: { name: 'Desk', phone: phone(3), pin: '2580' } })).status === 201);
const staffLogin = await call('POST', '/v1/auth/login', { body: { gymCode: gymA.code, phone: phone(3), secret: '2580' } });
check('staff signs in with a PIN', staffLogin.status === 200 && staffLogin.data.role === 'staff');
const staffA = staffLogin.data.token;
check('staff can’t add staff', (await call('POST', '/v1/staff', { token: staffA, body: { name: 'X', phone: phone(4), pin: '1111' } })).status === 403);

const addMember = (n, extra = {}) =>
  call('POST', '/v1/members', {
    token: staffA,
    body: { name: `Member ${n}`, phone: phone(100 + n), email: n === 1 ? 'm1@example.com' : undefined, member: { gender: n % 2 ? 'male' : 'female', planId: 'plan-monthly', startDate: today, endDate: '2099-01-01', pauseAllowance: 5, dues: 0, ...extra } },
  });
const m1 = (await addMember(1)).data;
check('staff add a member and get their full record, number and invite', /^[A-Z]{2}-\d{4}$/.test(m1.member?.code ?? '') && m1.member.planId === 'plan-monthly' && /^\d{6}$/.test(m1.inviteCode ?? '') && m1.whatsapp?.text.includes(m1.inviteCode), JSON.stringify(m1).slice(0, 200));
check('member numbers count up', (await addMember(2)).data.member.code !== m1.member.code);
check('duplicate phone is refused', (await call('POST', '/v1/members', { token: staffA, body: { name: 'Dup', phone: phone(101) } })).status === 409);
check('a bad member email is refused', (await call('POST', '/v1/members', { token: staffA, body: { name: 'Bad Mail', phone: phone(190), email: 'nope' } })).status === 400);
check('the new member appears for the whole gym team', !!find((await pull(ownerToken)).docs, 'members', m1.member.id));

const redeem = (code, p = phone(101), g = gymA.code) => call('POST', '/v1/auth/redeem', { body: { gymCode: g, phone: p, code } });
const wrong = m1.inviteCode === '000000' ? '111111' : '000000';
const unknown = await redeem('123456', phone(999));
const bad = await redeem(wrong);
check('unknown phone and wrong code look identical', unknown.status === 401 && bad.status === 401 && unknown.data.message === bad.data.message);
for (let i = 0; i < 4; i++) await redeem(wrong);
check('five wrong tries lock the invite, even for the right code', (await redeem(m1.inviteCode)).status === 401);
const re = await call('POST', `/v1/members/${m1.member.id}/invite`, { token: staffA });
check('staff issue a fresh invite', re.status === 200 && re.data.inviteCode !== m1.inviteCode);
const ok = await redeem(re.data.inviteCode);
check('the member signs in with the fresh code', ok.status === 200 && ok.data.role === 'member');
const memberA1 = ok.data.token;
check('an invite code works only once', (await redeem(re.data.inviteCode)).status === 401);

const pairMember = (await addMember(50)).data;
const pair = await call('POST', '/v1/pair', { body: { gymCode: gymA.code, name: 'Member 50', phone: phone(150) } });
check('a member requests pairing', pair.status === 201 && pair.data.qr.startsWith('GYMPAIR:'));
const poll = () => call('GET', `/v1/pair/${pair.data.pairingId}?secret=${pair.data.secret}`);
check('pairing waits for staff', (await poll()).data.status === 'waiting');
const preview = await call('POST', '/v1/pairings/approve', { token: staffA, body: { qr: pair.data.qr, preview: true } });
check('staff see who is asking before approving', preview.status === 200 && preview.data.request.name === 'Member 50' && preview.data.member?.id === pairMember.member.id, JSON.stringify(preview.data));
check('a preview unlocks nothing', (await poll()).data.status === 'waiting');
const approve = await call('POST', '/v1/pairings/approve', { token: staffA, body: { qr: pair.data.qr } });
check('staff approve by scanning, matched on phone', approve.status === 200 && approve.data.member.id === pairMember.member.id);
const claimed = await poll();
check('the member app unlocks and gets a session once', claimed.status === 200 && !!claimed.data.token && (await poll()).status === 410);
const stranger = await call('POST', '/v1/pair', { body: { gymCode: gymA.code, name: 'Random Person', phone: phone(777) } });
check('a stranger with the gym code gets nowhere without a matching member', (await call('POST', '/v1/pairings/approve', { token: staffA, body: { qr: stranger.data.qr } })).data.error === 'no_member');

// =============================================================================================
// Sync: what each role may see and do
// =============================================================================================
const mem = async (n) => {
  const m = (await addMember(n)).data;
  const t = (await redeem(m.inviteCode, phone(100 + n))).data.token;
  return { id: m.member.id, token: t, doc: m.member };
};
const P1 = { id: m1.member.id, token: memberA1, doc: m1.member };
const P10 = await mem(10);
const P11 = await mem(11);
const P12 = await mem(12);
const P13 = await mem(13);
const P14 = await mem(14);
const P15 = await mem(15);
const six = [P1, P10, P11, P12, P13, P14];

const slotDoc = { id: 's1', start: '06:00', end: '07:00', capacity: 2, days: [0, 1, 2, 3, 4, 5, 6], popularity: 0.5 };
check('staff create a slot', first(await push(staffA, put('slots', 's1', slotDoc))).ok);
check('members cannot change the timetable', first(await push(P1.token, put('slots', 's2', { ...slotDoc, id: 's2' }))).error === 'forbidden');
check('members cannot change plan prices', first(await push(P1.token, put('plans', 'plan-monthly', { id: 'plan-monthly', name: 'Monthly', months: 1, price: 1, pauseDays: 5, perks: [], active: true }))).error === 'forbidden');
const memberView = await pull(P10.token);
check('a member sees the timetable and plans', !!find(memberView.docs, 'slots', 's1') && memberView.docs.filter((d) => d.kind === 'plans').length === 4);
check('a member sees their own full record', find(memberView.docs, 'members', P10.id)?.data.phone === phone(110));
const others = memberView.docs.filter((d) => d.kind === 'members' && d.id !== P10.id);
check('other members show only a short name, never a phone or plan', others.length >= 5 && others.every((d) => !('phone' in d.data) && !('planId' in d.data) && !('dues' in d.data) && /^\w+ \w\.$/.test(d.data.name)), JSON.stringify(others[0]?.data));

check('staff record a payment', first(await push(staffA, put('payments', 'pay1', { id: 'pay1', memberId: P1.id, invoice: 'IT-1', date: today, amount: 2000, method: 'UPI' }))).ok);
check('the paying member sees it', !!find((await pull(P1.token)).docs, 'payments', 'pay1'));
check('other members never see it', !find((await pull(P10.token)).docs, 'payments', 'pay1'));
check('members cannot write payments', first(await push(P1.token, put('payments', 'pay2', { id: 'pay2', memberId: P1.id, amount: 1 }))).error === 'forbidden');

// booking capacity under concurrency
const bk = (m, id, status = 'booked') => put('bookings', id, { id, memberId: m.id, kind: 'slot', refId: 's1', date: today, status, createdAt: new Date().toISOString() });
const race = await Promise.all(six.map((m, i) => push(m.token, bk(m, `bk${i}`))));
const results = race.map(first);
check('6 people racing for 2 spots: exactly 2 get in', results.filter((r) => r.ok).length === 2, JSON.stringify(results.map((r) => r.error ?? 'ok')));
check('the rest are told the slot is full', results.filter((r) => r.error === 'slot_full').length === 4);
const winners = six.filter((_, i) => race[i].data.results[0].ok);
const losers = six.filter((_, i) => !race[i].data.results[0].ok);
check('members cannot book for someone else', first(await push(P15.token, bk(winners[0], 'bk-steal'))).error === 'forbidden');
check('other members see how many are booked, to show spots left', (await pull(P15.token)).docs.filter((d) => d.kind === 'bookings' && d.data.status === 'booked').length === 2);

const loser = losers[0];
const loserId = `bk${six.indexOf(loser)}`;
check('a full slot lets people join the waitlist', first(await push(loser.token, bk(loser, loserId, 'waitlist'))).ok);
const w = winners[0];
check('a booked member cancels', first(await push(w.token, bk(w, `bk${six.indexOf(w)}`, 'cancelled'))).ok);
check('and the next person on the waitlist can be moved up', first(await push(winners[1].token, bk(loser, loserId, 'booked'))).ok);
check('capacity still holds afterwards', first(await push(P15.token, bk(P15, 'bk-late'))).error === 'slot_full');
check('a booking for a session that doesn’t exist is refused', first(await push(P15.token, put('bookings', 'bk-x', { id: 'bk-x', memberId: P15.id, kind: 'slot', refId: 'nope', date: today, status: 'booked' }))).error === 'no_such_session');

// what a member may change about themselves
const merged = first(await push(P10.token, put('members', P10.id, { ...P10.doc, name: 'Renamed Person', weeklyGoal: 5, phone: '9999999999', dues: -500, planId: 'plan-free', endDate: '2199-01-01' }))).data;
check('a member can rename themselves and set a goal', merged?.name === 'Renamed Person' && merged?.weeklyGoal === 5);
check('but not their phone, dues, plan or end date', merged?.phone === phone(110) && merged?.dues === 0 && merged?.planId === 'plan-monthly' && merged?.endDate === '2099-01-01', JSON.stringify(merged));
check('nobody can add a member through sync, only through an invite', first(await push(staffA, put('members', 'm_made_up', { id: 'm_made_up', name: 'Ghost', phone: phone(321) }))).error === 'use_invite');
check('staff can edit a member’s dues', first(await push(staffA, put('members', P11.id, { ...P11.doc, dues: 300 }))).ok);
check('two members can’t share a phone number', first(await push(staffA, put('members', P11.id, { ...P11.doc, phone: phone(110) }))).error === 'phone_taken');

// pauses
const pause = (id, status, end = '2099-01-10') => put('pauses', id, { id, memberId: P1.id, start: '2099-01-05', end, reason: 'Travel', status, createdAt: new Date().toISOString() });
check('a member can ask for a pause', first(await push(P1.token, pause('ps1', 'pending'))).ok);
check('but can’t approve their own pause', first(await push(P1.token, pause('ps2', 'approved'))).error === 'needs_approval');
check('staff approve it', first(await push(staffA, pause('ps1', 'approved'))).ok);
check('a member may end an approved pause early but not extend it', first(await push(P1.token, pause('ps1', 'approved', '2099-01-07'))).ok && first(await push(P1.token, pause('ps1', 'approved', '2099-02-01'))).error === 'forbidden');

// XP and chests
const xp = (id, amount, m = P1) => put('xp', id, { id, memberId: m.id, amount, reason: 'Exercise done', at: new Date().toISOString(), key: id });
check('a member earns XP', first(await push(P1.token, xp('xp1', 20))).ok);
check('one award can’t be huge', first(await push(P1.token, xp('xp2', 5000))).error === 'invalid');
check('XP can’t be written for someone else', first(await push(P1.token, xp('xp3', 20, P10))).error === 'forbidden');
check('XP can’t be edited afterwards', first(await push(P1.token, xp('xp1', 150))).error === 'forbidden');
for (const i of [4, 5, 6, 7]) await push(P1.token, xp(`xp${i}`, 150));
check('there is a daily ceiling on self-reported XP', first(await push(P1.token, xp('xp9', 150))).error === 'daily_limit');
check('other members see XP amounts but not the reasons', (await pull(P10.token)).docs.filter((d) => d.kind === 'xp').every((d) => d.data.reason === ''));
check('staff can award XP at the desk', first(await push(staffA, xp('xp-desk', 20, P1))).ok);

const chest = (id, extra = {}) => put('chests', id, { id, memberId: P10.id, reason: 'Closed all three rings', earnedAt: new Date().toISOString(), ...extra });
const jackpot = { openedAt: new Date().toISOString(), prize: { kind: 'xp', amount: 250, label: 'XP jackpot' } };
check('a member can earn a chest', first(await push(P10.token, chest('ch1'))).ok);
check('but can’t create one that is already opened', first(await push(P10.token, chest('ch-fake', jackpot))).error === 'forbidden');
check('or edit a prize in', first(await push(P10.token, chest('ch1', jackpot))).error === 'forbidden');
const open1 = await call('POST', '/v1/chests/ch1/open', { token: P10.token });
check('the server draws the prize when the chest is opened', open1.status === 200 && !!open1.data.prize?.kind, JSON.stringify(open1.data));
const afterOpen = await pull(P10.token);
check('the opened chest syncs with its prize', find(afterOpen.docs, 'chests', 'ch1')?.data.openedAt && find(afterOpen.docs, 'chests', 'ch1')?.data.prize?.kind === open1.data.prize.kind);
check('a chest opens only once', (await call('POST', '/v1/chests/ch1/open', { token: P10.token })).status === 404);
check('nobody can open someone else’s chest', (await call('POST', '/v1/chests/ch1/open', { token: P1.token })).status === 404);
for (const i of [2, 3, 4]) await push(P10.token, chest(`ch${i}`));
check('there is a daily limit on self-earned chests', first(await push(P10.token, chest('ch9'))).error === 'daily_limit');

// per-member records
check('a member saves their own workout log', first(await push(P1.token, put('workoutLog', P1.id, { [today]: ['ex1'] }))).ok);
check('but not someone else’s', first(await push(P1.token, put('workoutLog', P10.id, { [today]: ['ex1'] }))).error === 'forbidden');
check('only staff assign diet plans', first(await push(P1.token, put('dietPlans', P1.id, { title: 'x' }))).error === 'forbidden' && first(await push(staffA, put('dietPlans', P1.id, { title: 'Cut', coachId: 't1', meals: [] }))).ok);
await push(P1.token, put('progress', P1.id, [{ id: 'pg1', date: today, weight: 70, bodyFat: 18, waist: 80 }]));
const seenProgress = find((await pull(P10.token)).docs, 'progress', P1.id);
check('others see only a body weight, not measurements', seenProgress && seenProgress.data.length === 1 && seenProgress.data[0].weight === 70 && !('bodyFat' in seenProgress.data[0]), JSON.stringify(seenProgress));

// =============================================================================================
// Gym isolation
// =============================================================================================
const gymBRes = await call('POST', '/v1/admin/gyms', { token: admin, body: { gymName: `Other Gym ${tag}`, ownerName: 'Ravi', email: `ravi${tag}@example.com`, password: 'another-pass-1' } });
check('the admin creates a gym that is live at once', gymBRes.status === 201 && gymBRes.data.status === 'active');
const gymB = gymBRes.data;
const ownerB = (await call('POST', '/v1/auth/owner-login', { body: { email: `ravi${tag}@example.com`, password: 'another-pass-1' } })).data.token;
const mB = (await call('POST', '/v1/members', { token: ownerB, body: { name: 'Gym B Member', phone: phone(200), member: { planId: 'plan-monthly' } } })).data;
const viewB = await pull(ownerB);
check('another gym sees none of this gym’s data', viewB.docs.every((d) => !['bookings', 'payments', 'xp', 'chests'].includes(d.kind)) && !find(viewB.docs, 'members', P1.id) && !find(viewB.docs, 'slots', 's1'));
const bMemberTok = (await redeem(mB.inviteCode, phone(200), gymB.code)).data.token;
const bView = await pull(bMemberTok);
check('another gym’s member sees none of this gym’s timetable or members', !find(bView.docs, 'slots', 's1') && bView.docs.filter((d) => d.kind === 'members').length === 1);
check('writing the same id in another gym leaves this gym alone', first(await push(ownerB, put('payments', 'pay1', { id: 'pay1', memberId: mB.member.id, amount: 5 }))).ok && find((await pull(P1.token)).docs, 'payments', 'pay1').data.amount === 2000);
check('this gym’s staff can’t invite another gym’s member', (await call('POST', `/v1/members/${mB.member.id}/invite`, { token: staffA })).status === 404);

// =============================================================================================
// Removing a member, and changes other devices need to hear about
// =============================================================================================
const cursor = (await pull(ownerToken)).seq;
check('staff remove a member', first(await push(staffA, put('members', P15.id, null))).ok);
check('that member’s session stops working at once', (await call('GET', '/v1/me', { token: P15.token })).status === 401);
check('and their identity is gone', (await call('POST', `/v1/members/${P15.id}/invite`, { token: staffA })).status === 404);
const delta = await pull(ownerToken, cursor);
check('other devices hear about the deletion', delta.docs.some((d) => d.kind === 'members' && d.id === P15.id && d.deleted));
check('a member cannot delete anything', first(await push(P1.token, put('xp', 'xp1', null))).error === 'forbidden');
check('too many changes in one push are refused', (await call('POST', '/v1/sync/push', { token: staffA, body: { ops: Array.from({ length: 25 }, (_, i) => put('announcements', `a${i}`, { id: `a${i}` })) } })).status === 400);
check('staff can publish a notice for everyone', first(await push(staffA, put('announcements', 'an1', { id: 'an1', title: 'Closed Sunday', body: 'Holiday', kind: 'holiday', date: today, pinned: true }))).ok && !!find((await pull(P10.token)).docs, 'announcements', 'an1'));
const repair = await call('POST', '/v1/sync/get', { token: P1.token, body: { keys: ['plans/plan-monthly', 'plans/nope'] } });
check('a device can fetch specific documents to repair itself', repair.data.docs.length === 2 && repair.data.docs.find((d) => d.id === 'nope').deleted === true);

// =============================================================================================
// Sessions keep themselves alive while the app is used
// =============================================================================================
const raw = (path, token) => fetch(API + path, { headers: { authorization: `Bearer ${token}` } });
const sess = P12.token;
setExpiry(sess, 3);
check('a member with 3 days left is not renewed yet', (await raw('/v1/me', sess)).headers.get('x-session-token') === null);
setExpiry(sess, 1.5);
const fresh = (await raw('/v1/me', sess)).headers.get('x-session-token');
check('a member with under 2 days left gets a fresh token', !!fresh && fresh !== sess);
check('the new token works and the old one still does briefly', (await raw('/v1/me', fresh)).status === 200 && (await raw('/v1/me', sess)).status === 200);
check('the old token does not mint a second one', (await raw('/v1/me', sess)).headers.get('x-session-token') === null);
setExpiry(staffA, 6);
check('staff with 6 days left are not renewed', (await raw('/v1/me', staffA)).headers.get('x-session-token') === null);
setExpiry(staffA, 4.5);
const staffFresh = (await raw('/v1/me', staffA)).headers.get('x-session-token');
check('staff with under 5 days left get a fresh token', !!staffFresh && (await raw('/v1/me', staffFresh)).status === 200);
setExpiry(ownerToken, 4);
check('an owner with under 5 days left gets a fresh token', !!(await raw('/v1/me', ownerToken)).headers.get('x-session-token'));
setExpiry(sess, -0.01);
check('an expired token is refused', (await raw('/v1/me', sess)).status === 401);
check('logout ends the session on the server', (await call('POST', '/v1/auth/logout', { token: fresh })).status === 200 && (await raw('/v1/me', fresh)).status === 401);

// =============================================================================================
// Lockouts and suspension
// =============================================================================================
let last;
for (let i = 0; i < 6; i++) last = await call('POST', '/v1/auth/owner-login', { body: { email: `asha${tag}@example.com`, password: 'wrong-wrong-1' } });
check('owner login locks after repeated failures', last.status === 429);
check('even the right password is refused while locked', (await call('POST', '/v1/auth/owner-login', { body: { email: `asha${tag}@example.com`, password: 'fresh-pass-77' } })).status === 429);
check('the admin suspends the gym', (await call('POST', `/v1/admin/gyms/${gymA.id}/status`, { token: admin, body: { status: 'suspended' } })).status === 200);
check('suspended gym: members are cut off', (await call('GET', '/v1/sync?since=0', { token: P1.token })).data.error === 'gym_suspended');
check('suspended gym: staff are cut off', (await call('GET', '/v1/sync?since=0', { token: staffA })).data.error === 'gym_suspended');
check('suspended gym: the code shows nothing', (await call('GET', `/v1/gyms/${gymA.code}/public`)).status === 404);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
