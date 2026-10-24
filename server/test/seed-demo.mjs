// Builds a ready-to-try gym through the real API, the way an owner would, and prints the logins.
// This is a developer convenience for trying the app. Nothing here ships inside the app itself.
// Run: node test/seed-demo.mjs
const API = process.env.API ?? 'http://127.0.0.1:8787';
const MASTER = process.env.ADMIN_TOKEN ?? 'dev-admin-token';

const call = async (method, path, token, body) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(data)}`);
  return data;
};
const push = async (token, ...ops) => {
  const r = await call('POST', '/v1/sync/push', token, { ops });
  const bad = r.results.filter((x) => !x.ok);
  if (bad.length) throw new Error(`push refused: ${JSON.stringify(bad)}`);
};

const tag = String(Date.now()).slice(-4);
const email = `asha${tag}@irontemple.test`;
const password = 'ironpass123';
const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const plus = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10);

const gym = await call('POST', '/v1/admin/gyms', MASTER, { gymName: 'Iron Temple', ownerName: 'Asha Rao', email, password });
const login = await fetch(API + '/v1/auth/owner-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
const owner = (await login.json()).token;

await call('PATCH', '/v1/gym', owner, {
  tagline: 'Lift heavy. Leave lighter.',
  primaryColor: '#E4572E',
  profile: {
    contact: { phone: '+919811100000', phoneDisplay: '+91 98111 00000', whatsapp: '919811100000', email: 'hello@irontemple.test', instagram: 'irontemple' },
    address: { line1: '12 MG Road', line2: 'Pune, Maharashtra 411001', mapsQuery: 'MG Road Pune' },
    hours: [
      { label: 'Mon to Sat', days: [1, 2, 3, 4, 5, 6], open: '05:30', close: '22:00' },
      { label: 'Sun', days: [0], open: '07:00', close: '13:00' },
    ],
    amenities: ['Strength floor', 'Cardio deck', 'Lockers', 'Showers'],
    referral: { reward: 'You both get 10 extra days when your friend joins.' },
  },
});

await call('POST', '/v1/staff', owner, { name: 'Front Desk', phone: `90000${tag}2`.slice(0, 10), pin: '2580' });

await push(
  owner,
  { kind: 'plans', id: 'plan-monthly', data: { id: 'plan-monthly', name: 'Monthly', months: 1, price: 2000, pauseDays: 5, perks: ['Full gym access', 'Slot booking'], active: true } },
  { kind: 'plans', id: 'plan-quarterly', data: { id: 'plan-quarterly', name: 'Quarterly', months: 3, price: 5400, pauseDays: 15, perks: ['Full gym access', 'Slot booking', 'Group classes'], active: true, popular: true } },
  { kind: 'plans', id: 'plan-annual', data: { id: 'plan-annual', name: 'Annual', months: 12, price: 18000, pauseDays: 60, perks: ['Everything in Quarterly', 'A locker of your own'], active: true } },
  { kind: 'slots', id: 'sl-early', data: { id: 'sl-early', start: '06:00', end: '07:30', capacity: 12, days: [0, 1, 2, 3, 4, 5, 6] } },
  { kind: 'slots', id: 'sl-eve', data: { id: 'sl-eve', start: '18:00', end: '19:30', capacity: 3, days: [1, 2, 3, 4, 5, 6] } },
  { kind: 'slots', id: 'sl-night', data: { id: 'sl-night', start: '20:00', end: '21:30', capacity: 10, days: [1, 2, 3, 4, 5, 6] } },
  { kind: 'trainers', id: 'tr1', data: { id: 'tr1', name: 'Karan Mehta', focus: 'Strength and fat loss', years: 8, rating: 0, price: 800, bio: 'Powerlifting background. Keeps it simple and heavy.', certifications: ['ACE'] } },
  { kind: 'classes', id: 'cl1', data: { id: 'cl1', name: 'Morning yoga', coachId: '', days: [1, 3, 5], start: '07:30', minutes: 60, capacity: 15, intensity: 'Easy', about: 'Mobility and breathing to start the day.' } },
  { kind: 'announcements', id: 'an1', data: { id: 'an1', title: 'Welcome to Iron Temple', body: 'Book your slot in the app and show your pass at the desk.', kind: 'notice', date: today, pinned: true } },
);

console.log(`\nGym code:     ${gym.code}   (Iron Temple, orange)`);
console.log(`Owner login:  ${email}  /  ${password}`);
console.log(`Front desk:   90000${tag}2  /  PIN 2580\n`);

let i = 0;
for (const [name, gender, planId, months] of [
  ['Rohit Sharma', 'male', 'plan-quarterly', 3],
  ['Priya Menon', 'female', 'plan-monthly', 1],
  ['Karan Patel', 'male', 'plan-annual', 12],
]) {
  const phone = `98765${tag}${i++}`.slice(0, 10);
  const end = plus(today, months * 30 - 1);
  const m = await call('POST', '/v1/members', owner, {
    name,
    phone,
    member: { gender, planId, joinedOn: today, startDate: today, endDate: end, pauseAllowance: 5, dues: 0, weeklyGoal: 4 },
  });
  console.log(`Member ${name}: phone ${phone}, invite code ${m.inviteCode}`);
}
