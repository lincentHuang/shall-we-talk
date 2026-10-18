"""
背景音樂合成引擎：純 numpy 合成，不用任何取樣或外部音源，所以沒有版權問題。

做法：
- 每首曲子是一個 Song，先指定速度、小節數；樂器音符用 place() 放到各自的 bus（立體聲緩衝）。
- 緩衝比一輪循環多留 tail 秒，讓最後幾個音的餘韻和殘響有地方放；
  render() 最後把超出一輪的部分「折回」開頭疊加，所以檔案頭尾完全接得上，可以無縫循環。
- 會隨時間變化的效果（顫音、側鏈、濾波掃頻）都用整數輪的週期，折回後也連續。
- 雨聲、黑膠雜訊這類質感層用 FFT 做循環濾波，本身就是週期訊號，不經過折回。
"""

import numpy as np
from scipy import signal

SR = 44100
NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(name):
    """'C4' → 60、'Bb3' → 58、'F#5' → 78；數字直接回傳"""
    if not isinstance(name, str):
        return name
    pc = NOTES[name[0]]
    i = 1
    while i < len(name) and name[i] in '#b':
        pc += 1 if name[i] == '#' else -1
        i += 1
    return pc + 12 * (int(name[i:]) + 1)


def hz(m):
    return 440.0 * 2 ** ((midi(m) - 69) / 12)


def notes(s):
    """'F2 A3 C4' → [41, 57, 60]"""
    return [midi(x) for x in s.split()]


def mel(s):
    """旋律字串 'C5:1 D5:.5 r:1' → [(音高或 None, 拍數)]"""
    out = []
    for tok in s.split():
        n, d = tok.split(':')
        out.append((None if n == 'r' else midi(n), float(d)))
    return out


def seg(dur, a=0.005, r=0.1):
    """持續 dur 秒、起音 a、釋音 r 的包絡長度（樣本數）"""
    return int((dur + r) * SR)


def release_env(t, dur, r):
    """dur 之前是 1，之後在 r 秒內平滑降到 0"""
    e = np.ones_like(t)
    m = t > dur
    e[m] = np.clip(1 - (t[m] - dur) / max(r, 1e-4), 0, 1) ** 2
    return e


def attack_env(t, a):
    return np.clip(t / max(a, 1e-4), 0, 1)


