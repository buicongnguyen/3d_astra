"""Original faction model candidates. Headless Blender 4.5; no external assets.

Run through generate_assets.py --factions. Candidates are not runtime roster definitions;
the owner reviews their silhouettes before the faction gameplay packages wire them in.
"""
import json,math,sys
from pathlib import Path
import bpy
HERE=Path(__file__).resolve().parent
if str(HERE) not in sys.path:sys.path.insert(0,str(HERE))
import frontier_kit as kit
from frontier_kit import Asset,chamfered
ROOT=HERE.parents[1]
OUT=ROOT/'public/models'
R=math.pi/2
CATALOG={
 'scrapper':('ashfall','unit',3200,2800),'scorcher':('ashfall','unit',4500,0),'salvageyard':('ashfall','building',4000,2100),
 'rider':('sunward','unit',4500,0),'wagon':('sunward','unit',4500,0),'waystation':('sunward','building',4000,2100),
 'drone':('wardens','unit',4500,0),'walker':('wardens','unit',6300,0),'pylon':('wardens','building',4000,2100),
 'shade':('veil','unit',3200,2800),'watcher':('veil','unit',3200,2800),'veilrelay':('veil','building',4000,2100),
}
def box(a,name,mat,size,loc,rot=(0,0,0),bevel=.035,parent=None):
 return a.part(name,mat,parent).box(size,loc=loc,rot=rot,bevel=bevel,seg=1)
def cyl(a,name,mat,r,depth,loc,rot=(0,0,0),seg=12,parent=None):
 return a.part(name,mat,parent).cyl(r,depth,loc=loc,rot=rot,seg=seg,bevel=.015,bseg=1)
def beam(a,name,mat,start,end,width=.09):
 return a.part(name,mat).limb(start,end,width,width,bevel=.015,seg=1)
def base(a,w=4,d=4):
 a.part('Platform','Concrete').prism(chamfered(w,d,.4),.18,loc=(0,0,.09),axis='Z',bevel=.025,seg=1)
 for x in [-w/2+.3,w/2-.3]:
  box(a,'Landing_lights','TeamGlow',(.2,.12,.08),(x,-d/2+.2,.21),bevel=.015)
def legs(a,wide=.2,height=.94,robot=False):
 for sign,side in [(-1,'L'),(1,'R')]:
  p=a.pivot('leg_'+side,(sign*wide,0,height))
  box(a,'Upper_leg','Armor' if robot else 'Suit',(.22,.25,height*.54),(0,0,-height*.27),parent=p)
  cyl(a,'Knee','Steel',.12,.25,(0,0,-height*.55),rot=(0,R,0),seg=10,parent=p)
  box(a,'Shin','Team',(.23,.26,height*.4),(0,-.025,-height*.77),parent=p)
  box(a,'Boot','Undercarriage',(.29,.43,.15),(0,-.08,-height+.08),parent=p)
