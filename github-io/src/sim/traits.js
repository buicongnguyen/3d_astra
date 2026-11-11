// Each faction registers a small deterministic hook here when its gameplay slice ships.
// Empty handlers are inert: the framework never invents faction behavior ahead of its package.
export const TRAIT_HANDLERS = {};
export const traits = {
  stepTraits(dt) {
    for(let team=0;team<this.players.length;team++) TRAIT_HANDLERS[this.factionFor(team).trait]?.tick?.(this,team,dt);
  },
  traitDeath(victim,killerTeam) {
    for(let team=0;team<this.players.length;team++) TRAIT_HANDLERS[this.factionFor(team).trait]?.death?.(this,team,victim,killerTeam);
  },
};