def lp(x, cutoff, order=2):
    sos = signal.butter(order, min(cutoff, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def hp(x, cutoff, order=2):
    sos = signal.butter(order, cutoff, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def wavetable(f, rolloff=1.0, maxf=9000, size=4096, odd=False):
    """一個週期的帶限波形（鋸齒或方波系），諧波高於 maxf 的不畫，避免疊頻"""
    k = np.arange(1, max(2, int(maxf / f)) + 1)
    if odd:
        k = k[k % 2 == 1]
    ph = np.arange(size) / size
    w = np.sum(np.sin(2 * np.pi * np.outer(k, ph)) / k[:, None] ** rolloff, axis=0)
    return w / np.max(np.abs(w))


def osc(table, freq, n, phase0=0.0):
    """freq 可以是常數或逐樣本陣列（顫音、滑音）"""
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    ph = (phase0 + np.cumsum(f) / SR) % 1.0
    idx = ph * len(table)
    i0 = idx.astype(int)
    frac = idx - i0
    return table[i0] * (1 - frac) + table[(i0 + 1) % len(table)] * frac


def vibrato(f, n, rate=5.0, depth=0.004, delay=0.25):
    t = np.arange(n) / SR
    ramp = np.clip((t - delay) / 0.4, 0, 1)
    return f * (1 + depth * ramp * np.sin(2 * np.pi * rate * t))


# ---------------------------------------------------------------- 樂器

def epiano(m, dur, vel=0.7, bright=1.0):
    """FM 電鋼琴（Rhodes 風）：載波與調變 1:1，重擊時調變指數高、比較有咬勁"""
    f = hz(m)
    r = 0.35
    n = seg(dur, r=r)
    t = np.arange(n) / SR
    decay = 2.6 * (220 / f) ** 0.4
    amp = np.exp(-t / decay) * release_env(t, dur, r) * attack_env(t, 0.003)
    idx = (0.3 + 1.5 * vel * bright) * np.exp(-t / 0.3) + 0.12
    mod = np.sin(2 * np.pi * f * t)
    car = np.sin(2 * np.pi * f * t + idx * mod)
    car2 = np.sin(2 * np.pi * f * 1.0015 * t + 0.6 * idx * mod)
    tine = np.sin(2 * np.pi * f * 7 * t) * np.exp(-t / 0.025) * 0.18 * vel * bright
    return (0.6 * car + 0.4 * car2 + tine) * amp * vel


def felt_piano(m, dur, vel=0.6, soft=0.6):
    """毛氈鋼琴：帶一點不諧和的泛音、兩根弦微微走音產生拍頻，再用低通變柔"""
    f = hz(m)
    r = 0.5
    n = seg(dur, r=r)
    t = np.arange(n) / SR
    out = np.zeros(n)
    tau1 = 3.2 * (220 / f) ** 0.5
    B = 0.0003
    for k in range(1, 9):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        a = (1 / k ** 1.6) * (vel ** (0.4 * (k - 1)))
        tau = tau1 / (1 + 0.7 * (k - 1))
        for det in (-0.6, 0.6):
            out += a * np.sin(2 * np.pi * fk * 2 ** (det / 1200) * t + k) * np.exp(-t / tau)
    hammer = np.random.default_rng(int(m)).standard_normal(n) * np.exp(-t / 0.006) * 0.08
    out = (out * 0.5 + hammer) * attack_env(t, 0.006) * release_env(t, dur, r)
    out = lp(out, 900 + 4000 * (1 - soft) * vel + f * 2)
    return out * vel


def ks(m, dur, vel=0.7, bright=0.5, t60=2.5, pick=0.18, rel=0.12, seed=None):
    """Karplus-Strong 撥弦（吉他、古箏、撥弦貝斯）。逐塊向量化計算回授，速度夠快"""
    f = hz(m)
    N = max(2, int(np.floor(SR / f - 0.5)))
    f_int = SR / (N + 0.5)
    ratio = f / f_int
    damp = 10 ** (-3 / (t60 * f_int))
    n_out = seg(dur, r=rel)
    n_raw = int(n_out * ratio) + N + 4
    rng = np.random.default_rng(seed if seed is not None else int(m * 7919 + vel * 1000))
    exc = rng.uniform(-1, 1, N)
    # 撥弦位置：減掉延遲過的自己，形成梳狀頻譜，聽起來像吉他而不是電子音
    p = max(1, int(N * pick))
    exc = exc - np.roll(exc, p)
    # 亮度：一階低通
    a = 0.15 + 0.8 * (1 - bright)
    exc = signal.lfilter([1 - a], [1, -a], exc)
    z = np.zeros(n_raw + 1)
    z[1:N + 1] = exc
    s = N + 1
    while s < n_raw + 1:
        e = min(s + N, n_raw + 1)
        z[s:e] = damp * 0.5 * (z[s - N:e - N] + z[s - N - 1:e - N - 1])
        s = e
    y = z[1:]
    out = np.interp(np.arange(n_out) * ratio, np.arange(len(y)), y)
    t = np.arange(n_out) / SR
    out *= release_env(t, dur, rel)
    return out / (np.max(np.abs(out)) + 1e-9) * vel


def guzheng(m, dur, vel=0.7, bend=True):
    """古箏：亮一點的撥弦，結尾往下按弦的小滑音"""
    y = ks(m, dur, vel, bright=0.85, t60=2.8, pick=0.12, rel=0.3)
    if bend and dur > 0.6:
        n = len(y)
        t = np.arange(n) / SR
        # 按弦：音高在後段上揚約半音再回來
        b = np.clip((t - dur * 0.45) / 0.18, 0, 1) * np.clip(1 - (t - dur * 0.8) / 0.25, 0, 1) * 0.5
        warp = np.cumsum(2 ** (b / 12)) - 1
        y = np.interp(warp, np.arange(n), y, right=0)
    return y


def bell(m, dur, vel=0.6, kind='glock'):
    """鐵琴／音樂盒／顫音琴：幾個不諧和泛音各自衰減"""
    f = hz(m)
    specs = {
        'glock': ([1, 2.76, 5.40, 8.93], [1, 0.3, 0.12, 0.05], [1.4, 0.45, 0.2, 0.1]),
        'musicbox': ([1, 3.0, 4.95, 7.2], [1, 0.18, 0.1, 0.04], [1.6, 0.4, 0.2, 0.08]),
        'vibes': ([1, 4.0, 10.0], [1, 0.22, 0.05], [2.4, 0.6, 0.15]),
        'celesta': ([1, 2.0, 3.0, 4.1], [1, 0.25, 0.1, 0.05], [1.2, 0.5, 0.3, 0.12]),
    }[kind]
    r = 0.3
    n = seg(max(dur, specs[2][0]), r=r)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, a, tau in zip(*specs):
        if f * ratio < 16000:
            out += a * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (tau * (440 / f) ** 0.2))
    if kind == 'vibes':
        out *= 1 + 0.25 * np.sin(2 * np.pi * 5.2 * t)
    click = np.random.default_rng(int(m)).standard_normal(n) * np.exp(-t / 0.002) * 0.05
    out = (out + click) * attack_env(t, 0.001) * release_env(t, max(dur, 1.2) if kind != 'vibes' else dur + 0.6, r)
    return out * vel * 0.6


def flute(m, dur, vel=0.6):
    """長笛：基音為主的正弦＋氣音，0.25 秒後才出現抖音"""
    f = hz(m)
    r = 0.15
    n = seg(dur, r=r)
    t = np.arange(n) / SR
    fv = vibrato(f, n, 5.0, 0.005, 0.25)
    ph = np.cumsum(fv) / SR
    tone = np.sin(2 * np.pi * ph) + 0.18 * np.sin(4 * np.pi * ph) + 0.06 * np.sin(6 * np.pi * ph)
    breath = bp(np.random.default_rng(int(m) + 3).standard_normal(n), f * 0.8, min(f * 4, 12000)) * 0.12
    amp = attack_env(t, 0.07) * release_env(t, dur, r) * (1 - 0.15 * np.exp(-t / 0.1))
    return (tone + breath) * amp * vel * 0.5


def lead(m, dur, vel=0.6, cutoff=2200, prev=None, glide=0.06):
    """柔和合成主奏：圓潤的鋸齒波＋抖音，可以從前一個音滑過來"""
    f = hz(m)
    r = 0.2
    n = seg(dur, r=r)
    t = np.arange(n) / SR
    fv = vibrato(f, n, 4.8, 0.006, 0.3)
    if prev is not None:
        fp = hz(prev)
        g = np.clip(t / glide, 0, 1)
        fv = fv * (fp / f) ** (1 - g)
    tab = wavetable(f, rolloff=1.6, maxf=7000)
    y = osc(tab, fv, n) * 0.7 + 0.3 * np.sin(2 * np.pi * np.cumsum(fv) / SR)
    y = lp(y, cutoff)
    return y * attack_env(t, 0.04) * release_env(t, dur, r) * vel * 0.5


def pad(ms, dur, vel=0.5, a=1.2, r=2.0, cutoff=1400, detune=7, rolloff=1.2, seed=0):
    """和弦鋪底：每個音三支互相走音的鋸齒波，慢起慢收"""
    n = seg(dur, r=r)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rng = np.random.default_rng(seed)
    for m in ms:
        f = hz(m)
        tab = wavetable(f, rolloff=rolloff, maxf=6000)
        for d in (-detune, 0, detune):
            out += osc(tab, f * 2 ** (d / 1200), n, rng.random())
    out /= max(1, len(ms)) ** 0.7 * 3
    out = lp(out, cutoff)
    env = np.clip(t / a, 0, 1) ** 1.5 * release_env(t, dur, r)
    return out * env * vel


def sub(m, dur, vel=0.8, a=0.01, r=0.12, drive=1.5):
    """低音：正弦＋一點二次諧波，輕微飽和讓小喇叭也聽得到"""
    f = hz(m)
    n = seg(dur, r=r)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    y = np.tanh(drive * y) / np.tanh(drive)
    return y * attack_env(t, a) * release_env(t, dur, r) * vel * 0.6


def upright(m, dur, vel=0.8):
    """低音大提琴：低亮度撥弦＋正弦基音補厚度"""
    y = ks(m, dur, vel, bright=0.25, t60=1.6, pick=0.3, rel=0.08)
    s = sub(m, dur, vel * 0.7, a=0.008, r=0.08, drive=1.2)
    t = np.arange(len(s)) / SR
    s *= np.exp(-t / 0.9)
    k = min(len(y), len(s))
    return y[:k] * 0.6 + s[:k]


def synth_bass(m, dur, vel=0.8, bright=0.6):
    """合成貝斯：鋸齒波，濾波器隨時間關起來（用三種亮度交叉淡化模擬）"""
    f = hz(m)
    r = 0.06
    n = seg(dur, r=r)
    t = np.arange(n) / SR
    tab = wavetable(f, rolloff=1.0, maxf=5000)
    raw = osc(tab, f, n) * 0.6 + np.sin(2 * np.pi * f * t) * 0.6
    dark = lp(raw, 180 + f)
    mid = lp(raw, 500 + 2 * f)
    hi = lp(raw, 1500 + 3000 * bright)
    e = np.exp(-t / (0.08 + 0.12 * bright))
    w_hi = e ** 2
    w_mid = 2 * e * (1 - e)
    w_dark = (1 - e) ** 2
    y = hi * w_hi + mid * w_mid + dark * w_dark
    return np.tanh(1.4 * y) * attack_env(t, 0.004) * release_env(t, dur, r) * vel * 0.7


def pluck(m, dur, vel=0.6, bright=0.8):
    """合成撥奏：亮的 KS，衰減快"""
    return ks(m, dur, vel, bright=bright, t60=0.9, pick=0.5, rel=0.08)


# ---------------------------------------------------------------- 打擊

def _rng(seed):
    return np.random.default_rng(seed)


def kick(vel=0.8, tone=50, punch=1.0, decay=0.35, seed=0):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = tone + (110 * punch) * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    click = lp(_rng(seed).standard_normal(n), 3000) * np.exp(-t / 0.003) * 0.15 * punch
    return np.tanh(1.5 * (y + click)) * vel


def snare(vel=0.6, tone=190, snap=0.5, decay=0.16, seed=1):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    noise = bp(_rng(seed).standard_normal(n), 1200, 7000) * np.exp(-t / decay)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.06)
    return (noise * (0.5 + snap) + body * 0.6) * vel * 0.6


def rim(vel=0.5, seed=2):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    y = bp(_rng(seed).standard_normal(n), 1500, 4500) * np.exp(-t / 0.012)
    y += np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.015) * 0.5
    return y * vel * 0.7


