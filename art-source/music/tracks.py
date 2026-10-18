"""
12 首依情境的背景音樂。在專案根目錄執行：

    python3 art-source/music/tracks.py            # 全部重做
    python3 art-source/music/tracks.py cafe walk  # 只做指定的幾首

輸出到 assets/music/<id>.mp3，每首都是可以無縫循環的一輪。

| 檔名        | 用在                        | 風格                                   |
| ----------- | --------------------------- | -------------------------------------- |
| cafe        | 咖啡廳小聊                  | Bossa nova：尼龍弦吉他、低音提琴、長笛 |
| latenight   | 深夜長聊、爸媽「睡前長聊」  | Lo-fi：電鋼琴、慵懶鼓組、黑膠雜訊、細雨 |
| walk        | 散步漫談、爸媽「陪爸媽散步」| 民謠：指彈吉他、鐵琴、沙鈴             |
| dinner      | 微醺餐桌                    | 爵士 lounge：走路貝斯、刷鼓、顫音琴    |
| travel      | 旅途之中                    | 公路夢境：脈動琶音、溫暖鋪底           |
| party       | 朋友聚會                    | 輕快 nu-disco：四四拍、放克貝斯        |
| ad-flirt    | 深夜限定・調情              | 慵懶 R&B：顫音電鋼琴、彈指             |
| ad-prelude  | 深夜限定・前夕              | 更慢更暖：呼吸般的鋪底、心跳           |
| ad-passion  | 深夜限定・激情              | Trip-hop：低沉脈動、側鏈、漸亮琶音     |
| ad-after    | 深夜限定・收尾（餘溫）      | 安靜的毛氈鋼琴、細雨                   |
| home        | 爸媽「飯後閒聊」            | 懷舊華爾滋：鋼琴、音樂盒               |
| holiday     | 爸媽「回家過節」            | 五聲音階：古箏、木魚、鈴鼓             |
"""

import functools
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import (  # noqa: E402
    SR, Song, bell, bp, brush, clap, epiano, felt_piano, flute, guzheng, hand_drum, hat, heartbeat, hp,
    kick, ks, lead, loudness, lp, master, mel, midi, notes, pad, pluck, rain, ride, rim, room, shaker,
    shaped_noise, snap, snare, sub, synth_bass, tambourine, upright, vinyl, woodblock, write,
)

OUT = 'assets/music'


# ---------------------------------------------------------------- 共用

def timeline(chart, start=0.0, repeat=1):
    """和弦表 [(拍數, 低音, 和弦內音)] → [(起始拍, 拍數, 低音, [和弦內音])]"""
    out = []
    b = start
    for _ in range(repeat):
        for beats, bass, voic in chart:
            out.append((b, beats, midi(bass), notes(voic)))
            b += beats
    return out


def chord_at(tl, beat):
    for c in tl:
        if c[0] <= beat + 1e-6 < c[0] + c[1]:
            return c
    return tl[-1]


def strum(s, bus, beat, ms, inst, dur, vel, spread=0.012, pan=0.0, up=False, gain=1.0, jitter=0.005, **kw):
    """和弦一個音一個音稍微錯開地彈下去（spread 秒）"""
    order = list(ms)[::-1] if up else list(ms)
    for i, m in enumerate(order):
        a = inst(m, s.beat_dur(dur), s.hum(vel), **kw)
        s.place(bus, beat + i * spread / s.spb, a, pan, gain, jitter)


def melody(s, bus, start, line, inst, vel=0.6, tr=0, sw=(0.0, 0.0), legato=0.92, pan=0.0, gain=1.0, glide=False,
           **kw):
    b = start
    prev = None
    for m, d in line:
        if m is not None:
            extra = {'prev': prev} if glide and prev is not None else {}
            a = inst(m + tr, s.beat_dur(d * legato), s.hum(vel, 0.08), **kw, **extra)
            s.place(bus, s.swing(b, *sw), a, pan, gain, jitter=0.005)
            prev = m + tr
        else:
            prev = None
        b += d
    return b


def third_fifth(root, voic):
    """從和弦內音判斷大小三度、完全或減五度"""
    pcs = {m % 12 for m in voic}
    third = 3 if (root + 3) % 12 in pcs and (root + 4) % 12 not in pcs else 4
    fifth = 6 if (root + 6) % 12 in pcs and (root + 7) % 12 not in pcs else 7
    return third, fifth


def near(m, ref, lo, hi):
    """把 m 換到離 ref 最近、又在 lo..hi 之間的八度"""
    best = None
    for k in range(-4, 5):
        c = m + 12 * k
        if lo <= c <= hi and (best is None or abs(c - ref) < abs(best - ref)):
            best = c
    return best if best is not None else m


def chain(*fns):
    return lambda x: functools.reduce(lambda a, f: f(a), fns, x)


def f_lp(c):
    return lambda x: lp(x, c)


def f_hp(c):
    return lambda x: hp(x, c)


def f_sat(d):
    return lambda x: np.tanh(d * x) / d


def f_autopan(s, cycles, depth):
    """左右來回的顫音（Rhodes 的招牌效果），cycles 是一輪裡擺幾次"""
    l = s.lfo(cycles)
    g = np.stack([1 - depth * (1 + l) / 2, 1 - depth * (1 - l) / 2], axis=1)
    return lambda x: x * g


def f_sweep(s, lo, hi, w):
    """在暗、亮兩個低通版本之間依 w（0..1，長度 n）交叉淡化，模擬濾波器慢慢打開"""
    w2 = w[:, None]
    return lambda x: lp(x, lo) * (1 - w2) + lp(x, hi) * w2


def f_delay(s, beats, fb=0.35, mix=0.3, cut=3000, pingpong=True):
    d = int(s.beat_dur(beats) * SR)

    def run(x):
        y = x.copy()
        src = lp(x, cut)
        for k in range(1, 9):
            a = mix * fb ** (k - 1)
            if a < 0.01 or k * d >= len(x):
                break
            tap = src[:len(x) - k * d]
            if pingpong and k % 2 == 1:
                tap = tap[:, ::-1]
            y[k * d:] += tap * a
        return y
    return run


def f_wow(s, ms=1.5, cycles=None):
    """錄音帶的音高晃動"""
    cycles = cycles or max(1, round(s.dur / 2.2))
    d = (ms / 1000 * SR) * (1 + s.lfo(cycles)) / 2 + (ms / 3000 * SR) * (1 + s.lfo(cycles * 3 + 1)) / 2

    def run(x):
        idx = np.arange(len(x)) - d
        return np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], axis=1)
    return run


