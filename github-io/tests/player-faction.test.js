// 0.16 item 16.1: choose your army in Skirmish. The player's faction is team 0; Mirror means the
// player's faction, Mixed leaves it out, saves remember both, and the test bot plays any roster.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { FACTION_RULES, PLAYER_FACTIONS, ENEMY_FACTIONS, skirmishFactions, skirmishSides, enemyFactionOf, playerFactionOf, matchLook, openingLine, victoryLine } from "../src/factions.js";
import { defaults, normalize, PLAYER_FACTION_IDS } from "../src/settings.js";
import { skirmishResultHTML } from "../src/results-ui.js";
import { translate } from "../src/i18n.js";
import { PlayBot } from "../tools/playbot.mjs";
import { readFileSync } from "node:fs";
import { clientFile, functionBody } from "./lib/client-source.js";

const FACTIONS = Object.keys(PLAYER_FACTIONS);

test("the picker offers the five factions, the same ones the rules and settings know", () => {
  assert.deepEqual(FACTIONS, Object.keys(FACTION_RULES));
  assert.deepEqual(PLAYER_FACTION_IDS, FACTIONS);
  for (const id of FACTIONS) assert.ok(Object.hasOwn(ENEMY_FACTIONS, id), `${id} can also be the enemy`);
  assert.equal(defaults().playerFaction, "meridian");
  assert.equal(normalize({ ...defaults(), playerFaction: "veil" }).playerFaction, "veil");
  assert.equal(normalize({ ...defaults(), playerFaction: "nobody" }).playerFaction, "meridian");
  assert.equal(normalize({ version: 1 }).playerFaction, "meridian", "older settings get Meridian");
});

test("each faction can start a skirmish as team 0 with its own base, roster and building", () => {
  for (const faction of FACTIONS) {
    const s = new Simulation({ ai: false, map: "riverlands", factions: skirmishSides(faction, "mirror", 1, "riverlands") });
    assert.equal(s.factions[0], faction);
    assert.equal(playerFactionOf(s), faction);
    const own = s.own(0);
    assert.ok(own.some((e) => e.type === "hq") && own.some((e) => e.type === "barracks"), `${faction}: core and barracks`);
    assert.equal(own.filter((e) => e.type === "worker").length, 4, `${faction}: four Harvesters`);
    // Starting soldiers and training lists come from the faction's roster.
    const roster = s.unitRoster(0);
    for (const e of own.filter((u) => u.kind === "unit")) assert.ok(roster.includes(e.type), `${faction}: starts with ${e.type}`);
    const barracks = own.find((e) => e.type === "barracks");
    for (const type of barracks.trains) assert.ok(roster.includes(type), `${faction}: barracks trains ${type}`);
    for (const [slot, type] of Object.entries(FACTION_RULES[faction].swap)) {
      assert.equal(s.typeFor(0, slot), type);
      assert.ok(!roster.includes(slot), `${faction}: no ${slot}`);
    }
    for (const slot of FACTION_RULES[faction].exclude || []) assert.ok(!roster.includes(slot), `${faction}: excludes ${slot}`);
    // The build menu (hud.js lists sim.buildable(0)) includes the faction's own building, and it can be placed.
    const extra = FACTION_RULES[faction].building;
    assert.equal(s.buildable(0).includes(extra), !!extra, `${faction}: building ${extra}`);
    if (extra) assert.notEqual(s.placement(extra, 0, 1e9, 1e9), "Invalid structure.");
    for (const other of FACTIONS.filter((f) => f !== faction && FACTION_RULES[f].building)) assert.ok(!s.buildable(0).includes(FACTION_RULES[other].building));
    // Training works through the command layer, and a foreign unit is refused.
    s.players[0].alloy = s.players[0].energy = 10000;
    const mine = s.typeFor(0, "ranger");
    assert.equal(s.command({ team: 0, type: "train", building: barracks.id, unit: mine }), true, `${faction}: trains ${mine}`);
    const foreign = faction === "veil" ? "scrapper" : "shade";
    assert.equal(s.command({ team: 0, type: "train", building: barracks.id, unit: foreign }), false, `${faction}: refuses ${foreign}`);
    // The opening line names the player's side; a save keeps the faction.
    assert.equal(s.events.find((e) => e.type === "message")?.text, openingLine(faction));
    const restored = Simulation.load(s.serialize());
    assert.equal(restored.factions[0], faction);
    assert.equal(restored.hash(), s.hash());
  }
});

test("Mirror means the player's faction and Mixed leaves the player's faction out", () => {
  // Meridian keeps the old behaviour exactly: Mirror is all Meridian (null: nothing extra saved).
  assert.equal(skirmishFactions("mirror", 2, "riverlands"), null);
  assert.equal(skirmishFactions("mirror", 2, "riverlands", "meridian"), null);
  assert.deepEqual(skirmishFactions("mixed", 3, "riverlands"), skirmishFactions("mixed", 3, "riverlands", "meridian"));
  for (const player of FACTIONS) {
    // Rivals left out are Meridian (normalizedFactions), so an all-Meridian match stores nothing extra.
    const mirror = new Simulation({ ai: false, enemyCount: 3, factions: skirmishSides(player, "mirror", 3, "dunes") }).factions;
    assert.deepEqual(mirror, { 0: player, 1: player, 2: player, 3: player });
    for (const map of ["classic", "riverlands", "dunes", "basin"]) {
      const mixed = skirmishSides(player, "mixed", 3, map), rivals = [1, 2, 3].map((t) => mixed[t]);
      assert.equal(mixed[0], player);
      assert.ok(!rivals.includes(player), `${player} on ${map}: Mixed leaves the player's faction out (${rivals})`);
      assert.equal(new Set(rivals).size, 3, "three different rivals");
      assert.ok(rivals.every((id) => Object.hasOwn(FACTION_RULES, id)));
    }
    // A named enemy is that faction, Meridian included.
    assert.deepEqual(new Simulation({ ai: false, factions: skirmishSides(player, "meridian", 1, "classic") }).factions, { 0: player, 1: "meridian" });
    assert.deepEqual(skirmishSides(player, "wardens", 2, "classic"), { 0: player, 1: "wardens", 2: "wardens" });
    assert.deepEqual(skirmishSides(player, "nonsense", 1, "classic"), skirmishSides(player, "mirror", 1, "classic"));
  }
});

