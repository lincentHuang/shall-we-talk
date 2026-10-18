"""
特別版卡牌美術的輸出流程（從專案根目錄執行）：

    python3 art-source/editions/tools/compose.py

1. 合成暫代美術（fal 餘額不足時）：把一張插畫嵌進卡框的拱窗裡，再沿拱窗描一道邊線蓋住接縫，
   結果放在 art-source/editions/composed/。
2. 依 EXPORT 對照表輸出到 assets/cards/<版本>/（900×1341）與 assets/topics/<版本>/（選單縮圖）。

之後用 AI 重新生成正式美術時，把原圖放進 art-source/editions/，改 EXPORT 的來源再跑一次即可。
生成用的提示詞在 art-source/editions/prompts.md。
"""
import math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageOps

W, H = 900, 1341
OUT = 'art-source/editions/composed'

def arch(cx=450, cy=432, rx=356, ry=333, bottom=680, grow=0):
    rx += grow; ry += grow; bottom += grow
    pts = [(cx - rx * math.cos(math.pi * i / 180), cy - ry * math.sin(math.pi * i / 180)) for i in range(181)]
    return [(cx - rx, bottom)] + pts + [(cx + rx, bottom)]

def cover(img, w, h, fx=0.5, fy=0.5):
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = round((img.width - w) * fx); y = round((img.height - h) * fy)
    return img.crop((x, y, x + w, y + h))

def shift_reds(img, deg):
    """只轉紅、酒紅色系的色相（金色線條不動），用來把卡框換成別的顏色"""
    hsv = np.array(img.convert('HSV')).astype(np.int16)
    h = hsv[..., 0]
    red = ((h > 205) | (h < 12)) & (hsv[..., 1] > 40)
    h[red] = (h[red] + round(deg / 360 * 255)) % 256
    return Image.frombytes('HSV', img.size, hsv.astype(np.uint8).tobytes()).convert('RGB')

def compose(frame, art, out, geom=None, fx=0.5, fy=0.5, line=None, tint=None, art_crop=None, hue=0):
    geom = geom or {}
    f = Image.open(frame).convert('RGB').resize((W, H), Image.LANCZOS)
    if hue:
        f = shift_reds(f, hue)
    poly = arch(**geom, grow=2)
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    box = (math.floor(min(xs)), math.floor(min(ys)), math.ceil(max(xs)), math.ceil(max(ys)))
    src = Image.open(art).convert('RGB')
    if art_crop:  # 只取插畫的某一塊（相對座標 x0, y0, x1, y1）
        x0, y0, x1, y1 = art_crop
        src = src.crop((round(src.width * x0), round(src.height * y0), round(src.width * x1), round(src.height * y1)))
    a = cover(src, box[2] - box[0], box[3] - box[1], fx, fy)
    if tint:  # 讓插畫色調貼近卡框
        a = Image.blend(a, Image.new('RGB', a.size, tint), 0.12)
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    layer = Image.new('RGB', (W, H)); layer.paste(a, box[:2])
    f.paste(layer, (0, 0), mask)
    # 拱窗邊線：顏色取原本邊線的顏色
    col = line or f.getpixel((94, 600))
    ImageDraw.Draw(f).line(arch(**geom, grow=1) + [arch(**geom, grow=1)[0]], fill=col, width=4, joint='curve')
    f.save(f'{OUT}/{out}', quality=88, optimize=True, progressive=True)
    print('saved', out)

def night_sky(out, size=(1000, 900), seed=7):
    """姿勢圖解的拱窗底圖：深藍紫漸層、中央一圈柔光、零星金色星點（人形圖由 App 疊上去）"""
    import random
    rnd = random.Random(seed)
    w, h = size
    y = np.linspace(0, 1, h)[:, None]
    top, bottom = np.array([24, 20, 52]), np.array([58, 30, 70])
    img = (top * (1 - y) + bottom * y)[:, None, :].repeat(w, axis=1)
    yy, xx = np.mgrid[0:h, 0:w]
    glow = np.exp(-(((xx - w / 2) / (w * 0.42)) ** 2 + ((yy - h * 0.62) / (h * 0.36)) ** 2))[..., None]
    img = img + glow * np.array([70, 42, 60])
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(90):
        x, yv, r = rnd.uniform(0, w), rnd.uniform(0, h * 0.75), rnd.choice([1, 1, 1.5, 2, 2.5])
        c = (232, 207, 148) if rnd.random() < 0.7 else (246, 233, 214)
        d.ellipse([x - r, yv - r, x + r, yv + r], fill=c)
    im.save(f'{OUT}/{out}')
    print('saved', out)

