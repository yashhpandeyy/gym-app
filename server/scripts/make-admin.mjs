// Creates a platform admin account, so you can sign in to the app with your own email and create gyms.
// Usage: node scripts/make-admin.mjs you@gmail.com "Your Name" "a-strong-password"
// For the deployed server: API=https://your-worker.workers.dev ADMIN_TOKEN=... node scripts/make-admin.mjs ...
const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error('Usage: node scripts/make-admin.mjs <email> <name> <password>');
  process.exit(1);
}
const API = process.env.API ?? 'http://127.0.0.1:8787';
const TOKEN = process.env.ADMIN_TOKEN ?? 'dev-admin-token';
const res = await fetch(`${API}/v1/admin/accounts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ email, name, password }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Failed (${res.status}): ${data.message ?? JSON.stringify(data)}`);
  process.exit(1);
}
console.log(`Admin ${email} created. Open the app, tap "I run a gym", and sign in with it.`);
