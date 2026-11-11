// End-to-end checks against a running `wrangler dev`. Run: npm run db:local && npm run dev, then npm test.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

const API = process.env.API ?? 'http://127.0.0.1:8787';
const MASTER = process.env.ADMIN_TOKEN ?? 'dev-admin-token';
const tag = String(Date.now()).slice(-6);

// Earlier runs leave sign-in and sign-up counters behind. Start each run clean.
const sql = (q, ...flags) => spawnSync('npx', ['wrangler', 'd1', 'execute', 'gym-db', '--local', ...flags, '--command', `"${q}"`], { cwd: new URL('..', import.meta.url), shell: true, encoding: 'utf8' });
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
// Gym lifecycle: sign up (live at once), readable code, platform admins, pending and active
// =============================================================================================
const signup = await call('POST', '/v1/gyms', { body: { gymName: `Iron Temple ${tag}`, ownerName: 'Asha Rao', email: `asha${tag}@example.com`, phone: phone(1), password: 'correct-horse-9' } });
check('owner can sign up and the gym is live at once', signup.status === 201 && signup.data.gym?.status === 'active', JSON.stringify(signup.data));
const gymA = signup.data.gym;
const ownerA = signup.data.token;
check('gym code is short and readable', /^[A-Z]{2}\d{2,4}$/.test(gymA.code), gymA.code);
check('the same email can’t open a second gym', (await call('POST', '/v1/gyms', { body: { gymName: 'Another One', ownerName: 'Asha', email: `ASHA${tag}@example.com`, password: 'correct-horse-9' } })).data.error === 'email_taken');
check('a bad email is refused', (await call('POST', '/v1/gyms', { body: { gymName: 'Bad Mail', ownerName: 'Asha', email: 'not-an-email', password: 'correct-horse-9' } })).status === 400);
check('weak password is rejected', (await call('POST', '/v1/gyms', { body: { gymName: 'X Gym', ownerName: 'Bob', email: `bob${tag}@example.com`, password: 'short' } })).status === 400);
check('a new gym is visible by its code straight away', (await call('GET', `/v1/gyms/${gymA.code}/public`)).status === 200);

const PROFILE = { contact: { phone: '+919811100000', phoneDisplay: '+91 98111 00000', whatsapp: '919811100000', email: 'hello@irontemple.test', instagram: '@irontemple' }, address: { line1: '12 MG Road', line2: 'Pune 411001', mapsQuery: 'MG Road Pune' }, hours: [{ label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6], open: '05:30', close: '22:00' }], amenities: ['Lockers', 'Showers'], referral: { reward: 'Both of you get 10 extra days.' } };
check('the owner can set up branding and business details', (await call('PATCH', '/v1/gym', { token: ownerA, body: { tagline: 'Lift heavy', primaryColor: '#E4572E', features: { nutrition: false }, profile: PROFILE } })).status === 200);
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
check('admin can hold a gym back as pending', (await call('POST', `/v1/admin/gyms/${gymA.id}/status`, { token: admin, body: { status: 'pending' } })).status === 200);
check('pending gym is invisible by code', (await call('GET', `/v1/gyms/${gymA.code}/public`)).status === 404);
check('pending gym can’t sync yet', (await call('GET', '/v1/sync?since=0', { token: ownerA })).data.error === 'gym_pending');
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

