"""Bake original rigid-part mechanical unit clips for Godot's AnimationPlayer.
Run after generate_assets.py with Blender 4.5.3 in background mode.
No add-ons, external models, or downloaded animation libraries are used.
"""
import bpy
import math
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'models'
SOURCE = ROOT / 'assets' / 'source'
CLIPS = ['Idle', 'Walk', 'Work', 'Attack', 'Death']
report = {}
for kind in ['worker', 'vanguard', 'ranger', 'breaker', 'medic', 'engineer', 'tank', 'antitank']:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(OUT / f'{kind}.glb'))
    roots = [o for o in bpy.context.scene.objects if o.parent is None]
    root = bpy.data.objects.new('MotionRoot', None)
    bpy.context.collection.objects.link(root)
    for obj in roots:
        matrix = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = matrix
    pivots = [o for o in bpy.context.scene.objects if o.type == 'EMPTY' and o.name.lower().startswith('leg_')]
    animated = [root] + pivots
    for obj in animated:
        obj.rotation_mode = 'XYZ'
        base_location = obj.location.copy()
        base_rotation = obj.rotation_euler.copy()
        obj.animation_data_create()
        for clip in CLIPS:
            action = bpy.data.actions.new(f'{kind}_{obj.name}_{clip}')
            obj.animation_data.action = action
            for frame in [1, 7, 13, 19, 25]:
                t = (frame - 1) / 24
                obj.location = base_location
                obj.rotation_euler = base_rotation
                if obj == root:
                    if clip == 'Idle': obj.location.z += math.sin(t*math.tau)*0.025
                    if clip == 'Walk': obj.location.z += abs(math.sin(t*math.tau))*0.08
                    if clip == 'Work': obj.rotation_euler.x += math.sin(t*math.tau)*0.1
                    if clip == 'Attack': obj.location.y += -0.12*math.sin(t*math.pi)**2
                    if clip == 'Death':
                        obj.rotation_euler.x += t*1.35
                        obj.location.z -= t*0.3
                elif clip in ['Walk', 'Work']:
                    phase = math.pi if '_R' in obj.name else 0
                    obj.rotation_euler.x += math.sin(t*math.tau+phase)*(0.35 if clip == 'Walk' else 0.08)
                obj.keyframe_insert(data_path='location', frame=frame)
                obj.keyframe_insert(data_path='rotation_euler', frame=frame)
            obj.animation_data.action = None
            track = obj.animation_data.nla_tracks.new()
            track.name = clip
            strip = track.strips.new(clip, 1, action)
            strip.name = clip
        obj.location = base_location
        obj.rotation_euler = base_rotation
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 25
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f'animated-{kind}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{kind}.glb'), export_format='GLB', export_yup=True,
                              export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_frame_range=True, export_force_sampling=True)
    report[kind] = {'clips': CLIPS, 'fps': 24, 'duration_seconds': 1, 'rig': 'original rigid articulated parts'}
(OUT / 'animation-manifest.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print('ANIMATION_EXPORT_COMPLETE')
