"""Builds SQL that fills the live "Yash Gym" with a believable showcase: slots, trainers, classes,
challenges, 18 members with payments, attendance, lifts, XP, chests and bookings.

Nothing is applied by this script. It writes scripts/demo_gym.sql, which you run with wrangler:
    npx wrangler d1 execute <db> --remote --file ../scripts/demo_gym.sql
Existing rows are never touched (INSERT OR IGNORE, seq numbers continue from the gym's counter).
Usage: python seed_demo_gym.py <gym_id> <first_seq> <first_member_no> <first_invoice_no> <today YYYY-MM-DD>
"""
import json
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone

GYM, SEQ0, MNO0, INV0, TODAY = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
today = date.fromisoformat(TODAY)
rnd = random.Random(2026)
NOW = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

rows: list[str] = []
seq = SEQ0 - 1


def q(v):
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"


def doc(kind, id_, data, owner=None, k1=None, k2=None, at=None):
    global seq
    seq += 1
    rows.append(
        f"INSERT OR IGNORE INTO docs (gym_id, kind, id, member_id, data, seq, deleted, k1, k2, at) VALUES "
        f"({q(GYM)}, {q(kind)}, {q(id_)}, {q(owner)}, {q(json.dumps(data, ensure_ascii=False, separators=(',', ':')))}, {seq}, 0, {q(k1)}, {q(k2)}, {q(at)});"
    )


def day(n):  # n days ago
    return today - timedelta(days=n)