def sidechain(s, kick_beats, depth=0.45, rel=0.16):
    """跟著大鼓壓低音量（讓鋪底「呼吸」）；一輪之後的那段也要壓，折回後才接得上"""
    env = np.ones(s.n)
    ln = int(0.5 * SR)
    t = np.arange(ln) / SR
    dip = 1 - depth * np.exp(-t / rel)
    for kb in kick_beats:
        for off in (0, s.L):
            i = int(kb * s.spb * SR) + off
            if i < s.n:
                k = min(ln, s.n - i)
                env[i:i + k] *= dip[:k]
    return lambda x: x * env[:, None]


def swell(s, every_bars, lo, hi, level, seed):
    """週期性的氣音起伏（像呼吸），長度剛好一輪"""
    noise = shaped_noise(s.L, lo, hi, seed, tilt=-0.5)
    cycles = s.bars / every_bars
    ph = np.arange(s.L) / s.L * cycles
    env = (0.5 - 0.5 * np.cos(2 * np.pi * ph)) ** 2
    return noise * env[:, None] * level


# ---------------------------------------------------------------- 咖啡廳小聊

def cafe():
    s = Song(bpm=132, bars=32, seed=11)
    chart = [
        (4, 'F2', 'A3 C4 E4 G4'), (4, 'F2', 'A3 C4 E4 G4'), (4, 'Bb2', 'Ab3 D4 G4'), (4, 'Bb2', 'Ab3 D4 G4'),
        (4, 'A2', 'G3 C4 E4'), (4, 'D3', 'F#3 C4 Eb4'), (4, 'G2', 'F3 Bb3 D4 A4'), (4, 'C3', 'Bb3 E4 A4'),
        (4, 'F2', 'A3 C4 E4 G4'), (4, 'D3', 'F3 A3 C4 E4'), (4, 'G2', 'F3 Bb3 D4 A4'), (4, 'C3', 'Bb3 Db4 E4'),
        (4, 'A2', 'G3 C4 E4'), (4, 'D3', 'F#3 C4 E4'), (2, 'G2', 'F3 Bb3 D4'), (2, 'C3', 'Bb3 E4 G4'),
        (4, 'F2', 'E3 A3 C4'),
    ]
    tl = timeline(chart, repeat=2)
    s.bus('gtr', gain=0.9, send=0.18, fx=f_lp(5000))
    s.bus('bass', gain=0.75, send=0.04)
    s.bus('perc', gain=0.75, send=0.12, fx=f_lp(9000))
    s.bus('mel', gain=0.75, send=0.3)

    # 尼龍弦吉他：兩小節一組的切分節奏
    comp = [0, 2, 3, 5, 6, 8, 10, 11, 13, 14]
    for bar in range(0, 32, 2):
        for e in comp:
            b = s.t(bar) + e * 0.5
            _, _, _, voic = chord_at(tl, b)
            accent = 0.5 if e in (0, 3, 6, 10, 13) else 0.36
            strum(s, 'gtr', b, voic, ks, 0.45, accent, spread=0.009, pan=-0.25, bright=0.4, t60=1.4, pick=0.2)

    # 低音：每小節 1、3 拍根音與五度，切分的小八分音符帶到下一小節
    prev = 41
    for (b0, beats, root, voic) in tl:
        _, fifth = third_fifth(root, voic)
        r = near(root, prev, 33, 50)
        s.place('bass', b0, upright(r, s.beat_dur(1.4), s.hum(0.8)), 0.05, jitter=0.004)
        if beats == 4:
            s.place('bass', b0 + 2, upright(near(r + fifth, r, 33, 52), s.beat_dur(1.4), s.hum(0.7)), 0.05,
                    jitter=0.004)
        prev = r

    # 打擊：沙鈴八分音符、邊擊的巴薩節奏、很輕的大鼓
    for bar in range(32):
        for e in range(8):
            v = 0.32 if e % 2 == 0 else 0.22
            s.place('perc', s.t(bar) + e * 0.5, shaker(s.hum(v), seed=bar * 8 + e), 0.35, jitter=0.004)
        for kb in (0, 1.5, 2, 3.5):
            s.place('perc', s.t(bar) + kb, kick(0.35 if kb % 2 == 0 else 0.22, tone=55, punch=0.4, decay=0.2), 0)
    for bar in range(0, 32, 2):
        for e in (0, 3, 6, 10, 13):
            s.place('perc', s.t(bar) + e * 0.5, rim(s.hum(0.35), seed=e), -0.15, jitter=0.004)

    # 第一輪後半由顫音琴輕輕帶一句，第二輪長笛完整主旋律
    line = mel(
        'A4:1 C5:.5 E5:1.5 D5:.5 C5:.5 | A4:3 r:1 | G4:.5 Ab4:.5 D5:1 C5:.5 Ab4:1.5 | G4:2 F4:1 r:1 '
        '| E5:1 D5:.5 C5:1 A4:1.5 | C5:.5 Bb4:.5 A4:1 F#4:2 | A4:1 Bb4:.5 D5:1.5 F5:1 | E5:2 D5:.5 C5:.5 A4:1 '
        '| G4:.5 A4:.5 C5:1 G5:2 | F5:1.5 E5:.5 D5:1 C5:1 | Bb4:1 A4:.5 G4:.5 F4:1 G4:1 | E4:.5 G4:.5 Bb4:1 Db5:2 '
        '| C5:2 E5:1 G5:1 | F#5:1.5 E5:.5 C5:1 A4:1 | Bb4:1 A4:.5 G4:.5 E5:1 C5:1 | A4:3 r:1'.replace('| ', '')
    )
    half = []
    acc = 0.0
    for n_, d in line:
        if acc >= 32:
            half.append((n_, d))
        acc += d
    melody(s, 'mel', s.t(8), half, lambda m, d, v: bell(m, d, v, 'vibes'), vel=0.55, pan=0.25)
    melody(s, 'mel', s.t(16), line, flute, vel=0.7, pan=0.15)

    return s.render(reverb=(1.8, 0.22), damp=5000)


# ---------------------------------------------------------------- 深夜長聊

