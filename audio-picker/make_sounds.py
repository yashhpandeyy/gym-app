"""Synthesises the candidate sound effects for audio-picker/index.html. Run: python make_sounds.py"""
import json
import os
import shutil
import wave

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'sounds')
CURRENT = os.path.join(HERE, '..', 'assets', 'sounds')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def t(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=0.003, dec=None):
    x = np.arange(n) / SR
    d = n / SR
    e = np.minimum(1, x / a) if a > 0 else np.ones(n)
    return e * np.exp(-x / (dec if dec else d / 4))


def tone(f, d, kind='sin', dec=None, a=0.003, harm=None):
    x = t(d)
    f = np.broadcast_to(f, x.shape) if np.isscalar(f) else f
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == 'sin':
        y = np.sin(ph)
    elif kind == 'tri':
        y = 2 / np.pi * np.arcsin(np.sin(ph))
    else:
        y = np.sign(np.sin(ph)) * 0.6
    for m, g in harm or []:
        y = y + g * np.sin(ph * m)
    return y * env(len(x), a, dec)


def sweep(f0, f1, d, **k):
    x = t(d)
    return tone(f0 * (f1 / f0) ** (x / d), d, **k)


def noise(d, lp=None, hp=None, dec=None, a=0.001):
    n = rng.standard_normal(int(SR * d))
    if lp:
        al = np.exp(-2 * np.pi * lp / SR)
        y = np.zeros_like(n)
        s = 0.0
        for i, v in enumerate(n):
            s = (1 - al) * v + al * s
            y[i] = s
        n = y
    if hp:
        al = np.exp(-2 * np.pi * hp / SR)
        y = np.zeros_like(n)
        s = 0.0
        for i, v in enumerate(n):
            s = (1 - al) * v + al * s
            y[i] = v - s
        n = y
    n = n / (np.abs(n).max() + 1e-9)
    return n * env(len(n), a, dec)


def seq(parts, gap=0.0):
    out = []
    for p in parts:
        out += [p, np.zeros(int(SR * gap))]
    return np.concatenate(out)


def mix(*a):
    y = np.zeros(max(len(x) for x in a))
    for x in a:
        y[: len(x)] += x
    return y


def at(x, delay):
    return np.concatenate([np.zeros(int(SR * delay)), x])


def save(name, y, peak=0.85):
    y = np.asarray(y, float)
    y = y / (np.abs(y).max() + 1e-9) * peak
    y[:64] *= np.linspace(0, 1, 64)
    y[-200:] *= np.linspace(1, 0, 200)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())


N = {'C5': 523.25, 'E5': 659.25, 'G5': 783.99, 'C6': 1046.5}