def add_months(d, m):
    y, mo = divmod(d.month - 1 + m, 12)
    y += d.year
    mo += 1
    dim = [31, 29 if y % 4 == 0 and (y % 100 or y % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]
    return date(y, mo, min(d.day, dim))


def ist_stamp(d, hh, mm):
    """An IST wall-clock time as the UTC ISO stamp the app stores."""
    t = datetime(d.year, d.month, d.day, hh, mm, rnd.randint(0, 59), tzinfo=timezone.utc) - timedelta(hours=5, minutes=30)
    return t.isoformat(timespec='milliseconds').replace('+00:00', 'Z')


# ---------------------------------------------------------------- gym profile, slots, trainers, classes
profile = {
    'contact': {'phone': '+919800000000', 'phoneDisplay': '+91 98000 00000', 'whatsapp': '919800000000', 'email': '', 'instagram': ''},
    'address': {'line1': '', 'line2': '', 'mapsQuery': ''},
    'hours': [
        {'label': 'Mon to Sat', 'days': [1, 2, 3, 4, 5, 6], 'open': '05:30', 'close': '22:00'},
        {'label': 'Sun', 'days': [0], 'open': '07:00', 'close': '13:00'},
    ],
    'amenities': ['Strength floor', 'Cardio deck', 'Functional zone', 'Lockers', 'Showers', 'Free parking'],
    'currency': {'code': 'INR', 'locale': 'en-IN', 'symbol': '₹'},
    'referral': {'reward': 'You both get 10 extra days when your friend joins.'},
}
rows.append(
    f"UPDATE gyms SET tagline = 'Train hard. Stay consistent.', "
    f"settings = json_set(CASE WHEN settings = '' THEN '{{}}' ELSE settings END, '$.profile', json({q(json.dumps(profile, ensure_ascii=False))})) "
    f"WHERE id = {q(GYM)} AND tagline = '';"
)

SLOTS = {
    'early': ('sl-early', '05:30', '07:00', 14, [1, 2, 3, 4, 5, 6]),
    'eve1': ('sl-eve1', '17:00', '18:30', 14, [1, 2, 3, 4, 5, 6]),
    'eve2': ('sl-eve2', '18:30', '20:00', 14, [1, 2, 3, 4, 5, 6]),
    'night': ('sl-night', '20:00', '21:30', 10, [1, 2, 3, 4, 5, 6]),
    'sun': ('sl-sun', '08:00', '10:00', 12, [0]),
}
for sid, a, b, cap, days in SLOTS.values():
    doc('slots', sid, {'id': sid, 'start': a, 'end': b, 'capacity': cap, 'days': days})

TRAINERS = [
    ('tr-karan', 'Karan Mehta', 'Strength and fat loss', 8, 4.9, 800, 'Powerlifting background. Keeps it simple, heavy and honest.', ['ACE', 'CSCS']),
    ('tr-sana', 'Sana Qureshi', 'Mobility, yoga and rehab', 6, 4.8, 700, 'Helps desk workers move without pain, then get strong.', ['RYT 500', 'FMS']),
    ('tr-dev', 'Dev Malhotra', 'Muscle gain and nutrition', 10, 4.7, 900, 'Ex state-level bodybuilder. Plans meals as carefully as sets.', ['NASM', 'Precision Nutrition']),
]
for tid, name, focus, yrs, rating, price, bio, certs in TRAINERS:
    doc('trainers', tid, {'id': tid, 'name': name, 'focus': focus, 'years': yrs, 'rating': rating, 'price': price, 'bio': bio, 'certifications': certs})

CLASSES = [
    ('cl-yoga', 'Morning yoga', 'tr-sana', [1, 3, 5], '07:30', 60, 15, 'Easy', 'Mobility and breathing to start the day.'),
    ('cl-hiit', 'HIIT blast', 'tr-karan', [2, 4, 6], '18:30', 45, 14, 'Hard', '45 minutes of intervals. Bring a towel.'),
    ('cl-strength', 'Strength basics', 'tr-dev', [1, 3, 5], '19:00', 60, 10, 'Moderate', 'Squat, bench, deadlift technique in small groups.'),
    ('cl-stretch', 'Sunday stretch', 'tr-sana', [0], '09:00', 45, 15, 'Easy', 'Slow recovery session for the week behind you.'),
]
for cid, name, coach, days, start, mins, cap, inten, about in CLASSES:
    doc('classes', cid, {'id': cid, 'name': name, 'coachId': coach, 'days': days, 'start': start, 'minutes': mins, 'capacity': cap, 'intensity': inten, 'about': about})

ANN = [
    ('an-welcome', 'Welcome to the new app', 'Book your slot, show your pass at the desk and collect XP for every visit.', 'notice', today, True),
    ('an-diwali', 'Diwali hours', 'Open 7 am to 1 pm on Diwali day. Slots reopen the day after.', 'holiday', today + timedelta(days=9), False),
    ('an-offer', 'Refer a friend', 'Bring a friend who joins and you both get 10 extra days.', 'offer', day(3), False),
]
for aid, title, body, kind, d, pin in ANN:
    doc('announcements', aid, {'id': aid, 'title': title, 'body': body, 'kind': kind, 'date': d.isoformat(), 'pinned': pin})

CHALLENGES = [
    ('ch-plank', 'Plank hold', 'Floor mats', 'time', 'higher', 'Hold a forearm plank as long as you can.', [30, 300]),
    ('ch-row', '500 m row', 'Rowing machines', 'time', 'lower', 'Row 500 m, damper at 5. Fastest time wins.', [95, 190]),
    ('ch-pushups', 'Max push-ups', 'Open floor', 'reps', 'higher', 'Strict push-ups in one go, chest to a fist.', [8, 70]),
    ('ch-deadhang', 'Dead hang', 'Pull-up rig', 'time', 'higher', 'Hang from the bar until your grip gives out.', [15, 150]),
]
for cid, name, station, unit, better, how, rng in CHALLENGES:
    doc('challenges', cid, {'id': cid, 'name': name, 'station': station, 'unit': unit, 'better': better, 'how': how, 'range': rng, 'active': True,
                            'category': 'cardio' if cid == 'ch-row' else 'endurance'})

# ---------------------------------------------------------------- members
PLANS = {
    'plan-monthly': (1, 2000, 5),
    'plan-quarterly': (3, 5000, 15),
    'plan-half': (6, 7000, 30),
    'plan-annual': (12, 10000, 60),
}
# key, name, gender, plan, joined N days ago, slot, trainer, attendance probability, lifting level (0 none .. 3 strong), lapsed, dues
M = [
    ('arjun', 'Arjun Nair', 'male', 'plan-annual', 130, 'early', 'tr-karan', 0.9, 3, False, 0),
    ('neha', 'Neha Kulkarni', 'female', 'plan-annual', 95, 'night', 'tr-sana', 0.82, 2, False, 0),
    ('rohan', 'Rohan Gupta', 'male', 'plan-half', 80, 'eve2', 'tr-dev', 0.75, 3, False, 0),
    ('priya', 'Priya Menon', 'female', 'plan-monthly', 70, 'early', 'tr-sana', 0.7, 1, False, 0),
    ('vikram', 'Vikram Singh', 'male', 'plan-quarterly', 62, 'eve1', 'tr-karan', 0.65, 2, False, 0),
    ('ananya', 'Ananya Iyer', 'female', 'plan-half', 58, 'eve2', None, 0.6, 1, False, 0),
    ('sahil', 'Sahil Khanna', 'male', 'plan-quarterly', 50, 'night', 'tr-dev', 0.55, 2, False, 0),
    ('meera', 'Meera Joshi', 'female', 'plan-monthly', 24, 'eve1', None, 0.7, 1, False, 0),
    ('imran', 'Imran Sheikh', 'male', 'plan-monthly', 26, 'early', 'tr-karan', 0.6, 2, False, 1000),
    ('kavya', 'Kavya Reddy', 'female', 'plan-quarterly', 40, 'eve2', 'tr-sana', 0.5, 1, False, 0),
    ('aditya', 'Aditya Verma', 'male', 'plan-monthly', 45, 'eve1', None, 0.35, 0, True, 0),
    ('shreya', 'Shreya Bansal', 'female', 'plan-monthly', 38, 'night', None, 0.3, 0, True, 2000),
    ('manav', 'Manav Desai', 'male', 'plan-half', 33, 'eve2', 'tr-dev', 0.6, 2, False, 0),
    ('tanvi', 'Tanvi Shah', 'female', 'plan-annual', 28, 'early', 'tr-sana', 0.8, 1, False, 0),
    ('harsh', 'Harsh Vora', 'male', 'plan-quarterly', 21, 'eve1', None, 0.5, 1, False, 0),
    ('divya', 'Divya Pillai', 'female', 'plan-monthly', 14, 'eve2', None, 0.55, 0, False, 0),
    ('nikhil', 'Nikhil Rao', 'male', 'plan-monthly', 9, 'night', 'tr-karan', 0.6, 1, False, 0),
    ('zoya', 'Zoya Ahmed', 'female', 'plan-quarterly', 5, 'early', 'tr-sana', 0.8, 0, False, 0),
]
SLOT_HOURS = {'early': (5, 40, 6, 55), 'eve1': (17, 0, 18, 20), 'eve2': (18, 30, 19, 50), 'night': (20, 0, 21, 10)}

member_rows: list[str] = []
member_ids: dict[str, str] = {}
mem_state: dict[str, dict] = {}
inv = INV0
for i, (key, name, gender, plan, joined_ago, slot, trainer, prob, lift, lapsed, dues) in enumerate(M):
    mid = f'm_demo_{key}'
    member_ids[key] = mid
    code = f'YG-{MNO0 + 1 + i}'
    phone = f'98100{10 + i:05d}'
    months, price, pause = PLANS[plan]
    # Walk the terms from the joining date, renewing each time one ends (lapsed members stop after the first).
    start = day(joined_ago)
    terms = []
    while True:
        end = add_months(start, months) - timedelta(days=1)
        terms.append((start, end))
        if end >= today or lapsed or len(terms) >= 8:
            break
        start = end + timedelta(days=1)
    cur_start, cur_end = terms[-1]
    mem = {
        'id': mid, 'code': code, 'name': name, 'phone': phone, 'gender': gender, 'joinedOn': day(joined_ago).isoformat(), 'planId': plan,
        'startDate': cur_start.isoformat(), 'endDate': cur_end.isoformat(), 'pauseAllowance': pause, 'dues': dues,
        'preferredSlotId': SLOTS[slot][0], 'weeklyGoal': 4 if prob >= 0.5 else 3,
    }
    if trainer:
        mem['trainerId'] = trainer
    doc('members', mid, mem, owner=mid)
    member_rows.append(
        f"INSERT OR IGNORE INTO members (id, gym_id, name, phone, email, gender, code, created_at) VALUES "
        f"({q(mid)}, {q(GYM)}, {q(name)}, {q(phone)}, NULL, {q(gender)}, {q(code)}, {q(ist_stamp(day(joined_ago), 10, 0))});"
    )
    for n, (ts, _te) in enumerate(terms):
        inv += 1
        pid = f'pay_demo_{key}_{n}'
        doc('payments', pid, {'id': pid, 'memberId': mid, 'invoice': f'YG-2026-{inv:04d}', 'date': ts.isoformat(), 'amount': price,
                              'method': rnd.choice(['UPI', 'UPI', 'UPI', 'Cash', 'Card']), 'planId': plan, 'note': 'New joining' if n == 0 else 'Renewal'},
            owner=mid, k1=f'{mid}:{ts.isoformat()}', at=ts.isoformat())
    mem_state[key] = {'mid': mid, 'start': day(joined_ago), 'end': cur_end, 'slot': slot, 'prob': prob, 'lift': lift, 'visits': []}

# ---------------------------------------------------------------- attendance, XP, chests
xp_n = 0
for key, st in mem_state.items():
    mid = st['mid']
    first = st['start']
    last = min(today, st['end'])
    d = first
    while d <= last:
        # Today only counts for people whose slot has already started, so the desk screen looks live.
        if d == today and st['slot'] in ('night', 'eve2') and rnd.random() < 0.7:
            d += timedelta(days=1)
            continue
        if d.weekday() == 6 and st['prob'] < 0.85:  # Sundays are quieter
            hit = rnd.random() < st['prob'] * 0.3
        else:
            hit = rnd.random() < st['prob']
        if hit:
            h1, m1, h2, m2 = SLOT_HOURS[st['slot']]
            minutes = rnd.randint(h1 * 60 + m1, h2 * 60 + m2)
            stamp = ist_stamp(d, minutes // 60, minutes % 60)
            cid = f'ci_demo_{key}_{d.isoformat()}'
            doc('checkins', cid, {'id': cid, 'memberId': mid, 'at': stamp, 'method': rnd.choice(['qr', 'qr', 'desk'])}, owner=mid, k1=f'{mid}:{d.isoformat()}', at=stamp)
            xid = f'xp_demo_{key}_{d.isoformat()}'
            doc('xp', xid, {'id': xid, 'memberId': mid, 'amount': 20, 'reason': 'Checked in', 'at': stamp, 'key': f'ci-{d.isoformat()}'}, owner=mid, k1=f'{mid}:{d.isoformat()}', at=stamp)
            st['visits'].append(d)
        d += timedelta(days=1)

# Streak bonuses and unopened chests for the keenest members.
for key, n_chests in (('arjun', 3), ('neha', 2), ('rohan', 2), ('tanvi', 1)):
    st = mem_state[key]
    for n in range(n_chests):
        d = day(n + 1)
        stamp = ist_stamp(d, 12, 0)
        cid = f'chest_demo_{key}_{n}'
        doc('chests', cid, {'id': cid, 'memberId': st['mid'], 'reason': 'Weekly ring bonus' if n else 'Checked in', 'earnedAt': stamp}, owner=st['mid'], k1=f"{st['mid']}:{d.isoformat()}", at=stamp)
for key, extra in (('arjun', 480), ('neha', 300), ('rohan', 260), ('vikram', 140), ('tanvi', 200)):
    st = mem_state[key]
    d = day(1)
    stamp = ist_stamp(d, 20, 0)
    xid = f'xp_demo_{key}_bonus'
    doc('xp', xid, {'id': xid, 'memberId': st['mid'], 'amount': extra, 'reason': 'Chest prize', 'at': stamp, 'key': f'bonus-{key}'}, owner=st['mid'], k1=f"{st['mid']}:{d.isoformat()}", at=stamp)

# ---------------------------------------------------------------- lifts (personal records over time)
BASE = {'squat': 60, 'bench': 45, 'deadlift': 80, 'ohp': 30}
NAMES = {'squat': 'Back squat', 'bench': 'Bench press', 'deadlift': 'Deadlift', 'ohp': 'Overhead press'}
for key, st in mem_state.items():
    if not st['lift']:
        continue
    scale = {1: 0.7, 2: 1.0, 3: 1.35}[st['lift']]
    if st['visits']:
        sessions = st['visits'][::4][-14:]
    else:
        sessions = []
    for si, d in enumerate(sessions):
        for lk, base in BASE.items():
            if (si + list(BASE).index(lk)) % 2:
                continue
            w = round((base * scale + si * 1.25 * scale) / 2.5) * 2.5
            lid = f'lf_demo_{key}_{d.isoformat()}_{lk}'
            doc('lifts', lid, {'id': lid, 'memberId': st['mid'], 'exercise': NAMES[lk], 'liftKey': lk, 'weight': w, 'reps': rnd.choice([5, 6, 8]), 'date': d.isoformat()},
                owner=st['mid'], k1=f"{st['mid']}:{d.isoformat()}", at=d.isoformat())

# ---------------------------------------------------------------- challenge entries this month
first_of_month = today.replace(day=1)
for key, st in mem_state.items():
    if st['prob'] < 0.5:
        continue
    skill = st['prob'] + st['lift'] * 0.05
    for cid, _n, _s, unit, better, _h, (lo, hi) in CHALLENGES:
        if rnd.random() < 0.25:
            continue
        frac = max(0.0, min(1.0, skill - 0.2 + rnd.uniform(-0.15, 0.15)))
        value = lo + (hi - lo) * frac if better == 'higher' else hi - (hi - lo) * frac
        value = int(round(value))
        d = first_of_month + timedelta(days=rnd.randint(0, max(0, (today - first_of_month).days)))
        eid = f'ce_demo_{key}_{cid}'
        doc('challengeEntries', eid, {'id': eid, 'memberId': st['mid'], 'challengeId': cid, 'value': value, 'date': d.isoformat()},
            owner=st['mid'], k1=f"{st['mid']}:{d.isoformat()}", at=d.isoformat())

# ---------------------------------------------------------------- bookings for today and tomorrow
for dd in (today, today + timedelta(days=1)):
    if dd.weekday() == 6:
        continue
    for key, st in mem_state.items():
        if st['end'] < dd or st['prob'] < 0.5 or rnd.random() < 0.3:
            continue
        sid = SLOTS[st['slot']][0]
        bid = f'bk_demo_{key}_{dd.isoformat()}'
        doc('bookings', bid, {'id': bid, 'memberId': st['mid'], 'kind': 'slot', 'refId': sid, 'date': dd.isoformat(), 'status': 'booked', 'createdAt': NOW},
            owner=st['mid'], k1=f'slot:{sid}:{dd.isoformat()}', k2='booked', at=dd.isoformat())

rows.append(f"UPDATE gym_seq SET seq = MAX(seq, {seq}), member_no = MAX(member_no, {MNO0 + len(M)}) WHERE gym_id = {q(GYM)};")
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo_gym.sql')
with open(out, 'w', encoding='utf8') as f:
    f.write('\n'.join(member_rows + rows) + '\n')
print(f'{len(rows) + len(member_rows)} statements, last seq {seq}, wrote {out}')
