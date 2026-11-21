// The cover's painted key art (src/art/cover/, original art for this game; provenance in
// docs/aaa/results/round3/m.md): three flat covers and the parallax layers that rebuild them.
// Placement is the art's own table: x, y, width in each frame's reference pixels (height from the image's
// aspect), back to front, and the motion amplitude (x / y in desktop reference pixels, scaled by frame width).
import coverDesktop from "../art/cover/keyart-desktop.webp";
import coverLandscape from "../art/cover/keyart-landscape.webp";
import coverPortrait from "../art/cover/keyart-portrait.webp";

export const COVERS = { desktop: coverDesktop, landscape: coverLandscape, portrait: coverPortrait };
export const FRAMES = { desktop: [2560, 1440], landscape: [1688, 780], portrait: [1170, 2532] };

// Only the layers' URLs are in the bundle; their bytes are fetched lazily by app/cover.js.
const FILES = import.meta.glob("../art/cover/layer-*.webp", { query: "?url", import: "default", eager: true });
export const layerUrl = (name) => FILES[`../art/cover/layer-${name}.webp`];

// [name, aspect (w/h), desktop [x, y, w], landscape, portrait, motion [x, y], kind]
export const LAYERS = [
  ["stars", 1672 / 941, [0, 0, 2560], [0, -65, 1688], [0, 0, 1170], [1, 0.5], "stars"],
  ["sun-amber", 370 / 369, [76, 65, 148], [45, 25, 92], [57, 86, 116], [2, 1], "sun"],
  ["sun-silver", 232 / 228, [227, 95, 63], [145, 52, 39], [184, 137, 56], [2, 1], "sun"],
  ["planet-ember", 440 / 445, [1608, 462, 118], [1085, 201, 66], [819, 625, 89], [3, 1], "planet"],
  ["planet-dunes", 590 / 593, [1883, 127, 147], [602, 319, 87], [41, 684, 118], [4, 2], "planet"],
  ["planet-ringed-river", 1536 / 1024, [5, 253, 1180], [3, 113, 691], [-95, 777, 1100], [7, 3], "planet"],
  ["planet-storm", 950 / 946, [2125, 40, 419], [1440, 13, 223], [871, 224, 275], [5, 2], "planet"],
  ["ships-balloon", 305 / 427, [1001, 661, 57], [655, 337, 35], [954, 1308, 66], [8, 3], "ship"],
  ["ships-glider", 400 / 267, [799, 875, 99], [573, 464, 70], [456, 1401, 98], [9, 4], "ship"],
  ["ships-rotor", 440 / 277, [1975, 305, 91], [1255, 126, 61], [1045, 1464, 60], [8, 3], "ship"],
  ["ships-dropship", 550 / 506, [1105, 784, 178], [772, 380, 104], [649, 1335, 164], [10, 4], "ship"],
  ["storm-horizon", 1920 / 244, [-45, 1114, 2650], [-36, 564, 1760], [-180, 2302, 1920], [5, 2], "horizon"],
  ["foreground-squad", 1536 / 1024, [1004, 434, 1568], [756, 169, 946], [335, 1970, 865], [8, 3], "squad"],
  ["ranger-flash", 1536 / 1024, [1004, 434, 1568], [756, 169, 946], [335, 1970, 865], [8, 3], "flash"],
];
export const SHAPES = ["desktop", "landscape", "portrait"];

// The worlds, for labels and battle flashes: centre and radius as fractions of the layer box.
export const WORLDS = {
  "planet-ringed-river": { id: "riverlands", cx: 0.5, cy: 0.5, r: 0.31 },
  "planet-dunes": { id: "dunes", cx: 0.5, cy: 0.5, r: 0.44 },
  "planet-ember": { id: "highlands", cx: 0.5, cy: 0.5, r: 0.44 },
  "planet-storm": { id: "storm", cx: 0.5, cy: 0.5, r: 0.44 },
};

// Reserved darker areas of each cover (percent of the frame): the live title and the menu.
export const UI_AREAS = {
  desktop: { title: [33, 71, 6, 23], menu: [4, 27, 73, 89] },
  landscape: { title: [36, 72, 6, 24], menu: [4, 29, 73, 89] },
  portrait: { title: [17, 72, 8, 25], menu: [4, 27, 67, 94] },
};

// A layer's box in frame pixels for a shape: [x, y, w, h].
export function layerBox(layer, shape) {
  const [x, y, w] = layer[2 + SHAPES.indexOf(shape)];
  return [x, y, w, w / layer[1]];
}
