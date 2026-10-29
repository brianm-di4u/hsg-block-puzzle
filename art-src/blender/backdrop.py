# Composition guide for the Thermal Blocks era backdrops: real terrain + real footprints from a real viewpoint.
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P art-src/blender/backdrop.py -- <out.png> [eyeLat eyeLon eyeH az hfov]
# Terrain: USGS 3DEP (art-src/dem/hs-3dep.bip, fetched by tools/skyline.mjs). Footprints: OpenStreetMap (ODbL),
# art-src/geo/row-osm.json. Heights are estimates from storey counts (sourced features in research/backdrop-notes.md).
import bpy, bmesh, sys, os, math, json, struct
HERE = os.path.dirname(os.path.abspath(__file__)); GAME = os.path.abspath(os.path.join(HERE, '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(HERE, 'renders', 'guide.png')
EYE_LAT, EYE_LON, EYE_H, AZ, HFOV, PITCH = (float(v) for v in (argv[1:7] if len(argv) >= 7 else (34.5136, -93.0560, 28, 80, 62, 2)))
LAT0, LON0 = 34.5138, -93.0540
M_LAT, M_LON = 110950.0, 111320.0 * math.cos(math.radians(34.515))
def xy(lat, lon): return ((lon - LON0) * M_LON, (lat - LAT0) * M_LAT)

BBOX, W, H = (-93.090, 34.470, -92.970, 34.560), 480, 360
raw = open(os.path.join(GAME, 'art-src', 'dem', 'hs-3dep.bip'), 'rb').read()
dem = struct.unpack('<%df' % (W * H), raw[:W * H * 4])
def elev(lat, lon):
    fx = (lon - BBOX[0]) / (BBOX[2] - BBOX[0]) * (W - 1); fy = (BBOX[3] - lat) / (BBOX[3] - BBOX[1]) * (H - 1)
    x = max(0, min(W - 2, int(fx))); y = max(0, min(H - 2, int(fy))); u = fx - x; v = fy - y; i = y * W + x
    return dem[i] * (1 - u) * (1 - v) + dem[i + 1] * u * (1 - v) + dem[i + W] * (1 - u) * v + dem[i + W + 1] * u * v

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def mat(name, rgb):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb, 1); return m
M = {'terrain': mat('terrain', (0.16, 0.25, 0.12)), 'city': mat('city', (0.55, 0.5, 0.45)), 'row': mat('row', (0.85, 0.78, 0.62)),
     'roof': mat('roof', (0.55, 0.18, 0.1)), 'tower': mat('tower', (0.35, 0.36, 0.4)), 'dome': mat('dome', (0.2, 0.35, 0.6)),
     'landmark': mat('landmark', (0.7, 0.45, 0.35))}

# terrain mesh, 23 m grid, 4 km around the eye
lat_a, lat_b, lon_a, lon_b = 34.490, 34.540, -93.085, -93.010
nx, ny = 210, 160
bm = bmesh.new(); verts = []
for j in range(ny):
    lat = lat_a + (lat_b - lat_a) * j / (ny - 1)
    for i in range(nx):
        lon = lon_a + (lon_b - lon_a) * i / (nx - 1)
        x, y = xy(lat, lon); verts.append(bm.verts.new((x, y, elev(lat, lon))))
for j in range(ny - 1):
    for i in range(nx - 1):
        a = j * nx + i; bm.faces.new((verts[a], verts[a + 1], verts[a + nx + 1], verts[a + nx]))
me = bpy.data.meshes.new('terrain'); bm.to_mesh(me); bm.free()
ter = bpy.data.objects.new('terrain', me); sc.collection.objects.link(ter); me.materials.append(M['terrain'])
for p in me.polygons: p.use_smooth = True

# buildings from OSM footprints; storey estimates for named landmarks (see research/backdrop-notes.md)
HEIGHT = {'Superior': 11, 'Hale': 10, 'Maurice': 15, 'Fordyce': 16, 'Quapaw': 11, 'Ozark': 11, 'Buckstaff': 15, 'Lamar': 10,
          'Arlington': 42, 'Medical Arts': 55, 'Army-Navy': 34, 'Administration': 10}
osm = json.load(open(os.path.join(GAME, 'art-src', 'geo', 'row-osm.json'), encoding='utf-8'))
def extrude(name, pts, h, material, base=None):
    if len(pts) < 3: return None
    if pts[0] == pts[-1]: pts = pts[:-1]
    gz = base if base is not None else min(elev(la, lo) for la, lo in pts)
    bm = bmesh.new(); bottom = [bm.verts.new((*xy(la, lo), gz - 2)) for la, lo in pts]
    try: f = bm.faces.new(bottom)
    except ValueError: bm.free(); return None
    r = bmesh.ops.extrude_face_region(bm, geom=[f]); top = [v for v in r['geom'] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, h + 2), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); me.materials.append(M[material]); return o, gz
