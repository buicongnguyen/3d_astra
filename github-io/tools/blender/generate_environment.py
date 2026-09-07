"""Original Riverlands scenery. Run with Blender --background --python this_file."""
import bpy, math, json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name, color, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=.86; bsdf.inputs['Metallic'].default_value=metal
    return m
bark=material('River_bark',(.18,.15,.10)); leaf=material('River_leaves',(.19,.31,.15)); light=material('River_leaf_tips',(.33,.42,.20))
stone=material('River_concrete',(.42,.42,.34)); steel=material('River_steel',(.26,.32,.31),.45); wood=material('River_crate',(.39,.29,.15))
assets=[]
def start(name):
    o=bpy.data.objects.new('asset_'+name,None);bpy.context.collection.objects.link(o);assets.append(o);return o
def finish(o,name,mat,parent):
    o.name=name;o.data.materials.append(mat);o.parent=parent;return o
def box(name,loc,size,mat,parent):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent)
def cone(name,loc,r1,r2,depth,mat,parent,vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=loc)
    return finish(bpy.context.object,name,mat,parent)
p=start('tree');cone('Trunk',(0,0,1.2),.23,.13,2.4,bark,p)
for i in range(3):cone('Pine_crown',(0,0,2.2+i*.75),1.25-i*.22,0,1.9,leaf if i%2 else light,p)
p=start('bush')
for i in range(3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.65,location=((i-1)*.4,math.sin(i)*.25,.45))
    finish(bpy.context.object,'Bush_leaves',leaf if i%2 else light,p)
p=start('reed')
for i in range(5):cone('Reed',((i-2)*.12,math.sin(i)*.18,.4+(i%2)*.1),.045,.018,.8+(i%2)*.2,light,p,5)
p=start('crate');box('Cargo',(0,0,.48),(1.05,.85,.95),wood,p)
for x in [-.46,.46]:box('Steel_strap',(x,0,.5),(.1,.9,1.02),steel,p)
p=start('bridge');box('Deck',(0,0,-.08),(10,10,.3),stone,p)
for x in [-4.9,4.9]:
    box('Rail',(x,0,.6),(.16,10,.18),steel,p)
    for y in [-4,-2,0,2,4]:box('Post',(x,y,.3),(.2,.2,.7),steel,p)
for y in [-4.6,4.6]:box('Abutment',(0,y,-.35),(10.4,.7,.7),stone,p)
manifest={'generator':'Blender 4.5 Python','provenance':'Original procedural scenery, no external assets','assets':[]}
for a in assets:
    tris=0
    for o in a.children:
        o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    manifest['assets'].append({'name':a.name,'triangles':tris})
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/environment.glb'),export_format='GLB',export_yup=True,export_animations=False)
for i,a in enumerate(assets):a.location.x=i*13
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/source/riverlands-library.blend'))
(root/'public/models/environment-manifest.json').write_text(json.dumps(manifest,indent=2))
print('ENVIRONMENT_COMPLETE',json.dumps(manifest))