def clap(vel=0.6, seed=3):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    noise = bp(_rng(seed).standard_normal(n), 900, 4000)
    env = np.zeros(n)
    for i, off in enumerate((0, 0.009, 0.019)):
        tt = t - off
        env += np.where(tt >= 0, np.exp(-np.maximum(tt, 0) / (0.006 if i < 2 else 0.12)), 0)
    return noise * env * vel * 0.5


def hat(vel=0.3, open_=False, seed=4):
    n = int((0.4 if open_ else 0.1) * SR)
    t = np.arange(n) / SR
    y = hp(_rng(seed).standard_normal(n), 7000, order=4) * np.exp(-t / (0.16 if open_ else 0.025))
    return y * vel * 0.5


def shaker(vel=0.25, seed=5):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    y = bp(_rng(seed).standard_normal(n), 4000, 11000) * np.clip(t / 0.012, 0, 1) * np.exp(-t / 0.035)
    return y * vel * 0.5


def brush(vel=0.3, long=False, seed=6):
    n = int((0.6 if long else 0.25) * SR)
    t = np.arange(n) / SR
    att = 0.08 if long else 0.02
    y = bp(_rng(seed).standard_normal(n), 1500, 7000) * np.clip(t / att, 0, 1) * np.exp(-t / (0.25 if long else 0.07))
    return y * vel * 0.5


