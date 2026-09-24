# Heavy weapons update

Both games now have eight unit types. The existing Breaker retains its anti-infantry splash role.

| Unit | Production | HP / shield | Attack | Cost (alloy / energy) | Supply |
|---|---|---|---|---|---|
| Battle tank | Foundry level 3 | 460 / 100 | 48 per 2.2s; range 12; 40% splash within 2 m; 1.5× against Vanguards | 275 / 125 | 4 |
| Anti-tank soldier | Barracks level 2 | 90 / 20 | 20 per 2.4s; 120 against mechanical units; range 12 | 125 / 50 | 2 |

Upgrade the Command core to the matching level before upgrading production buildings. Locked training explains the required building level. Research adds 10% damage, including vehicle bonus damage. Rockets counter both tanks and Breakers; they get no bonus against infantry or buildings. Tank shells splash nearby enemies; rockets do not. The [balance review](BALANCE.md) explains the current numbers. Engineers repair tanks; Medics heal anti-tank soldiers.

The AI adds anti-tank infantry at level 2 and mixes tanks with artillery at level 3. New original Blender assets use existing materials, mesh batching and animation conventions. Initial army size is unchanged. Training actions use the existing desktop and mobile interfaces, including Godot action paging.

Validation covers counter damage, shields, cooldowns, support targeting, level gates, supply reservations, refunds, training completion, Blender imports/animations, and desktop/touch training controls. Mobile viewport checks include both production buildings. Physical Android hardware performance remains unmeasured.