S = {
    'tap': [
        ('soft-click', 'Soft click', noise(0.035, lp=3500, dec=0.008)),
        ('wood-tick', 'Wood tick', tone(950, 0.05, dec=0.01)),
        ('bubble', 'Bubble', sweep(380, 950, 0.06, dec=0.02)),
        ('glass-tick', 'Glass tick', tone(2600, 0.06, dec=0.012, harm=[(2.4, 0.3)])),
        ('key', 'Keyboard key', mix(noise(0.02, hp=1500, dec=0.004), tone(500, 0.03, 'sq', dec=0.006) * 0.4)),
        ('soft-thump', 'Soft thump', sweep(260, 140, 0.07, dec=0.025)),
        ('blip', 'Blip', tone(880, 0.05, 'tri', dec=0.02)),
        ('snap', 'Finger snap', noise(0.03, hp=2500, dec=0.005)),
        ('marimba', 'Marimba', tone(660, 0.15, dec=0.04, harm=[(3, 0.25)])),
        ('droplet', 'Droplet', sweep(1300, 600, 0.07, dec=0.02)),
    ],
    'success': [
        ('chime-up', 'Two-note chime up', seq([tone(N['C5'], 0.14, dec=0.05), tone(N['G5'], 0.3, dec=0.12, harm=[(2, 0.2)])])),
        ('arpeggio', 'Happy arpeggio', seq([tone(N[k], 0.1, 'tri', dec=0.05) for k in ['C5', 'E5', 'G5']] + [tone(N['C6'], 0.3, 'tri', dec=0.12)])),
        ('bell', 'Bell ding', tone(1175, 0.7, dec=0.2, harm=[(2.76, 0.4), (5.4, 0.2)])),
        ('double-tick', 'Double tick', seq([tone(1500, 0.05, dec=0.012), tone(2000, 0.08, dec=0.02)], 0.04)),
        ('sparkle', 'Sparkle', sweep(700, 2400, 0.28, dec=0.1, a=0.01)),
        ('marimba-pair', 'Marimba pair', seq([tone(N['E5'], 0.12, dec=0.04, harm=[(3, 0.2)]), tone(N['G5'], 0.28, dec=0.1, harm=[(3, 0.2)])])),
        ('soft-chord', 'Soft chord', mix(tone(N['C5'], 0.35, 'tri', dec=0.15), tone(N['E5'], 0.3, 'tri', dec=0.12), at(tone(N['G5'], 0.35, 'tri', dec=0.15), 0.09))),
        ('low-high', 'Low then high', seq([tone(330, 0.08, dec=0.03), tone(660, 0.22, dec=0.09)], 0.02)),
        ('tink', 'Single tink', tone(1760, 0.25, dec=0.07, harm=[(2, 0.3)])),
    ],
    'warn': [
        ('buzz', 'Low buzz', tone(150, 0.16, 'sq', dec=0.08)),
        ('down-two', 'Two notes down', seq([tone(N['E5'], 0.12, 'tri', dec=0.06), tone(N['C5'], 0.22, 'tri', dec=0.1)])),
        ('dull-thud', 'Dull thud', sweep(220, 90, 0.15, dec=0.05)),
        ('beep-beep', 'Beep beep', seq([tone(700, 0.07, 'sq', dec=0.04), tone(700, 0.09, 'sq', dec=0.05)], 0.05)),
        ('wobble', 'Minor wobble', seq([tone(N['E5'], 0.1, 'tri', dec=0.05), tone(311, 0.2, 'tri', dec=0.1)])),
        ('sad-slide', 'Sad slide', sweep(500, 250, 0.3, kind='tri', dec=0.15)),
        ('knock-knock', 'Knock knock', seq([tone(200, 0.06, dec=0.015, harm=[(2, 0.3)]), tone(200, 0.08, dec=0.02, harm=[(2, 0.3)])], 0.06)),
        ('error-ding', 'Low error ding', tone(392, 0.35, dec=0.12, harm=[(2.76, 0.3)])),
    ],
    'pop': [
        ('bubble-pop', 'Bubble pop', sweep(300, 1200, 0.04, dec=0.015)),
        ('cork', 'Cork pop', sweep(500, 160, 0.07, dec=0.02)),
        ('click-pop', 'Click pop', mix(noise(0.015, hp=1000, dec=0.004), tone(700, 0.05, dec=0.012))),
        ('soft-blip', 'Soft blip', tone(520, 0.07, dec=0.025)),
        ('water-drop', 'Water drop', sweep(1500, 500, 0.09, dec=0.03)),
        ('pluck', 'Tiny pluck', tone(1000, 0.1, 'tri', dec=0.03)),
        ('bloop', 'Bloop', sweep(250, 700, 0.1, dec=0.04)),
    ],
    'flip': [
        ('whoosh', 'Whoosh', noise(0.25, lp=2500, hp=300, dec=0.08, a=0.08)),
        ('card-flick', 'Card flick', mix(noise(0.08, hp=1800, dec=0.02), at(tone(1200, 0.05, dec=0.012), 0.03))),
        ('swoosh-up', 'Swoosh up', mix(noise(0.2, lp=4000, dec=0.07, a=0.06), sweep(300, 1200, 0.2, dec=0.08, a=0.05) * 0.4)),
        ('paper-flap', 'Paper flap', noise(0.12, lp=6000, hp=800, dec=0.03)),
        ('ratchet', 'Spin ratchet', mix(*[at(noise(0.012, hp=2000, dec=0.003), i * 0.035) for i in range(7)])),
        ('airy-rise', 'Airy rise', mix(sweep(400, 1600, 0.3, dec=0.14, a=0.1) * 0.6, noise(0.3, hp=2000, dec=0.12, a=0.1) * 0.3)),
        ('shimmer', 'Shimmer', mix(*[at(tone(1400 + i * 350, 0.15, dec=0.05, a=0.002), i * 0.03) for i in range(5)])),
    ],
    'heavy': [
        ('deep-thud', 'Deep thud', sweep(150, 50, 0.3, dec=0.1)),
        ('kick', 'Kick drum', mix(sweep(180, 45, 0.25, dec=0.08), noise(0.01, lp=3000, dec=0.003) * 0.5)),
        ('wood-knock', 'Wood knock', tone(320, 0.12, dec=0.03, harm=[(2.3, 0.4)])),
        ('boom', 'Low boom', sweep(110, 38, 0.55, dec=0.2)),
        ('rumble', 'Rumble shake', noise(0.4, lp=400, dec=0.2, a=0.02)),
        ('tom', 'Tom drum', sweep(220, 100, 0.3, dec=0.1, harm=[(2, 0.2)])),
        ('double-thump', 'Double thump', seq([sweep(160, 70, 0.12, dec=0.04), sweep(150, 60, 0.2, dec=0.07)], 0.04)),
    ],
}