def ride(vel=0.3, seed=7):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for r_, a in ((1.0, 1), (1.483, 0.8), (1.932, 0.7), (2.546, 0.6), (3.112, 0.5), (4.03, 0.4)):
        y += a * np.sign(np.sin(2 * np.pi * 420 * r_ * t + r_))
    y = hp(y, 3500) * 0.12 + hp(_rng(seed).standard_normal(n), 6000) * 0.25
    return y * np.exp(-t / 0.45) * attack_env(t, 0.001) * vel * 0.4


def snap(vel=0.5, seed=8):
    n = int(0.2 * SR)
    t = np.arange(n) / SR
    y = bp(_rng(seed).standard_normal(n), 1800, 4500) * np.exp(-t / 0.018)
    y += bp(_rng(seed + 1).standard_normal(n), 800, 1600) * np.exp(-t / 0.008) * 0.6
    return y * vel * 0.8


def woodblock(m=76, vel=0.4):
    f = hz(m)
    n = int(0.15 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.03) + 0.4 * np.sin(2 * np.pi * f * 2.7 * t) * np.exp(-t / 0.015)
    return y * vel * 0.5


def hand_drum(vel=0.5, tone=110, seed=9):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = tone * (1 + 0.4 * np.exp(-t / 0.02))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    y += lp(_rng(seed).standard_normal(n), 2500) * np.exp(-t / 0.01) * 0.2
    return y * vel * 0.7


