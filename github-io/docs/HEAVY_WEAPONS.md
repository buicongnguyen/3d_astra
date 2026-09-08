# Heavy weapons update

Both games now have eight unit types. The existing Breaker retains its anti-infantry splash role.

| Unit | Production | HP / shield | Attack | Cost (alloy / energy) | Supply |
|---|---|---|---|---|---|
| Battle tank | Foundry level 3 | 520 / 100 | 48 per 2.2s; range 10; single target | 275 / 125 | 4 |
| Anti-tank soldier | Barracks level 2 | 80 / 20 | 20 per 2.4s; 60 against mechanical units; range 11 | 125 / 50 | 2 |

Upgrade the Command core to the matching level before upgrading production buildings. Locked training explains the required building level. Research adds 10% damage, including vehicle bonus damage. Rockets counter both tanks and Breakers; they get no bonus against infantry or buildings. Neither new weapon deals splash damage. Engineers repair tanks; Medics heal anti-tank soldiers.

The AI adds anti-tank infantry at level 2 and mixes tanks with artillery at level 3. New original Blender assets use existing materials, mesh batching and animation conventions. Initial army size is unchanged. Training actions use the existing desktop and mobile interfaces, including Godot action paging.

Validation covers counter damage, shields, cooldowns, support targeting, level gates, supply reservations, refunds, training completion, Blender imports/animations, and desktop/touch training controls. Mobile viewport checks include both production buildings. Physical Android hardware performance remains unmeasured.
