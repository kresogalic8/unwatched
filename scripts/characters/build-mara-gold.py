#!/usr/bin/env python3
"""Build the first Mara gold-master Spine package from the approved source.

The source image is the only artwork used. Masks intentionally overlap at every
joint so small rotations never expose an empty shoulder, wrist, hip or knee.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/public/characters/mara-gold"
SOURCE = OUT / "source/mara-master-v1.png"
SCALE = 0.08
BASELINE = 1450
CENTER_X = 512

# Polygons follow the approved painting. Adjacent pieces overlap by 18–42 px.
PARTS = {
    "body": [(338,28),(680,28),(680,300),(690,420),(650,472),(626,550),(622,675),(660,790),(635,860),(390,860),(365,790),(400,675),(414,550),(374,472),(292,420),(338,300)],
    "upper-far": [(342,318),(430,365),(412,490),(386,575),(294,573),(292,492),(318,382)],
    "fore-far": [(300,535),(390,535),(368,705),(353,878),(284,887),(278,790)],
    "upper-near": [(592,350),(670,330),(708,410),(717,515),(680,570),(620,552),(602,475)],
    "fore-near": [(640,530),(716,514),(759,690),(770,805),(744,876),(688,850),(676,718)],
    "thigh-far": [(377,748),(530,750),(528,1010),(500,1160),(365,1150),(350,1010)],
    "shin-far": [(366,1080),(505,1080),(496,1325),(548,1428),(466,1487),(330,1456),(331,1350)],
    "thigh-near": [(493,748),(656,748),(675,1010),(648,1150),(516,1162),(510,1010)],
    "shin-near": [(516,1080),(650,1075),(674,1325),(776,1420),(720,1480),(575,1458),(552,1340)],
}

PIVOTS = {
    "body": (512, 790),
    "upper-far": (374, 375),
    "fore-far": (342, 555),
    "upper-near": (650, 380),
    "fore-near": (686, 548),
    "thigh-far": (451, 790),
    "shin-far": (438, 1115),
    "thigh-near": (575, 790),
    "shin-near": (594, 1110),
}

def world(px, py):
    return ((px - CENTER_X) * SCALE, (BASELINE - py) * SCALE)

source = Image.open(SOURCE).convert("RGBA")
layers = {}
for name, polygon in PARTS.items():
    mask = Image.new("L", source.size)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.25))
    alpha = Image.composite(source.getchannel("A"), Image.new("L", source.size), mask)
    layer = source.copy()
    layer.putalpha(alpha)
    bbox = layer.getbbox()
    if not bbox:
        raise RuntimeError(f"Empty Mara layer: {name}")
    layers[name] = (layer.crop(bbox), bbox)

# Deterministic shelf packing with generous transparent gutters.
ATLAS = 2048
GAP = 12
sheet = Image.new("RGBA", (ATLAS, ATLAS))
regions = {}
x = y = GAP
row_h = 0
for name, (layer, bbox) in sorted(layers.items(), key=lambda item: item[1][0].height, reverse=True):
    if x + layer.width + GAP > ATLAS:
        x = GAP
        y += row_h + GAP
        row_h = 0
    if y + layer.height + GAP > ATLAS:
        raise RuntimeError("Mara gold atlas no longer fits 2048×2048")
    sheet.alpha_composite(layer, (x, y))
    regions[name] = {"x": x, "y": y, "width": layer.width, "height": layer.height, "bbox": bbox}
    x += layer.width + GAP
    row_h = max(row_h, layer.height)

sheet.save(OUT / "mara.png", optimize=True)
atlas = ["mara.png", f"size: {ATLAS},{ATLAS}", "format: RGBA8888", "filter: Linear,Linear", "repeat: none"]
for name, region in regions.items():
    atlas.extend([
        name,
        "  rotate: false",
        f"  xy: {region['x']},{region['y']}",
        f"  size: {region['width']},{region['height']}",
        f"  orig: {region['width']},{region['height']}",
        "  offset: 0,0",
        "  index: -1",
    ])
(OUT / "mara.atlas").write_text("\n".join(atlas) + "\n")

hip = world(*PIVOTS["body"])
bones = [{"name": "root"}, {"name": "hip", "parent": "root", "x": hip[0], "y": hip[1]}]

def local(name, parent_point):
    point = world(*PIVOTS[name])
    return point[0] - parent_point[0], point[1] - parent_point[1]

bones.append({"name": "body", "parent": "hip"})
for side in ("far", "near"):
    upper = f"upper-{side}"
    fore = f"fore-{side}"
    ux, uy = local(upper, hip)
    upper_world = world(*PIVOTS[upper])
    fx, fy = local(fore, upper_world)
    bones.extend([
        {"name": upper, "parent": "hip", "x": ux, "y": uy},
        {"name": fore, "parent": upper, "x": fx, "y": fy},
    ])
for side in ("far", "near"):
    thigh = f"thigh-{side}"
    shin = f"shin-{side}"
    tx, ty = local(thigh, hip)
    thigh_world = world(*PIVOTS[thigh])
    sx, sy = local(shin, thigh_world)
    bones.extend([
        {"name": thigh, "parent": "hip", "x": tx, "y": ty},
        {"name": shin, "parent": thigh, "x": sx, "y": sy},
    ])

draw_order = ["shin-far", "thigh-far", "shin-near", "thigh-near", "body", "upper-far", "fore-far", "upper-near", "fore-near"]
slots = [{"name": name, "bone": name, "attachment": name} for name in draw_order]
attachments = {}
for name, region in regions.items():
    x0, y0, x1, y1 = region["bbox"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    pivot_world = world(*PIVOTS[name])
    center_world = world(cx, cy)
    attachments[name] = {name: {
        "path": name,
        "x": center_world[0] - pivot_world[0],
        "y": center_world[1] - pivot_world[1],
        "width": region["width"] * SCALE,
        "height": region["height"] * SCALE,
    }}

def rotate(points):
    return [{"time": t, "value": value, "curve": [t + .18, value, t + .38, value2]} if i < len(points)-1 else {"time": t, "value": value}
            for i, (t, value) in enumerate(points)
            for value2 in ([points[i+1][1]] if i < len(points)-1 else [value])]

def translate(points):
    return [{"time": t, "x": x, "y": y} for t, x, y in points]

idle = {"bones": {
    "hip": {"translate": translate([(0,0,0),(1.2,0,.35),(2.4,0,0)])},
    "body": {"rotate": rotate([(0,-.35),(1.2,.35),(2.4,-.35)])},
    "upper-far": {"rotate": rotate([(0,.5),(1.2,-.7),(2.4,.5)])},
    "upper-near": {"rotate": rotate([(0,-.5),(1.2,.7),(2.4,-.5)])},
}}
walk = {"bones": {
    "hip": {"translate": translate([(0,-.25,-.8),(.3,.25,0),(.6,-.25,-.8),(.9,.25,0),(1.2,-.25,-.8)]), "rotate": rotate([(0,-1.2),(.3,0),(.6,1.2),(.9,0),(1.2,-1.2)])},
    "body": {"rotate": rotate([(0,.7),(.6,-.7),(1.2,.7)])},
    "thigh-far": {"rotate": rotate([(0,8),(.3,0),(.6,-8),(.9,0),(1.2,8)])},
    "shin-far": {"rotate": rotate([(0,-2),(.3,0),(.6,7),(.9,14),(1.2,-2)])},
    "thigh-near": {"rotate": rotate([(0,-8),(.3,0),(.6,8),(.9,0),(1.2,-8)])},
    "shin-near": {"rotate": rotate([(0,7),(.3,14),(.6,-2),(.9,0),(1.2,7)])},
    "upper-far": {"rotate": rotate([(0,-5),(.6,5),(1.2,-5)])},
    "upper-near": {"rotate": rotate([(0,5),(.6,-5),(1.2,5)])},
}}
wave = {"bones": {
    "upper-near": {"rotate": rotate([(0,0),(.45,112),(1.65,112),(2.1,0)])},
    "fore-near": {"rotate": rotate([(0,0),(.45,28),(.72,15),(.98,32),(1.24,15),(1.5,32),(1.65,28),(2.1,0)])},
    "body": {"rotate": rotate([(0,0),(.55,-1.5),(1.65,-1.5),(2.1,0)])},
}}
think = {"bones": {
    "upper-near": {"rotate": rotate([(0,0),(.55,57),(2.25,57),(2.8,0)])},
    "fore-near": {"rotate": rotate([(0,0),(.55,108),(1.5,112),(2.25,108),(2.8,0)])},
    "body": {"rotate": rotate([(0,0),(.7,1.2),(2.2,1.2),(2.8,0)])},
}}

data = {
    "skeleton": {"spine": "4.2.22", "width": 82, "height": 118, "fps": 30},
    "bones": bones,
    "slots": slots,
    "skins": [{"name": "mara-gold", "attachments": attachments}],
    "animations": {"idle": idle, "walk": walk, "wave": wave, "think": think},
}
(OUT / "mara.json").write_text(json.dumps(data, indent=2) + "\n")
(OUT / "manifest.json").write_text(json.dumps({
    "version": 1,
    "character": "Mara",
    "source": "source/mara-master-v1.png",
    "spine": "4.2",
    "animations": list(data["animations"]),
    "construction": "Fresh overlapping masks cut only from the approved gold master",
    "limitations": ["First articulation pass; face remains part of the body layer.", "Walk requires visual foot-contact review before production."],
    "generator": "scripts/characters/build-mara-gold.py",
}, indent=2) + "\n")
print(f"Built {len(regions)} fresh Mara regions and {len(data['animations'])} animations")