// Reset links: the owner picks their own password from a one-time link the admin sends.
const emailA = `asha${tag}@example.com`;
const ownerLogin = (password) => call('POST', '/v1/auth/owner-login', { body: { email: emailA, password } });
const resetLink = () => call('POST', `/v1/admin/gyms/${gymA.id}/reset-link`, { token: admin });
const tokenOf = (r) => decodeURIComponent(new URL(r.data.url).hash.slice(1));
check('only an admin can make a reset link', (await call('POST', `/v1/admin/gyms/${gymA.id}/reset-link`)).status === 401);
const link1 = await resetLink();
check('the admin makes a one-time reset link', link1.status === 201 && /\/reset#[\w-]{40,}$/.test(link1.data.url) && link1.data.email === emailA, JSON.stringify(link1.data));
const link2 = await resetLink();
check('a new link cancels the earlier one', (await call('POST', '/v1/auth/reset/check', { body: { token: tokenOf(link1) } })).status === 410);
const chk = await call('POST', '/v1/auth/reset/check', { body: { token: tokenOf(link2) } });
check('the link shows which gym and email it is for', chk.status === 200 && chk.data.gymName === `Iron Temple ${tag}` && chk.data.email === emailA && chk.data.primaryColor === '#E4572E', JSON.stringify(chk.data));
const page = await fetch(`${API}/reset`);
check('the reset page loads with a strict script policy', page.status === 200 && (page.headers.get('content-security-policy') ?? '').includes("script-src 'nonce-") && (await page.text()).includes('/v1/auth/reset/check'));
check('a short password is refused', (await call('POST', '/v1/auth/reset', { body: { token: tokenOf(link2), password: 'short' } })).status === 400);
const before = (await ownerLogin('fresh-pass-77')).data.token;
const used = await call('POST', '/v1/auth/reset', { body: { token: tokenOf(link2), password: 'link-pass-88' } });
check('the owner sets a new password from the link', used.status === 200 && used.data.email === emailA, JSON.stringify(used.data));
check('the link works only once', (await call('POST', '/v1/auth/reset', { body: { token: tokenOf(link2), password: 'again-pass-99' } })).status === 410);
check('the owner is signed out everywhere by it', (await call('GET', '/v1/me', { token: before })).status === 401);
check('the old password stops working', (await ownerLogin('fresh-pass-77')).status === 401);
check('and the new one works', (await ownerLogin('link-pass-88')).status === 200);
const link3 = await resetLink();
sql(`UPDATE password_resets SET expires_at = 1 WHERE token_hash = '${hashOf(tokenOf(link3))}'`);
check('an expired link is refused', (await call('POST', '/v1/auth/reset/check', { body: { token: tokenOf(link3) } })).status === 410);
for (let i = 0; i < 6; i++) await ownerLogin('wrong-wrong-2');
check('(the owner is locked out)', (await ownerLogin('link-pass-88')).status === 429);
const link4 = await resetLink();
check('a reset link lifts the lockout', (await call('POST', '/v1/auth/reset', { body: { token: tokenOf(link4), password: 'fresh-pass-77' } })).status === 200 && (await ownerLogin('fresh-pass-77')).status === 200);

// The developer console: the page, one gym in full, and a backup without passwords.
const consolePage = await fetch(`${API}/admin`);
check('the developer console loads with a strict script policy', consolePage.status === 200 && (consolePage.headers.get('content-security-policy') ?? '').includes("script-src 'nonce-") && (await consolePage.text()).includes('Developer console'));
const detail = await call('GET', `/v1/admin/gyms/${gymA.id}`, { token: admin });
check('the admin sees one gym in full', detail.status === 200 && detail.data.gym.code === gymA.code && detail.data.people.some((p) => p.role === 'owner' && p.email === emailA) && Array.isArray(detail.data.records), JSON.stringify(detail.data).slice(0, 200));
check('an owner can’t see the admin view of a gym', (await call('GET', `/v1/admin/gyms/${gymA.id}`, { token: (await ownerLogin('fresh-pass-77')).data.token })).status === 401);
const exported = await call('GET', `/v1/admin/gyms/${gymA.id}/export`, { token: admin });
check('a backup has the gym but no password hashes', exported.status === 200 && exported.data.gym.id === gymA.id && exported.data.users.length >= 1 && !JSON.stringify(exported.data).includes('hmac$'), JSON.stringify(exported.data).slice(0, 200));

// Admin setup links: made straight in the database (scripts/admin-link.mjs), used once at /admin#setup=...
const invite = () => {
  const t = randomBytes(32).toString('base64url');
  sql(`INSERT INTO admin_invites (token_hash, expires_at, created_at) VALUES ('${hashOf(t)}', ${Math.floor(Date.now() / 1000) + 3600}, '${new Date().toISOString()}')`);
  return t;
};
const inv1 = invite();
check('a setup link is recognised', (await call('POST', '/v1/admin/setup/check', { body: { token: inv1 } })).status === 200);
check('a made-up setup link is refused', (await call('POST', '/v1/admin/setup/check', { body: { token: 'x'.repeat(43) } })).status === 410);
check('a setup link can’t make an admin out of a gym owner’s email', (await call('POST', '/v1/admin/setup', { body: { token: inv1, name: 'Dev', email: emailA, password: 'dev-pass-123' } })).status === 409);
const dev = await call('POST', '/v1/admin/setup', { body: { token: inv1, name: 'Dev Person', email: `dev${tag}@gmail.test`, password: 'dev-pass-123' } });
check('a setup link creates an admin account and signs it in', dev.status === 201 && dev.data.token?.startsWith('adm.') && (await call('GET', '/v1/admin/gyms', { token: dev.data.token })).status === 200, JSON.stringify(dev.data));
check('a setup link works only once', (await call('POST', '/v1/admin/setup', { body: { token: inv1, name: 'Dev Again', email: `dev2${tag}@gmail.test`, password: 'dev-pass-123' } })).status === 410);
check('the new admin signs in with email and password', (await call('POST', '/v1/auth/owner-login', { body: { email: `dev${tag}@gmail.test`, password: 'dev-pass-123' } })).data.role === 'admin');
const inv2 = invite();
check('a username with spaces or symbols is refused', (await call('POST', '/v1/admin/setup', { body: { token: inv2, name: 'Dev User', email: 'no spaces!', password: 'user-pass-123' } })).status === 400);
check('an admin account can use a username instead of an email', (await call('POST', '/v1/admin/setup', { body: { token: inv2, name: 'Dev User', email: `dev_user.${tag}`, password: 'user-pass-123' } })).status === 201);
check('the admin signs in with that username, any case', (await call('POST', '/v1/auth/owner-login', { body: { email: `  DEV_User.${tag} `, password: 'user-pass-123' } })).data.role === 'admin');
check('a wrong password for a username is refused like any other', (await call('POST', '/v1/auth/owner-login', { body: { email: `dev_user.${tag}`, password: 'wrong-pass-123' } })).status === 401);
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
check('the old code stopped working', (await redeem(m1.inviteCode)).status === 401);
const memberLogin = (code, p = phone(101)) => call('POST', '/v1/auth/member-login', { body: { phone: p, code } });
const again = await memberLogin(re.data.inviteCode);
check('the code is the member’s login: phone and code alone sign in again, no gym code', again.status === 200 && again.data.memberId === m1.member.id && again.data.gym?.code === gymA.code, JSON.stringify(again.data).slice(0, 200));
check('a wrong code with phone alone is refused', (await memberLogin(wrong)).status === 401);
check('unknown phone looks the same on the phone-only login', (await memberLogin('123456', phone(998))).data.message === (await memberLogin(wrong)).data.message);
check('a right code resets the wrong-try count', (await memberLogin(re.data.inviteCode)).status === 200);

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

// The desk books a member in (when the gym requires a booking before check-in).
check('staff can change a slot’s times, days and spots', first(await push(staffA, put('slots', 's1', { ...slotDoc, start: '06:30', end: '07:30', capacity: 3, days: [1, 2, 3, 4, 5, 6, 0] }))).ok);
check('the desk can book a member into a slot', first(await push(staffA, bk(P15, 'bk-desk'))).ok);
check('the member sees the booking the desk made', find((await pull(P15.token)).docs, 'bookings', 'bk-desk')?.data.status === 'booked');
check('a desk booking still respects the spots left', first(await push(staffA, bk(P14, 'bk-desk2'))).error === 'slot_full');

// what a member may change about themselves
const merged = first(await push(P10.token, put('members', P10.id, { ...P10.doc, name: 'Renamed Person', weeklyGoal: 5, phone: '9999999999', dues: -500, planId: 'plan-free', endDate: '2199-01-01' }))).data;
check('a member can rename themselves and set a goal', merged?.name === 'Renamed Person' && merged?.weeklyGoal === 5);
check('but not their phone, dues, plan or end date', merged?.phone === phone(110) && merged?.dues === 0 && merged?.planId === 'plan-monthly' && merged?.endDate === '2099-01-01', JSON.stringify(merged));
check('nobody can add a member through sync, only through an invite', first(await push(staffA, put('members', 'm_made_up', { id: 'm_made_up', name: 'Ghost', phone: phone(321) }))).error === 'use_invite');
check('staff can edit a member’s dues', first(await push(staffA, put('members', P11.id, { ...P11.doc, dues: 300 }))).ok);
check('staff can backdate a member’s plan and joining date', first(await push(staffA, put('members', P11.id, { ...P11.doc, dues: 300, joinedOn: '2019-04-01', startDate: '2026-08-15', endDate: '2026-11-15' }))).ok);
check('staff note when they messaged a member who stopped coming', first(await push(staffA, put('members', P11.id, { ...P11.doc, dues: 300, joinedOn: '2019-04-01', startDate: '2026-08-15', endDate: '2026-11-15', nudgedOn: today }))).ok);
const selfEdit = first(await push(P11.token, put('members', P11.id, { ...P11.doc, name: 'Eleven Renamed', nudgedOn: '2000-01-01', joinedOn: '2026-01-01' }))).data;
check('a member editing their profile keeps the gym’s dates and the message note', selfEdit?.nudgedOn === today && selfEdit?.joinedOn === '2019-04-01' && selfEdit?.startDate === '2026-08-15', JSON.stringify(selfEdit));
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
// Malformed records: one person's bad data must never reach anyone else's app
// =============================================================================================
const stamp = () => new Date().toISOString();
const damaged = {
  'a challenge entry with no date': put('challengeEntries', 'ce-bad', { id: 'ce-bad', memberId: P12.id, challengeId: 'c1', value: 10 }),
  'a challenge entry with a numeric date': put('challengeEntries', 'ce-bad2', { id: 'ce-bad2', memberId: P12.id, challengeId: 'c1', value: 10, date: 20260101 }),
  'a challenge entry with text for a score': put('challengeEntries', 'ce-bad3', { id: 'ce-bad3', memberId: P12.id, challengeId: 'c1', value: 'fast', date: today }),
  'a guest pass with a broken start date': put('guestPasses', 'gp-bad', { id: 'gp-bad', hostId: P12.id, name: 'Guest', phone: '9000000000', code: 'G1234', createdOn: today, activatedOn: 'soon', visits: [] }),
  'a guest pass with no visit list': put('guestPasses', 'gp-bad2', { id: 'gp-bad2', hostId: P12.id, name: 'Guest', phone: '9000000000', code: 'G1235', createdOn: today }),
  'a pause with no end date': put('pauses', 'ps-bad', { id: 'ps-bad', memberId: P12.id, start: '2099-02-01', reason: 'Travel', status: 'pending', createdAt: stamp() }),
  'a member name that is not text': put('members', P12.id, { ...P12.doc, name: { first: 'x' } }),
  'an XP event with an unreadable time': put('xp', 'xp-bad', { id: 'xp-bad', memberId: P12.id, amount: 5, reason: 'x', at: 'whenever' }),
  'a progress list holding the wrong thing': put('progress', P12.id, ['not an entry']),
  'a workout log with a broken date': put('workoutLog', P12.id, { soon: ['ex1'] }),
  'a record stored under a different id': put('lifts', 'lf-x', { id: 'lf-other', memberId: P12.id, exercise: 'Squat', weight: 60, reps: 5, date: today }),
};
for (const [what, op] of Object.entries(damaged)) check(`${what} is refused`, first(await push(P12.token, op)).error === 'invalid', JSON.stringify(first(await push(P12.token, op))));

// Every shape the app really writes, so validation can never refuse normal use.
const normal = {
  'a lift': put('lifts', 'lf-1', { id: 'lf-1', memberId: P12.id, exercise: 'Back squat', liftKey: 'squat', weight: 62.5, reps: 5, date: today }),
  'a lift with no strength key': put('lifts', 'lf-2', { id: 'lf-2', memberId: P12.id, exercise: 'Curl', weight: 10, reps: 12, date: today }),
  'a challenge entry': put('challengeEntries', 'ce-1', { id: 'ce-1', memberId: P12.id, challengeId: 'c1', value: 95.5, date: today }),
  'a breathing session': put('mindLog', 'md-1', { id: 'md-1', memberId: P12.id, sessionId: 'box', minutes: 3, at: stamp() }),
  'a guest pass': put('guestPasses', 'gp-1', { id: 'gp-1', hostId: P12.id, name: 'Priya', phone: '9000000001', code: 'G4821', createdOn: today, visits: [] }),
  'a pause request': put('pauses', 'ps-1', { id: 'ps-1', memberId: P12.id, start: '2099-03-01', end: '2099-03-05', reason: 'Travel', note: 'Goa', status: 'pending', createdAt: stamp() }),
  'a coach request': put('ptRequests', 'pt-1', { id: 'pt-1', memberId: P12.id, trainerId: 't1', preferredTime: 'Mornings', goal: 'Lose weight', status: 'pending', createdAt: stamp() }),
  'a support ticket': put('tickets', 'tk-1', { id: 'tk-1', memberId: P12.id, category: 'Equipment', message: 'The treadmill is loud', status: 'open', createdAt: stamp() }),
  'a notice to myself': put('notices', 'nt-1', { id: 'nt-1', memberId: P12.id, title: 'Booked', body: 'You are in', kind: 'booking', at: stamp(), read: false }),
  'an XP event': put('xp', 'xp-p12', { id: 'xp-p12', memberId: P12.id, amount: 5, reason: 'Exercise done', at: stamp(), key: 'ex-1' }),
  'a chest': put('chests', 'ch-p12', { id: 'ch-p12', memberId: P12.id, reason: 'New PR: Curl', earnedAt: stamp() }),
  'a body progress list': put('progress', P12.id, [{ id: 'pg-1', date: today, weight: 70.5 }, { id: 'pg-2', date: today, weight: 70, bodyFat: 18, waist: 80 }]),
  'a workout log': put('workoutLog', P12.id, { [today]: ['ex1', 'ex2'] }),
  'a meal log': put('mealLog', P12.id, { [today]: ['breakfast'] }),
  'a water count': put('water', P12.id, { [today]: 4 }),
  'ring claims': put('ringClaims', P12.id, { [today]: ['show', 'train', 'all'] }),
  'supplements': put('supplements', P12.id, [{ id: 'sp-1', name: 'Creatine', dose: '5 g', time: 'After workout', kind: 'supplement', addedBy: 'member' }]),
  'a league tier': put('leagueTier', P12.id, 0),
  'a higher league tier': put('leagueTier', P13.id, 2),
  'the week a league was settled': put('leagueSettledWeek', P12.id, today),
  'my own profile': put('members', P12.id, { ...P12.doc, name: 'Renamed Twelve', weeklyGoal: 3, goalWeight: 68, gender: 'female' }),
};
for (const [what, op] of Object.entries(normal)) {
  const token = op.id === P13.id ? P13.token : P12.token;
  const r = first(await push(token, op));
  check(`${what} is still accepted`, r?.ok === true, JSON.stringify(r));
}
check('a league tier reaches the server', find((await pull(P13.token)).docs, 'leagueTier', P13.id)?.data === 2);

// Strength and endurance test results: the member and the gym see them, nobody else.
const testLine = (extra = {}) => ({ itemId: 'pushups', name: 'Push-ups', measure: 'reps', better: 'higher', sets: [32], value: 32, target: 40, score: 80, ...extra });
const testDoc = (m, id, extra = {}) => put('testResults', id, { id, memberId: m.id, date: today, at: stamp(), score: 71, bodyweight: 72.5, lines: [testLine(), testLine({ itemId: 'mile', name: '1 mile brisk walk', measure: 'time', better: 'lower', sets: [905], value: 905, target: 840, score: 93 })], skipped: ['Leg press'], ...extra });
check('a member saves their own strength test', first(await push(P12.token, testDoc(P12, 'ft-1'))).ok);
check('the gym can save a test it ran with a member', first(await push(staffA, testDoc(P13, 'ft-2', { by: 'Front desk' }))).ok);
check('a member can’t save a test for someone else', first(await push(P12.token, testDoc(P13, 'ft-3'))).error === 'forbidden');
check('a test score over 100 is refused', first(await push(P12.token, testDoc(P12, 'ft-4', { score: 140 }))).error === 'invalid');
check('a test line with an unknown measure is refused', first(await push(P12.token, testDoc(P12, 'ft-5', { lines: [testLine({ measure: 'miles' })] }))).error === 'invalid');
check('a member sees their own test results', !!find((await pull(P12.token)).docs, 'testResults', 'ft-1'));
check('and the one the gym ran with them', !!find((await pull(P13.token)).docs, 'testResults', 'ft-2'));
check('other members never see someone’s test', !find((await pull(P13.token)).docs, 'testResults', 'ft-1') && !find((await pull(P10.token)).docs, 'testResults', 'ft-2'));
check('staff see every member’s tests', !!find((await pull(staffA)).docs, 'testResults', 'ft-1') && !!find((await pull(staffA)).docs, 'testResults', 'ft-2'));
check('a member can’t delete a test result', first(await push(P12.token, put('testResults', 'ft-1', null))).error === 'forbidden');
const customTest = [{ id: 'plank', name: 'Plank hold', measure: 'time', sets: 1, target: 120, better: 'higher', active: true }];
check('staff can set up the gym’s own test', first(await push(staffA, put('settings', 'gym', { ...find(start.docs, 'settings', 'gym').data, strengthTest: customTest, awayAfterDays: 5, awayMessage: 'Hi {name}, we miss you!' }))).ok);
const seenSettings = find((await pull(P12.token)).docs, 'settings', 'gym');
check('members get the gym’s test and settings', seenSettings?.data.strengthTest?.[0]?.id === 'plank' && seenSettings?.data.awayAfterDays === 5, JSON.stringify(seenSettings?.data).slice(0, 200));
check('members can’t change the test', first(await push(P12.token, put('settings', 'gym', { strengthTest: [] }))).error === 'forbidden');

// Records stored before these checks existed, or written by staff, are held back on the way out.
check('staff write a damaged record, as an older version could', first(await push(staffA, put('challengeEntries', 'ce-old', { id: 'ce-old', memberId: P12.id, challengeId: 'c1', value: 5 }))).ok);
check('a damaged record never reaches other members', !find((await pull(P10.token)).docs, 'challengeEntries', 'ce-old'));
check('or the staff who could otherwise crash on it', !find((await pull(staffA)).docs, 'challengeEntries', 'ce-old'));
check('a healthy record next to it still arrives', !!find((await pull(P10.token)).docs, 'challengeEntries', 'ce-1'));

// =============================================================================================
// Daily limits and prizes: the phone doesn't choose the date, and only the desk unlocks real prizes
// =============================================================================================
const dayOff = (n) => new Date(Date.now() + n * 86400_000).toISOString();
const xpOn = (m, id, at, amount = 150) => put('xp', id, { id, memberId: m.id, amount, reason: 'Exercise done', at });
const chestOn = (m, id, earnedAt = dayOff(0), extra = {}) => put('chests', id, { id, memberId: m.id, reason: 'New PR: Curl', earnedAt, ...extra });

for (const i of [1, 2, 3, 4]) await push(P13.token, xpOn(P13, `lim-xp${i}`, dayOff(-1)));
check('XP backdated to yesterday still counts against today’s limit', first(await push(P13.token, xpOn(P13, 'lim-xp5', dayOff(0)))).error === 'daily_limit');
check('so does XP dated tomorrow', first(await push(P13.token, xpOn(P13, 'lim-xp6', dayOff(1)))).error === 'daily_limit');
for (const i of [1, 2, 3, 4]) await push(P14.token, chestOn(P14, `lim-ch${i}`, dayOff(-1)));
check('chests backdated to yesterday still count against today’s limit', first(await push(P14.token, chestOn(P14, 'lim-ch5'))).error === 'daily_limit');
check('XP from a phone that was offline yesterday is still accepted', first(await push(P11.token, xpOn(P11, 'lim-xp7', dayOff(-1), 20))).ok);
check('XP dated long ago is refused', first(await push(P11.token, xpOn(P11, 'lim-xp8', dayOff(-30), 20))).error === 'invalid');
check('XP dated in the future is refused', first(await push(P11.token, xpOn(P11, 'lim-xp9', dayOff(5), 20))).error === 'invalid');
check('a chest dated long ago is refused', first(await push(P11.token, chestOn(P11, 'lim-ch6', dayOff(-30)))).error === 'invalid');

const earned = first(await push(P11.token, chestOn(P11, 'self-1', dayOff(0), { selfEarned: false })));
check('a chest a member creates is marked as self-earned, whatever the phone says', earned.ok && earned.data?.selfEarned === true, JSON.stringify(earned));
check('and the phone is told, so it keeps the same copy', find((await pull(P11.token)).docs, 'chests', 'self-1')?.data.selfEarned === true);
const { selfEarned: _drop, ...stripped } = earned.data;
check('a member can’t remove the mark', first(await push(P11.token, put('chests', 'self-1', stripped))).ok && find((await pull(P11.token)).docs, 'chests', 'self-1')?.data.selfEarned === true);
check('a member can’t take over someone else’s chest', first(await push(P11.token, chestOn(P11, 'lim-ch1'))).error === 'forbidden');

const openAll = async (prefix, extra) => {
  const prizes = [];
  for (let b = 0; b < 5; b++) {
    await push(staffA, ...Array.from({ length: 20 }, (_, i) => chestOn(P11, `${prefix}-${b}-${i}`, dayOff(0), extra)));
    for (let i = 0; i < 20; i++) prizes.push((await call('POST', `/v1/chests/${prefix}-${b}-${i}/open`, { token: P11.token })).data.prize?.kind);
  }
  return prizes;
};
const selfPrizes = await openAll('odds-self', { selfEarned: true });
check('100 self-earned chests pay only XP', selfPrizes.length === 100 && selfPrizes.every((k) => k === 'xp'), selfPrizes.filter((k) => k !== 'xp').join());
const deskPrizes = await openAll('odds-desk', {});
check('chests from the desk can still win real prizes', deskPrizes.some((k) => k && k !== 'xp'), deskPrizes.join());

// =============================================================================================
// Pass keys: what makes a check-in QR impossible to work out from a member ID
// =============================================================================================
const keyOf = (docs, id) => find(docs, 'members', id)?.data.passKey;
const k12 = keyOf((await pull(P12.token)).docs, P12.id);
check('every new member gets a long random pass key', typeof k12 === 'string' && k12.length >= 40, String(k12));
check('no two members share a key', keyOf((await pull(staffA)).docs, P13.id) !== k12);
check('the desk can read it, to check passes offline', keyOf((await pull(staffA)).docs, P12.id) === k12);
check('other members can’t', keyOf((await pull(P13.token)).docs, P12.id) === undefined);
check('the key can’t be set when adding a member', (await call('POST', '/v1/members', { token: staffA, body: { name: 'Chosen Key', phone: phone(180), member: { passKey: 'mine' } } })).data.member?.passKey !== 'mine');
await push(P12.token, put('members', P12.id, { ...P12.doc, name: 'Twelve', passKey: 'chosen-by-me' }));
check('a member can’t change their own key', keyOf((await pull(P12.token)).docs, P12.id) === k12);
const { passKey: _k, ...noKey } = find((await pull(staffA)).docs, 'members', P12.id).data;
check('a staff phone with an older copy can’t wipe the key', first(await push(staffA, put('members', P12.id, noKey))).ok && keyOf((await pull(staffA)).docs, P12.id) === k12);
await push(staffA, put('members', P12.id, { ...noKey, passKey: 'chosen-by-staff' }));
check('and staff can’t choose one', keyOf((await pull(staffA)).docs, P12.id) === k12);
const beforeInvite = (await pull(staffA)).seq;
const reissued = await call('POST', `/v1/members/${P12.id}/invite`, { token: staffA });
const rotated = keyOf((await pull(staffA, beforeInvite)).docs, P12.id);
check('a new login code replaces the key, so a lost phone’s pass stops working', reissued.status === 200 && !!rotated && rotated !== k12, String(rotated));
const stored = JSON.parse(sql(`SELECT COUNT(*) AS n FROM docs WHERE kind = 'members' AND deleted = 0 AND json_extract(data, '$.passKey') IS NULL`, '--json').stdout || '[]')[0]?.results?.[0]?.n;
check('no member in the database is left without a key', stored === 0, String(stored));

// =============================================================================================
// Each gym chooses: chests and prizes, and XP with leaderboards, switch off separately
// =============================================================================================
const setFeatures = (features) => call('PATCH', '/v1/gym', { token: ownerToken, body: { features } });
await push(staffA, chestOn(P11, 'off-1'), chestOn(P11, 'off-won'));
await call('POST', '/v1/chests/off-won/open', { token: P11.token });

check('the owner turns chests off and keeps XP', (await setFeatures({ gamification: true, chests: false })).status === 200);
check('members see that it’s off', (await call('GET', `/v1/gyms/${gymA.code}/public`)).data.features?.chests === false);
check('a member’s phone can’t earn a chest', first(await push(P13.token, chestOn(P13, 'off-2'))).error === 'feature_off');
check('neither can the desk give one', first(await push(staffA, chestOn(P11, 'off-3'))).error === 'feature_off');
check('a chest already earned can’t be opened', (await call('POST', '/v1/chests/off-1/open', { token: P11.token })).status === 403);
check('XP still counts', first(await push(P14.token, xpOn(P14, 'off-xp1', dayOff(0), 5))).ok);
const won = find((await pull(staffA)).docs, 'chests', 'off-won').data;
check('the desk can still hand over a prize already won', first(await push(staffA, put('chests', 'off-won', { ...won, redeemedAt: stamp() }))).ok);

check('the owner turns XP off too', (await setFeatures({ gamification: false, chests: true })).status === 200);
check('XP stops', first(await push(P14.token, xpOn(P14, 'off-xp2', dayOff(0), 5))).error === 'feature_off');
check('and chests stop with it, because they pay in XP', first(await push(P13.token, chestOn(P13, 'off-4'))).error === 'feature_off');

check('turning both back on restores everything', (await setFeatures({ gamification: true, chests: true })).status === 200 && first(await push(staffA, chestOn(P11, 'off-5'))).ok && (await call('POST', '/v1/chests/off-1/open', { token: P11.token })).status === 200);
check('a gym that has never set this keeps chests on', (await setFeatures({ nutrition: false })).status === 200 && first(await push(staffA, chestOn(P11, 'off-6'))).ok && first(await push(P14.token, xpOn(P14, 'off-xp3', dayOff(0), 5))).ok);

// =============================================================================================
// The shop: the owner lists, members reserve at the shop's price, the desk sells
// =============================================================================================
const allOk = (r) => r.data.results?.length > 0 && r.data.results.every((x) => x.ok);
const whey = { id: 'whey', name: 'Whey 1kg', category: 'Supplements', price: 2400, stock: 5, active: true };
check('the owner lists a product', first(await push(ownerToken, put('products', 'whey', whey))).ok);
check('the desk can list one too', first(await push(staffA, put('products', 'band', { id: 'band', name: 'Resistance band', category: 'Gear', price: 350, active: true }))).ok);
check('the owner can take one off sale', first(await push(ownerToken, put('products', 'gone', { id: 'gone', name: 'Old shaker', category: 'Gear', price: 200, active: false }))).ok);
check('members see what’s on sale', !!find((await pull(P1.token)).docs, 'products', 'whey'));
check('a member can’t change a price', first(await push(P1.token, put('products', 'whey', { ...whey, price: 1 }))).error === 'forbidden');
const reserve = (m, id, items) => push(m.token, put('orders', id, { id, memberId: m.id, items, total: 1, status: 'requested', createdAt: stamp() }));
const ord = first(await reserve(P1, 'o1', [{ productId: 'whey', name: 'Cheap whey', price: 1, qty: 2 }]));
check('a member reserves at the shop’s price, not the phone’s', ord.ok && ord.data?.total === 4800 && ord.data.items[0].price === 2400 && ord.data.items[0].name === 'Whey 1kg', JSON.stringify(ord));
check('a member can’t reserve something that doesn’t exist', first(await reserve(P1, 'o2', [{ productId: 'nope', qty: 1 }])).error === 'invalid');
check('or something taken off sale', first(await reserve(P1, 'o2b', [{ productId: 'gone', qty: 1 }])).error === 'invalid');
check('or a silly quantity', first(await reserve(P1, 'o2c', [{ productId: 'band', qty: 500 }])).error === 'invalid');
check('a member can’t reserve in someone else’s name', first(await push(P1.token, put('orders', 'o2d', { id: 'o2d', memberId: P10.id, items: [{ productId: 'band', qty: 1 }], total: 350, status: 'requested', createdAt: stamp() }))).error === 'forbidden');
check('a member can’t mark their own order as handed over', first(await push(P1.token, put('orders', 'o1', { ...ord.data, status: 'done' }))).error === 'forbidden');
check('another member can’t see it', !find((await pull(P10.token)).docs, 'orders', 'o1'));
const sale = { id: 'sale1', date: today, items: ord.data.items, total: 4800, method: 'UPI', memberId: P1.id, orderId: 'o1', at: stamp() };
check('the desk sees it and hands it over as a sale', !!find((await pull(staffA)).docs, 'orders', 'o1') && allOk(await push(staffA, put('orders', 'o1', { ...ord.data, status: 'done', saleId: 'sale1' }), put('sales', 'sale1', sale))));
check('the desk records a walk-in sale', first(await push(staffA, put('sales', 'sale2', { id: 'sale2', date: today, items: [{ productId: 'band', name: 'Resistance band', price: 350, qty: 1 }], total: 350, method: 'Cash', at: stamp() }))).ok);
const o3 = first(await reserve(P10, 'o3', [{ productId: 'band', qty: 1 }]));
check('a member calls off a reservation the desk hasn’t touched', o3.ok && first(await push(P10.token, put('orders', 'o3', { ...o3.data, status: 'cancelled' }))).ok);
check('but not one that’s already been handed over', first(await push(P1.token, put('orders', 'o1', { ...ord.data, status: 'cancelled' }))).error === 'forbidden');
check('members never see the shop’s takings', !find((await pull(P1.token)).docs, 'sales', 'sale1'));

// =============================================================================================
// Staff pay and the books: the owner's alone. The desk marks attendance without seeing pay.
// =============================================================================================
const coach = { id: 't1', name: 'Coach Vik', role: 'Coach', phone: phone(300), payType: 'monthly', pay: 25000, offDays: [0], joinedOn: today, active: true };
check('the owner adds a coach with their pay', first(await push(ownerToken, put('team', 't1', coach))).ok);
const deskTeam = find((await pull(staffA)).docs, 'team', 't1');
check('the desk sees the team without their pay or number', deskTeam?.data.name === 'Coach Vik' && deskTeam.data.pay === undefined && deskTeam.data.payType === undefined && deskTeam.data.phone === undefined, JSON.stringify(deskTeam));
check('the owner sees the full record', find((await pull(ownerToken)).docs, 'team', 't1')?.data.pay === 25000);
check('the desk can’t change anyone’s pay', first(await push(staffA, put('team', 't1', { ...coach, pay: 99 }))).error === 'forbidden');
check('or remove someone from the team', first(await push(staffA, put('team', 't1', null))).error === 'forbidden');
check('the desk marks attendance', first(await push(staffA, put('attendance', today, { t1: 'A' }))).ok);
check('the owner records an expense', first(await push(ownerToken, put('ledger', 'l1', { id: 'l1', dir: 'out', date: today, category: 'Rent', amount: 40000 }))).ok);
check('and pays a salary from the same books', first(await push(ownerToken, put('ledger', 'l2', { id: 'l2', dir: 'out', date: today, category: 'Salaries', amount: 20000, teamId: 't1', period: today.slice(0, 7) }))).ok);
check('the desk never sees the books', !find((await pull(staffA)).docs, 'ledger', 'l1'));
check('nor can the desk write to them', first(await push(staffA, put('ledger', 'l3', { id: 'l3', dir: 'in', date: today, category: 'Other', amount: 1 }))).error === 'forbidden');
check('or delete from them', first(await push(staffA, put('ledger', 'l1', null))).error === 'forbidden');
check('a repair fetch doesn’t leak the books to the desk', (await call('POST', '/v1/sync/get', { token: staffA, body: { keys: ['ledger/l1', 'team/t1'] } })).data.docs.every((d) => d.kind !== 'ledger' && (d.kind !== 'team' || d.data.pay === undefined)));
check('members see none of it', (await pull(P1.token)).docs.every((d) => !['team', 'attendance', 'ledger', 'sales'].includes(d.kind)));
check('a member can’t write to any of it', (await push(P1.token, put('team', 'tx', { id: 'tx' }), put('attendance', today, {}), put('ledger', 'lx', { id: 'lx' }), put('sales', 'sx', { id: 'sx' }))).data.results.every((x) => x.error === 'forbidden'));

// =============================================================================================
// Switching pauses, guest passes and the shop off
// =============================================================================================
const pauseFor = (m, id) => put('pauses', id, { id, memberId: m.id, start: dayOff(3).slice(0, 10), end: dayOff(6).slice(0, 10), reason: 'Travel', status: 'pending', createdAt: stamp() });
check('the owner turns pausing, guest passes and the shop off', (await setFeatures({ pauses: false, guestPass: false, store: false })).status === 200);
check('members can’t ask for a pause', first(await push(P13.token, pauseFor(P13, 'pz1'))).error === 'feature_off');
check('or hand out a guest pass', first(await push(P13.token, put('guestPasses', 'gz1', { id: 'gz1', hostId: P13.id, name: 'Friend', phone: phone(301), code: 'GZ1', createdOn: today, visits: [] }))).error === 'feature_off');
check('or reserve from the shop', first(await reserve(P13, 'oz1', [{ productId: 'band', qty: 1 }])).error === 'feature_off');
check('the desk can still pause a member', first(await push(staffA, put('pauses', 'pz2', { id: 'pz2', memberId: P13.id, start: dayOff(10).slice(0, 10), end: dayOff(12).slice(0, 10), reason: 'Injury', status: 'approved', createdAt: stamp() }))).ok);
check('turning them back on works', (await setFeatures({ nutrition: false })).status === 200 && first(await push(P13.token, pauseFor(P13, 'pz3'))).ok);

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

// =============================================================================================
// Deleting a gym from the developer console
// =============================================================================================
const doomed = await call('POST', '/v1/admin/gyms', { token: admin, body: { gymName: `Short Lived ${tag}`, ownerName: 'Temp Owner', email: `temp${tag}@example.com`, password: 'temp-pass-123' } });
const doomedOwner = (await call('POST', '/v1/auth/owner-login', { body: { email: `temp${tag}@example.com`, password: 'temp-pass-123' } })).data.token;
check('(the gym to delete has data)', first(await push(doomedOwner, put('announcements', 'bye', { id: 'bye', title: 'Closing', body: 'Last day', kind: 'holiday', date: today, pinned: false }))).ok);
check('deleting needs the gym code typed back', (await call('DELETE', `/v1/admin/gyms/${doomed.data.id}`, { token: admin, body: { confirm: 'NOPE' } })).status === 400);
check('an owner can’t delete a gym', (await call('DELETE', `/v1/admin/gyms/${doomed.data.id}`, { token: doomedOwner, body: { confirm: doomed.data.code } })).status === 401);
const deleted = await call('DELETE', `/v1/admin/gyms/${doomed.data.id}`, { token: admin, body: { confirm: doomed.data.code.toLowerCase() } });
check('the admin deletes a gym and gets a backup', deleted.status === 200 && deleted.data.backup.gym.code === doomed.data.code && deleted.data.backup.docs.some((d) => d.kind === 'announcements'), JSON.stringify(deleted.data).slice(0, 200));
check('the deleted gym is gone everywhere', (await call('GET', `/v1/admin/gyms/${doomed.data.id}`, { token: admin })).status === 404 && (await call('GET', `/v1/gyms/${doomed.data.code}/public`)).status === 404 && !(await call('GET', '/v1/admin/gyms', { token: admin })).data.gyms.some((g) => g.id === doomed.data.id));
check('its owner is signed out and can’t sign in', (await call('GET', '/v1/me', { token: doomedOwner })).status === 401 && (await call('POST', '/v1/auth/owner-login', { body: { email: `temp${tag}@example.com`, password: 'temp-pass-123' } })).status === 401);
check('other gyms are untouched', (await call('GET', `/v1/admin/gyms/${gymBRes.data.id}`, { token: admin })).status === 200);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
