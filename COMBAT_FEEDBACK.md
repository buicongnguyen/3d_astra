# Lightweight combat feedback

Both game versions use the existing screen overlay to show:

- Blue shield flashes and warm impact sparks on units and buildings. Hits are throttled to one effect per object every 0.2 seconds.
- Fire and rising smoke on completed buildings and mechanical units below 35% HP. Repairs clear the fire. Infantry and unfinished construction never burn.
- A brief flash, fragments and a fading scorch mark when something is destroyed. Vehicles and buildings leave smoke for up to 2.2 seconds; infantry feedback lasts 0.75 seconds.

Fire is a visual damage warning. It adds no damage over time, collision, resource cost or gameplay obstruction.

## Rendering limits

The effects use small polygons and circles in the existing Canvas 2D / Godot Control overlay. They require no additional textures, lights, shadows, particle nodes or physics bodies. Transient effects are capped at 32, with destruction taking priority over hit spam. Active fires are capped at 8 in Eco mode and 16 in High mode, with fewer smoke puffs and fragments in Eco.

Offscreen and unseen enemy effects are skipped. Godot also keeps individual effect shapes clear of the HUD and minimap. Pausing freezes effects; restart and map changes clear them. Reduced-motion preferences and the animation setting disable drift and flickering while preserving damage feedback.

## Verification

Logic checks cover shields, throttling, critical HP, repair, construction and vehicle classification. Browser checks cover desktop and mobile layouts, fog visibility, pause, destruction, cleanup and effect caps. Three.js checks verify that fire adds no 3D draw calls; Godot checks verify that a burst creates no additional scene nodes. Android Chrome is tested through browser emulation, not a physical-phone frame-rate benchmark.
