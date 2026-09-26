# Guided training mission implementation plan

## Evaluation

A short, optional hands-on mission is a good fit for this RTS. The existing units, production queues and desktop/touch controls give new players several systems to learn at once. A safe mission can teach those actions without the pressure of an AI attack.

Use one focused instruction at a time, a visible destination/target marker, and a Focus button. A separate Training entry at the beginning keeps established campaign saves and skirmish settings intact. Players can leave, restart or replay training; campaign access never depends on it.

## First release — both Three.js and Godot

1. Select a Harvester.
2. Move it to the marked position using a normal move order.
3. Gather at least 10 alloy from the highlighted deposit. Explain automatic cargo return.
4. Complete a Supply relay, introducing supply and building placement.
5. Train a new Ranger at the Barracks, introducing the production queue.
6. Attack the stationary practice target and land a hit.
7. Use Move to withdraw a combat unit to a safe marker, teaching combat override and micro control.
8. Return and destroy the weakened target to finish training.

The training map uses Ashen Frontier, one inactive opposing headquarters and no hostile units or AI production. Training supplies are replenished and labeled as such. The practice target appears only for the combat lesson, cannot attack, and has enough health to survive the withdrawal lesson.

## Implementation

- Store lesson titles and desktop/touch instructions in shared JSON copied to both repositories.
- Keep each engine's tutorial controller separate from normal match simulation. Track real selections, travel, deposit depletion, completed buildings, completed production and damage; elapsed time or opening a menu must not complete a lesson.
- Observe construction/production completed early so players do not repeat those actions unnecessarily.
- Require a new movement order during the withdrawal lesson; pre-positioned units do not count.
- Use a compact collapsible instruction panel, Focus target and Leave training. Keep existing controls available.
- Completion offers the campaign menu and replay. Save completion locally when storage is available; do not unlock campaign stages or overwrite campaign progress.
- Restart clears training progress; leaving removes training markers and restores ordinary match rules.

## Review and acceptance

- Unit/headless tests cover every transition, early actions, disabled AI, withdrawal requiring movement, target setup, completion, restart and normal-game isolation.
- Browser tests exercise the visible entry and controls on desktop and narrow/mobile layouts. Inspect markers and avoid clipped buttons.
- Run the existing regression/build workflow, commit and publish both editions, and verify successful deployment.

## Later lessons

Add optional advanced drills for patrol, attack-move, repairs/healers, anti-tank matchups, rally points, building upgrades, control groups and multi-front battles. Keep them separate so the introductory mission remains short.