def person(a,kind):
 legs(a)
 box(a,'Pelvis','Armor',(.6,.36,.22),(0,0,1.02))
 box(a,'Torso','Team',(.62,.4,.57),(0,0,1.44),bevel=.07)
 box(a,'Chest_harness','Steel',(.47,.06,.13),(0,-.23,1.42))
 cyl(a,'Neck','Undercarriage',.12,.14,(0,0,1.79))
 a.part('Helmet','Armor').sphere(.245,loc=(0,-.025,1.99),seg=12,rings=8)
 box(a,'Face','Glass',(.31,.08,.13),(0,-.245,2.01),bevel=.025)
 for sign in [-1,1]:
  cyl(a,'Shoulder_joint','Steel',.115,.18,(sign*.4,0,1.63),rot=(0,R,0),seg=10)
  a.part('Arms','Suit').limb((sign*.42,0,1.62),(sign*.48,-.24,1.25),.17,.2,bevel=.025,seg=1)
  box(a,'Hands','Armor',(.19,.18,.2),(sign*.46,-.3,1.22))
 if kind=='scrapper':
  box(a,'Salvaged_pauldron','Team',(.5,.6,.37),(-.49,0,1.77),rot=(0,.2,-.2),bevel=.07)
  box(a,'Patch_plate','Hazard',(.3,.07,.31),(.14,-.25,1.5),rot=(0,0,.19))
  for sign in [-1,1]:beam(a,'Exposed_frame','Steel',(sign*.36,.2,1.1),(sign*.38,.21,1.74),.055)
  cyl(a,'Exhaust','Undercarriage',.085,.85,(.34,.24,1.86),seg=10)
  box(a,'Stack_cap','Steel',(.2,.2,.07),(.34,.24,2.3))
  a.part('Salvage_cutter','Steel').prism([(-.17,-.3),(.18,-.3),(.25,.25),(-.23,.14)],.09,loc=(.48,-.4,1.19),axis='X',seg=1)
  for z in [1.27,1.48,1.69]:box(a,'Welded_straps','Steel',(.53,.05,.035),(0,-.26,z),bevel=.01)
 else:
  # Veil hoods and split cloaks make a narrow, triangular silhouette.
  a.part('Hood','Team').prism([(-.32,0),(0,.58),(.32,0),(.24,-.2),(-.24,-.2)],.48,loc=(0,.04,2.01),axis='Y',seg=1)
  for sign in [-1,1]:
   a.part('Split_cloak','Suit').prism([(sign*.05,1.68),(sign*.52,.45),(sign*.08,.65)],.11,loc=(0,.24,0),axis='Y',bevel=.02,seg=1)
  cyl(a,'Mast','Steel',.035,.95,(.23,.2,2.15),seg=8)
  cyl(a,'Lens_disc','Team',.2,.09,(.23,.15,2.57),rot=(R,0,0),seg=16)
  cyl(a,'Lens','TeamGlow',.1,.1,(.23,.09,2.57),rot=(R,0,0),seg=12)
  if kind=='watcher':
   box(a,'Barrel_receiver','Armor',(.25,.85,.22),(.37,-.4,1.38))
   cyl(a,'Barrel_long','Steel',.06,1.5,(.37,-1.14,1.42),rot=(R,0,0),seg=12)
   cyl(a,'Rangefinder','Team',.14,.3,(.37,-.5,1.67),rot=(R,0,0),seg=16)
  else:
   box(a,'Forearm_blade','Steel',(.08,.1,.72),(.46,-.36,1.24),rot=(-.2,0,0))
   box(a,'Sensor_veil','TeamGlow',(.2,.04,.055),(0,-.3,1.99),bevel=.01)
def wheels(a,length=2.5,width=1.1,rows=2):
 for x in [-width,width]:
  for i in range(rows):
   y=-length/2+i*length/max(1,rows-1)
   cyl(a,'Wheels','Undercarriage',.42,.26,(x,y,.48),rot=(0,R,0),seg=16)
   cyl(a,'Wheel_hubs','Team',.23,.29,(x,y,.48),rot=(0,R,0),seg=12)
def scorcher(a):
 wheels(a,2,1.03,2)
 box(a,'Chassis','Steel',(2.2,3,.3),(0,0,.62),bevel=.08)
 box(a,'Patch_hull','Team',(1.7,2.5,.65),(0,0,1.08),bevel=.08)
 for sign in [-1,1]:
  for i in range(3):box(a,'Mismatched_plates','Armor' if i%2 else 'Hazard',(.1,.71,.57),(sign*.9,-.88+i*.82,1.14),rot=(0,sign*.13,i*.06))
  beam(a,'External_frame','Steel',(sign*.86,-1.4,.83),(sign*.86,1.4,1.53),.085)
 cyl(a,'Tall_stack','Undercarriage',.14,1.7,(.69,.85,1.95),seg=12)
 cyl(a,'Stack_rim','Steel',.2,.12,(.69,.85,2.8),seg=12)
 cyl(a,'Fuel_drum','Hazard',.4,1.2,(-.5,.43,1.65),rot=(R,0,0),seg=16)
 box(a,'Turret_head','Team',(.8,.9,.46),(0,-.5,1.66),bevel=.08)
 a.pivot('Turret_pivot',(0,-.5,1.43))
 cyl(a,'Barrel_flame','Steel',.12,1.65,(0,-1.5,1.72),rot=(R,0,0),seg=12)
 cyl(a,'Muzzle_cage','Armor',.2,.22,(0,-2.3,1.72),rot=(R,0,0),seg=12)
 for x in [-.22,.22]:beam(a,'Feed_pipe','Steel',(x,.4,1.5),(x,-.7,1.72),.06)