row = {}
for e in osm['elements']:
    if e.get('type') != 'way' or 'geometry' not in e: continue
    t = e.get('tags', {}); name = t.get('name', '')
    pts = [(p['lat'], p['lon']) for p in e['geometry']]
    key = next((k for k in HEIGHT if k in name), None)
    lv = t.get('building:levels')
    h = HEIGHT[key] if key else (float(lv) * 4 if lv and lv.replace('.', '').isdigit() else 9)
    material = 'row' if key in ('Superior', 'Hale', 'Maurice', 'Fordyce', 'Quapaw', 'Ozark', 'Buckstaff', 'Lamar') else ('landmark' if key else 'city')
    r = extrude(name or 'bldg%d' % e['id'], pts, h, material)
    if r and key: row[key] = (r[0], r[1], pts, h)

def centroid(pts): return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
# Quapaw: tiled dome with cupola (the Row's tallest dome)
if 'Quapaw' in row:
    o, gz, pts, h = row['Quapaw']; la, lo = centroid(pts); x, y = xy(la, lo)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=6, location=(x - 4, y, gz + h)); d = bpy.context.active_object; d.scale = (1, 1, 1.25)
    d.data.materials.append(M['dome'])
    bpy.ops.mesh.primitive_cube_add(size=2, location=(x - 4, y, gz + h + 8)); bpy.context.active_object.data.materials.append(M['roof'])
# Ozark: twin towers stepping in three tiers, red hipped caps
if 'Ozark' in row:
    o, gz, pts, h = row['Ozark']; la, lo = centroid(pts); x, y = xy(la, lo)
    for dy in (-11, 11):
        for k, (s, z) in enumerate(((7, 4), (5.5, 4), (4, 3))):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x - 6, y + dy, gz + h + sum(zz for _, zz in ((7, 4), (5.5, 4), (4, 3))[:k]) + z / 2))
            c = bpy.context.active_object; c.scale = (s, s, z); c.data.materials.append(M['row'])
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=3.2, depth=3.5, location=(x - 6, y + dy, gz + h + 11 + 1.75))
        c = bpy.context.active_object; c.rotation_euler[2] = math.pi / 4; c.data.materials.append(M['roof'])
# hipped red tile roofs on Hale, Fordyce, Maurice (low pyramids over the footprint box)
for k in ('Hale', 'Fordyce', 'Maurice'):
    if k not in row: continue
    o, gz, pts, h = row[k]; xs = [xy(*p) for p in pts]
    x0, x1 = min(p[0] for p in xs), max(p[0] for p in xs); y0, y1 = min(p[1] for p in xs), max(p[1] for p in xs)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1, depth=1, location=((x0 + x1) / 2, (y0 + y1) / 2, gz + h + 2))
    c = bpy.context.active_object; c.rotation_euler[2] = math.pi / 4
    c.scale = ((x1 - x0) * 0.72, (y1 - y0) * 0.72, 4); c.data.materials.append(M['roof'])

# Hot Springs Mountain Tower: 216 ft (65.8 m) lattice, observation levels at the top (34.51723, -93.04611)
tx, ty = xy(34.51723, -93.04611); tz = elev(34.51723, -93.04611)
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=9, radius2=4, depth=52, location=(tx, ty, tz + 26))
c = bpy.context.active_object; c.rotation_euler[2] = math.pi / 4; c.data.materials.append(M['tower'])
w = c.modifiers.new('lattice', 'WIREFRAME'); w.thickness = 0.9
bpy.ops.mesh.primitive_cube_add(size=1, location=(tx, ty, tz + 57)); c = bpy.context.active_object; c.scale = (11, 11, 9); c.data.materials.append(M['tower'])
bpy.ops.mesh.primitive_cube_add(size=1, location=(tx, ty, tz + 63)); c = bpy.context.active_object; c.scale = (13, 13, 1.2); c.data.materials.append(M['tower'])
bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=4, location=(tx, ty, tz + 65.8)); bpy.context.active_object.data.materials.append(M['tower'])

# camera
ex, ey = xy(EYE_LAT, EYE_LON); ez = elev(EYE_LAT, EYE_LON) + EYE_H
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (ex, ey, ez)
cam.rotation_euler = (math.radians(90 + PITCH), 0, math.radians(-AZ))
cam.data.sensor_fit = 'HORIZONTAL'; cam.data.angle = math.radians(HFOV); cam.data.clip_end = 20000; cam.data.clip_start = 1
# afternoon sun from the west-southwest lights the Row's west-facing facades
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(62), 0, math.radians(-110 + 180)); sun.data.energy = 3
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True; sh.show_cavity = True
sh.show_object_outline = True; sc.display.light_direction = (-0.6, -0.3, 0.75)
world = bpy.data.worlds.new('w'); sc.world = world; world.color = (0.62, 0.74, 0.86)
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'backdrop.blend'))
print('GUIDE DONE', OUT, 'eye ground', round(elev(EYE_LAT, EYE_LON), 1), 'tower ground', round(tz, 1))
