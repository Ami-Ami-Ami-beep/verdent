"""Build the DJ deck models and their textures from one shared atlas.

Models and textures are generated together on purpose: the UV of every face is
taken from the same region table the painter uses, so the two can never drift
apart.
"""
import json
import re
import struct
import sys
import zlib
from pathlib import Path

PACK = Path(__file__).resolve().parent / "assets" / "djpult"
MODELS = PACK / "models" / "item"
TEXTURES = PACK / "textures" / "item"

SIZE = 32                 # texture is 32x32
PPU = SIZE / 16.0         # pixels per uv unit

# ---------------------------------------------------------------- palette ---
CASE_SHADOW = (17, 18, 22, 255)
CASE_DARK = (26, 28, 33, 255)
CASE_MID = (38, 42, 49, 255)
CASE_LIGHT = (54, 60, 69, 255)
METAL = (78, 86, 98, 255)
METAL_LIGHT = (112, 122, 136, 255)
ACCENT = (54, 214, 138, 255)
ACCENT_DIM = (28, 116, 76, 255)
AMBER = (232, 163, 61, 255)
AMBER_DIM = (126, 88, 33, 255)
VINYL = (13, 13, 16, 255)
VINYL_GROOVE = (32, 33, 38, 255)

# ------------------------------------------------------------------ atlas ---
# name -> pixel rect (x0, y0, x1, y1) in the side texture. Regions must not
# overlap; check_atlas() enforces that.
ATLAS = {
    "case_top":    (0, 0, 16, 16),
    "vinyl":       (16, 0, 32, 16),
    "case_n":      (0, 16, 16, 18),
    "case_e":      (0, 18, 16, 20),
    "case_s":      (0, 20, 16, 22),
    "case_w":      (0, 22, 16, 24),
    "rim_lo":      (16, 16, 32, 18),
    "rim_hi":      (16, 18, 32, 20),
    "arm":         (16, 20, 32, 22),
    "metal":       (16, 22, 32, 24),
    "case_bottom": (0, 24, 4, 28),
    "housing_top": (4, 24, 8, 28),
    "head":        (8, 24, 12, 28),
    "spindle_top": (12, 24, 16, 28),
    "slot":        (16, 24, 20, 28),
    "fader_cap":   (20, 24, 24, 28),
    "btn_go":      (24, 24, 28, 28),
    "btn_small":   (28, 24, 32, 28),
    "power":       (0, 28, 4, 32),
    "spare":       (4, 28, 32, 32),
}

# Which atlas region each face of each element of the left model uses.
# "vinyl_inset" marks the upper platter step: it samples the inner part of the
# record so the grooves run on across the step instead of starting over.
SIDE_FACES = {
    "Grundplatte":  {"north": "case_n", "east": "case_e", "south": "case_s",
                     "west": "case_w", "up": "case_top", "down": "case_bottom"},
    "Teller unten": {"north": "rim_lo", "east": "rim_lo", "south": "rim_lo",
                     "west": "rim_lo", "up": "vinyl"},
    "Teller oben":  {"north": "rim_hi", "east": "rim_hi", "south": "rim_hi",
                     "west": "rim_hi", "up": "vinyl_inset"},
    "Spindel":      {"north": "metal", "east": "metal", "south": "metal",
                     "west": "metal", "up": "spindle_top"},
    "Tonarm-Lager": {"north": "metal", "east": "metal", "south": "metal",
                     "west": "metal", "up": "housing_top"},
    "Tonarm":       {"north": "arm", "east": "arm", "south": "arm",
                     "west": "arm", "up": "arm", "down": "arm"},
    "Tonabnehmer":  {"north": "head", "east": "head", "south": "head",
                     "west": "head", "up": "head", "down": "head"},
    "Pitch-Schlitz": {"north": "metal", "east": "metal", "south": "metal",
                      "west": "metal", "up": "slot"},
    "Pitch-Regler": {"north": "metal", "east": "metal", "south": "metal",
                     "west": "metal", "up": "fader_cap"},
    "Start-Stop":   {"north": "metal", "east": "metal", "south": "metal",
                     "west": "metal", "up": "btn_go"},
    "Taste A":      {"north": "metal", "east": "metal", "south": "metal",
                     "west": "metal", "up": "btn_small"},
    "Taste B":      {"north": "metal", "east": "metal", "south": "metal",
                     "west": "metal", "up": "btn_small"},
    "Power":        {"north": "metal", "east": "metal", "south": "metal",
                     "west": "metal", "up": "power"},
}

