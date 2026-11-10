// One autosave slot for the match in progress, kept in this browser only.
// localStorage 'frontier-save-v1' = JSON { at, mode, missionId, text } where `text` is
// sim.serialize(). Training is never saved; a finished match deletes the slot.
export const SAVE_KEY = "frontier-save-v1";
export const AUTOSAVE_SECONDS = 30;
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };

// Returns true when the slot was written. A full or blocked storage fails silently.
export function writeSave({ mode, missionId = null, sim }, store = storage()) {
  if (!sim || sim.result || mode === "training") return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), mode, missionId, text: sim.serialize() }));
    return true;
  } catch {
    return false;
  }
}
export function clearSave(store = storage()) {
  try { store?.removeItem(SAVE_KEY); } catch { /* storage is optional */ }
}
// The stored save with a short summary for the Continue button, or null when there is none
// or it is not one this version wrote.
export function readSave(store = storage()) {
  try {
    const save = JSON.parse(store?.getItem(SAVE_KEY) || "null");
    if (!save || typeof save.text !== "string" || !["skirmish", "campaign"].includes(save.mode)) return null;
    const data = JSON.parse(save.text);
    const time = data?.state?.time, map = data?.options?.map;
    if (!Number.isFinite(time) || typeof map !== "string") return null;
    return { at: Number(save.at) || 0, mode: save.mode, missionId: save.missionId ?? null, text: save.text, time, map };
  } catch {
    return null;
  }
}
