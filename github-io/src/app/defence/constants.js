// Frontier Defence interface constants: tints, labels and the texts of the command card.
// Pure data (no DOM, no three.js), shared by the modules of app/defence-ui.js and read by tests.
// Tier trims multiply the tower's paint (never a material swap: the batches stay as they are).
export const TIER_TINT = { 1: [1.08, 0.94, 0.8], 2: [0.92, 0.99, 1.1], 3: [1.25, 1.1, 0.62] };
// Branch ranks (0.24): the gold trim, brighter per rank.
export const RANK_TINT = { 1: [1.34, 1.18, 0.7], 2: [1.45, 1.3, 0.86] };
// The commander's gold trim, on every part of its model.
export const HERO_TINT = [1.9, 1.38, 0.34];
// Pad colours: plain ground, rim (seen from the road), deep (hidden from it), and the picked pad.
export const PAD_COLOR = { ground: [0.86, 0.8, 0.66], rim: [1.0, 0.56, 0.2], deep: [0.4, 0.55, 1.05], picked: [1.6, 1.42, 0.62] };
// A crewed pad shows its garrison's tier around the tower's foot: bronze, steel, gold.
export const TIER_PAD = { 1: [0.8, 0.46, 0.22], 2: [0.72, 0.84, 0.95], 3: [1.5, 1.08, 0.2] };
// Short crew names for the tiles (the full garrison name is in garrisons.json).
export const CREW_LABEL = { ranger: "Rangers", breaker: "Mortar", antitank: "Anti-tank", watcher: "Watcher", tank: "Tank post", scorcher: "Flame trap" };
export const CREW_ROLE = {
  ranger: "Single target, long reach. Strong against siege machines.",
  breaker: "Shells burst on groups. Best against swarms on foot.",
  antitank: "Rockets that pierce armour. Best against tanks and other machines.",
  watcher: "Long sight. Reveals hidden units further than any other tower.",
  tank: "Heavy single shots, slow to reload. Strong against machines.",
  scorcher: "Short range. Sets the road on fire: best against swarms on foot.",
};
// What each tier-3 branch does, in a line.
export const BRANCH_TEXT = {
  marksman: "Much harder single shots, a little slower, 2 m more reach.",
  suppressor: "Every hit slows the target for a moment.",
  cluster: "Wider bursts that hit the crowd harder.",
  guided: "5 m more reach and a little more damage.",
  heavy: "Far heavier rockets, a little slower.",
  rapid: "Fires almost twice as fast.",
  beacon: "Marks every target it hits: it takes 25% more damage.",
  fareye: "Reveals hidden units much further, 3 m more reach.",
  breacher: "Heavier shells, even stronger against machines.",
  shrapnel: "Shells burst on everyone close to the target.",
  inferno: "The road burns much hotter.",
  firewall: "Wider fires that burn longer.",
};
// What each branch rank adds (0.24), in a line: [rank 1, rank 2].
export const RANK_TEXT = {
  marksman: ["Harder shots that pass half of a shield.", "Shots pass every shield and bite into armour; 1 m more reach."],
  suppressor: ["A stronger, longer slow.", "The slow also falls on everyone near the target; more damage."],
  cluster: ["Wider bursts.", "Wider still, and the blast hits the crowd almost as hard as the target."],
  guided: ["2 m more reach; marks the target: it takes 15% more damage.", "2 m more reach, more damage, a stronger and longer mark."],
  heavy: ["Rockets that hit machines harder.", "Harder still against machines, and more damage."],
  rapid: ["Fires in bursts of two.", "Bursts of three, a little more damage."],
  beacon: ["A stronger mark (35%) that lasts longer.", "The mark spreads to everyone near the target; more damage."],
  fareye: ["Sees 6 m further, 1 m more reach.", "Harder shots that pass half of a shield; 1 m more reach."],
  breacher: ["Thicker armour, harder against machines.", "Thicker armour again, more damage."],
  shrapnel: ["Bursts reach 1 m further; thicker armour.", "Bursts hit harder; thicker armour."],
  inferno: ["The road burns hotter; thicker armour.", "Hotter fires that last longer; thicker armour."],
  firewall: ["Fires 1 m wider; thicker armour.", "Fires that last longer, laid more often; thicker armour."],
};
// Armour squad upgrades (0.24): Rank 2, then one branch.
export const ARMOUR_TEXT = {
  rank2: "Rank 2: thicker armour, a little more damage, and the tanks mend between fights.",
  assault: "Assault: harder, faster guns, strong against machines and carriers; chases further.",
  bulwark: "Bulwark: much thicker armour and faster mending: holds the road far longer.",
};
export const PAD_NOTE = {
  ground: "Ground pad",
  rim: "Rim pad: 2 m more reach and harder hits, but the road can see it.",
  deep: "Deep pad: hidden from the road, but further from it.",
};
// Wave intel (0.22): the road a wave group walks, by route id (other ids show as they are).
export const ROUTE_LABEL = { main: "Road", west: "West bridge", ford: "Ford", east: "East bridge" };
export const FLOAT_SECONDS = 1.6; // the "+N" over a carrier lost with its squad
export const PICK_RADIUS = 26; // px: the nearest pad within this distance of a tap is picked
// Build zones (0.23): the flat paint of their open cells, and the pads a zone without `max` keeps room for.
export const ZONE_COLOR = 0xa8f0c0, ZONE_PADS = 6;
// ms after a battlefield tap during which a click at the same spot on the command card is its ghost.
export const GHOST_MS = 600;
export const BRIDGE_RADIUS = 44; // px: a tap this close to a bridge's middle picks it
// Pontoon planks: one merged mesh per pontoon, grown from the north bank while it is built.
export const PONTOON_LENGTH = 9;
// W1-F: the view button's three states, the aim modes, the phone zoom and how long a manual pan holds the follow camera.
export const VIEWS = ["follow", "overview", "free"];
export const VIEW_ICON = { follow: "crosshair", overview: "expand", free: "move" };
export const VIEW_TITLE = { follow: "View: following the wave. Tap for the whole valley.", overview: "View: the whole valley. Tap to move the camera yourself.", free: "View: free camera. Tap to follow the wave." };
export const AIM_LABEL = { near: "Nearest", first: "First", strong: "Strongest", air: "Air" };
export const AIM_TEXT = { near: "Shoots the nearest enemy.", first: "Shoots the enemy closest to the exit.", strong: "Shoots the enemy with the most health.", air: "Shoots flyers first." };
export const PHONE_ZOOM = 55, FOLLOW_HOLD_MS = 6000, CARD_MS = 6000;