def latenight():
    s = Song(bpm=72, bars=24, seed=21)
    chart = [
        (4, 'Db2', 'F3 Ab3 C4 Eb4'), (4, 'C2', 'Eb3 G3 Bb3 D4'), (4, 'Bb1', 'Db3 F3 Ab3 C4'),
        (2, 'Eb2', 'Gb3 Bb3 Db4 F4'), (2, 'Ab1', 'Gb3 C4 F4'),
        (4, 'Gb1', 'Bb3 Db4 F4 Ab4'), (2, 'F2', 'Ab3 C4 Eb4'), (2, 'Bb1', 'Ab3 Db4 F4'),
        (4, 'Eb2', 'Gb3 Bb3 Db4 F4'), (2, 'Ab1', 'Gb3 Bb3 Db4 Eb4'), (2, 'Ab1', 'Gb3 C4 F4'),
    ]
    tl = timeline(chart, repeat=3)
    sw = (0.0, 0.07)
    s.bus('keys', gain=0.9, send=0.22, fx=chain(f_wow(s, 1.6), f_lp(3800), f_autopan(s, s.bars * 2, 0.25)))
    s.bus('bass', gain=0.6, send=0.0, fx=f_lp(400))
    s.bus('drums', gain=0.9, send=0.08, fx=chain(f_lp(5200), f_sat(1.6)))
    s.bus('mel', gain=0.6, send=0.3, fx=chain(f_wow(s, 1.6), f_lp(4500)))
    s.bus('tex', gain=0.75, send=0.0)

    for (b0, beats, root, voic) in tl:
        strum(s, 'keys', b0 + 0.04, voic, epiano, beats - 0.1, 0.42, spread=0.025, pan=-0.1, bright=0.7)
        if beats == 4:
            strum(s, 'keys', s.swing(b0 + 2.75, *sw), voic[1:], epiano, 0.6, 0.22, spread=0.015, pan=0.1,
                  bright=0.5)
        r = near(root, 36, 30, 44)
        s.place('bass', b0, sub(r, s.beat_dur(min(beats, 2.3) - 0.1), s.hum(0.8, 0.05), drive=1.8), 0)
        if beats == 4:
            s.place('bass', b0 + 2.5, sub(r, s.beat_dur(1.3), s.hum(0.65, 0.05), drive=1.8), 0)

    # 慵懶鼓組：開頭兩小節只有電鋼琴，像唱針剛放下
    for bar in range(2, 24):
        base = s.t(bar)
        for kb, v in ((0, 0.7), (2.5, 0.55)):
            s.place('drums', base + kb, kick(s.hum(v), tone=48, punch=0.6, decay=0.3), 0, jitter=0.006)
        if bar % 4 == 3:
            s.place('drums', s.swing(base + 1.75, *sw), kick(0.35, tone=48, punch=0.5, decay=0.25), 0)
        for sb in (1, 3):
            s.place('drums', base + sb + 0.02, snare(s.hum(0.5), tone=180, snap=0.25, decay=0.14, seed=bar), 0.05,
                    jitter=0.008)
        for e in range(8):
            v = 0.28 if e % 2 == 0 else 0.17
            s.place('drums', s.swing(base + e * 0.5, 0.0) + (0.035 if e % 2 else 0), hat(s.hum(v), seed=e),
                    0.25, jitter=0.006)

    line = mel(
        'r:.5 F5:.5 Eb5:.5 C5:.5 Ab4:2 r:1 G4:.5 Bb4:.5 C5:1.5 Bb4:.5 Ab4:2 F4:1 r:1 '
        'r:.5 Gb4:.5 Bb4:.5 Db5:.5 C5:1.5 r:.5 Bb4:.5 Db5:.5 F5:2 Eb5:1 Eb5:1 C5:1 Db5:1 Ab4:1 '
        'Bb4:1.5 Gb4:.5 F4:2 Eb4:1 Gb4:1 Ab4:1 C5:1'
    )
    melody(s, 'mel', s.t(8), line, felt_piano, vel=0.55, sw=sw, pan=0.2, soft=0.5)
    melody(s, 'mel', s.t(16), line, felt_piano, vel=0.4, tr=12, sw=sw, pan=0.25, soft=0.55)

    s.add_loop('tex', vinyl(s.L) * 1.0 + rain(s.L) * 0.7)
    return s.render(reverb=(2.2, 0.22), damp=3500)


# ---------------------------------------------------------------- 散步漫談

def walk():
    s = Song(bpm=100, bars=32, seed=31)
    chart = [
        (4, 'G2', 'B3 D4 G4'), (4, 'F#2', 'A3 D4 F#4'), (4, 'E2', 'G3 B3 D4'), (4, 'C3', 'E3 G3 D4'),
        (4, 'G2', 'B3 D4 G4'), (4, 'D3', 'F#3 A3 D4'), (4, 'C3', 'E3 G3 D4'), (2, 'C3', 'E3 G3 D4'),
        (2, 'D3', 'G3 A3 D4'),
    ]
    tl = timeline(chart, repeat=4)
    s.bus('gtr', gain=0.9, send=0.18)
    s.bus('bass', gain=0.3, send=0.03, fx=f_lp(500))
    s.bus('perc', gain=0.7, send=0.1)
    s.bus('mel', gain=0.55, send=0.3)
    s.bus('pad', gain=0.5, send=0.3)

    # 指彈：低音在 1、3 拍交替，上面三個音輪流
    for (b0, beats, root, voic) in tl:
        r = near(root, 43, 40, 50)
        alt = near(r + 7, r, 40, 52)
        u = voic[-3:]
        pat = [(0, r), (0.5, u[1]), (1, u[2]), (1.5, u[0]), (2, alt), (2.5, u[1]), (3, u[2]), (3.5, u[1])]
        for off, m in pat:
            if off >= beats:
                continue
            v = 0.55 if off in (0, 2) else 0.38
            s.place('gtr', b0 + off, ks(m, s.beat_dur(1.6), s.hum(v), bright=0.6, t60=2.6, pick=0.15), -0.2,
                    jitter=0.006)
        if b0 >= s.t(8):
            s.place('bass', b0, sub(r - 12, s.beat_dur(beats * 0.9), 0.6, drive=1.3), 0)
        if s.t(16) <= b0 < s.t(24):
            s.place('pad', b0, pad(voic, s.beat_dur(beats), 0.5, a=1.0, r=1.5, cutoff=1500, seed=int(b0)), 0)

    for bar in range(8, 32):
        for e in range(8):
            v = 0.3 if e % 2 else 0.2
            s.place('perc', s.t(bar) + e * 0.5, shaker(s.hum(v), seed=e + bar), 0.4, jitter=0.005)
        if bar >= 16:
            for kb in (0, 2):
                s.place('perc', s.t(bar) + kb, hand_drum(s.hum(0.45), tone=95), -0.2, jitter=0.005)
            s.place('perc', s.t(bar) + 3.5, hand_drum(0.25, tone=140), -0.2, jitter=0.005)

    line = mel(
        'D5:1 B4:.5 D5:.5 G5:2 F#5:1 E5:.5 D5:.5 A4:2 B4:1 D5:1 E5:1 G5:1 E5:2 D5:2 '
        'B4:.5 D5:.5 G5:1 A5:1 B5:1 A5:1.5 F#5:.5 D5:2 E5:1 G5:1 E5:1 D5:1 D5:2 A4:1 r:1'
    )
    glock = lambda m, d, v: bell(m, d, v, 'glock')  # noqa: E731
    melody(s, 'mel', s.t(8), line, glock, vel=0.5, pan=0.2)
    melody(s, 'mel', s.t(24), line, glock, vel=0.45, pan=0.2)
    melody(s, 'mel', s.t(24), line, flute, vel=0.45, tr=-12, pan=-0.1)

    return s.render(reverb=(2.0, 0.2), damp=6000, master_lp=9000)


# ---------------------------------------------------------------- 微醺餐桌

