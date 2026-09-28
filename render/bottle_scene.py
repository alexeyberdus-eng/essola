"""Studio render of the ESSOLA 30 ml argan oil dropper bottle (Blender 4.2, Cycles).

Units: 1 Blender unit = 1 cm. Run with the `bpy` Python module:
    python3 render/bottle_scene.py --label label_tex.png --out out/ [--frames 36] [--samples 256] [--still]
"""
import argparse
import math
import os
import sys

import bpy  # must come first: it registers bmesh/mathutils
import bmesh
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument("--label", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--frames", type=int, default=36)
ap.add_argument("--start", type=int, default=0)
ap.add_argument("--samples", type=int, default=256)
ap.add_argument("--res", type=int, default=1000, help="output width in px (height = 4/3)")
ap.add_argument("--still", action="store_true", help="render one frame at --angle")
ap.add_argument("--angle", type=float, default=0.0)
ap.add_argument("--blend", default="")
args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- helpers

def lathe(name, profile, segments=256, closed_top=False):
    """Spin a (r, z) profile around Z. Profile is walked in order; faces follow it."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r * ca, r * sa, z)) for r, z in profile])
    for i in range(segments):
        r0, r1 = rings[i], rings[(i + 1) % segments]
        for j in range(len(profile) - 1):
            v = [r0[j], r1[j], r1[j + 1], r0[j + 1]]
            if len({x.index for x in v}) < 4 and False:
                continue
            try:
                bm.faces.new(v)
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def arc(cx, cz, rad, a0, a1, n):
    return [(cx + rad * math.cos(a0 + (a1 - a0) * i / n), cz + rad * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def bez(p0, p1, p2, p3, n):
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return out


def offset_profile(pts, d):
    """Offset an open (r,z) polyline inward by d along its normal."""
    out = []
    for i, (r, z) in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tx, tz) or 1
        nx, nz = tz / ln, -tx / ln          # right-hand normal (points outward for our walk)
        out.append((max(r - nx * d, 0.0), z - nz * d))
    return out


def mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links


# ---------------------------------------------------------------- geometry
R, BODY = 1.70, 5.90
outer = [(0.0, 0.0), (R - 0.32, 0.0)]
outer += arc(R - 0.32, 0.32, 0.32, -math.pi / 2, 0, 12)[1:]
outer += [(R, BODY)]
outer += bez((R, BODY), (R, 6.55), (1.12, 6.72), (0.86, 6.95), 28)
outer += [(0.86, 7.05), (0.92, 7.1), (0.92, 7.3), (0.86, 7.36), (0.62, 7.36)]

# inner wall: 1.6 mm glass, thick 4 mm punt-free base
inner_side = offset_profile([(R, 0.4), (R, BODY)] + bez((R, BODY), (R, 6.55), (1.12, 6.72), (0.86, 6.95), 28) + [(0.86, 7.36)], 0.16)
inner = [(0.62, 7.36)] + list(reversed(inner_side[1:]))
inner = [p for p in inner if p[1] > 0.45]
inner += arc(R - 0.16 - 0.3, 0.75, 0.3, 0, -math.pi / 2, 10)[1:] + [(0.0, 0.45)]

glass_prof = outer + inner
glass = lathe("Glass", glass_prof, 256)

# oil: sits 0.2 mm inside the inner wall, fill line 5.3 cm, meniscus climbs the wall
oil_r = R - 0.16 - 0.02
fill = 5.30
oil_prof = [(0.0, 0.47), (oil_r - 0.3, 0.47)]
oil_prof += arc(oil_r - 0.3, 0.77, 0.3, -math.pi / 2, 0, 10)[1:]
oil_prof += [(oil_r, fill + 0.06)]
oil_prof += [(oil_r - 0.03, fill + 0.01), (oil_r - 0.1, fill - 0.005), (oil_r - 0.3, fill - 0.01), (0.0, fill - 0.01)]
oil = lathe("Oil", oil_prof, 192)

# label: 98 x 46 mm, 0.1 mm proud of the glass, starts 9.5 mm above the base
LBL_W, LBL_H, LBL_Z = 9.8, 4.6, 0.95
lr = R + 0.012
me = bpy.data.meshes.new("Label")
bm = bmesh.new()
uv = bm.loops.layers.uv.new("UVMap")
cols, rows = 220, 2
theta = LBL_W / lr
grid = []
for i in range(cols + 1):
    a = -theta / 2 + theta * i / cols - math.pi / 2     # centred on -Y (faces the camera)
    col = []
    for j in range(rows + 1):
        z = LBL_Z + LBL_H * j / rows
        col.append(bm.verts.new((lr * math.cos(a), lr * math.sin(a), z)))
    grid.append(col)
for i in range(cols):
    for j in range(rows):
        f = bm.faces.new([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]])
        for loop, (u, v) in zip(f.loops, [(i / cols, j / rows), ((i + 1) / cols, j / rows),
                                           ((i + 1) / cols, (j + 1) / rows), (i / cols, (j + 1) / rows)]):
            loop[uv].uv = (u, v)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me)
bm.free()
label = bpy.data.objects.new("Label", me)
scene.collection.objects.link(label)
for p in me.polygons:
    p.use_smooth = True
# make sure normals face outward
me.update()
if me.polygons[0].normal.dot(Vector(me.polygons[0].center).normalized()) < 0:
    me.flip_normals()

# cap collar (smooth wide band) + ribbed skirt + shoulder ring + rubber bulb
collar = lathe("Collar", [(0.0, 7.02), (1.02, 7.02)] + arc(1.02, 7.1, 0.08, -math.pi / 2, 0, 6)[1:]
               + [(1.1, 7.8)] + arc(1.02, 7.8, 0.08, 0, math.pi / 2, 6)[1:] + [(0.0, 7.88)], 192)

skirt_prof = [(0.0, 7.88), (0.96, 7.88), (0.965, 7.92), (0.955, 9.35), (0.9, 9.42), (0.0, 9.42)]
skirt = lathe("Skirt", skirt_prof, 480)
RIBS = 40
for v in skirt.data.vertices:
    rr = math.hypot(v.co.x, v.co.y)
    if rr < 0.5 or v.co.z < 7.9 or v.co.z > 9.36:
        continue
    a = math.atan2(v.co.y, v.co.x)
    k = 1 + 0.03 * (0.5 + 0.5 * math.cos(a * RIBS)) ** 0.7
    v.co.x *= k
    v.co.y *= k
bev = skirt.modifiers.new("ws", "WEIGHTED_NORMAL")

ring = lathe("Ring", [(0.0, 9.4), (0.8, 9.4)] + arc(0.76, 9.48, 0.08, -math.pi / 2, math.pi / 2, 8)[1:] + [(0.0, 9.56)], 128)

bulb = [(0.0, 9.55), (0.56, 9.55), (0.58, 9.62), (0.56, 9.7)]
bulb += bez((0.56, 9.7), (0.52, 10.1), (0.44, 10.3), (0.43, 10.6), 14)
bulb += arc(0.0, 10.6, 0.43, 0, math.pi / 2, 16)[1:]
bulb_ob = lathe("Bulb", bulb, 128)

# ---------------------------------------------------------------- materials
# amber glass: clear dielectric surface + absorbing volume (tint grows with thickness)
m, n, l = mat("AmberGlass")
n.clear()
out = n.new("ShaderNodeOutputMaterial")
g = n.new("ShaderNodeBsdfGlass")
g.inputs["IOR"].default_value = 1.52
g.inputs["Roughness"].default_value = 0.0
g.inputs["Color"].default_value = (1, 1, 1, 1)
vol = n.new("ShaderNodeVolumeAbsorption")
vol.inputs["Color"].default_value = (0.64, 0.33, 0.1, 1)
vol.inputs["Density"].default_value = 38.0
l.new(g.outputs[0], out.inputs["Surface"])
l.new(vol.outputs[0], out.inputs["Volume"])
glass.data.materials.append(m)

m, n, l = mat("ArganOil")
n.clear()
out = n.new("ShaderNodeOutputMaterial")
g = n.new("ShaderNodeBsdfGlass")
g.inputs["IOR"].default_value = 1.47
g.inputs["Color"].default_value = (1, 1, 1, 1)
vol = n.new("ShaderNodeVolumeAbsorption")
vol.inputs["Color"].default_value = (0.93, 0.72, 0.22, 1)
vol.inputs["Density"].default_value = 0.9
l.new(g.outputs[0], out.inputs["Surface"])
l.new(vol.outputs[0], out.inputs["Volume"])
oil.data.materials.append(m)

# label: printed laminated paper, alpha for rounded corners, faint paper bump
m, n, l = mat("Label")
p = n["Principled BSDF"]
tex = n.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(os.path.abspath(args.label))
tex.interpolation = "Cubic"
tex.extension = "CLIP"
l.new(tex.outputs["Color"], p.inputs["Base Color"])
l.new(tex.outputs["Alpha"], p.inputs["Alpha"])
p.inputs["Roughness"].default_value = 0.42
p.inputs["Coat Weight"].default_value = 0.25
p.inputs["Coat Roughness"].default_value = 0.18
noise = n.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 900
noise.inputs["Detail"].default_value = 4
bump = n.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.03
bump.inputs["Distance"].default_value = 0.002
l.new(noise.outputs["Fac"], bump.inputs["Height"])
l.new(bump.outputs["Normal"], p.inputs["Normal"])
m.blend_method = "HASHED" if hasattr(m, "blend_method") else None
label.data.materials.append(m)

m, n, l = mat("BlackPP")
p = n["Principled BSDF"]
p.inputs["Base Color"].default_value = (0.006, 0.006, 0.006, 1)
p.inputs["Roughness"].default_value = 0.22
p.inputs["Specular IOR Level"].default_value = 0.5
for ob in (collar, skirt, ring):
    ob.data.materials.append(m)

m, n, l = mat("Rubber")
p = n["Principled BSDF"]
p.inputs["Base Color"].default_value = (0.018, 0.018, 0.018, 1)
p.inputs["Roughness"].default_value = 0.5
p.inputs["Sheen Weight"].default_value = 0.2
bulb_ob.data.materials.append(m)

# ---------------------------------------------------------------- turntable rig
rig = bpy.data.objects.new("Turntable", None)
scene.collection.objects.link(rig)
for ob in (glass, oil, label, collar, skirt, ring, bulb_ob):
    ob.parent = rig

# ---------------------------------------------------------------- studio
# floor: shadow catcher only, so the render drops onto any page background
bpy.ops.mesh.primitive_plane_add(size=26, location=(0, 0, 0))
sw = bpy.context.active_object
sw.name = "Floor"
m, n, l = mat("Floor")
n["Principled BSDF"].inputs["Base Color"].default_value = (0.9, 0.9, 0.9, 1)
sw.data.materials.append(m)
sw.is_shadow_catcher = True

# black flags left/right: give the glass and cap dark edges like a real studio
for x in (-26, 26):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, -14, 10))
    fl = bpy.context.active_object
    fl.scale = (1, 30, 24)
    fl.rotation_euler = (0, math.radians(90), math.radians(-20 if x < 0 else 20))
    fm, fn, _ = mat("Flag")
    fn["Principled BSDF"].inputs["Base Color"].default_value = (0.01, 0.01, 0.01, 1)
    fn["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    fl.data.materials.append(fm)
    fl.visible_camera = False
    fl.visible_shadow = False
    fl.visible_diffuse = False
    fl.visible_volume_scatter = False


def area(name, loc, size, energy, shape="RECTANGLE", size_y=None, color=(1, 1, 1), target=(0, 0, 4.5)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = shape
    ld.size = size
    if size_y:
        ld.size_y = size_y
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    scene.collection.objects.link(ob)
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


# key softbox (front-left, high), two vertical strip lights for the glass edges,
# overhead scrim, and a warm kicker behind to light the oil through the glass
area("Key", (-38, -34, 30), 34, 45000, size_y=44, color=(1.0, 0.97, 0.93))
area("StripL", (-17, 6, 6), 5, 9000, size_y=38)
area("StripR", (17, 6, 6), 5, 9000, size_y=38)
area("Top", (0, -4, 40), 30, 15000, size_y=30)
area("Kicker", (2, 22, 8), 10, 7000, size_y=16, color=(1.0, 0.85, 0.62), target=(0, 0, 3.5))
area("Fill", (32, -40, 12), 40, 7000, size_y=40)

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3

# camera: 100 mm lens, slightly above the label
cd = bpy.data.cameras.new("Cam")
cd.lens = 100
cd.sensor_width = 36
cd.dof.use_dof = True
cd.dof.focus_distance = 46
cd.dof.aperture_fstop = 8
cam = bpy.data.objects.new("Cam", cd)
cam.location = (0, -46, 8.2)
scene.collection.objects.link(cam)
d = Vector((0, 0, 5.3)) - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# ---------------------------------------------------------------- render settings
scene.render.engine = "CYCLES"
cy = scene.cycles
cy.device = "CPU"
cy.samples = args.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.01
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
cy.max_bounces = 24
cy.transmission_bounces = 24
cy.glossy_bounces = 8
cy.transparent_max_bounces = 16
cy.volume_bounces = 2
cy.caustics_refractive = True
cy.caustics_reflective = True
cy.blur_glossy = 0.6
cy.sample_clamp_indirect = 8
scene.render.resolution_x = args.res
scene.render.resolution_y = int(args.res * 4 / 3)
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -0.35
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.color_mode = "RGBA"

if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))

os.makedirs(args.out, exist_ok=True)
if args.still:
    rig.rotation_euler.z = math.radians(args.angle)
    scene.render.filepath = os.path.join(os.path.abspath(args.out), "still.png")
    bpy.ops.render.render(write_still=True)
else:
    for f in range(args.start, args.frames):
        rig.rotation_euler.z = 2 * math.pi * f / args.frames
        scene.render.filepath = os.path.join(os.path.abspath(args.out), f"f{f:03d}.png")
        if os.path.exists(scene.render.filepath):
            continue
        bpy.ops.render.render(write_still=True)
        print("frame", f, "done", flush=True)
