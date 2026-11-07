"""Genera media/fotos/ladrillo.svg: un muro de ladrillo (tile sin costuras).
Uso: python tools/gen_ladrillo.py
"""
import random, colorsys, os

random.seed(14)
W, H = 1200, 800          # tamano del tile
BW, BH, M = 114, 44, 6    # ladrillo y mortero
COLS = W // (BW + M)      # 10
ROWS = H // (BH + M)      # 16
out = []

def hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return "#%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255))

out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
out.append('''<defs>
<filter id="grano" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" stitchTiles="stitch" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 -.12"/>
</filter>
<filter id="mancha" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="3" stitchTiles="stitch" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0 0.02  0 0 0 1.1 -.42"/>
</filter>
<linearGradient id="luz" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
  <stop offset=".12" stop-color="#fff" stop-opacity=".04"/>
  <stop offset=".8" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity=".28"/>
</linearGradient>
</defs>''')

# mortero
out.append(f'<rect width="{W}" height="{H}" fill="#3a2924"/>')

for r in range(ROWS):
    y = r * (BH + M) + M / 2
    off = 0 if r % 2 == 0 else (BW + M) / 2
    for c in range(-1, COLS + 1):
        x = c * (BW + M) + off + M / 2
        # variacion de color por ladrillo
        hue = random.uniform(5, 20)
        sat = random.uniform(0.32, 0.52)
        lig = random.uniform(0.27, 0.40)
        col = hsl(hue, sat, lig)
        # esquinas casi rectas con leve irregularidad
        rx = random.uniform(1.5, 3.5)
        w = BW + random.uniform(-2, 2)
        h = BH + random.uniform(-1.5, 1.5)
        out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx:.1f}" fill="{col}"/>')
        out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx:.1f}" fill="url(#luz)"/>')
        # manchas / desportillados ocasionales
        for _ in range(random.choice([0, 0, 1, 2])):
            px = x + random.uniform(4, w - 20)
            py = y + random.uniform(3, h - 12)
            pw = random.uniform(6, 22)
            ph = random.uniform(3, 9)
            dark = random.random() < .6
            fill = "#1d100d" if dark else "#a8645a"
            out.append(f'<rect x="{px:.1f}" y="{py:.1f}" width="{pw:.1f}" height="{ph:.1f}" rx="2" fill="{fill}" opacity="{random.uniform(.10, .26):.2f}"/>')

# textura general
out.append(f'<rect width="{W}" height="{H}" filter="url(#grano)"/>')
out.append(f'<rect width="{W}" height="{H}" filter="url(#mancha)"/>')
out.append('</svg>')

dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "media", "fotos", "ladrillo.svg")
with open(dest, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("ok", os.path.getsize(dest) // 1024, "KB")