def dinner():
    s = Song(bpm=104, bars=32, seed=41)
    chart = [
        (4, 'Bb1', 'D4 F4 A4 C5'), (4, 'G1', 'B3 D4 F4 Ab4'), (4, 'C2', 'Eb3 G3 Bb3 D4'), (4, 'F1', 'Eb3 A3 D4'),
        (2, 'D2', 'F3 A3 C4 E4'), (2, 'G1', 'F3 Ab3 B3 D4'), (2, 'C2', 'Eb3 G3 Bb3 D4'), (2, 'F1', 'Eb3 A3 D4'),
        (4, 'Bb1', 'D4 F4 A4 C5'), (2, 'A1', 'G3 C4 Eb4'), (2, 'D2', 'F#3 C4 Eb4'),
        (4, 'G1', 'F3 Bb3 D4 A4'), (4, 'C2', 'Bb3 E4 A4'), (4, 'C2', 'Eb3 G3 Bb3 D4'), (4, 'F1', 'Eb3 A3 D4'),
        (2, 'D2', 'F3 A3 C4'), (2, 'G1', 'F3 B3 E4'), (2, 'C2', 'Eb3 G3 Bb3'), (2, 'F1', 'Eb3 A3 C4'),
        (4, 'Bb1', 'D4 F4 G4 C5'), (2, 'C2', 'Eb3 G3 Bb3 D4'), (2, 'F1', 'Eb3 A3 D4'),
    ]
    tl = timeline(chart, repeat=2)
    sw = (0.15, 0.0)
    s.bus('keys', gain=0.75, send=0.2, fx=f_lp(4500))
    s.bus('bass', gain=0.75, send=0.05)
    s.bus('drums', gain=0.85, send=0.12)
    s.bus('mel', gain=0.7, send=0.3)

    # 走路貝斯：根音 → 和弦音 → 和弦音 → 半音接到下一個根音
    prev = 34
    for i, (b0, beats, root, voic) in enumerate(tl):
        third, fifth = third_fifth(root, voic)
        nxt = tl[(i + 1) % len(tl)][2]
        r = near(root, prev, 28, 43)
        nr = near(nxt, r, 28, 43)
        if beats == 4:
            mid = [r + third, r + fifth] if i % 2 == 0 else [r + fifth, r + 12 if r + 12 <= 46 else r + third]
            line = [r] + mid + [nr + (1 if nr < r + fifth else -1)]
        else:
            line = [r, nr + (1 if nr <= r else -1)]
        for k, m in enumerate(line):
            s.place('bass', b0 + k, upright(m, s.beat_dur(0.95), s.hum(0.75 if k == 0 else 0.62, 0.06)), 0.05,
                    jitter=0.006)
            prev = m

    # 鋼琴伴奏：Charleston 節奏的幾種變化
    pats = [((0, 0.9), (1.5, 0.4)), ((1.5, 0.4), (3, 0.8)), ((0, 0.4), (2.5, 0.6)), ((0.5, 0.4), (2, 0.9))]
    for i, (b0, beats, root, voic) in enumerate(tl):
        for off, d in pats[int(s.rng.integers(0, len(pats)))]:
            if off < beats:
                strum(s, 'keys', s.swing(b0 + off, *sw), voic, epiano, d, 0.4, spread=0.008, pan=-0.2, bright=0.6)

    # 刷鼓：叮、叮噠、叮、叮噠
    for bar in range(32):
        base = s.t(bar)
        for rb, v in ((0, 0.5), (1, 0.7), (1.5, 0.4), (2, 0.5), (3, 0.7), (3.5, 0.4)):
            s.place('drums', s.swing(base + rb, *sw), ride(s.hum(v), seed=int(rb * 2)), 0.35, jitter=0.005)
        for hb in (1, 3):
            s.place('drums', base + hb, hat(0.35, seed=hb), 0.2, jitter=0.004)
            s.place('drums', base + hb, brush(s.hum(0.35), long=True, seed=bar + hb), -0.1, jitter=0.01)
        for kb in range(4):
            s.place('drums', base + kb, kick(0.18, tone=52, punch=0.3, decay=0.15), 0)

    line = mel(
        'F4:.5 G4:.5 Bb4:.5 D5:2.5 Ab4:.5 B4:.5 D5:1 F5:2 Eb5:1.5 D5:.5 C5:.5 Bb4:.5 G4:1 A4:2 D5:1 r:1 '
        'F5:1 D5:1 B4:1 Ab4:1 G4:1 Bb4:.5 D5:.5 Eb5:1 D5:1 C5:3 r:1 C5:.5 Eb5:.5 G5:1 F#5:1 Eb5:1 '
        'D5:2 Bb4:1 A4:1 G4:.5 A4:.5 Bb4:1 E5:2 Eb5:1 D5:1 C5:1 G4:1 A4:1.5 C5:.5 D5:2 '
        'F5:1 A4:1 B4:1 D5:1 Eb5:1 C5:1 A4:1 Eb5:1 D5:2 C5:.5 Bb4:1.5 r:2 F4:.5 G4:.5 A4:1'
    )
    vib = lambda m, d, v: bell(m, d, v, 'vibes')  # noqa: E731
    melody(s, 'mel', s.t(16), line, vib, vel=0.6, sw=sw, pan=0.25)

    return s.render(reverb=(1.6, 0.2), damp=4500, master_lp=11000)


# ---------------------------------------------------------------- 旅途之中

