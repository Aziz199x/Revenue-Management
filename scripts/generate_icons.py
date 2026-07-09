from PIL import Image, ImageDraw
import os

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), "..")

# Colors
TEAL_PRIMARY = (13, 148, 136)      # #0d9488
TEAL_DARK = (15, 118, 110)         # #0f766e
TEAL_LIGHT = (20, 168, 156)        # #14a89c
WHITE = (255, 255, 255, 255)
NEAR_WHITE = (240, 248, 247, 255)  # slight teal-tint white

def create_background():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Radial-style gradient: teal center fading to darker teal at edges
    cx, cy = SIZE // 2, SIZE // 2
    max_r = int(SIZE * 0.72)
    for r in range(max_r, -1, -1):
        t = r / max_r
        red = int(TEAL_PRIMARY[0] + (TEAL_DARK[0] - TEAL_PRIMARY[0]) * (1 - t))
        green = int(TEAL_PRIMARY[1] + (TEAL_DARK[1] - TEAL_PRIMARY[1]) * (1 - t))
        blue = int(TEAL_PRIMARY[2] + (TEAL_DARK[2] - TEAL_PRIMARY[2]) * (1 - t))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, 255))
    # Fill corners with dark teal
    draw.rectangle([0, 0, SIZE, SIZE], fill=TEAL_DARK)
    # Re-draw radial gradient on top
    for r in range(max_r, -1, -1):
        t = r / max_r
        red = int(TEAL_PRIMARY[0] + (TEAL_DARK[0] - TEAL_PRIMARY[0]) * (1 - t))
        green = int(TEAL_PRIMARY[1] + (TEAL_DARK[1] - TEAL_PRIMARY[1]) * (1 - t))
        blue = int(TEAL_PRIMARY[2] + (TEAL_DARK[2] - TEAL_PRIMARY[2]) * (1 - t))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, 255))
    # Bright center highlight
    for r in range(int(max_r * 0.4), -1, -1):
        t = r / (max_r * 0.4)
        red = int(TEAL_LIGHT[0] + TEAL_PRIMARY[0] * (1 - t))
        green = int(TEAL_LIGHT[1] + TEAL_PRIMARY[1] * (1 - t))
        blue = int(TEAL_LIGHT[2] + TEAL_PRIMARY[2] * (1 - t))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, 255))
    return img

def create_foreground():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Adaptive icon safe zone: ~72% of canvas
    safe = int(SIZE * 0.72)
    margin = (SIZE - safe) // 2  # ~143px each side

    cx, cy = SIZE // 2, SIZE // 2

    # ---- BUILDING GROUP ----
    # We create two buildings side by side: a taller left building and a shorter right building
    # This fills the safe zone nicely and suggests "multi-property / real estate"

    bldg_w = int(safe * 0.38)
    bldg_gap = int(safe * 0.04)

    # Tall building (left)
    tall_w = bldg_w
    tall_h = int(safe * 0.78)
    tall_x = cx - bldg_gap // 2 - tall_w
    tall_y = cy - tall_h // 2 + int(safe * 0.02)

    # Short building (right)
    short_w = bldg_w
    short_h = int(safe * 0.55)
    short_x = cx + bldg_gap // 2
    short_y = cy - short_h // 2 + int(safe * 0.12)

    def draw_building(x, y, w, h, is_tall):
        # Building body (semi-transparent white fill + white outline)
        draw.rounded_rectangle(
            [x, y, x + w, y + h],
            radius=int(w * 0.08),
            fill=(255, 255, 255, 35),
            outline=WHITE,
            width=int(w * 0.045),
        )

        # Roof accent line
        roof_h = int(h * 0.06)
        draw.rounded_rectangle(
            [x + int(w * 0.08), y - roof_h, x + w - int(w * 0.08), y],
            radius=int(roof_h * 0.5),
            fill=WHITE,
            outline=None,
        )

        # Entrance door (bottom center)
        door_w = int(w * 0.22)
        door_h = int(h * 0.22)
        door_x = x + (w - door_w) // 2
        door_y = y + h - door_h
        draw.rounded_rectangle(
            [door_x, door_y, door_x + door_w, door_y + door_h],
            radius=int(door_w * 0.2),
            fill=None,
            outline=WHITE,
            width=int(w * 0.04),
        )
        # Door inner
        door_inner_margin = int(door_w * 0.1)
        draw.rounded_rectangle(
            [door_x + door_inner_margin, door_y + door_inner_margin,
             door_x + door_w - door_inner_margin, door_y + door_h - door_inner_margin],
            radius=int(door_w * 0.12),
            fill=WHITE,
            outline=None,
        )

        # Windows - 2 columns, 3 rows for tall, 2 rows for short
        cols = 2
        rows = 4 if is_tall else 2
        win_w = int(w * 0.2)
        win_h = int(h * 0.1)
        win_gap_x = (w - (cols * win_w)) // 3
        win_gap_y = int(h * 0.08)
        roof_offset = int(h * 0.15)

        for row in range(rows):
            for col in range(cols):
                wx = x + win_gap_x + col * (win_w + win_gap_x)
                # Alternate window row start
                wy = y + roof_offset + row * (win_h + win_gap_y)

                if wy + win_h > y + h - door_h - int(h * 0.04):
                    continue

                opacity = 200 - row * 20
                fill_color = (255, 255, 255, opacity)

                # Window frame
                draw.rounded_rectangle(
                    [wx, wy, wx + win_w, wy + win_h],
                    radius=int(win_w * 0.15),
                    fill=fill_color,
                    outline=None,
                )
                # Window cross divider (vertical line)
                divider_x = wx + win_w // 2
                draw.line(
                    [(divider_x, wy + int(win_h * 0.12)),
                     (divider_x, wy + int(win_h * 0.88))],
                    fill=(255, 255, 255, 120),
                    width=max(1, int(win_w * 0.06)),
                )

    draw_building(tall_x, tall_y, tall_w, tall_h, True)
    draw_building(short_x, short_y, short_w, short_h, False)

    # ---- Ground line connecting buildings ----
    ground_y = tall_y + tall_h
    draw.line(
        [(tall_x - int(SIZE * 0.02), ground_y),
         (short_x + short_w + int(SIZE * 0.02), ground_y)],
        fill=WHITE,
        width=int(SIZE * 0.008),
    )

    return img

print("Creating icon assets...")

bg = create_background()
bg.save(os.path.join(OUT_DIR, "icon-background.png"))
print("  -> icon-background.png")

fg = create_foreground()
fg.save(os.path.join(OUT_DIR, "icon-foreground.png"))
print("  -> icon-foreground.png")

# Combine background + foreground for icon-only
icon_only = Image.alpha_composite(bg, fg)
icon_only.save(os.path.join(OUT_DIR, "icon-only.png"))
print("  -> icon-only.png")

print("Done! All icons created at 1024x1024.")