EXTRA = {
    'tap': [
        ('pebble', 'Pebble drop', tone(420, 0.06, dec=0.014, harm=[(1.6, 0.4)])),
        ('tiny-bell', 'Tiny bell', tone(2200, 0.18, dec=0.05, harm=[(2.76, 0.3)])),
        ('rubber', 'Rubber band', sweep(700, 300, 0.05, dec=0.015)),
        ('switch', 'Light switch', mix(noise(0.012, hp=2500, dec=0.003), at(noise(0.012, hp=1500, dec=0.003), 0.045))),
        ('sine-soft', 'Soft beep', tone(660, 0.07, dec=0.03)),
        ('hollow', 'Hollow tap', tone(300, 0.08, dec=0.02, harm=[(2, 0.5), (3, 0.3)])),
        ('ping', 'Ping', tone(1500, 0.14, dec=0.04)),
        ('mouse', 'Mouse click', mix(noise(0.008, hp=2000, dec=0.002), at(noise(0.01, hp=800, dec=0.003), 0.04))),
    ],
    'success': [
        ('triple-up', 'Three notes up', seq([tone(N['C5'], 0.09, dec=0.04), tone(N['E5'], 0.09, dec=0.04), tone(N['G5'], 0.25, dec=0.1)])),
        ('glass-chime', 'Glass chime', mix(tone(1568, 0.5, dec=0.15, harm=[(2.4, 0.25)]), at(tone(2093, 0.5, dec=0.15), 0.07))),
        ('level-up', 'Level up', seq([tone(f, 0.07, 'sq', dec=0.04) for f in (392, 523, 659, 784)] + [tone(1046, 0.2, 'sq', dec=0.1)])),
        ('soft-ding', 'Soft ding', tone(988, 0.4, dec=0.12, harm=[(2, 0.15)])),
        ('whoop', 'Rising whoop', sweep(400, 1200, 0.2, dec=0.1, kind='tri')),
        ('pluck-pair', 'Pluck pair', seq([tone(880, 0.08, 'tri', dec=0.03), tone(1318, 0.2, 'tri', dec=0.08)])),
        ('checkmark', 'Checkmark', seq([sweep(500, 700, 0.05, dec=0.03), sweep(700, 1400, 0.12, dec=0.06)])),
        ('harp', 'Harp gliss', mix(*[at(tone(f, 0.3, dec=0.1), i * 0.05) for i, f in enumerate((523, 659, 784, 1046, 1318))])),
    ],
    'warn': [
        ('nope', 'Nope (low-high-low)', seq([tone(220, 0.08, 'tri', dec=0.04), tone(165, 0.16, 'tri', dec=0.08)])),
        ('buzzer', 'Game-show buzzer', tone(110, 0.3, 'sq', dec=0.2)),
        ('thunk', 'Soft thunk', sweep(180, 100, 0.1, dec=0.03)),
        ('alert-two', 'Alert two-tone', seq([tone(880, 0.08, 'sq', dec=0.05), tone(660, 0.1, 'sq', dec=0.06)], 0.02)),
        ('rubber-low', 'Rubbery low', sweep(300, 120, 0.2, dec=0.09, kind='tri')),
        ('click-clack', 'Click clack', seq([noise(0.02, hp=1000, dec=0.005), tone(200, 0.08, dec=0.02)], 0.05)),
        ('flat-note', 'Flat note', tone(147, 0.3, 'tri', dec=0.13)),
    ],
    'pop': [
        ('pop-high', 'High pop', sweep(800, 2000, 0.03, dec=0.01)),
        ('tock', 'Tock', tone(500, 0.04, dec=0.01, harm=[(2, 0.4)])),
        ('plip', 'Plip', sweep(900, 1500, 0.05, dec=0.02)),
        ('tick-soft', 'Soft tick', noise(0.02, lp=5000, hp=1500, dec=0.005)),
        ('boop', 'Boop', tone(440, 0.09, dec=0.04)),
        ('gulp', 'Gulp', sweep(400, 150, 0.1, dec=0.04)),
        ('tiny-chime', 'Tiny chime', tone(1900, 0.12, dec=0.035)),
    ],
    'flip': [
        ('flutter', 'Page flutter', mix(*[at(noise(0.02, hp=2500, dec=0.005), i * 0.025) for i in range(4)])),
        ('whip', 'Whip', mix(noise(0.1, hp=2000, dec=0.025, a=0.03), sweep(2400, 600, 0.1, dec=0.04) * 0.3)),
        ('spin-up', 'Spin up', sweep(300, 2000, 0.25, dec=0.12, a=0.08, kind='tri')),
        ('coin-flip', 'Coin flip', mix(tone(2800, 0.5, dec=0.15, harm=[(2.4, 0.3)]), at(tone(3400, 0.4, dec=0.12), 0.1))),
        ('soft-swish', 'Soft swish', noise(0.15, lp=3000, hp=500, dec=0.05, a=0.05)),
        ('zip', 'Quick zip', sweep(500, 3000, 0.1, dec=0.05, a=0.02, kind='saw' if False else 'tri')),
        ('reveal', 'Reveal sweep', mix(noise(0.3, hp=1500, dec=0.12, a=0.12) * 0.5, sweep(500, 900, 0.3, dec=0.15, a=0.1) * 0.4)),
    ],
    'heavy': [
        ('punch', 'Punch', mix(sweep(200, 60, 0.15, dec=0.04), noise(0.02, lp=2000, dec=0.006) * 0.6)),
        ('drum-low', 'Floor drum', sweep(130, 65, 0.4, dec=0.14, harm=[(2, 0.15)])),
        ('chest-knock', 'Chest knock', seq([tone(240, 0.07, dec=0.02, harm=[(2.3, 0.4)]), tone(200, 0.1, dec=0.03, harm=[(2.3, 0.4)])], 0.05)),
        ('wobble-low', 'Wobbling bass', sweep(90, 60, 0.5, dec=0.22)),
        ('slam', 'Slam', mix(sweep(120, 40, 0.3, dec=0.08), noise(0.05, lp=1500, dec=0.015))),
        ('triple-thump', 'Triple thump', seq([sweep(150, 60, 0.08, dec=0.025)] * 3, 0.06)),
        ('stone', 'Stone drop', mix(sweep(100, 50, 0.25, dec=0.07), noise(0.1, lp=800, dec=0.03) * 0.5)),
    ],
}
for _k, _v in EXTRA.items():
    S[_k] += _v

CURRENT_FILE = {'tap': 'tap', 'success': 'success', 'warn': 'warn', 'pop': 'pop', 'flip': 'flip', 'heavy': 'thud'}

manifest = {}
for cat, items in S.items():
    manifest[cat] = []
    shutil.copy(os.path.join(CURRENT, CURRENT_FILE[cat] + '.wav'), os.path.join(OUT, f'{cat}-current.wav'))
    manifest[cat].append({'id': 'current', 'label': 'Current (in the app now)', 'file': f'sounds/{cat}-current.wav'})
    manifest[cat].append({'id': 'none', 'label': 'None (silent)', 'file': None})
    for id_, label, y in items:
        save(f'{cat}-{id_}', y)
        manifest[cat].append({'id': id_, 'label': label, 'file': f'sounds/{cat}-{id_}.wav'})
import re
page = os.path.join(HERE, 'index.html')
html = open(page, encoding='utf8').read()
html = re.sub(r'const MANIFEST = .*?;\nconst CATEGORIES', lambda m: 'const MANIFEST = ' + json.dumps(manifest) + ';\nconst CATEGORIES', html, flags=re.S)
open(page, 'w', encoding='utf8').write(html)
print({k: len(v) for k, v in manifest.items()})