def travel():
    s = Song(bpm=92, bars=32, seed=51)
    chart = [
        (4, 'D2', 'F#3 A3 C#4 E4'), (4, 'B1', 'D3 F#3 A3 E4'), (4, 'G1', 'F#3 B3 D4 A4'),
        (2, 'A1', 'E3 A3 D4'), (2, 'A1', 'E3 A3 C#4'),
    ]
    tl = timeline(chart, repeat=8)
    s.bus('arp', gain=1.4, send=0.2, fx=chain(f_delay(s, 0.75, fb=0.35, mix=0.3), f_lp(5000)))
    s.bus('pad', gain=0.45, send=0.35)
    s.bus('bass', gain=0.45, send=0.0, fx=f_lp(600))
    s.bus('drums', gain=0.6, send=0.08)
    s.bus('mel', gain=0.6, send=0.3)

    for (b0, beats, root, voic) in tl:
        s.place('pad', b0, pad(voic, s.beat_dur(beats), 0.55, a=0.8, r=1.6, cutoff=1300, seed=int(b0)), 0)
        up = [m + 12 for m in voic]
        order = [0, 1, 2, 3, 2, 1, 0, 1] if len(up) >= 4 else [0, 1, 2, 1, 0, 1, 2, 1]
        high = b0 >= s.t(16) and b0 < s.t(24)
        for k in range(int(beats * 2)):
            m = up[order[k % 8] % len(up)] + (12 if high and k % 4 == 2 else 0)
            v = 0.45 if k % 2 == 0 else 0.32
            s.place('arp', b0 + k * 0.5, pluck(m, s.beat_dur(0.4), s.hum(v), bright=0.55), -0.3 if k % 2 else 0.3,
                    jitter=0.003)
        r = near(root, 38, 33, 45)
        if s.t(4) <= b0 < s.t(16) or b0 >= s.t(24):
            s.place('bass', b0, sub(r, s.beat_dur(beats * 0.95), 0.7, a=0.05, r=0.3), 0)
        elif b0 >= s.t(16):
            for k in range(int(beats * 2)):
                s.place('bass', b0 + k * 0.5, sub(r, s.beat_dur(0.4), 0.7 if k % 2 == 0 else 0.5), 0)

    for bar in range(4, 32):
        base = s.t(bar)
        for kb in (0, 2):
            s.place('drums', base + kb, kick(s.hum(0.55), tone=50, punch=0.5, decay=0.28), 0)
        if bar >= 8:
            for rb in (1, 3):
                s.place('drums', base + rb, rim(s.hum(0.4), seed=rb), -0.1, jitter=0.004)
        if bar >= 16:
            for e in range(8):
                s.place('drums', base + e * 0.5, hat(s.hum(0.22 if e % 2 else 0.14), seed=e), 0.3, jitter=0.003)

    line = mel(
        'F#5:1.5 E5:.5 D5:1 A4:1 B4:2 r:.5 A4:.5 D5:1 F#5:1 A5:1 G5:1.5 F#5:.5 E5:3 r:1 '
        'A4:.5 D5:.5 E5:1 F#5:2 E5:1 D5:1 B4:1 A4:1 B4:1.5 D5:.5 F#5:2 E5:2 C#5:1 A4:1'
    )
    melody(s, 'mel', s.t(8), line, lead, vel=0.55, pan=0.1, cutoff=2400)
    melody(s, 'mel', s.t(24), line, lead, vel=0.55, pan=0.1, cutoff=2600)
    melody(s, 'mel', s.t(24), line, lambda m, d, v: bell(m, d, v, 'celesta'), vel=0.3, tr=12, pan=-0.2)

    return s.render(reverb=(2.4, 0.22), damp=5000)


# ---------------------------------------------------------------- 朋友聚會

def party():
    s = Song(bpm=112, bars=32, seed=61)
    chart = [
        (4, 'A1', 'G3 B3 C4 E4'), (4, 'D2', 'F#3 A3 C4 E4'), (4, 'A1', 'G3 B3 C4 E4'), (4, 'D2', 'F#3 A3 C4 E4'),
        (4, 'F1', 'A3 C4 E4 G4'), (4, 'E2', 'G3 B3 D4'), (4, 'D2', 'F3 A3 C4 E4'), (2, 'E2', 'A3 B3 D4'),
        (2, 'E2', 'G#3 B3 D4'),
    ]
    tl = timeline(chart, repeat=4)
    kicks = [s.t(bar) + k for bar in range(32) if not 16 <= bar < 20 for k in range(4)]
    sc = sidechain(s, kicks, depth=0.4)
    s.bus('drums', gain=0.5, send=0.06)
    s.bus('bass', gain=0.55, send=0.0, fx=sc)
    s.bus('keys', gain=0.45, send=0.15, fx=chain(f_autopan(s, s.bars, 0.3), sc))
    s.bus('pad', gain=0.55, send=0.3, fx=sc)
    s.bus('mel', gain=1.0, send=0.22, fx=f_delay(s, 0.75, fb=0.3, mix=0.22))

    for kb in kicks:
        s.place('drums', kb, kick(0.75, tone=50, punch=0.9, decay=0.24), 0)
    for bar in range(32):
        base = s.t(bar)
        if not 16 <= bar < 18:
            for cb in (1, 3):
                s.place('drums', base + cb, clap(s.hum(0.6), seed=bar), 0.05, jitter=0.004)
        for e in range(16):
            v = 0.2 if e % 4 == 2 else 0.1
            s.place('drums', base + e * 0.25, hat(s.hum(v), seed=e), 0.3, jitter=0.003)
        for ob in (0.5, 1.5, 2.5, 3.5):
            if not 16 <= bar < 20:
                s.place('drums', base + ob, hat(0.18, open_=True, seed=int(ob * 2)), -0.25)
        if bar >= 20:
            for e in range(8):
                s.place('drums', base + e * 0.5, tambourine(s.hum(0.3 if e % 2 else 0.18), seed=e), -0.35)

    groove = [(0, 0, 0.35), (0.75, 12, 0.2), (1.5, 0, 0.25), (2, 0, 0.35), (2.75, 12, 0.2), (3.25, 7, 0.2),
              (3.5, 10, 0.25)]
    for (b0, beats, root, voic) in tl:
        r = near(root, 36, 33, 45)
        brk = s.t(16) <= b0 < s.t(20)
        if brk:
            s.place('bass', b0, synth_bass(r, s.beat_dur(beats * 0.95), 0.7, bright=0.2), 0)
        else:
            for off, iv, d in groove:
                if off < beats:
                    s.place('bass', b0 + off, synth_bass(r + iv, s.beat_dur(d), s.hum(0.8 if off == 0 else 0.65)), 0,
                            jitter=0.003)
            for ob in (0.5, 1.5, 2.5, 3.5):
                if ob < beats:
                    strum(s, 'keys', b0 + ob, voic, epiano, 0.22, 0.42, spread=0.004, bright=1.0)
        if b0 >= s.t(16):
            s.place('pad', b0, pad(voic, s.beat_dur(beats), 0.55, a=0.4, r=0.8, cutoff=2600, seed=int(b0)), 0)

    line = mel(
        'E5:.5 G5:.5 A5:.75 G5:.25 E5:.5 D5:.5 E5:1 r:1 A4:.5 C5:.5 D5:1 E5:.5 r:.5 '
        'E5:.5 G5:.5 A5:.75 G5:.25 E5:.5 D5:.5 G5:1 A5:1.5 G5:.5 E5:1 r:1 '
        'C5:.5 E5:.5 G5:1 A5:.5 G5:.5 E5:1 D5:1 B4:1 G4:1 r:1 A4:.5 C5:.5 E5:1 F5:1 E5:1 D5:1 B4:1 G#4:2'
    )
    melody(s, 'mel', s.t(8), line, pluck, vel=0.6, pan=0.15, bright=0.9)
    melody(s, 'mel', s.t(24), line, pluck, vel=0.6, pan=0.15, bright=0.9)
    melody(s, 'mel', s.t(24), line, lambda m, d, v: bell(m, d, v, 'glock'), vel=0.3, tr=12, pan=-0.2)

    return s.render(reverb=(1.4, 0.18), damp=6000, master_lp=11000)


# ---------------------------------------------------------------- 深夜限定・調情