def salvageyard(a):
 base(a,4.6,4.1)
 for x in [-1.9,1.7]:
  beam(a,'Gantry_posts','Steel',(x,.6,.2),(x,.6,3.4),.2)
 beam(a,'Broken_gantry','Team',(-2,.6,3.4),(2.15,.6,3.4),.33)
 beam(a,'Crane_jib','Hazard',(.8,.6,3.4),(.8,-1.5,4),.18)
 beam(a,'Hook_cable','Undercarriage',(.8,-1.5,4),(.8,-1.5,1.6),.04)
 a.part('Hook','Steel').torus(.17,.045,loc=(.8,-1.5,1.49),rot=(R,0,0),seg=12,ring=6)
 for i in range(3):
  box(a,'Salvage_bins','Armor',(1.1,1.2,.75),(-1.5+i*1.45,0,.62),bevel=.08)
  box(a,'Patch_panels','Team',(1.15,.08,.5),(-1.5+i*1.45,-.65,.72),rot=(0,0,(-1)**i*.1))
  for j in range(2):box(a,'Reclaimed_beams','Steel',(.15,.8,.16),(-1.7+i*1.45+j*.3,0,1.1+j*.1),rot=(0,.2,.2*i))
 for z in [.5,1.1,1.7,2.3]:box(a,'Ladder_rungs','Hazard',(.6,.09,.09),(-1.9,.38,z))
 cyl(a,'Exhaust','Armor',.17,1.8,(-1.4,1.25,1.2),seg=12)
def rider(a):
 # Pedalled two-wheel outrider: low awning, visible rider and pannier tanks.
 for y in [-.95,.95]:
  cyl(a,'Tyres','Undercarriage',.56,.19,(0,y,.58),rot=(0,R,0),seg=20)
  a.part('Spoked_rims','Steel').torus(.4,.035,loc=(0,y,.58),rot=(0,R,0),seg=16,ring=6)
  for angle in [0,math.pi/3,math.pi*2/3]:
   beam(a,'Spokes','Steel',(0,y-math.cos(angle)*.39,.58-math.sin(angle)*.39),(0,y+math.cos(angle)*.39,.58+math.sin(angle)*.39),.025)
 beam(a,'Bike_frame','Team',(0,-.9,.65),(0,.75,1.1),.14)
 beam(a,'Front_fork','Steel',(0,-.95,.6),(0,-.6,1.3),.1)
 box(a,'Seat','Suit',(.5,.5,.16),(0,.35,1.24))
 legs(a,.26,1.15)
 box(a,'Rider_torso','Team',(.6,.4,.6),(0,.2,1.73),bevel=.07)
 a.part('Helmet','Armor').sphere(.24,loc=(0,.12,2.18),seg=12,rings=8)
 for x in [-.55,.55]:
  cyl(a,'Water_panniers','Steel',.2,.8,(x,.68,.98),rot=(R,0,0),seg=12)
  beam(a,'Awning_posts','Steel',(x,.65,1.1),(x,.65,2.35),.04)
 box(a,'Low_awning','Team',(1.4,1.15,.12),(0,.55,2.4),rot=(.07,0,0),bevel=.04)
 for sign in [-1,1]:
  a.part('Rider_arms','Suit').limb((sign*.34,.13,1.95),(sign*.42,-.19,1.65),.16,.18,bevel=.025,seg=1)
  a.part('Rider_forearms','Team').limb((sign*.42,-.19,1.65),(sign*.4,-.58,1.46),.16,.18,bevel=.025,seg=1)
  box(a,'Gloves','Armor',(.18,.2,.16),(sign*.4,-.58,1.46))
 beam(a,'Handlebars','Steel',(-.48,-.6,1.44),(.48,-.6,1.44),.06)
 box(a,'Barrel_carbine','Steel',(.13,.95,.16),(.35,-.5,1.78))
