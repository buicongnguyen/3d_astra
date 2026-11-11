// Deterministic ladder: three maps, four bot attack thresholds, every AI speed.
// Usage: node tools/skirmish-bench.mjs [--speeds relaxed,normal] [--maps classic]
import {Simulation} from '../src/simulation.js';
import {PlayBot} from './playbot.mjs';
const args=process.argv.slice(2), value=(name,fallback)=>(args.includes(name)?args[args.indexOf(name)+1]:fallback).split(',');
const CAP=40*60,TICK=.05;
for(const speed of value('--speeds','relaxed,normal,fast,relentless')) {
  const results=[];
  for(const map of value('--maps','classic,riverlands,dunes')) for(const attackAt of value('--attack-at','12,16,20,24').map(Number)) {
    const s=new Simulation({map,aiSpeed:speed,capturePoints:!args.includes('--no-points')});
    const bot=new PlayBot(s,{attackAt}),t0=performance.now();let ticks=0;
    for(;ticks<CAP/TICK&&!s.result;ticks++) {
      bot.step();s.tick(TICK);
      for(const e of s.events) bot.see(e);
      s.events.length=0;
    }
    const result={speed,map,attackAt,result:s.result||'timeout',seconds:Math.round(s.time),msPerTick:(performance.now()-t0)/ticks};
    results.push(result);console.log(JSON.stringify(result));
  }
  const times=results.map(r=>r.seconds).sort((a,b)=>a-b),mid=times.length>>1;
  console.log(JSON.stringify({summary:speed,games:results.length,winRate:100*results.filter(r=>r.result==='victory').length/results.length,medianSeconds:times.length%2?times[mid]:(times[mid-1]+times[mid])/2}));
}