def ad_flirt():
    s = Song(bpm=70, bars=24, seed=71)
    chart = [
        (4, 'F1', 'Ab3 C4 Eb4 G4'), (4, 'Bb1', 'Ab3 C4 Db4 F4'), (4, 'Eb2', 'G3 Db4 F4 Bb4'),
        (2, 'Db2', 'Ab3 C4 F4'), (2, 'C2', 'E3 Bb3 Eb4'),
    ]
    tl = timeline(chart, repeat=6)
    sw = (0.0, 0.06)
    s.bus('keys', gain=0.85, send=0.22, fx=chain(f_lp(4200), f_autopan(s, s.bars * 8, 0.55)))
    s.bus('bass', gain=0.6, send=0.0, fx=f_lp(350))
    s.bus('drums', gain=0.6, send=0.1, fx=f_lp(7000))
    s.bus('snap', gain=1.6, send=0.55)
    s.bus('mel', gain=0.6, send=0.32)

    for (b0, beats, root, voic) in tl:
        strum(s, 'keys', b0 + 0.03, voic, epiano, beats - 0.15, 0.45, spread=0.03, bright=0.6)
        if beats == 4:
            for off, v in ((1.5, 0.22), (2.75, 0.26)):
                strum(s, 'keys', s.swing(b0 + off, *sw), voic[1:], epiano, 0.5, v, spread=0.012, bright=0.5)
        r = near(root, 36, 29, 41)
        s.place('bass', b0, sub(r, s.beat_dur(min(beats, 2.6) - 0.1), 0.85, a=0.02, drive=2.0), 0)
        if beats == 4:
            s.place('bass', s.swing(b0 + 3.25, *sw), sub(r + 12, s.beat_dur(0.2), 0.45, drive=2.0), 0)
            s.place('bass', b0 + 3.5, sub(r + 7, s.beat_dur(0.45), 0.6, drive=2.0), 0)

    for bar in range(24):
        base = s.t(bar)
        for sb in (1, 3):
            s.place('snap', base + sb + 0.015, snap(s.hum(0.6), seed=bar * 2 + sb), 0.15 if sb == 1 else -0.15,
                    jitter=0.006)
        if bar >= 4:
            for kb, v in ((0, 0.6), (1.75, 0.35), (2.5, 0.5)):
                s.place('drums', s.swing(base + kb, *sw), kick(s.hum(v), tone=45, punch=0.5, decay=0.32), 0)
            for e in range(16):
                v = 0.14 if e % 2 == 0 else 0.08
                s.place('drums', s.swing(base + e * 0.25, *sw), hat(s.hum(v, 0.3), seed=e), 0.3, jitter=0.004)

    line = mel(
        'r:1 C5:.5 Eb5:.5 F5:1 Eb5:.75 C5:.25 Db5:2 Bb4:1 r:1 r:.5 Bb4:.5 Db5:.5 Eb5:.5 F5:1.5 Eb5:.5 '
        'C5:2 Bb4:1 G4:1 Ab5:1 G5:.5 F5:.5 Eb5:1 C5:1 Db5:1.5 C5:.5 Bb4:2 G4:.5 Bb4:.5 Db5:1 F5:2 '
        'Eb5:1 C5:1 Bb4:1.5 r:.5'
    )
    melody(s, 'mel', s.t(8), line, lead, vel=0.55, sw=sw, tr=-12, pan=0.1, cutoff=1700, glide=True)
    melody(s, 'mel', s.t(16), line, lead, vel=0.5, sw=sw, tr=-12, pan=0.1, cutoff=1900, glide=True)
    melody(s, 'mel', s.t(16), line, epiano, vel=0.25, sw=sw, pan=-0.25, bright=0.4)

    return s.render(reverb=(2.6, 0.25), damp=3500)


# ---------------------------------------------------------------- 深夜限定・前夕

def ad_prelude():
    s = Song(bpm=62, bars=24, seed=81)
    chart = [
        (4, 'Db2', 'F3 Ab3 C4 Eb4'), (4, 'Bb1', 'Ab3 Db4 Eb4 F4'), (4, 'Gb1', 'Bb3 F4 Ab4 C5'),
        (4, 'Ab1', 'Gb3 Bb3 Db4 F4'),
    ]
    tl = timeline(chart, repeat=6)
    breathe = 0.5 + 0.5 * s.lfo(3, phase=-0.25)
    s.bus('pad', gain=0.55, send=0.4, fx=f_sweep(s, 650, 2000, breathe))
    s.bus('keys', gain=0.85, send=0.45, fx=f_lp(3800))
    s.bus('bass', gain=0.5, send=0.0, fx=f_lp(260))
    s.bus('heart', gain=0.75, send=0.05)
    s.bus('mel', gain=0.65, send=0.4)
    s.bus('tex', gain=1.0, send=0.0)

    for i, (b0, beats, root, voic) in enumerate(tl):
        s.place('pad', b0, pad(voic, s.beat_dur(beats), 0.6, a=2.0, r=3.0, cutoff=2400, detune=9, seed=i), 0)
        r = near(root, 34, 29, 41)
        if b0 >= s.t(4):
            s.place('bass', b0, sub(r, s.beat_dur(beats - 0.2), 0.7, a=0.4, r=0.8, drive=1.3), 0)
            seq = voic + voic[-2:0:-1]
            for k in range(4):
                m = seq[(k + i) % len(seq)] + 12
                s.place('keys', b0 + k + (0.5 if k % 2 else 0), epiano(m, s.beat_dur(2.5), s.hum(0.3), bright=0.35),
                        -0.35 if k % 2 else 0.35, jitter=0.01)

    # 心跳：一拍一下，62 BPM 剛好是安靜時的心跳
    for bar in range(8, 24):
        for k in range(4):
            s.place('heart', s.t(bar) + k, heartbeat(0.55 if k == 0 else 0.4), 0)

    line = mel('Eb5:2 F5:2 Db5:3 r:1 C5:2 Bb4:2 Ab4:4 F5:2 Eb5:2 Db5:2 Eb5:1 F5:1 C5:4 Bb4:2 Ab4:2')
    melody(s, 'mel', s.t(12), line, lead, vel=0.45, tr=-12, legato=0.98, cutoff=1300, glide=True)
    melody(s, 'mel', s.t(12), line, bell, vel=0.12, pan=0.3)

    s.add_loop('tex', swell(s, 4, 400, 3200, 0.03, seed=82) + room(s.L) * 2)
    return s.render(reverb=(3.6, 0.3), damp=3000, predelay=0.03)


# ---------------------------------------------------------------- 深夜限定・激情

