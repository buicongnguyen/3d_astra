// Deterministic ladder: three maps, four bot attack thresholds, every AI speed.
// Usage: node tools/skirmish-bench.mjs [--speeds relaxed,normal] [--maps classic] [--attack-at 12,16] [--no-points]
//   --cap 2400        seconds of game time before a match is stopped (40 minutes)
//   --json out.json   the rows without the wall-clock msPerTick, so the same ladder gives the same bytes
//   --jobs 3          plays the matches in 3 forked processes; rows are printed and saved in the
//                     single-process order (msPerTick then measures a busier machine)
//   --rules '{"roster":"expanded"}'  skirmish rules for every match (new Simulation({ rules }); round 2)
import fs from 'node:fs';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Simulation} from '../src/simulation.js';
import {PlayBot} from './playbot.mjs';
const args=process.argv.slice(2), arg=(name,fallback)=>(args.includes(name)?args[args.indexOf(name)+1]:fallback), value=(name,fallback)=>arg(name,fallback).split(',');
const CAP=Number(arg('--cap',40*60)),TICK=.05;
const RULES=args.includes('--rules')?JSON.parse(arg('--rules')):null, withRules=RULES?{rules:RULES}:{};
const JOBS=Math.max(1,Number(arg('--jobs',1))||1);
const speeds=value('--speeds','relaxed,normal,fast,relentless');

// Every match, in the order its row is printed and saved.
const matches=speeds.flatMap(speed=>value('--maps','classic,riverlands,dunes').flatMap(map=>value('--attack-at','12,16,20,24').map(Number).map(attackAt=>({speed,map,attackAt}))));
function play({speed,map,attackAt}) {
  const s=new Simulation({map,aiSpeed:speed,capturePoints:!args.includes('--no-points'),...withRules});
  const bot=new PlayBot(s,{attackAt}),t0=performance.now();let ticks=0;
  for(;ticks<CAP/TICK&&!s.result;ticks++) {
    bot.step();s.tick(TICK);
    for(const e of s.events) bot.see(e);
    s.events.length=0;
  }
  return {speed,map,attackAt,result:s.result||'timeout',seconds:Math.round(s.time),msPerTick:(performance.now()-t0)/ticks};
}
// One speed's summary line, printed after its last row.
function summary(speed,results) {
  const times=results.map(r=>r.seconds).sort((a,b)=>a-b),mid=times.length>>1;
  console.log(JSON.stringify({summary:speed,games:results.length,winRate:100*results.filter(r=>r.result==='victory').length/results.length,medianSeconds:times.length%2?times[mid]:(times[mid-1]+times[mid])/2}));
}
// Plays every match, here or in JOBS forked processes, printing rows (and each speed's summary) in
// match order as soon as every row before them is in.
async function playAll() {
  const rows=new Array(matches.length);let printed=0;
  const land=(i,row)=>{
    rows[i]=row;
    while(printed<rows.length&&rows[printed]) {
      const r=rows[printed++];console.log(JSON.stringify(r));
      if(printed===rows.length||matches[printed].speed!==r.speed) summary(r.speed,rows.slice(0,printed).filter(x=>x.speed===r.speed));
    }
  };
  if(JOBS===1){matches.forEach((m,i)=>land(i,play(m)));return rows;}
  let next=0;
  await Promise.all(Array.from({length:Math.min(JOBS,matches.length)},()=>new Promise((done,fail)=>{
    const child=fork(fileURLToPath(import.meta.url),['--worker',...args],{stdio:['ignore','inherit','inherit','ipc']});
    const send=()=>{if(next<matches.length){const i=next++;child.send({i,match:matches[i]});}else child.disconnect();};
    child.on('message',({i,row})=>{land(i,row);send();});
    child.on('exit',code=>code?fail(new Error(`bench worker exited with ${code}`)):done());
    send();
  })));
  return rows;
}

if(args.includes('--worker')) process.on('message',({i,match})=>process.send({i,row:play(match)}));
else {
  const rows=await playAll();
  if(args.includes('--json')) fs.writeFileSync(arg('--json'),JSON.stringify(rows.map(({msPerTick,...row})=>row),null,1));
}
