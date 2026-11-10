// Mission music moods ("calm", "tense", "battle"). There is no music yet: this stub only
// remembers the mood the mission asked for so a later audio task can fill it in.
let mood = "calm";
export function setMusicMood(next) {
  mood = ["calm", "tense", "battle"].includes(next) ? next : "calm";
  return mood;
}
export const musicMood = () => mood;
