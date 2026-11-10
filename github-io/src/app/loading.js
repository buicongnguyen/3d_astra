// Staged loading of the 3D models: the files come in a fixed order (terrain, headquarters and
// harvester first, because every opening needs them), with a byte-true percentage and the name of
// the part being fetched. Each file is handed to three.js' own cache, so WorldView.loadModels
// (which still parses and retries by itself) finds the bytes there instead of downloading again.
import { Cache } from "three";
import { DEFINITIONS } from "../data.js";

const FIRST = ["environment", "hq", "worker"];

// The files WorldView.loadModels asks for, in the order to fetch them.
export function modelPlan() {
  const types = Object.keys(DEFINITIONS).filter((key) => DEFINITIONS[key].role !== "Research");
  const names = [...new Set([...FIRST, ...types, "environment"])];
  return names.map((name) => ({ name, label: name === "environment" ? "terrain" : DEFINITIONS[name]?.name || name, url: `${import.meta.env.BASE_URL}models/${name}.glb` }));
}

// Fetches every model with a small number of parallel streams and reports stage and percent.
// Never throws: a file that fails here is simply downloaded (and retried) by loadModels.
export async function prefetchModels(onProgress, { concurrency = 6 } = {}) {
  const plan = modelPlan();
  Cache.enabled = true;
  const sizes = new Map(), got = new Map();
  let stage = plan[0].label;
  const report = () => {
    let total = 0, done = 0;
    for (const item of plan) { total += sizes.get(item.name) || 400000; done += got.get(item.name) || 0; }
    onProgress?.({ stage, percent: Math.min(99, Math.floor((done / total) * 100)) });
  };
  report();
  let next = 0;
  async function worker() {
    while (next < plan.length) {
      const item = plan[next++];
      stage = item.label;
      try {
        const response = await fetch(item.url);
        if (!response.ok) continue;
        const length = Number(response.headers.get("content-length")) || 0;
        if (length) sizes.set(item.name, length);
        const reader = response.body?.getReader();
        if (!reader) {
          Cache.add(`file:${item.url}`, await response.arrayBuffer());
          got.set(item.name, sizes.get(item.name) || 400000);
          report();
          continue;
        }
        const chunks = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          size += value.length;
          got.set(item.name, size);
          report();
        }
        sizes.set(item.name, size);
        const buffer = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
        Cache.add(`file:${item.url}`, buffer.buffer);
      } catch {
        /* loadModels fetches and retries what is missing. */
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, plan.length) }, worker));
  onProgress?.({ stage: "scene", percent: 100 });
}

// The parsed models are held by the view; the raw copies are not needed any more.
export function releaseModelBytes() {
  Cache.clear();
  modelsLoaded = true;
  dispatchEvent(new Event("fc-models-loaded"));
}
let modelsLoaded = false;
export const areModelsLoaded = () => modelsLoaded;