SIDES = {0: ("west", "east"), 1: ("down", "up"), 2: ("north", "south")}
OTHER = {0: (1, 2), 1: (0, 2), 2: (0, 1)}


# ------------------------------------------------------------------- png ----
class Canvas:
    def __init__(self, size, fill):
        self.size = size
        self.px = [[fill for _ in range(size)] for _ in range(size)]

    def set(self, x, y, colour):
        if 0 <= x < self.size and 0 <= y < self.size:
            self.px[y][x] = colour

    def fill(self, rect, colour):
        x0, y0, x1, y1 = rect
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                self.set(x, y, colour)

    def write(self, path):
        raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in self.px)

        def chunk(tag, data):
            body = tag + data
            return (struct.pack(">I", len(data)) + body
                    + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF))

        blob = (b"\x89PNG\r\n\x1a\n"
                + chunk(b"IHDR", struct.pack(">IIBBBBB", self.size, self.size, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9))
                + chunk(b"IEND", b""))
        Path(path).write_bytes(blob)


# ---------------------------------------------------------------- painters --
def paint_panel(canvas, rect):
    """A brushed control surface: calm, because knobs sit on top of it."""
    x0, y0, x1, y1 = rect
    canvas.fill(rect, CASE_MID)
    # One faint brushed line every fourth row; alternating rows read as ribbing
    # and fight with the knobs sitting on top.
    for y in range(y0 + 2, y1, 4):
        for x in range(x0, x1):
            canvas.set(x, y, CASE_DARK)
    for x in range(x0, x1):                       # framing edge
        canvas.set(x, y0, CASE_SHADOW)
        canvas.set(x, y1 - 1, CASE_SHADOW)
    for y in range(y0, y1):
        canvas.set(x0, y, CASE_SHADOW)
        canvas.set(x1 - 1, y, CASE_SHADOW)


