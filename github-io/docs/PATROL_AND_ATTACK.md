# Patrol and Harvester Attack

Both editions use the same command rules and PC shortcuts. On mobile, use the named command buttons and then tap the battlefield. In Three.js, these buttons are in the **Selection** tab; Godot shows them in its action panel.

| Command | Shortcut | Behavior |
| --- | --- | --- |
| Patrol | **P**, then choose a destination | Vanguard, Ranger, Breaker, Battle tank and Anti-tank soldier repeat a route between their starting position and the chosen point. They stop to fire at visible enemies within weapon range and with a clear line of fire, then resume the route. |
| Attack | **N**, then choose an enemy | Harvesters can attack a visible enemy unit or building. N also works for other armed units. Friendly units, resources and empty ground are not attack targets. |
| Move / withdraw | **M**, then choose ground | Immediately replaces Patrol or Attack and lets units retreat. |
| Stop | **X** | Cancels the current route and queued orders. Combat units retain their normal idle defense. |

Harvesters retain their existing 4 damage per hit, one-second cooldown and short range. They keep carried resources when ordered to fight. They do not abandon mining to attack automatically; assign them to a deposit again when you want them to resume gathering.

Use Shift on PC, or enable Queue on mobile, to append orders. A patrol queued after movement starts from the position reached when it becomes active. An order appended behind an active patrol takes over at the next patrol endpoint. An ordinary Move, Attack or Stop replaces the loop immediately. Unreachable routes use the normal pathfinding warning and clear the blocked order.

**N** avoids the existing **A** camera-pan binding. **P** is dedicated to Patrol. Both are included in the in-game shortcut guide.
