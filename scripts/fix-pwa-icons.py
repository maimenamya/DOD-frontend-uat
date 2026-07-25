"""Remove baked-in outer frame from PWA icons; output full-bleed dark squares.

Android/iOS apply different masks — a gold border in the PNG never lines up.
Shave the outer silhouette ring (~border thickness) and fill to the canvas edge
with the app background color so each OS can mask cleanly.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

SCRIPTS = Path(__file__).resolve().parent
PUBLIC = SCRIPTS.parent / "public"
SRC = SCRIPTS / "app-icon-source.png"
# theme / manifest background (#10141d); close to icon fill (~8,12,21)
BG = (16, 20, 29, 255)
# gold stroke is ~10–12px at mid-edge; shave a bit more for AA fringe
BORDER_SHAVE_PX = 14


def shave_outer_ring(src: Image.Image, shave: int) -> Image.Image:
    img = src.convert("RGBA")
    w, h = img.size
    px = img.load()

    opaque = [[px[x, y][3] > 128 for x in range(w)] for y in range(h)]

    # Multi-source BFS: distance from outside.
    # Outside = transparent pixels OR canvas edge (squircle often touches mid-edges
    # with no neighboring transparent pixel, so edge seeding is required).
    dist = [[10**9] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()
    for y in range(h):
        for x in range(w):
            on_canvas_edge = x == 0 or y == 0 or x == w - 1 or y == h - 1
            if (not opaque[y][x]) or on_canvas_edge:
                dist[y][x] = 0
                q.append((x, y))

    while q:
        x, y = q.popleft()
        d = dist[y][x]
        if d >= shave:
            continue
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and dist[ny][nx] > d + 1:
                dist[ny][nx] = d + 1
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h), BG)
    out_px = out.load()
    for y in range(h):
        for x in range(w):
            if opaque[y][x] and dist[y][x] > shave:
                r, g, b, _a = px[x, y]
                out_px[x, y] = (r, g, b, 255)
    return out


def main() -> None:
    src = Image.open(SRC)
    clean = shave_outer_ring(src, BORDER_SHAVE_PX)

    outputs = {
        "app-icon.png": 512,
        "icon-192.png": 192,
        "apple-touch-icon.png": 180,
        "apple-touch-icon-167.png": 167,
        "apple-touch-icon-152.png": 152,
        "favicon-64.png": 64,
        "favicon-48.png": 48,
        "favicon-32.png": 32,
    }

    for name, size in outputs.items():
        resized = clean.resize((size, size), Image.Resampling.LANCZOS)
        path = PUBLIC / name
        resized.save(path, format="PNG", optimize=True)
        print(f"wrote {path.name} ({size}x{size})")

    ico32 = clean.resize((32, 32), Image.Resampling.LANCZOS)
    ico48 = clean.resize((48, 48), Image.Resampling.LANCZOS)
    ico_path = PUBLIC / "favicon.ico"
    ico32.save(ico_path, format="ICO", sizes=[(32, 32), (48, 48)], append_images=[ico48])
    print(f"wrote {ico_path.name}")


if __name__ == "__main__":
    main()
