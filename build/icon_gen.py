#!/usr/bin/env python3
"""生成 Macown 应用图标：简洁字母 M（圆角方块 + 渐变蓝 + 白色几何 M）。
纯几何绘制，无字体依赖，可在任意分辨率下重现。

遵循 macOS Big Sur 图标规范：图标本体（squircle）只占画布约 80%，
四周各留约 10% 透明边距，避免图标在 Dock/访达里显得过大。
"""
from PIL import Image, ImageDraw
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = OUT_DIR
os.makedirs(BASE, exist_ok=True)

SIZE = 1024                      # 最终画布（含透明边距）
PAD_RATIO = 0.10                 # 四周各留 10% 透明边距
BODY = int(SIZE * (1 - 2 * PAD_RATIO))   # 图标本体尺寸 ~820
OFF = (SIZE - BODY) // 2                # 居中偏移 ~102

# ---- 配色（对齐默认主题 accent #0969da）----
TOP = (88, 166, 255)      # #58a6ff
BOTTOM = (9, 105, 218)    # #0969da
WHITE = (255, 255, 255)

def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def make_gradient(size, top, bottom):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        c = lerp(top, bottom, t)
        for x in range(size):
            px[x, y] = c
    return img

def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m

# ---- 在 BODY 尺寸上绘制图标本体 ----
bg = make_gradient(BODY, TOP, BOTTOM)
mask = rounded_mask(BODY, int(BODY * 0.225))  # Big Sur 风格 ~22.5% 圆角
body = Image.new("RGBA", (BODY, BODY), (0, 0, 0, 0))
body.paste(bg, (0, 0), mask)

# 轻微高光：顶部叠加一条更亮的渐变（约 40/255 透明度）
draw = ImageDraw.Draw(body)
highlight = make_gradient(BODY, (120, 180, 255), (88, 166, 255))
hl = Image.new("RGBA", (BODY, BODY), (0, 0, 0, 0))
hl.paste(highlight, (0, 0), mask)
body = Image.alpha_composite(body, Image.blend(Image.new("RGBA", (BODY, BODY), (0, 0, 0, 0)), hl, 40 / 255))

# ---- 白色几何 M（粗描边折线，圆角 join/cap）----
draw = ImageDraw.Draw(body)
scanvas = draw

# M 折线：左下 → 左上 → 中下(尖) → 右上 → 右下
cx = BODY / 2
stroke = int(BODY * 0.085)
left_x = BODY * 0.25
right_x = BODY * 0.75
top_y = BODY * 0.30
bottom_y = BODY * 0.72

pts = [
    (left_x, bottom_y), (left_x, top_y), (cx, bottom_y),
    (right_x, top_y), (right_x, bottom_y),
]
draw.line(pts, fill=WHITE, width=stroke, joint="curve")

r = stroke // 2
for (px_, py_) in (pts[0], pts[-1]):
    draw.ellipse([px_ - r, py_ - r, px_ + r, py_ + r], fill=WHITE)

# ---- 贴到 1024 透明画布，四周留白 ----
canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
canvas.paste(body, (OFF, OFF))

# ---- 导出 ----
base_png = os.path.join(BASE, "icon_1024.png")
canvas.save(base_png)
print("已生成基础图:", base_png)

iconset = os.path.join(BASE, "Macown.iconset")
os.makedirs(iconset, exist_ok=True)
mac_sizes = {
    "icon_16x16.png": 16, "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32, "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128, "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256, "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512, "icon_512x512@2x.png": 1024,
}
for name, s in mac_sizes.items():
    canvas.resize((s, s), Image.LANCZOS).save(os.path.join(iconset, name))

ico_path = os.path.join(BASE, "Macown.ico")
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
canvas.save(ico_path, format="ICO", sizes=[(s, s) for s in ico_sizes])

png512 = os.path.join(BASE, "icon.png")
canvas.resize((512, 512), Image.LANCZOS).save(png512)

print("iconset 目录:", iconset)
print("ico:", ico_path)
print("png512:", png512)
print("DONE")