def paint_vinyl(canvas, rect):
    """A record: grooves by radius, coloured label, spindle hole."""
    x0, y0, x1, y1 = rect
    cx, cy = (x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2
    for y in range(y0, y1):
        for x in range(x0, x1):
            r = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if r < 0.9:
                colour = CASE_SHADOW                      # spindle hole
            elif r < 3.2:
                colour = ACCENT if r < 2.4 else ACCENT_DIM  # label
            else:
                colour = VINYL_GROOVE if int(r) % 2 else VINYL
            canvas.set(x, y, colour)


def paint_strip(canvas, rect, body=CASE_DARK, top=CASE_LIGHT):
    """A casing side: one bright edge pixel row, the rest body colour."""
    x0, y0, x1, y1 = rect
    canvas.fill(rect, body)
    for x in range(x0, x1):
        canvas.set(x, y0, top)


def paint_cap(canvas, rect, colour, dim):
    """A knob or button top: lit on the upper left, shaded on the lower right."""
    x0, y0, x1, y1 = rect
    canvas.fill(rect, colour)
    if x1 - x0 < 2 or y1 - y0 < 2:
        return
    for x in range(x0, x1):
        canvas.set(x, y1 - 1, dim)
    for y in range(y0, y1):
        canvas.set(x1 - 1, y, dim)
    canvas.set(x0, y0, METAL_LIGHT)


def paint_slot(canvas, rect):
    """A fader track: dark recess with a light rail through the middle."""
    x0, y0, x1, y1 = rect
    canvas.fill(rect, CASE_SHADOW)
    mid = (y0 + y1) // 2
    for x in range(x0, x1):
        canvas.set(x, mid, METAL)


def paint_dot(canvas, rect, colour):
    x0, y0, x1, y1 = rect
    canvas.fill(rect, CASE_DARK)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    canvas.set(cx, cy, colour)
    canvas.set(cx - 1, cy, colour)
    canvas.set(cx, cy - 1, colour)
    canvas.set(cx - 1, cy - 1, colour)


def paint_housing(canvas, rect):
    x0, y0, x1, y1 = rect
    canvas.fill(rect, CASE_DARK)
    for x in range(x0 + 1, x1 - 1):
        canvas.set(x, y0 + 1, METAL)
        canvas.set(x, y1 - 2, METAL)
    for y in range(y0 + 1, y1 - 1):
        canvas.set(x0 + 1, y, METAL)
        canvas.set(x1 - 2, y, METAL)


def build_side_texture():
    canvas = Canvas(SIZE, CASE_DARK)
    paint_panel(canvas, ATLAS["case_top"])
    paint_vinyl(canvas, ATLAS["vinyl"])
    for name in ("case_n", "case_e", "case_s", "case_w"):
        paint_strip(canvas, ATLAS[name])
    paint_strip(canvas, ATLAS["rim_lo"], CASE_SHADOW, CASE_LIGHT)
    paint_strip(canvas, ATLAS["rim_hi"], CASE_SHADOW, METAL)
    paint_strip(canvas, ATLAS["arm"], METAL, METAL_LIGHT)
    paint_strip(canvas, ATLAS["metal"], CASE_MID, CASE_LIGHT)
    canvas.fill(ATLAS["case_bottom"], CASE_SHADOW)
    paint_housing(canvas, ATLAS["housing_top"])
    paint_cap(canvas, ATLAS["head"], METAL, CASE_SHADOW)
    paint_cap(canvas, ATLAS["spindle_top"], METAL_LIGHT, METAL)
    paint_slot(canvas, ATLAS["slot"])
    paint_cap(canvas, ATLAS["fader_cap"], AMBER, AMBER_DIM)
    paint_cap(canvas, ATLAS["btn_go"], ACCENT, ACCENT_DIM)
    paint_cap(canvas, ATLAS["btn_small"], ACCENT_DIM, CASE_SHADOW)
    paint_dot(canvas, ATLAS["power"], AMBER)
    canvas.fill(ATLAS["spare"], CASE_DARK)
    canvas.write(TEXTURES / "dj_pult_seite.png")
    return canvas


# ------------------------------------------------- middle texture by role ---
def role_of(element):
    frm, to = element["from"], element["to"]
    dx, dz = to[0] - frm[0], to[2] - frm[2]
    if dx >= 16 and dz >= 16:
        return "case"
    if dx <= 1.5 and dz <= 1.5:
        return "knob"
    if max(dx, dz) >= 4:
        return "slot"
    return "cap"


def uv_rect(face):
    u0, v0, u1, v1 = face["uv"]
    x0, x1 = sorted((u0 * PPU, u1 * PPU))
    y0, y1 = sorted((v0 * PPU, v1 * PPU))
    return int(x0), int(y0), max(int(x1), int(x0) + 1), max(int(y1), int(y0) + 1)


def build_middle_texture(model):
    """Paint the supplied mixer model face by face, using its own UVs."""
    canvas = Canvas(SIZE, CASE_DARK)
    touched = [[False] * SIZE for _ in range(SIZE)]

    def mark(rect):
        x0, y0, x1, y1 = rect
        for y in range(y0, min(y1, SIZE)):
            for x in range(x0, min(x1, SIZE)):
                touched[y][x] = True

    knob = 0
    for element in model["elements"]:
        kind = role_of(element)
        for side, face in element["faces"].items():
            rect = uv_rect(face)
            top = side == "up"
            if kind == "case":
                if top:
                    paint_panel(canvas, rect)
                elif side == "down":
                    canvas.fill(rect, CASE_SHADOW)
                else:
                    paint_strip(canvas, rect)
            elif kind == "slot":
                paint_slot(canvas, rect) if top else paint_strip(canvas, rect, CASE_MID, CASE_LIGHT)
            elif kind == "cap":
                paint_cap(canvas, rect, AMBER, AMBER_DIM) if top \
                    else paint_strip(canvas, rect, CASE_MID, CASE_LIGHT)
            else:
                colour, dim = (ACCENT, ACCENT_DIM) if knob % 3 else (AMBER, AMBER_DIM)
                paint_cap(canvas, rect, colour, dim) if top \
                    else paint_strip(canvas, rect, CASE_MID, CASE_LIGHT)
            mark(rect)
        if kind == "knob":
            knob += 1

    untouched = sum(1 for row in touched for hit in row if not hit)
    canvas.write(TEXTURES / "dj_pult_mitte.png")
    return untouched


# ----------------------------------------------------------------- models ---
def tidy(value):
    rounded = round(value, 4)
    return int(rounded) if rounded == int(rounded) else rounded


def uv_of(region, inset=0.0):
    x0, y0, x1, y1 = ATLAS[region]
    if inset:
        dx, dy = (x1 - x0) * inset, (y1 - y0) * inset
        x0, y0, x1, y1 = x0 + dx, y0 + dy, x1 - dx, y1 - dy
    return [tidy(x0 / PPU), tidy(y0 / PPU), tidy(x1 / PPU), tidy(y1 / PPU)]


def apply_side_uvs(model):
    """Point every face of the left model at its atlas region."""
    model["textures"] = {"0": "djpult:item/dj_pult_seite",
                         "particle": "djpult:item/dj_pult_seite"}
    for element in model["elements"]:
        mapping = SIDE_FACES[element["name"]]
        for side, face in element["faces"].items():
            region = mapping[side]
            if region == "vinyl_inset":
                # The upper step is inset by one block on each side of a ten
                # block platter, so the record has to be inset by the same tenth.
                face["uv"] = uv_of("vinyl", inset=0.1)
            else:
                face["uv"] = uv_of(region)
        missing = set(mapping) - set(element["faces"])
        for side in missing:
            pass
    return model


def dump(model, path):
    text = json.dumps(model, indent="\t", ensure_ascii=False)
    text = re.sub(r"\[\s*((?:-?[\d.]+,\s*)*-?[\d.]+)\s*]",
                  lambda m: "[" + ", ".join(p.strip() for p in m.group(1).split(",")) + "]", text)
    Path(path).write_text(text + "\n", encoding="utf-8")
    json.loads(Path(path).read_text(encoding="utf-8"))


def mirror_x(model, name):
    out = json.loads(json.dumps(model))
    out["credit"] = name
    for element in out["elements"]:
        frm, to = element["from"], element["to"]
        frm[0], to[0] = tidy(16 - to[0]), tidy(16 - frm[0])
        faces = element["faces"]
        east, west = faces.pop("east", None), faces.pop("west", None)
        if east is not None:
            faces["west"] = east
        if west is not None:
            faces["east"] = west
        for side in ("north", "south", "up", "down"):
            if side in faces:
                uv = faces[side]["uv"]
                uv[0], uv[2] = uv[2], uv[0]
        if "rotation" in element and element["rotation"].get("axis") == "y":
            element["rotation"]["origin"][0] = tidy(16 - element["rotation"]["origin"][0])
            element["rotation"]["angle"] = -element["rotation"]["angle"]
        element["faces"] = {k: faces[k] for k in
                            ("north", "east", "south", "west", "up", "down") if k in faces}
    for group in out.get("groups", []):
        group["name"] = name
    return out


def repair_middle(model):
    seen, kept, dropped = {}, [], []
    for index, element in enumerate(model["elements"]):
        key = (tuple(element["from"]), tuple(element["to"]))
        if key in seen:
            dropped.append(index)
            continue
        seen[key] = index
        kept.append(index)
    remap = {old: new for new, old in enumerate(kept)}
    model["elements"] = [model["elements"][i] for i in kept]
    for name, value in list(model.get("textures", {}).items()):
        if ":" not in value:
            model["textures"][name] = "djpult:item/" + value
    for group in model.get("groups", []):
        group["children"] = [remap[c] for c in group.get("children", []) if c in remap]
    return model, dropped


# -------------------------------------------------------------- validation --
def overlap(a_lo, a_hi, b_lo, b_hi):
    return min(a_hi, b_hi) - max(a_lo, b_lo) > 1e-9


def check_atlas():
    problems = []
    names = list(ATLAS)
    for i, a in enumerate(names):
        ax0, ay0, ax1, ay1 = ATLAS[a]
        if not (0 <= ax0 < ax1 <= SIZE and 0 <= ay0 < ay1 <= SIZE):
            problems.append(f"region '{a}' leaves the texture")
        for b in names[i + 1:]:
            bx0, by0, bx1, by1 = ATLAS[b]
            if overlap(ax0, ax1, bx0, bx1) and overlap(ay0, ay1, by0, by1):
                problems.append(f"regions '{a}' and '{b}' overlap")
    return problems


def validate(model, label):
    problems = []
    elements = model["elements"]
    for index, element in enumerate(elements):
        for axis in range(3):
            if element["to"][axis] < element["from"][axis]:
                problems.append(f"element {index}: 'to' below 'from'")
            for corner in ("from", "to"):
                if not -16 <= element[corner][axis] <= 32:
                    problems.append(f"element {index}: coordinate outside -16..32")
        for side, face in element["faces"].items():
            for value in face["uv"]:
                if not 0 <= value <= 16:
                    problems.append(f"element {index}/{side}: uv {value} outside 0..16")

    for i, a in enumerate(elements):
        for j, b in enumerate(elements[i + 1:], start=i + 1):
            for axis, (low, high) in SIDES.items():
                u, v = OTHER[axis]
                for side, corner in ((low, "from"), (high, "to")):
                    if side not in a["faces"] or side not in b["faces"]:
                        continue
                    if abs(a[corner][axis] - b[corner][axis]) > 1e-9:
                        continue
                    if (overlap(a["from"][u], a["to"][u], b["from"][u], b["to"][u])
                            and overlap(a["from"][v], a["to"][v], b["from"][v], b["to"][v])):
                        problems.append(f"elements {i} and {j}: '{side}' faces coplanar "
                                        f"and overlapping -> z-fighting")

    print(f"[{'OK ' if not problems else 'BAD'}] {label}: {len(elements)} elements")
    for problem in problems:
        print(f"        {problem}")
    return not problems


if __name__ == "__main__":
    TEXTURES.mkdir(parents=True, exist_ok=True)
    ok = True

    atlas_problems = check_atlas()
    print(f"[{'OK ' if not atlas_problems else 'BAD'}] atlas: {len(ATLAS)} regions")
    for problem in atlas_problems:
        print(f"        {problem}")
    ok &= not atlas_problems

    left = json.loads((MODELS / "dj_pult_links.json").read_text(encoding="utf-8"))
    left = apply_side_uvs(left)
    dump(left, MODELS / "dj_pult_links.json")
    ok &= validate(left, "dj_pult_links")

    right = mirror_x(left, "DJPult - rechter Plattenspieler")
    dump(right, MODELS / "dj_pult_rechts.json")
    ok &= validate(right, "dj_pult_rechts (mirrored)")

    build_side_texture()
    print(f"        wrote {TEXTURES / 'dj_pult_seite.png'}")

    source = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if source and source.exists():
        middle, dropped = repair_middle(json.loads(source.read_text(encoding="utf-8")))
        print(f"        middle: dropped duplicate element(s) at {dropped}")
        dump(middle, MODELS / "dj_pult_mitte.json")
        ok &= validate(middle, "dj_pult_mitte (repaired)")
        untouched = build_middle_texture(middle)
        print(f"        wrote {TEXTURES / 'dj_pult_mitte.png'} "
              f"({untouched} of {SIZE * SIZE} pixels unused by any face)")

    sys.exit(0 if ok else 1)