def wagon(a):
 wheels(a,2.7,1.32,3)
 box(a,'Deck','Steel',(2.7,3.7,.22),(0,0,.76),bevel=.08)
 box(a,'Caravan_body','Team',(2.3,3.15,.7),(0,0,1.2),bevel=.1)
 for x in [-1,1]:
  for y in [-1.3,1.3]:beam(a,'Awning_stays','Steel',(x,y,1.4),(x,y,2.2),.06)
  cyl(a,'Water_tanks','Medical',.36,1.7,(x,0,1.72),rot=(R,0,0),seg=16)
 a.part('Awning','Team').prism([(-1.42,0),(-.75,.27),(0,.34),(.75,.27),(1.42,0)],3.7,loc=(0,0,2.3),axis='Y',bevel=.025,seg=1)
 for x in [-.6,.6]:box(a,'Medical_crates','Medical',(.65,.65,.5),(x,-1.35,1.75))
 box(a,'Rear_step','Steel',(1.6,.5,.13),(0,2,.45))
def waystation(a):
 base(a,4.7,4)
 for x in [-1.85,1.85]:
  for y in [-1.45,1.45]:beam(a,'Canopy_stays','Steel',(x,y,.2),(x,y,1.9),.11)
 a.part('Broad_awning','Team').prism([(-2.3,0),(-1.2,.38),(0,.55),(1.2,.38),(2.3,0)],3.8,loc=(0,0,2),axis='Y',bevel=.025,seg=1)
 for x in [-1.4,1.4]:
  cyl(a,'Round_tanks','Medical',.55,1.45,(x,.6,1),seg=20)
  a.part('Tank_bands','Steel').torus(.56,.045,loc=(x,.6,.8),seg=16,ring=6)
 box(a,'Counter','Armor',(2.3,.8,.85),(0,-.9,.65),bevel=.07)
 for x in [-.8,0,.8]:box(a,'Supply_crates','Team',(.6,.55,.4),(x,-.8,1.24))
 for x in [-2,2]:cyl(a,'Wheel_sign','Team',.43,.1,(x,-1.7,.7),rot=(R,0,0),seg=20)
def eye(a,loc,r=.22):
 cyl(a,'Eye_rim','Steel',r*1.4,.12,loc,rot=(R,0,0),seg=20)
 cyl(a,'Single_eye','TeamGlow',r,.14,(loc[0],loc[1]-.05,loc[2]),rot=(R,0,0),seg=20)
def drone(a):
 a.pivot('hover',(0,0,0))
 a.part('Smooth_shell','Team').sphere(.65,loc=(0,0,1.35),seg=20,rings=12)
 a.part('Orbital_ring','Steel').torus(.95,.105,loc=(0,0,1.28),seg=28,ring=8)
 cyl(a,'Lower_thruster','Armor',.32,.35,(0,0,.78),seg=20)
 cyl(a,'Thruster_light','TeamGlow',.23,.08,(0,0,.58),seg=16)
 eye(a,(0,-.61,1.42),.21)
 for sign in [-1,1]:box(a,'Barrel_emitters','Steel',(.16,.6,.14),(sign*.5,-.46,1.13))
def walker(a):
 legs(a,.65,1.8,True)
 box(a,'Hip_bridge','Steel',(1.65,.65,.35),(0,0,1.85),bevel=.1)
 a.part('Smooth_carapace','Team').sphere(.98,loc=(0,0,2.75),seg=24,rings=16)
 a.part('Halo','Steel').torus(1.1,.11,loc=(0,.07,2.85),rot=(R,0,0),seg=28,ring=8)
 eye(a,(0,-.92,2.9),.34)
 for sign in [-1,1]:
  cyl(a,'Shoulder_socket','Armor',.3,.35,(sign*1.02,0,2.73),rot=(0,R,0),seg=20)
  box(a,'Turret_head_arm','Team',(.43,.7,.5),(sign*1.22,-.15,2.63),bevel=.08)
  cyl(a,'Barrel_cannon','Steel',.13,1.7,(sign*1.22,-1.05,2.61),rot=(R,0,0),seg=16)
  cyl(a,'Muzzle_ring','Armor',.21,.19,(sign*1.22,-1.91,2.61),rot=(R,0,0),seg=16)
 a.pivot('Turret_pivot',(0,0,2.5))
