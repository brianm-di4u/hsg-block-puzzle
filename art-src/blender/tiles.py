# Renders the glazed tile sprites for Thermal Blocks.
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P art-src/blender/tiles.py -- <outdir>
# Builds the scene from scratch, saves tiles.blend beside this script, renders PNGs with alpha.
import bpy, sys, os, math
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.path.join(os.path.dirname(__file__), 'renders')
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.use_denoising = True
sc.cycles.device = 'CPU'
sc.render.resolution_x = sc.render.resolution_y = 256
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.62, 0.72, 0.74, 1); bg.inputs[1].default_value = 0.32

# camera: orthographic, straight down; the tile fills ~84% of the frame, leaving room for the shadow
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.19; cam.location = (0, -0.035, 5); cam.rotation_euler = (0, 0, 0)
key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'AREA')); sc.collection.objects.link(key)
key.data.energy = 330; key.data.size = 1.6; key.location = (-2.6, 2.9, 2.4)
key.rotation_euler = (math.radians(-48), math.radians(-42), 0)
rim = bpy.data.objects.new('rim', bpy.data.lights.new('rim', 'AREA')); sc.collection.objects.link(rim)
rim.data.energy = 40; rim.data.size = 3; rim.location = (2.5, -2.0, 2.5); rim.rotation_euler = (math.radians(40), math.radians(40), 0)
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0)); ground = bpy.context.active_object; ground.is_shadow_catcher = True


def tile_mesh(name, h=0.26, bevel=0.15, inset=True):
    import bmesh
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, h / 2))
    o = bpy.context.active_object; o.name = name; o.scale = (0.9, 0.9, h)
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 8; m.limit_method = 'NONE'; m.profile = 0.62
    bpy.ops.object.modifier_apply(modifier='bev')
    bpy.ops.object.shade_smooth()
    if inset:  # molded art tile: a pillowed relief panel rising from the face, joined into one mesh
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, h - 0.004))
        p = bpy.context.active_object; p.scale = (0.56, 0.56, 0.055)
        bpy.ops.object.transform_apply(scale=True)
        pm = p.modifiers.new('bev', 'BEVEL'); pm.width = 0.06; pm.segments = 8; pm.limit_method = 'NONE'; pm.profile = 0.75
        bpy.ops.object.modifier_apply(modifier='bev')
        bpy.ops.object.shade_smooth()
        o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.join()
    return o


def lin(h):  # sRGB hex to linear
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def glaze(name, hexcol, rough=0.22):
    rgb = lin(hexcol)
    mt = bpy.data.materials.new(name); mt.use_nodes = True
    nt = mt.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = 0.8; p.inputs['Coat Roughness'].default_value = 0.04
    # handmade glaze: faint waviness in the coat normal, glaze pooled darker toward the edges
    tex = nt.nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = 3.5; tex.inputs['Detail'].default_value = 3
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.06
    nt.links.new(tex.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], p.inputs['Coat Normal'])
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    edge = nt.nodes.new('ShaderNodeMix'); edge.data_type = 'RGBA'
    edge.inputs['A'].default_value = (*rgb, 1); edge.inputs['B'].default_value = (rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5, 1)
    nt.links.new(lw.outputs['Facing'], edge.inputs['Factor'])
    var = nt.nodes.new('ShaderNodeTexNoise'); var.inputs['Scale'].default_value = 6; var.inputs['Detail'].default_value = 2
    hsv = nt.nodes.new('ShaderNodeHueSaturation'); nt.links.new(edge.outputs['Result'], hsv.inputs['Color'])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.88; mr.inputs['To Max'].default_value = 1.1
    nt.links.new(var.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], hsv.inputs['Value'])
    nt.links.new(hsv.outputs['Color'], p.inputs['Base Color'])
    return mt


# Fixed palette (game design, after Row materials: terra cotta, amber glass, cobalt glass,
# green tile, cream marble, violet stained glass). Keep in sync with TILE_HEX in index.html.
COLORS = {'tile-1': '#B8381F', 'tile-2': '#E09A1E', 'tile-3': '#2450B8', 'tile-4': '#1F8A4C', 'tile-5': '#E9DFC6', 'tile-6': '#7A3FB4'}
t = tile_mesh('tile')
for name, hx in COLORS.items():
    t.data.materials.clear(); t.data.materials.append(glaze(name, hx, 0.26 if name == 'tile-5' else 0.2))
    sc.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)


def tufa_mat():
    mt = bpy.data.materials.new('tufa'); mt.use_nodes = True; nt = mt.node_tree; p = nt.nodes['Principled BSDF']
    vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 9; vor.feature = 'SMOOTH_F1'
    noi = nt.nodes.new('ShaderNodeTexNoise'); noi.inputs['Scale'].default_value = 14; noi.inputs['Detail'].default_value = 8
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.25; ramp.color_ramp.elements[0].color = (*lin('#6E6A60'), 1)
    ramp.color_ramp.elements[1].position = 0.8; ramp.color_ramp.elements[1].color = (*lin('#CFC3A6'), 1)
    e = ramp.color_ramp.elements.new(0.55); e.color = (*lin('#A3957A'), 1)
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'
    nt.links.new(vor.outputs['Distance'], add.inputs[0]); nt.links.new(noi.outputs['Fac'], add.inputs[1])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.62
    nt.links.new(add.outputs[0], mul.inputs[0]); nt.links.new(mul.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.85
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.9; bump.inputs['Distance'].default_value = 0.05
    nt.links.new(mul.outputs[0], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return mt


# tufa stone: porous, lobed travertine (a fresh block with no inset)
bpy.data.objects.remove(t)
t = tile_mesh('tufa', 0.3, 0.2, inset=False)
t.data.materials.clear(); t.data.materials.append(tufa_mat())
sc.render.filepath = os.path.join(out, 'tile-7.png'); bpy.ops.render.render(write_still=True)

# vent: tufa block with a round hot pool sunk into it
bpy.ops.mesh.primitive_cylinder_add(radius=0.27, depth=0.4, location=(0, 0, 0.26), vertices=64)
hole = bpy.context.active_object; hole.hide_render = True
b = t.modifiers.new('hole', 'BOOLEAN'); b.object = hole; b.operation = 'DIFFERENCE'
bpy.ops.mesh.primitive_cylinder_add(radius=0.275, depth=0.02, location=(0, 0, 0.17), vertices=64)
water = bpy.context.active_object
wm = bpy.data.materials.new('water'); wm.use_nodes = True; wp = wm.node_tree.nodes['Principled BSDF']
wp.inputs['Base Color'].default_value = (*lin('#13606A'), 1); wp.inputs['Roughness'].default_value = 0.05
wp.inputs['Emission Color'].default_value = (*lin('#7FE0D2'), 1); wp.inputs['Emission Strength'].default_value = 0.25
water.data.materials.append(wm)
sc.render.filepath = os.path.join(out, 'tile-8.png'); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tiles.blend'))
print('TILES DONE', out)