def heartbeat(vel=0.6):
    """心跳：低沉的「咚—咚」"""
    n = int(0.9 * SR)
    out = np.zeros(n)
    for off, a in ((0, 1.0), (0.24, 0.7)):
        i = int(off * SR)
        k = kick(a, tone=42, punch=0.3, decay=0.12)
        out[i:i + len(k)] += k[:n - i]
    return lp(out, 160) * vel


def tambourine(vel=0.3, seed=10):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    y = hp(_rng(seed).standard_normal(n), 6000) * np.exp(-t / 0.07)
    for r_ in (5200, 6900, 8800):
        y += 0.15 * np.sin(2 * np.pi * r_ * t) * np.exp(-t / 0.06)
    return y * vel * 0.4


# ---------------------------------------------------------------- 循環質感（本身就是週期訊號）

def shaped_noise(n, lo, hi, seed, tilt=0.0, stereo=True):
    """用 FFT 在頻域濾波的循環噪音；tilt < 0 越往高頻越弱"""
    rng = np.random.default_rng(seed)
    ch = 2 if stereo else 1
    out = np.zeros((n, ch))
    fr = np.fft.rfftfreq(n, 1 / SR)
    H = ((fr >= lo) & (fr <= hi)).astype(float)
    H *= np.where(fr > 0, (np.maximum(fr, 1) / 1000) ** tilt, 0)
    # 邊緣做軟一點的斜坡
    H = np.convolve(H, np.hanning(64) / 32, mode='same')
    for c in range(ch):
        X = np.fft.rfft(rng.standard_normal(n)) * H
        y = np.fft.irfft(X, n)
        out[:, c] = y / (np.std(y) + 1e-9)
    return out