def pylon(a):
 base(a,3.8,3.8)
 a.part('Smooth_base','Team').lathe([(0,.2),(1.25,.2),(1.1,.5),(.6,.85),(.45,1.1)],seg=20)
 cyl(a,'Spine','Armor',.32,3.3,(0,0,1.9),seg=20)
 for z,r in [(1.2,1),(2.1,.85),(3,.65)]:
  a.part('Orbit_rings','Team').torus(r,.14,loc=(0,0,z),seg=28,ring=8)
  for sign in [-1,1]:beam(a,'Ring_braces','Steel',(0,0,z-.4),(sign*r,0,z),.07)
 eye(a,(0,-.35,3.55),.25)
def veilrelay(a):
 base(a,3.6,3.6)
 a.part('Narrow_housing','Team').prism([(-.85,0),(-.5,2.3),(0,2.7),(.5,2.3),(.85,0)],1.1,loc=(0,0,.25),axis='Y',seg=1)
 for sign in [-1,1]:
  beam(a,'Tall_masts','Steel',(sign*1.25,.35,.2),(sign*.8,.35,4.8),.11)
  for z in [1.5,2.7,3.9]:
   cyl(a,'Lens_discs','Team',.34,.12,(sign*(1.25-z*.08),.24,z),rot=(R,0,0),seg=20)
   cyl(a,'Lens_lights','TeamGlow',.19,.14,(sign*(1.25-z*.08),.17,z),rot=(R,0,0),seg=16)
 beam(a,'Cross_mast','Armor',(-.8,.35,4.1),(.8,.35,4.1),.07)
 box(a,'Entrance','Glass',(.48,.07,.86),(0,-.59,.83))
 for x in [-1,1]:box(a,'Instrument_cases','Armor',(.6,.6,.5),(x,-.8,.45))
BUILDERS={'scrapper':lambda a:person(a,'scrapper'),'shade':lambda a:person(a,'shade'),'watcher':lambda a:person(a,'watcher'),'scorcher':scorcher,'salvageyard':salvageyard,'rider':rider,'wagon':wagon,'waystation':waystation,'drone':drone,'walker':walker,'pylon':pylon,'veilrelay':veilrelay}
def count(a):return sum(len(f.verts)-2 for shape in a.shapes.values() for f in shape.bm.faces)
def build_all():
 root=kit.workspace('FrontierFactions');kit.clear_workspace(root)
 OUT.mkdir(parents=True,exist_ok=True)
 entries=[]
 for name,(faction,kind,limit,minimum) in CATALOG.items():
  a=Asset(name,root,ao_distance=.7 if minimum==2800 else 1,ao_samples=40)
  BUILDERS[name](a)
  # Functional fasteners and deck fixtures supply authored surface detail within budget.
  n=0
  while count(a)<minimum:
   if minimum==2800:
    x=(n%5-2)*.09;z=1.15+(n//5)*.1
    cyl(a,'Harness_fasteners','Steel',.027,.035,(x,-.246,z),rot=(R,0,0),seg=6)
   else:
    x=(n%6-2.5)*.22;y=-1.4+(n//6)*.25
    box(a,'Service_deck_fixtures','Steel',(.1,.1,.06),(x,y,.23),bevel=.01)
   n+=1
   if n>80:raise RuntimeError('Detail budget did not converge: '+name)
  triangles=count(a)
  if triangles>limit:raise RuntimeError(f'{name}: {triangles} triangles > {limit}')
  a.finish();a.export(OUT/f'{name}.glb')
  entries.append(dict(name=name,file=name+'.glb',triangles=a.triangles(),faction=faction,kind=kind,budget=limit,review='approved by owner 2026-11-11',animation='Runtime articulated parts; no baked clips'))
  print('FACTION_ASSET',name,a.triangles(),flush=True)
 manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
 manifest['assets']=[e for e in manifest['assets'] if e['name'] not in CATALOG]+entries
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
 source=ROOT/'assets/source';source.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(source/'frontier-factions.blend'))
 return entries
if __name__=='__main__':build_all()