def ad_passion():
    s = Song(bpm=88, bars=32, seed=91)
    chart = [
        (4, 'C2', 'Eb3 G3 Bb3 D4'), (4, 'Ab1', 'Eb3 G3 C4'), (4, 'Eb2', 'G3 Bb3 D4'),
        (2, 'Bb1', 'F3 Bb3 C4'), (2, 'Bb1', 'F3 Bb3 D4'),
    ]
    tl = timeline(chart, repeat=8)
    sw = (0.0, 0.05)
    kick_pat = [0, 1.75, 2.5]
    kicks = [s.t(bar) + k for bar in range(4, 32) for k in kick_pat]
    sc = sidechain(s, kicks, depth=0.5, rel=0.2)
    tt = np.arange(s.n) / s.L
    opening = 0.5 - 0.5 * np.cos(2 * np.pi * (tt - 0.25))
    s.bus('drums', gain=0.6, send=0.08, fx=chain(f_lp(8000), f_sat(1.4)))
    s.bus('snare', gain=0.9, send=0.45)
    s.bus('bass', gain=0.6, send=0.0, fx=chain(sc, f_lp(900)))
    s.bus('pad', gain=0.5, send=0.3, fx=sc)
    s.bus('arp', gain=1.2, send=0.25, fx=chain(f_sweep(s, 700, 4200, opening), f_delay(s, 0.75, 0.3, 0.25), sc))
    s.bus('mel', gain=0.75, send=0.3)
    s.bus('tex', gain=1.0, send=0.0)

    for i, (b0, beats, root, voic) in enumerate(tl):
        s.place('pad', b0, pad(voic, s.beat_dur(beats), 0.6, a=0.6, r=1.2, cutoff=1500, seed=i), 0)
        r = near(root, 36, 31, 43)
        for k in range(int(beats * 2)):
            v = 0.85 if k % 4 == 0 else 0.6
            m = r + (12 if k % 8 == 7 else 0)
            s.place('bass', b0 + k * 0.5, synth_bass(m, s.beat_dur(0.42), s.hum(v, 0.05), bright=0.35), 0)
        if b0 >= s.t(8):
            up = [m + 12 for m in voic]
            for k in range(int(beats * 4)):
                m = up[k % len(up)] + (12 if (k // len(up)) % 2 else 0)
                s.place('arp', s.swing(b0 + k * 0.25, *sw), pluck(m, s.beat_dur(0.2), s.hum(0.4 if k % 4 else 0.55),
                                                                    bright=0.7), 0.3 if k % 2 else -0.3)

    for kb in kicks:
        s.place('drums', s.swing(kb, *sw), kick(0.8 if kb % 4 == 0 else 0.6, tone=46, punch=0.8, decay=0.3), 0)
    for bar in range(4, 32):
        base = s.t(bar)
        for e in range(16):
            v = 0.2 if e % 2 == 0 else 0.11
            s.place('drums', s.swing(base + e * 0.25, *sw), hat(s.hum(v, 0.25), seed=e), 0.3, jitter=0.003)
        if bar >= 8:
            for sb in (1, 3):
                s.place('snare', base + sb, snare(s.hum(0.6), tone=170, snap=0.4, decay=0.2, seed=bar), 0.05,
                        jitter=0.004)
            s.place('drums', base + 3.5, hat(0.2, open_=True, seed=3), -0.2)

    line = mel(
        'G4:1 Bb4:1 C5:1.5 D5:.5 Eb5:2 C5:1 G4:1 Bb4:1 D5:1 Eb5:1 G5:1 F5:2 D5:2 '
        'Eb5:1.5 D5:.5 C5:1 Bb4:1 C5:2 G4:2 Bb4:1 G4:.5 Bb4:.5 D5:2 C5:2 Bb4:2'
    )
    melody(s, 'mel', s.t(24), line, lead, vel=0.55, pan=0.1, cutoff=2000, glide=True)

    s.add_loop('tex', swell(s, 8, 500, 4000, 0.025, seed=92))
    return s.render(reverb=(2.4, 0.22), damp=4000)


# ---------------------------------------------------------------- 深夜限定・收尾

def ad_after():
    s = Song(bpm=60, bars=20, seed=101)
    chart = [
        (4, 'Ab1', 'C4 Eb4 G4 Bb4'), (4, 'F1', 'Ab3 C4 Eb4 G4'), (4, 'Db2', 'F3 Ab3 C4 Eb4'),
        (2, 'Eb2', 'Ab3 Bb3 Db4'), (2, 'Eb2', 'G3 Bb3 Db4'),
    ]
    tl = timeline(chart, repeat=5)
    s.bus('piano', gain=0.8, send=0.35)
    s.bus('pad', gain=0.4, send=0.4, fx=f_lp(1100))
    s.bus('mel', gain=0.6, send=0.38)
    s.bus('tex', gain=1.0, send=0.0)

    for i, (b0, beats, root, voic) in enumerate(tl):
        low = near(root, 44, 36, 51)
        s.place('piano', b0, felt_piano(low, s.beat_dur(beats), 0.45, soft=0.8), -0.15, jitter=0.01)
        for k in range(1, int(beats)):
            m = voic[(k - 1) % len(voic)]
            s.place('piano', b0 + k + (0.06 if k % 2 else 0), felt_piano(m, s.beat_dur(beats - k + 0.5),
                                                                          s.hum(0.32), soft=0.8), 0.1, jitter=0.012)
        s.place('pad', b0, pad(voic, s.beat_dur(beats), 0.5, a=2.0, r=3.0, cutoff=1400, seed=i), 0)

    line = mel('C5:1 Eb5:1 G5:2 F5:2 Eb5:1 C5:1 Ab4:1 C5:1 Eb5:2 Db5:2 Bb4:2 '
               'Eb5:3 r:1 C5:2 Ab4:2 F4:1 Ab4:1 C5:2 Bb4:4')
    melody(s, 'mel', s.t(8), line, felt_piano, vel=0.42, tr=0, legato=1.3, pan=0.2, soft=0.7)

    s.add_loop('tex', rain(s.L, seed=103) * 0.45 + room(s.L) * 2)
    return s.render(reverb=(3.2, 0.28), damp=3200, predelay=0.03)


# ---------------------------------------------------------------- 爸媽聊聊・飯後閒聊

def home():
    s = Song(bpm=88, bars=32, beats=3, seed=111)
    chart = [
        (3, 'F2', 'A3 C4 F4'), (3, 'E2', 'G3 C4 E4'), (3, 'D2', 'F3 A3 C4'), (3, 'Bb1', 'F3 Bb3 D4'),
        (3, 'C2', 'A3 C4 F4'), (3, 'G2', 'F3 Bb3 D4'), (3, 'C2', 'G3 Bb3 E4'), (3, 'F2', 'A3 C4 F4'),
    ]
    tl = timeline(chart, repeat=4)
    s.bus('piano', gain=0.8, send=0.25)
    s.bus('bass', gain=0.6, send=0.05)
    s.bus('pad', gain=0.35, send=0.3, fx=f_lp(1600))
    s.bus('mel', gain=0.65, send=0.3)

    # 嗡—恰—恰
    for i, (b0, beats, root, voic) in enumerate(tl):
        low = near(root, 45, 38, 50)
        s.place('piano', b0, felt_piano(low, s.beat_dur(1.4), s.hum(0.5), soft=0.6), -0.1, jitter=0.008)
        for k in (1, 2):
            strum(s, 'piano', b0 + k, voic, felt_piano, 0.8, 0.3, spread=0.006, pan=0.1, soft=0.6)
        if b0 >= s.t(8):
            s.place('bass', b0, upright(near(root, 36, 31, 43), s.beat_dur(1.5), 0.6), 0)
        if s.t(16) <= b0 < s.t(32):
            s.place('pad', b0, pad(voic, s.beat_dur(beats), 0.45, a=0.6, r=1.0, cutoff=1800, rolloff=1.6, seed=i), 0)

    a = mel('C5:1 A4:1 C5:1 E5:2 C5:1 D5:1.5 E5:.5 F5:1 D5:3 C5:1 A4:1 F4:1 Bb4:1.5 A4:.5 G4:1 E4:1 G4:1 Bb4:1 '
            'A4:3')
    b = mel('F5:1 E5:1 C5:1 G5:2 E5:1 F5:1 D5:1 A4:1 Bb4:1.5 C5:.5 D5:1 C5:2 A4:1 D5:1.5 C5:.5 Bb4:1 '
            'G4:1 Bb4:1 E5:1 F5:3')
    box = lambda m, d, v: bell(m, d, v, 'musicbox')  # noqa: E731
    melody(s, 'mel', s.t(8), a, box, vel=0.6, pan=0.2)
    melody(s, 'mel', s.t(16), b, box, vel=0.6, pan=0.2)
    melody(s, 'mel', s.t(24), a, flute, vel=0.5, pan=-0.1)
    melody(s, 'mel', s.t(24), a, box, vel=0.3, tr=12, pan=0.25)

    return s.render(reverb=(2.0, 0.22), damp=4500)


# ---------------------------------------------------------------- 爸媽聊聊・回家過節

def holiday():
    s = Song(bpm=104, bars=32, seed=121)
    chart = [(4, 'D2', 'F#3 A3 D4'), (4, 'B1', 'F#3 B3 D4'), (4, 'G1', 'G3 B3 D4'), (4, 'A1', 'E3 A3 C#4')]
    tl = timeline(chart, repeat=8)
    s.bus('zheng', gain=1.0, send=0.28)
    s.bus('bass', gain=0.35, send=0.03, fx=f_lp(500))
    s.bus('perc', gain=0.5, send=0.12)
    s.bus('mel', gain=0.7, send=0.3)
    s.bus('bells', gain=0.4, send=0.35)

    penta = notes('D4 E4 F#4 A4 B4 D5 E5 F#5 A5')
    for i, (b0, beats, root, voic) in enumerate(tl):
        # 撥弦伴奏：根音、五度、八度、五度
        r = near(root, 50, 45, 57)
        for k, m in enumerate([r, r + 7, r + 12, r + 7, r, r + 7, r + 12, r + 7]):
            s.place('zheng', b0 + k * 0.5, ks(m, s.beat_dur(0.9), s.hum(0.35 if k % 2 else 0.45), bright=0.75,
                                              t60=1.6, pick=0.12), -0.3, jitter=0.004)
        s.place('bass', b0, sub(near(root, 38, 33, 45), s.beat_dur(1.8), 0.6), 0)
        s.place('bass', b0 + 2, sub(near(root + 7, 40, 33, 47), s.beat_dur(1.8), 0.5), 0)
        # 每四小節開頭一個古箏刮奏
        if i % 4 == 0:
            for k, m in enumerate(penta):
                s.place('zheng', b0 - 0.5 + k * 0.055, guzheng(m, s.beat_dur(1.5), 0.25 + 0.03 * k, bend=False),
                        -0.4 + 0.1 * k)

    for bar in range(32):
        base = s.t(bar)
        for hb in (0, 2):
            s.place('perc', base + hb, hand_drum(s.hum(0.5), tone=100), -0.1, jitter=0.004)
        if bar >= 8:
            for wb in (1, 3):
                s.place('perc', base + wb, woodblock(76 if wb == 1 else 79, s.hum(0.4)), 0.3, jitter=0.004)
        if bar >= 16:
            for e in range(8):
                s.place('perc', base + e * 0.5, tambourine(s.hum(0.2 if e % 2 else 0.12), seed=e), -0.35)
        if bar % 8 == 7:
            for k, m in enumerate(notes('A5 F#5 D5')):
                s.place('bells', base + 3 + k * 0.33, bell(m, 1.2, 0.5, 'glock'), 0.3)

    line = mel(
        'A4:.5 B4:.5 D5:1 E5:.5 D5:.5 B4:1 A4:1 B4:.5 A4:.5 F#4:2 E4:.5 F#4:.5 A4:1 B4:1 D5:1 E5:3 r:1 '
        'F#5:1 E5:.5 D5:.5 E5:1 A4:1 B4:1 D5:.5 B4:.5 A4:2 B4:.5 A4:.5 F#4:1 E4:1 A4:1 '
        'E4:.5 F#4:.5 A4:1 D5:2'
    )
    melody(s, 'mel', s.t(8), line, guzheng, vel=0.7, pan=0.15)
    melody(s, 'mel', s.t(16), line, flute, vel=0.6, tr=12, pan=0.1)
    melody(s, 'mel', s.t(24), line, guzheng, vel=0.7, pan=0.15)
    melody(s, 'mel', s.t(24), line, lambda m, d, v: bell(m, d, v, 'glock'), vel=0.3, tr=12, pan=-0.25)

    return s.render(reverb=(1.8, 0.2), damp=6000, master_lp=9000)


# ---------------------------------------------------------------- 輸出

SONGS = {
    'cafe': (cafe, -19.0),
    'latenight': (latenight, -20.0),
    'walk': (walk, -19.5),
    'dinner': (dinner, -19.5),
    'travel': (travel, -19.5),
    'party': (party, -18.5),
    'ad-flirt': (ad_flirt, -20.0),
    'ad-prelude': (ad_prelude, -21.0),
    'ad-passion': (ad_passion, -19.5),
    'ad-after': (ad_after, -21.5),
    'home': (home, -20.0),
    'holiday': (holiday, -19.0),
}


def main(names):
    os.makedirs(OUT, exist_ok=True)
    for name in names or SONGS:
        fn, target = SONGS[name]
        x = fn()
        y = master(x, target)
        path = os.path.join(OUT, f'{name}.mp3')
        write(path, y)
        print(f'{name:11s} {len(y) / SR:5.1f}s  loud {loudness(y):6.1f} dB  peak {np.max(np.abs(y)):.2f}  '
              f'{os.path.getsize(path) / 1024:6.0f} KB')


if __name__ == '__main__':
    main(sys.argv[1:])