def rain(n, seed=20):
    """細雨：粉紅噪音的沙沙聲＋隨機雨滴"""
    bed = shaped_noise(n, 300, 9000, seed, tilt=-0.6) * 0.08
    rng = np.random.default_rng(seed + 1)
    drops = np.zeros((n, 2))
    k = int(n / SR * 9)
    for _ in range(k):
        i = rng.integers(0, n)
        f = rng.uniform(1800, 5200)
        ln = int(0.02 * SR)
        t = np.arange(ln) / SR
        d = np.sin(2 * np.pi * f * t * (1 + 3 * t)) * np.exp(-t / 0.004) * rng.uniform(0.01, 0.05)
        idx = (i + np.arange(ln)) % n
        pan = rng.uniform(0, 1)
        drops[idx, 0] += d * (1 - pan)
        drops[idx, 1] += d * pan
    return bed + drops


def vinyl(n, seed=30):
    """黑膠：低沉的底噪加零星爆音"""
    hiss = shaped_noise(n, 800, 7000, seed, tilt=-0.4) * 0.012
    rng = np.random.default_rng(seed + 1)
    cr = np.zeros(n)
    k = int(n / SR * 6)
    pos = rng.integers(0, n, k)
    cr[pos] = rng.uniform(-1, 1, k) * rng.uniform(0.02, 0.12, k)
    # 循環卷積成短促的「啪」
    ker = np.zeros(n)
    ln = int(0.002 * SR)
    ker[:ln] = np.exp(-np.arange(ln) / (0.0004 * SR))
    cr = np.fft.irfft(np.fft.rfft(cr) * np.fft.rfft(ker), n)
    cr = np.fft.irfft(np.fft.rfft(cr) * (np.fft.rfftfreq(n, 1 / SR) > 1000), n)
    return hiss + np.stack([cr, cr], axis=1)


def room(n, seed=40):
    """很輕的空間底噪，讓安靜段落不會完全死寂"""
    return shaped_noise(n, 60, 2500, seed, tilt=-1.0) * 0.004


# ---------------------------------------------------------------- 殘響

def make_ir(decay=2.5, predelay=0.02, damp=4000, seed=99, size=None):
    n = int((size or decay * 1.4) * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    ir = np.zeros((n, 2))
    for c in range(2):
        noise = rng.standard_normal(n)
        low = lp(noise, damp)
        high = noise - low
        ir[:, c] = low * np.exp(-6.9 * t / decay) + high * np.exp(-6.9 * t / (decay * 0.35))
    ir *= np.clip(t / 0.015, 0, 1)[:, None]
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((pd, 2)), ir])
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def convolve(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c]) for c in range(2)], axis=1)


# ---------------------------------------------------------------- 曲子

