"""Glass dropper pipette with a black rubber bulb releasing a drop of argan oil.

Blender 4.2 / Cycles via the `bpy` module. Units: 1 = 1 cm. Transparent background.
    python3 render/pipette_drip.py --out out/ --frames 0-47 [--samples 96] [--res 700]
"""
import argparse
import math
import os
import sys

import bpy  # must come first: it registers bmesh/mathutils
import bmesh
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--frames", default="0-47")
ap.add_argument("--total", type=int, default=48)
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--res", type=int, default=700)
args = ap.parse_args()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def lathe(name, profile, segments=160):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(segments):
        r0, r1 = rings[i], rings[(i + 1) % segments]
        for j in range(len(profile) - 1):
            try:
                bm.faces.new([r0[j], r1[j], r1[j + 1], r0[j + 1]])
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


def arc(cx, cz, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def bez(p0, p1, p2, p3, n):
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return out


def mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links


def dielectric(name, ior, color, density):
    m, n, l = mat(name)
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    g = n.new("ShaderNodeBsdfGlass")
    g.inputs["IOR"].default_value = ior
    g.inputs["Color"].default_value = (1, 1, 1, 1)
    l.new(g.outputs[0], out.inputs["Surface"])
    if density:
        v = n.new("ShaderNodeVolumeAbsorption")
        v.inputs["Color"].default_value = (*color, 1)
        v.inputs["Density"].default_value = density
        l.new(v.outputs[0], out.inputs["Volume"])
    return m


# ------------------------------------------------------------------ pipette
# tip opening at z = 0; tube 6.2 cm; bulb on top
TIP_R_OUT, TIP_R_IN = 0.085, 0.045
tube_out = [(TIP_R_IN, 0.0), (TIP_R_OUT, 0.0)]
tube_out += bez((TIP_R_OUT, 0.0), (0.1, 0.5), (0.32, 0.9), (0.33, 1.6), 20)
tube_out += [(0.33, 6.2)]
tube_in = [(0.27, 6.2), (0.27, 1.6)] + bez((0.27, 1.6), (0.26, 0.9), (0.07, 0.5), (TIP_R_IN, 0.0), 20)[:-1]
glass = lathe("Tube", tube_out + tube_in + [(TIP_R_IN, 0.0)])
glass.data.materials.append(dielectric("Glass", 1.5, (0.95, 0.97, 0.96), 0.4))

# oil column inside the tube (fills the tip), slight meniscus at the top
oil_top = 3.4
oil_prof = [(0.0, 0.0), (TIP_R_IN - 0.004, 0.0)]
oil_prof += bez((TIP_R_IN - 0.004, 0.0), (0.066, 0.5), (0.255, 0.9), (0.265, 1.6), 20)
oil_prof += [(0.265, oil_top + 0.04), (0.22, oil_top), (0.0, oil_top - 0.02)]
oil = lathe("OilCol", oil_prof, 96)
oil_mat = dielectric("ArganOil", 1.47, (0.95, 0.66, 0.16), 2.6)
oil.data.materials.append(oil_mat)

# black collar that sits on the bottle neck, then the rubber bulb
collar = [(0.0, 6.0), (0.95, 6.0)] + arc(0.9, 6.07, 0.07, -math.pi / 2, 0, 6)[1:] + [(0.97, 6.75)] + arc(0.9, 6.75, 0.07, 0, math.pi / 2, 6)[1:] + [(0.0, 6.82)]
col_ob = lathe("Collar", collar, 192)
ribs = [(0.0, 6.82), (0.86, 6.82), (0.86, 8.2), (0.8, 8.26), (0.0, 8.26)]
rib_ob = lathe("Ribs", ribs, 400)
for v in rib_ob.data.vertices:
    if 6.84 < v.co.z < 8.18 and math.hypot(v.co.x, v.co.y) > 0.5:
        a = math.atan2(v.co.y, v.co.x)
        k = 1 + 0.035 * (0.5 + 0.5 * math.cos(a * 36)) ** 0.7
        v.co.x *= k
        v.co.y *= k
bulb = [(0.0, 8.2), (0.5, 8.2), (0.52, 8.28)]
bulb += bez((0.52, 8.28), (0.5, 8.9), (0.42, 9.2), (0.42, 9.7), 16)
bulb += arc(0.0, 9.7, 0.42, 0, math.pi / 2, 16)[1:]
bulb_ob = lathe("Bulb", bulb, 128)

m, n, l = mat("BlackPP")
p = n["Principled BSDF"]
p.inputs["Base Color"].default_value = (0.006, 0.006, 0.006, 1)
p.inputs["Roughness"].default_value = 0.22
col_ob.data.materials.append(m)
rib_ob.data.materials.append(m)
m, n, l = mat("Rubber")
p = n["Principled BSDF"]
p.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
p.inputs["Roughness"].default_value = 0.45
p.inputs["Coat Weight"].default_value = 0.15
p.inputs["Coat Roughness"].default_value = 0.35
bulb_ob.data.materials.append(m)

# ------------------------------------------------------------------ drop (metaballs)
mb = bpy.data.metaballs.new("Drop")
mb.resolution = 0.012
mb.render_resolution = 0.006
mb.threshold = 0.6
drop = bpy.data.objects.new("Drop", mb)
scene.collection.objects.link(drop)
drop.data.materials.append(oil_mat)
e_tip = mb.elements.new()          # oil bead that always clings to the tip
e_hang = mb.elements.new()         # the growing drop
e_neck = mb.elements.new()         # thin neck that pinches off


def pose_drop(f, total):
    t = f / total                     # 0..1 loop
    grow_end = 0.66
    e_tip.co = (0, 0, -0.05)
    e_tip.radius = 0.16
    if t < grow_end:
        k = t / grow_end
        ease = k * k * (3 - 2 * k)
        e_hang.radius = 0.12 + 0.26 * ease
        e_hang.co = (0, 0, -0.08 - 0.42 * ease ** 1.4)
        e_neck.radius = 0.12
        e_neck.co = (0, 0, -0.1 - 0.18 * ease)
    else:
        k = (t - grow_end) / (1 - grow_end)      # 0..1 falling
        fall = 0.5 * 58.0 * (k * 0.68) ** 2     # cm, ~g over the remaining time
        e_hang.radius = 0.38
        e_hang.co = (0, 0, -0.5 - fall)
        # neck snaps back up into the tip within the first frames
        e_neck.radius = max(0.0, 0.12 * (1 - k * 5))
        e_neck.co = (0, 0, -0.28 + 0.2 * min(1, k * 5))


# ------------------------------------------------------------------ studio
def area(name, loc, size, energy, size_y=None, color=(1, 1, 1), target=(0, 0, 2.0)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = "RECTANGLE"
    ld.size = size
    ld.size_y = size_y or size
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


area("Key", (-30, -30, 18), 30, 26000, 38, color=(1, 0.97, 0.93))
area("StripL", (-14, 5, 3), 4, 5000, 30)
area("StripR", (14, 5, 3), 4, 5000, 30)
area("Back", (0, 20, 0), 14, 9000, 14, color=(1, 0.88, 0.66), target=(0, 0, -0.5))   # makes the oil glow
area("Top", (0, -2, 30), 20, 8000)

world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

cd = bpy.data.cameras.new("Cam")
cd.lens = 90
cam = bpy.data.objects.new("Cam", cd)
cam.location = (0, -40, 2.6)
scene.collection.objects.link(cam)
cam.rotation_euler = (Vector((0, 0, 2.6)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

sc = scene.cycles
scene.render.engine = "CYCLES"
sc.device = "CPU"
sc.samples = args.samples
sc.use_denoising = True
sc.denoiser = "OPENIMAGEDENOISE"
sc.max_bounces = 32
sc.transmission_bounces = 32
sc.transparent_max_bounces = 16
sc.glossy_bounces = 8
sc.volume_bounces = 2
sc.sample_clamp_indirect = 8
scene.render.resolution_x = args.res
scene.render.resolution_y = int(args.res * 16 / 9)
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.use_motion_blur = False

a, b = (int(x) for x in args.frames.split("-")) if "-" in args.frames else (int(args.frames),) * 2
os.makedirs(args.out, exist_ok=True)
for f in range(a, b + 1):
    pose_drop(f, args.total)
    scene.render.filepath = os.path.join(os.path.abspath(args.out), f"d{f:03d}.png")
    if os.path.exists(scene.render.filepath):
        continue
    bpy.ops.render.render(write_still=True)
    print("frame", f, flush=True)
