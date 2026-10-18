"""
把 src/data/editions/poses.ts 的姿勢畫成圖（和 App 裡 PoseArt 的畫法一致）：
- 檢查用總覽：python3 art-source/editions/tools/poses.py sheet <輸出.png>
- 姿勢牌的選單縮圖會用 draw_pose() 畫在卡面拱窗上（compose.py 呼叫）
姿勢資料由 node 直接讀 TS 檔取得。
"""
import json, subprocess, sys
from PIL import Image, ImageDraw

GOLD = (232, 207, 148)
ROSE = (235, 163, 182)
LINE = (227, 194, 122)

def load_poses():
    js = "import('./src/data/editions/poses.ts').then(m => console.log(JSON.stringify(m.POSES)))"
    out = subprocess.run(['node', '--no-warnings', '-e', js], capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def draw_scene(d, scene, S, ox, oy, col):
    P = lambda x, y: (ox + x * S, oy + y * S)
    w = max(1, round(1.2 * S))
    if scene in ('bed',):
        d.line([P(14, 129), P(186, 129)], fill=col, width=w)
    elif scene == 'top':
        d.rounded_rectangle([P(14, 30), P(186, 130)], radius=8 * S, outline=col, width=w)
        d.rounded_rectangle([P(19, 38), P(31, 122)], radius=4 * S, outline=col, width=w)
    elif scene == 'edge':
        d.line([P(14, 86), P(118, 86), P(118, 128)], fill=col, width=w)
        d.line([P(14, 129), P(186, 129)], fill=col, width=w)
    elif scene == 'wall':
        d.line([P(40, 8), P(40, 129)], fill=col, width=w)
        d.line([P(40, 129), P(186, 129)], fill=col, width=w)

def draw_figure(img, fig, color, S, ox, oy):
    """近側四肢實線、遠側四肢淡一點；關節畫小圓點，像星座"""
    P = lambda p: (ox + p[0] * S, oy + p[1] * S)
    w = round(3.4 * S)
    for i, alpha in ((1, 0.45), (0, 1.0)):  # 先畫遠側
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        segs = []
        if i < len(fig['arms']):
            e, h = fig['arms'][i]; segs.append([fig['neck'], e, h])
        if i < len(fig['legs']):
            k, f = fig['legs'][i]; segs.append([fig['hip'], k, f])
        if i == 0:
            segs.append([fig['neck'], fig['hip']])
        c = color + (round(255 * alpha),)
        for seg in segs:
            pts = [P(p) for p in seg]
            d.line(pts, fill=c, width=w, joint='curve')
            for p in pts:
                r = w / 2
                d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=c)
            for p in pts[1:]:
                r = w * 0.55
                d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=(255, 248, 230, round(255 * alpha)))
        if i == 0:
            hx, hy = P(fig['head']); r = 6.5 * S
            d.ellipse([hx - r, hy - r, hx + r, hy + r], outline=c, width=w, fill=color + (70,))
        img.alpha_composite(layer)

def draw_pose(img, pose, box):
    """box = (x, y, 寬)；viewBox 200×150"""
    x, y, W = box
    S = W / 200
    d = ImageDraw.Draw(img)
    draw_scene(d, pose['scene'], S, x, y, LINE + (110,))
    draw_figure(img, pose['back'], ROSE, S, x, y)
    draw_figure(img, pose['front'], GOLD, S, x, y)

if __name__ == '__main__' and sys.argv[1] == 'sheet':
    poses = load_poses()
    cw, ch = 400, 330
    sheet = Image.new('RGBA', (cw * 5, ch * ((len(poses) + 4) // 5)), (34, 24, 52, 255))
    for i, p in enumerate(poses):
        ox, oy = (i % 5) * cw, (i // 5) * ch
        draw_pose(sheet, p, (ox, oy + 10, cw))
        ImageDraw.Draw(sheet).text((ox + 10, oy + 305), f"{i + 1}", fill=(255, 255, 255, 255))
    sheet.convert('RGB').save(sys.argv[2])
    print('saved', sys.argv[2])
