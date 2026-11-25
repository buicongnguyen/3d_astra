// One height source for everything drawn on the ground at a world point: buildings (finished or
// under construction; their decals, selection ring, health bar and contact shadow ride the same
// root), the build ghost, order markers and the rally flag. It is Terrain.heightAt, the render
// height the ground mesh is built from, so on a plateau each sits on the top (plateau_height up),
// and on a map without plateaus it is 0 as before.
//
// Bug fixed 2026-11-25: the build ghost and the rally flag used fixed heights (0.23 m, 0 m), so on
// high ground they were drawn inside the plateau and the player saw no site where they aimed.
export const GHOST_LIFT = 0.23; // the ghost disc (0.09 m thick) clears the fog sheet (0.15 m) and ground paint
export const MARKER_LIFT = 0.09;
export const ROUTE_LIFT = 0.18;

export function groundY(terrain, x, z) {
  return terrain?.plateaus?.length && Number.isFinite(x) && Number.isFinite(z) ? terrain.heightAt(x, z) : 0;
}

// Puts `object` on the ground at (x, z), `lift` metres up. Returns the object.
export function placeOnGround(object, terrain, x, z, lift = 0) {
  object.position.set(x, groundY(terrain, x, z) + lift, z);
  return object;
}
