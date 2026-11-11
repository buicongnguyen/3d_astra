import balance from './balance.json' with {type:'json'};
export const DIFFICULTIES = ['story','standard','veteran'];
export const difficultyId = value => DIFFICULTIES.includes(value) ? value : 'standard';
export const difficultyRules = sim => balance.difficulty[sim.mission ? difficultyId(sim.difficulty) : 'standard'];
export const difficultySpeed = (speed, difficulty) => difficulty === 'veteran' ? ({relaxed:'normal',normal:'fast',fast:'fast',relentless:'relentless'}[speed] || speed) : speed;
export const DIFFICULTY_LABELS = {story:'Story',standard:'Standard',veteran:'Veteran'};
export const DIFFICULTY_DESCRIPTIONS = {story:'Smaller waves, gentler enemies and more starting alloy.',standard:'The original campaign balance.',veteran:'Larger waves, stronger enemies and faster AI.'};

export function objectiveText(objective, difficulty) {
  if (objective.type !== 'timeUnder' || difficultyId(difficulty) !== 'story') return objective.text;
  return `Finish within ${Math.round(objective.seconds * balance.difficulty.story.time)} seconds`;
}