def pose_thumb(face, out, index):
    """姿勢牌的選單縮圖：在卡面拱窗畫上一個姿勢（位置和 App 的 PoseArt 一樣）"""
    sys.path.insert(0, 'art-source/editions/tools')
    from poses import draw_pose, load_poses
    img = Image.open(face).convert('RGBA').resize((W, H), Image.LANCZOS)
    draw_pose(img, load_poses()[index], (W * POSE_BOX[0], H * POSE_BOX[1], W * POSE_BOX[2]))
    img.convert('RGB').save(f'{OUT}/{out}', quality=90)
    print('saved', out)

# 姿勢圖在卡面上的位置：(左, 上) 相對卡片寬高，寬度相對卡片寬；和 src/components/PoseArt.tsx 一致
POSE_BOX = (0.13, 0.12, 0.74)

def duotone(src, out, dark, mid, light):
    g = ImageOps.autocontrast(ImageOps.grayscale(Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)), cutoff=1)
    ImageOps.colorize(g, black=dark, white=light, mid=mid).save(f'{OUT}/{out}', quality=88, optimize=True, progressive=True)
    print('saved', out)

def export(src, card, thumb=None):
    """卡面縮到 900×1341；縮圖取拱窗那一塊，比例和經典版主題縮圖一樣（338×290）"""
    img = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
    if card:
        img.save(card, quality=86, optimize=True, progressive=True)
    if thumb:
        win = img.crop((111, 99, 789, 680)).resize((338, 290), Image.LANCZOS)
        win.save(thumb, quality=86, optimize=True)
    print('export', card, thumb or '')

# 來源 → 輸出（正式美術生成後改這裡）
E = 'art-source/editions'
EXPORT = [
    (f'{E}/ad_back_a.png', 'assets/cards/afterdark/back.jpg', None),
    (f'{E}/ad_talk_b.png', 'assets/cards/afterdark/talk.jpg', 'assets/topics/afterdark/talk.jpg'),
    (f'{E}/ad_talk_a.png', 'assets/cards/afterdark/touch.jpg', 'assets/topics/afterdark/touch.jpg'),
    (f'{E}/composed/ad_fantasy.jpg', 'assets/cards/afterdark/fantasy.jpg', 'assets/topics/afterdark/fantasy.jpg'),
    (f'{E}/composed/ad_pose.jpg', 'assets/cards/afterdark/pose.jpg', None),
    (f'{E}/composed/ad_pose_thumb.jpg', None, 'assets/topics/afterdark/pose.jpg'),
    (f'{E}/composed/pa_back.jpg', 'assets/cards/parents/back.jpg', None),
    (f'{E}/composed/pa_past.jpg', 'assets/cards/parents/past.jpg', 'assets/topics/parents/past.jpg'),
    (f'{E}/composed/pa_home.jpg', 'assets/cards/parents/home.jpg', 'assets/topics/parents/home.jpg'),
    (f'{E}/composed/pa_heart.jpg', 'assets/cards/parents/heart.jpg', 'assets/topics/parents/heart.jpg'),
    (f'{E}/composed/pa_wild.jpg', 'assets/cards/parents/wild.jpg', 'assets/topics/parents/wild.jpg'),
]

if __name__ == '__main__':
    import os
    for d in [OUT, 'assets/cards/afterdark', 'assets/cards/parents', 'assets/topics/afterdark', 'assets/topics/parents']:
        os.makedirs(d, exist_ok=True)
    A = 'art-source'
    # 深夜限定：祕密幻想＝情話卡框改紫＋月下遞玫瑰
    compose(f'{A}/editions/ad_talk_b.png', f'{A}/editions/ad_back_b.png', 'ad_fantasy.jpg',
            geom={'bottom': 688}, art_crop=(0.21, 0.16, 0.79, 0.62), fy=0.45, line=(214, 178, 110), hue=-55)
    # 深夜限定：姿勢圖解＝情話卡框改靛藍＋星空拱窗；縮圖畫上騎乘式
    night_sky('night_sky.png')
    compose(f'{A}/editions/ad_talk_b.png', f'{OUT}/night_sky.png', 'ad_pose.jpg',
            geom={'bottom': 688}, line=(214, 178, 110), hue=-105)
    pose_thumb(f'{OUT}/ad_pose.jpg', 'ad_pose_thumb.jpg', 1)
    # 爸媽聊聊：經典卡框＋情境插畫
    compose('assets/cards/memory.jpg', f'{A}/walk_raw.png', 'pa_past.jpg', fy=0.55)
    compose('assets/cards/values.jpg', f'{A}/party_raw.png', 'pa_home.jpg', fy=0.4)
    compose('assets/cards/love.jpg', f'{A}/latenight_raw.png', 'pa_heart.jpg', fy=0.35)
    compose('assets/cards/wild.jpg', f'{A}/dinner_raw.png', 'pa_wild.jpg', fy=0.3)
    # 爸媽聊聊卡背：經典卡背做成暖色雙色調（像老照片）
    duotone('assets/cards/back.jpg', 'pa_back.jpg', '#3E2418', '#B8704A', '#FCF3E3')

    for src, card, thumb in EXPORT:
        export(src, card, thumb)