test("a loaded skirmish gives back both choices", () => {
  const cases = [["meridian", "mirror", 1], ["meridian", "veil", 1], ["meridian", "mixed", 2], ["ashfall", "mirror", 1], ["ashfall", "meridian", 1], ["wardens", "mixed", 3], ["veil", "sunward", 2]];
  for (const [player, enemy, count] of cases) {
    const s = new Simulation({ ai: false, map: "classic", enemyCount: count, factions: skirmishSides(player, enemy, count, "classic") });
    const back = Simulation.load(s.serialize());
    assert.equal(playerFactionOf(back), player, `${player}/${enemy}`);
    assert.equal(enemyFactionOf(back), enemy, `${player}/${enemy}`);
  }
  // Colours and emblems follow the match whenever any side is not Meridian, team 0 included.
  const s = new Simulation({ ai: false, factions: skirmishSides("sunward", "mirror", 1) });
  assert.deepEqual(matchLook(null, s), { factions: { 0: "sunward", 1: "sunward" } });
  assert.equal(matchLook(null, new Simulation({ ai: false })), null);
});

test("the all-Meridian hash holds when team 0 is named Meridian explicitly", () => {
  const s = new Simulation({ ai: false, factions: skirmishSides("meridian", "mirror", 1, "classic") });
  for (let i = 0; i < 1200; i++) s.tick(0.05);
  assert.equal(s.hash(), "d071360b");
});

test("the test bot trains each faction's own units through roster slots", () => {
  for (const faction of ["ashfall", "sunward", "wardens", "veil"]) {
    const s = new Simulation({ ai: false, map: "riverlands", factions: { 0: faction } }), bot = new PlayBot(s);
    const tried = [], command = s.command.bind(s);
    s.command = (c) => { if (c.type === "train") tried.push(c.unit); return command(c); };
    while (s.time < 300) { bot.step(); s.tick(0.05); s.events.length = 0; }
    const roster = s.unitRoster(0), trained = new Set(tried);
    for (const type of trained) assert.ok(roster.includes(type), `${faction}: the bot asked for ${type}`);
    const signature = { ashfall: "scrapper", sunward: "rider", wardens: "drone", veil: "shade" }[faction];
    assert.ok(trained.has(signature), `${faction}: the bot trains ${signature} (${[...trained]})`);
    assert.ok(s.own(0).some((e) => e.type === signature), `${faction}: ${signature} on the field`);
  }
});

test("lines that named Meridian now name the player's side, in English and Vietnamese", () => {
  assert.equal(openingLine("meridian"), "Meridian is online. Assign Harvesters to the amber alloy deposits.");
  assert.equal(victoryLine("meridian"), "Enemy command has been eliminated. Meridian holds the valley.");
  for (const id of ["ashfall", "sunward", "wardens", "veil"]) {
    assert.doesNotMatch(openingLine(id), /Meridian/);
    assert.doesNotMatch(victoryLine(id), /Meridian/);
    for (const line of [openingLine(id), victoryLine(id)]) assert.notEqual(translate(line, "vi"), line, `Vietnamese for: ${line}`);
  }
  const html = skirmishResultHTML({ result: "victory", seconds: 60, stats: {}, emblem: "", arrow: "", faction: "veil" });
  assert.match(html, /Veil command holds the valley/);
});

test("client: the picker is wired to the setup, settings, saves, emblem and Training", () => {
  const shell = clientFile("shell.js"), briefing = clientFile("briefing.js"), flow = clientFile("match-flow.js");
  assert.match(shell, /id="player-faction"/);
  // Training and the campaign always command Meridian.
  const setup = functionBody(briefing, "battleSetup");
  assert.match(setup, /training[\s\S]*playerFaction:"meridian"/);
  assert.match(setup, /mission: m, faction: "mirror", playerFaction: "meridian"/);
  assert.match(setup, /playerFaction: \$\("player-faction"\)\.value/);
  assert.match(briefing, /settings\.playerFaction = \$\("player-faction"\)\.value;\s*saveSettings/);
  assert.match(flow, /playerFaction = mission \? "meridian" : playerFactionOf\(sim\)/);
  assert.match(clientFile("main.js", { plain: false }), /S\.mission \|\| S\.playMode !== "skirmish" \? null : skirmishSides\(S\.playerFaction/);
  assert.match(readFileSync(new URL("../src/view.js", import.meta.url), "utf8"), /factionOf\(this\.mission, e\.team\)\?\.id \|\| \(e\.team === 0 \? "meridian"/);
});