class Song:
    def __init__(self, bpm, bars, beats=4, tail=7.0, seed=1):
        self.bpm = bpm
        self.spb = 60.0 / bpm
        self.beats = beats
        self.bars = bars
        self.dur = bars * beats * self.spb
        self.L = int(round(self.dur * SR))
        self.n = self.L + int(tail * SR)
        self.rng = np.random.default_rng(seed)
        self.buses = {}

    # 時間與律動

    def t(self, bar, beat=0.0):
        """第 bar 小節（從 0 起算）第 beat 拍 → 總拍數"""
        return bar * self.beats + beat

    def swing(self, b, eighth=0.0, sixteenth=0.0):
        """後半拍往後推：eighth=0.08 約等於 58% 的搖擺"""
        fr = b % 1
        if abs(fr - 0.5) < 1e-6:
            b += eighth
        elif abs(fr - 0.25) < 1e-6 or abs(fr - 0.75) < 1e-6:
            b += sixteenth
        return b

    def beat_dur(self, beats):
        return beats * self.spb

    def lfo(self, cycles_per_loop, phase=0.0, n=None):
        """整數圈的低頻振盪，折回後首尾連續"""
        n = n or self.n
        tt = np.arange(n) / self.L
        return np.sin(2 * np.pi * (cycles_per_loop * tt + phase))

    def beat_phase(self, n=None, every=1.0):
        """每 every 拍歸零一次的鋸齒（0→1），做側鏈用"""
        n = n or self.n
        b = np.arange(n) / SR / self.spb
        return (b % every) / every

    # 混音

    def bus(self, name, gain=1.0, send=0.2, fx=None):
        self.buses[name] = {'buf': np.zeros((self.n, 2)), 'gain': gain, 'send': send, 'fx': fx}
        return name

    def place(self, bus, beat, audio, pan=0.0, gain=1.0, jitter=0.0):
        """在第 beat 拍放一段單聲道音訊；jitter 是隨機偏移（秒），模擬人手"""
        if audio is None or len(audio) == 0:
            return
        sec = beat * self.spb + (self.rng.uniform(-jitter, jitter) if jitter else 0)
        start = int(round(sec * SR))
        if start < 0:
            start += self.L
        start %= self.L
        b = self.buses[bus]['buf']
        ln = min(len(audio), self.n - start)
        th = (pan + 1) * np.pi / 4
        b[start:start + ln, 0] += audio[:ln] * np.cos(th) * gain
        b[start:start + ln, 1] += audio[:ln] * np.sin(th) * gain

    def hum(self, v, spread=0.12):
        """力度的人味：隨機上下一點"""
        return v * (1 + self.rng.uniform(-spread, spread))

    def add_loop(self, bus, stereo):
        """循環質感層：長度剛好一輪，不需要折回"""
        b = self.buses[bus]['buf']
        b[:self.L] += stereo[:self.L]

    def render(self, reverb=(2.5, 0.25), ir_seed=99, damp=4500, predelay=0.02, master_lp=None):
        mix = np.zeros((self.n, 2))
        send = np.zeros((self.n, 2))
        self.levels = {}
        for name, b in self.buses.items():
            x = b['buf']
            if b['fx'] is not None:
                x = b['fx'](x)
            x = x * b['gain']
            self.levels[name] = loudness(x[:self.L])
            mix += x
            send += x * b['send']
        decay, wet = reverb
        if wet > 0:
            ir = make_ir(decay, predelay, damp, ir_seed)
            wetsig = convolve(send, ir) * wet
            full = np.zeros((len(wetsig), 2))
            full[:self.n] += mix
            full += wetsig
        else:
            full = mix
        # 濾波要在折回之前做：濾波器的餘振也會跟著折回，接點才不會喀一聲
        full = hp(full, 28)
        if master_lp:
            full = lp(full, master_lp)
        # 折回：超過一輪的部分疊到開頭
        out = np.zeros((self.L, 2))
        for k in range(0, len(full), self.L):
            part = full[k:k + self.L]
            out[:len(part)] += part
        return out


# ---------------------------------------------------------------- 母帶與輸出

def loudness(x):
    """粗略的響度：濾掉低頻後的 RMS（dB）"""
    y = hp(x, 150)
    return 20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-12)


def master(x, target=-24.0, ceiling=0.89):
    g = 10 ** ((target - loudness(x)) / 20)
    y = x * g
    # 軟限制：超過門檻的部分用 tanh 壓
    th = 0.6
    a = np.abs(y)
    over = a > th
    y[over] = np.sign(y[over]) * (th + (1 - th) * np.tanh((a[over] - th) / (1 - th)))
    peak = np.max(np.abs(y))
    if peak > ceiling:
        y *= ceiling / peak
    return y


def write(path_mp3, x, quality=6):
    import os
    import subprocess
    import tempfile
    from scipy.io import wavfile
    pcm = np.clip(x * 32767, -32768, 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wav = f.name
    wavfile.write(wav, SR, pcm)
    subprocess.run(['lame', '--quiet', '-V', str(quality), '-q', '2', wav, path_mp3], check=True)
    os.unlink(wav)
