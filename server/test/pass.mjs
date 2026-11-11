// Checks the signed check-in pass the way a forger would attack it. Needs no server.
import { makePass, passIsGenuine, readPass } from '../../src/lib/pass.ts';

let failed = 0;
function check(name, ok, extra = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${extra}`}`);
}

const KEY = 'a-long-random-key-only-this-member-has';
const GYM = 'gym_1';
const NOW = 1_800_000_000_000;
const window = Math.floor(NOW / 30_000);

const value = makePass(KEY, GYM, 'FK-1001', 30, NOW);
const read = readPass(value, GYM, 30, NOW);
check('a genuine pass is accepted', read.ok && read.code === 'FK-1001' && passIsGenuine(KEY, read), value);
check('it still works a minute later', readPass(value, GYM, 30, NOW + 60_000).ok);
check('a pass is too old after three minutes', !readPass(value, GYM, 30, NOW + 180_000).ok);
check('one from the far future is refused', !readPass(value, GYM, 30, NOW - 180_000).ok);

const forged = readPass(makePass('a-guess-at-the-key', GYM, 'FK-1001', 30, NOW), GYM, 30, NOW);
check('a pass signed with any other key is refused', forged.ok && !passIsGenuine(KEY, forged));

const parts = value.split(':');
const renamed = readPass([parts[0], parts[1], 'FK-1002', parts[3], parts[4]].join(':'), GYM, 30, NOW);
check('editing the member ID breaks the signature', renamed.ok && !passIsGenuine(KEY, renamed));

const shifted = readPass([parts[0], parts[1], parts[2], window + 1, parts[4]].join(':'), GYM, 30, NOW);
check('a photo can’t be moved on to the next window', shifted.ok && !passIsGenuine(KEY, shifted));

const blank = readPass([parts[0], parts[1], parts[2], parts[3], '0'.repeat(24)].join(':'), GYM, 30, NOW);
check('a made-up signature is refused', blank.ok && !passIsGenuine(KEY, blank));
const short = readPass([parts[0], parts[1], parts[2], parts[3], 'a'].join(':'), GYM, 30, NOW);
check('a shortened signature is refused', short.ok && !passIsGenuine(KEY, short));

check('a member with no key can’t be checked in by QR', read.ok && !passIsGenuine(undefined, read));
check('the key of another member doesn’t work', read.ok && !passIsGenuine('someone-elses-key', read));

const old = readPass(`GYMPASS:${GYM}:FK-1001:${window}`, GYM, 30, NOW);
check('the old unsigned format is refused, and says to update', !old.ok && old.reason.includes('older version'));
check('a pass from another gym is refused', !readPass(value, 'gym_2', 30, NOW).ok);
check('random text isn’t a pass', !readPass('hello', GYM, 30, NOW).ok);

console.log(failed ? `${failed} failed` : 'pass checks all passed');
process.exit(failed ? 1 : 0);
