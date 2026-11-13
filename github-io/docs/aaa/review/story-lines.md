# Story lines for review: 0.19a "Choices"

Every new line of release 0.19a (decisions, endings, campaign map), in English and Vietnamese, for the owner to read before release. Generated from `src/story/missions.js`, `src/story/choices.js`, `src/story/campaign-map.js` and `src/locales/story-vi.json`; the data wins if they differ. Rules: `docs/aaa/PLAN_ROUND3_REFINED_2026-11-13.md`, section 2. Voices: `docs/WORLD.md`, "How they speak". The Commander never speaks; choices are orders.

No existing line was removed: each one kept today's words as the firm (default) branch, so a player who answers every decision the default way hears the campaign as before, except in the finale, whose closing lines follow the ending.

## What each answer does in play

| Decision | Merciful | Firm (default) |
|---|---|---|
| m03-alloy (mission 3, at the north siphon) | Return the alloy: nothing now; in mission 7 Hale's 7:00 wave from the west pass comes without its Breaker | Keep it: +300 alloy now; mission 7 as before |
| m05-pact (mission 5, on the north road) | Share the forest relay: Sol's ambush is 2 Vanguards instead of 6 units; in mission 9 Sol greets you differently | Drive them off: the full ambush, +200 alloy; mission 9 as before |
| m10-veil (mission 10, when a damper is half broken) | Let the crews stand down: the Veil sends no wave to the Crown; in mission 12 Maren stands down with a different line | Break the dampers: +150 energy; mission 12 as before |

Mission 9's consequence is words only: two more Riders, +200 alloy or one probe fewer each turned the objective bot's win into a defeat. Two or more merciful answers lead to "The Open Frontier", fewer to "The Meridian Line"; the finale's last objective, its closing line and its debrief follow the ending.

## The three decisions

### m03-alloy · mission 3, The Ashen Line

Asked by Tobi Okoro.

| Where | Who | English | Vietnamese |
|---|---|---|---|
| prompt | Tobi Okoro | Commander, this siphon sits on a store of alloy, packed and labelled for the sleeper fleet. What do we do with it? | Thưa Chỉ huy, trạm hút này nằm trên một kho hợp kim, đã đóng gói và dán nhãn gửi hạm đội ngủ đông. Ta làm gì với nó? |
| order return (merciful) | Commander | Return the alloy to Ashfall's scavengers | Trả hợp kim cho đội nhặt nhạnh của Ashfall |
| consequence return | — | Nothing for us now. Hale will remember it. | Lúc này ta không được gì. Hale sẽ nhớ điều đó. |
| order keep (firm, default) | Commander | Keep the alloy for the expedition | Giữ hợp kim cho đoàn viễn chinh |
| consequence keep | — | +300 alloy now. Ashfall goes without. | +300 hợp kim ngay. Ashfall phải chịu thiếu. |

Lines that follow the answer:

| Where | Who | English | Vietnamese |
|---|---|---|---|
| m03-the-ashen-line: trigger (enter siphonNorth, team 0), if return | Corvin Hale | Received, Commander. Forty thousand people will sleep warmer tonight. I will note the courtesy. | Đã nhận, thưa Chỉ huy. Đêm nay bốn mươi nghìn người sẽ ngủ ấm hơn. Tôi sẽ ghi nhận sự tử tế này. |
| m03-the-ashen-line: trigger (enter siphonNorth, team 0), if keep | Mira Vale | Three hundred alloy, loaded. Hale will count that loss, Commander. So will his sleepers. | Ba trăm hợp kim, đã chất lên xe. Hale sẽ đếm khoản mất mát đó, thưa Chỉ huy. Những người ngủ đông của ông ta cũng vậy. |
| m07-copper-siege: trigger (time 420), if keep | Corvin Hale | I have seen it. It changes nothing. I need the power tonight, not the truth. | Tôi xem rồi. Nó chẳng thay đổi gì. Tôi cần năng lượng ngay đêm nay, không cần sự thật. |
| m07-copper-siege: trigger (time 420), if return | Corvin Hale | I have seen it. You returned our alloy on the Ashen Line, so I send fewer guns tonight. Not none. | Tôi đã xem. Các vị đã trả lại hợp kim cho chúng tôi ở Phòng tuyến Tro Tàn, nên đêm nay tôi gửi ít súng hơn. Nhưng không phải là không có. |

### m05-pact · mission 5, The Verdant Pact

Asked by Tamsin Sol.

| Where | Who | English | Vietnamese |
|---|---|---|---|
| prompt | Tamsin Sol | Give me a reason not to fight, Commander. Will Meridian share the forest relay's light with the Caravan? | Hãy cho tôi một lý do để không đánh, thưa Chỉ huy. Meridian có chia ánh sáng của trạm trong rừng cho Đoàn Lữ hành không? |
| order share (merciful) | Commander | Offer Sunward a share of the forest relay | Đề nghị chia cho Sunward một phần trạm trong rừng |
| consequence share | — | Sol holds most of her riders back. The relay's power is shared. | Sol giữ lại phần lớn kỵ binh. Năng lượng của trạm được chia sẻ. |
| order drive (firm, default) | Commander | Drive the Caravan off the forest road | Đuổi Đoàn Lữ hành khỏi con đường rừng |
| consequence drive | — | A full fight now. The relay stores pay +200 alloy. | Một trận đánh trọn vẹn ngay bây giờ. Kho của trạm trả +200 hợp kim. |

Lines that follow the answer:

| Where | Who | English | Vietnamese |
|---|---|---|---|
| m05-the-verdant-pact: trigger (enter northRoad, team 0), if drive | Mira Vale | Then the road is ours by force. The Caravan's relay stores are ours too: two hundred alloy. | Vậy thì ta giành con đường bằng sức mạnh. Kho ở trạm của Đoàn Lữ hành cũng về tay ta: hai trăm hợp kim. |
| m05-the-verdant-pact: trigger (enter northRoad, team 0), if share | Tamsin Sol | A fair offer, and I remember fair offers. Two riders for the Pact's sake. The rest go home. | Một lời đề nghị công bằng, và tôi nhớ những lời đề nghị công bằng. Hai kỵ binh vì thể diện của Hiệp ước. Số còn lại về nhà. |
| m09-a-debt-in-the-dunes: trigger (objective link, is done), if drive | Tamsin Sol | You came. You warned me and I did not listen. The Caravan pays its debts. We ride with you. | Anh đã đến. Anh đã cảnh báo mà tôi không nghe. Đoàn Lữ hành có nợ thì trả. Chúng tôi sẽ đi cùng anh. |
| m09-a-debt-in-the-dunes: trigger (objective link, is done), if share | Tamsin Sol | You came. You shared the forest light when you did not have to. The Caravan pays its debts twice. | Anh đã đến. Anh đã chia ánh sáng của rừng khi không buộc phải làm thế. Đoàn Lữ hành trả nợ gấp đôi. |

### m10-veil · mission 10, Obsidian Storm

Asked by Ilse Maren.

| Where | Who | English | Vietnamese |
|---|---|---|---|
| prompt | Ilse Maren | My crews are still inside the dampers, Commander. Will you let them walk out before you break the rest? | Các tổ của tôi vẫn còn trong các máy triệt năng, thưa Chỉ huy. Các vị có để họ rời đi trước khi phá nốt không? |
| order spare (merciful) | Commander | Let the Survey crews stand down | Để các tổ Khảo sát rút lui |
| consequence spare | — | The Veil sends no troops to the Crown. | Veil không gửi quân tới Vương Miện. |
| order break (firm, default) | Commander | Break the dampers now | Phá các máy triệt năng ngay |
| consequence break | — | +150 energy from the damper stores. The Veil fights on. | +150 năng lượng từ kho của máy triệt năng. Veil tiếp tục chiến đấu. |

Lines that follow the answer:

| Where | Who | English | Vietnamese |
|---|---|---|---|
| m10-obsidian-storm: trigger (tagHpBelow {"tag":"damper","percent":50}), if spare | Ilse Maren | Thank you. My crews are walking out now. I will remember who opened the door. | Cảm ơn. Các tổ của tôi đang rời đi. Tôi sẽ nhớ ai đã mở cửa. |
| m10-obsidian-storm: trigger (tagHpBelow {"tag":"damper","percent":50}), if break | Ilse Maren | Then I cannot stop you. I can only ask the sky to stay clear. | Vậy thì tôi không thể ngăn các vị. Tôi chỉ có thể cầu xin bầu trời giữ quang đãng. |
| m12-frontiers-end: trigger (tagHpBelow {"tag":"engine","percent":50}), if break | Ilse Maren | I watched the Crown light without a storm. All Veil commands: stand down. I was wrong. | Tôi đã thấy Vương Miện sáng lên mà không có bão. Mọi đơn vị Veil: hạ vũ khí. Tôi đã sai. |
| m12-frontiers-end: trigger (tagHpBelow {"tag":"engine","percent":50}), if spare | Ilse Maren | You let my crews walk out of the dampers. Now I walk out of this war. All Veil commands: stand down. | Các vị đã để các tổ của tôi rời khỏi máy triệt năng. Giờ tôi rời khỏi cuộc chiến này. Mọi đơn vị Veil: hạ vũ khí. |

## The finale by ending (mission 12)

| Where | Who | English | Vietnamese |
|---|---|---|---|
| objective engine, ending meridian-line | — | Destroy the Keystone draw engine | Phá cỗ máy rút năng lượng Then Chốt |
| objective engine, ending open-frontier | — | Destroy the draw engine and open the Keystone to every camp | Phá cỗ máy rút năng lượng và mở Then Chốt cho mọi trại |
| trigger (objective engine, is done), ending meridian-line | ECHO | The engine is silent. Tuning the Keystone. One hundred and eight relays are answering. | Cỗ máy đã im. Đang điều hưởng Then Chốt. Một trăm lẻ tám trạm đang đáp lời. |
| trigger (objective engine, is done), ending open-frontier | ECHO | The engine is silent. Tuning the Keystone for every camp. One hundred and eight relays are answering. | Cỗ máy đã im. Đang điều hưởng Then Chốt cho mọi trại. Một trăm lẻ tám trạm đang đáp lời. |
| debrief win, ending meridian-line | Mira Vale | Meridian holds the Keystone now. The first beam goes up to the Ashfall fleet tonight, on our schedule. | Giờ Meridian giữ Then Chốt. Chùm tia đầu tiên sẽ phóng lên hạm đội Ashfall đêm nay, theo lịch của chúng ta. |
| debrief win, ending meridian-line | Corvin Hale | Forty thousand, fed by a camp that is not mine. I am grateful, Commander. I am also watching. | Bốn mươi nghìn người, được nuôi bởi một trại không phải của tôi. Tôi biết ơn, thưa Chỉ huy. Tôi cũng đang dõi theo. |
| debrief win, ending open-frontier | Mira Vale | First beam is going up to the Ashfall fleet now, Director. Your sleepers will wake to a living world. | Chùm tia đầu tiên đang phóng lên hạm đội Ashfall, thưa Giám đốc. Những người ngủ đông của ông sẽ thức dậy giữa một thế giới sống. |
| debrief win, ending open-frontier | Corvin Hale | Forty thousand. All of them. I did not think to count on strangers. I will not forget it. | Bốn mươi nghìn người. Tất cả. Tôi đã không nghĩ đến chuyện trông cậy vào người lạ. Tôi sẽ không quên điều này. |
| debrief win, ending open-frontier | Tamsin Sol | Every camp at one table. Bring your own cup, Commander. The Caravan brings the water. | Mọi trại cùng một bàn. Chỉ huy hãy mang cốc của mình. Đoàn Lữ hành mang nước. |

## Epilogue cards

### The Open Frontier (open-frontier)

| Where | Who | English | Vietnamese |
|---|---|---|---|
| title | — | The Open Frontier | Biên cương Rộng mở |
| summary | — | The Keystone is shared, and the four camps sign a truce. | Then Chốt được chia sẻ, và bốn trại ký hiệp định đình chiến. |
| card | Mira Vale | The truce was signed at the Keystone, on a supply crate, by four camps. | Hiệp định đình chiến được bốn trại ký tại Then Chốt, trên một thùng tiếp tế. |
| card | Mira Vale | Every camp draws from the same circuit now. I count the settlers each week, and the number keeps rising. | Giờ mọi trại cùng lấy năng lượng từ một mạch. Tuần nào tôi cũng đếm người định cư, và con số cứ tăng lên. |
| card | Tamsin Sol | The roads are open from the dunes to the river, and the wells are full again. | Đường đã mở từ đồi cát tới sông, và giếng lại đầy nước. |
| card | Tamsin Sol | Meridian ate at my table, as promised. A debt paid well makes a friend, Commander. | Meridian đã dùng bữa tại bàn của tôi, như đã hứa. Một món nợ trả tử tế sẽ thành một người bạn, thưa Chỉ huy. |
| card | Corvin Hale | The fleet wakes in turns: two thousand sleepers each month, on schedule. | Hạm đội thức dậy theo lượt: mỗi tháng hai nghìn người ngủ đông, đúng lịch. |
| card | Corvin Hale | I signed the truce with a pen I did not trust. I was wrong about strangers, and I have written that down. | Tôi ký hiệp định bằng một cây bút mà tôi không tin. Tôi đã sai về những người xa lạ, và tôi đã ghi điều đó lại. |
| card | Ilse Maren | The Veil has opened the highlands again. Our new records are of storms that never came. | Veil đã mở lại cao nguyên. Những ghi chép mới của chúng tôi là về những cơn bão không bao giờ đến. |
| card | Ilse Maren | Each year, at the Crown, we read the names of the friends we lost. Nobody is afraid of the light there now. | Mỗi năm, tại Vương Miện, chúng tôi đọc tên những người bạn đã mất. Giờ ở đó không ai còn sợ ánh sáng. |
| card | ECHO | One hundred and eight relays, all awake, all in tune. I have counted them twice. | Một trăm lẻ tám trạm, tất cả đã thức, tất cả hòa nhịp. Tôi đã đếm hai lần. |
| card | ECHO | I have chosen a name, Commander. Visit me, and I will tell you what it is. | Tôi đã chọn một cái tên, thưa Chỉ huy. Hãy đến thăm tôi, tôi sẽ cho biết đó là tên gì. |

### The Meridian Line (meridian-line)

| Where | Who | English | Vietnamese |
|---|---|---|---|
| title | — | The Meridian Line | Phòng tuyến Meridian |
| summary | — | Meridian holds the Keystone and the frontier alone. | Meridian một mình giữ Then Chốt và cả biên cương. |
| card | Mira Vale | Meridian holds the Keystone, and our towers stand on every road that leads to it. | Meridian giữ Then Chốt, và tháp của ta đứng trên mọi con đường dẫn tới đó. |
| card | Mira Vale | The frontier is safe, Commander. It is also quiet. Nobody comes to the circuit without asking us first. | Biên cương đã an toàn, thưa Chỉ huy. Nó cũng thật yên ắng. Không ai đến mạch năng lượng mà không hỏi ta trước. |
| card | Tamsin Sol | The Caravan keeps its own roads now, and pays Meridian for the light. | Giờ Đoàn Lữ hành tự giữ đường của mình, và trả tiền ánh sáng cho Meridian. |
| card | Tamsin Sol | It is a fair price. Still, I miss the nights when we shared one fire. | Một cái giá công bằng. Dù vậy, tôi nhớ những đêm ta ngồi chung một bếp lửa. |
| card | Corvin Hale | Meridian sends power to the fleet each night, on Meridian's schedule. Half my people are awake. | Mỗi đêm Meridian gửi năng lượng lên hạm đội, theo lịch của Meridian. Một nửa người của tôi đã thức. |
| card | Corvin Hale | I am grateful, and I am not free. Both are true. | Tôi biết ơn, và tôi không được tự do. Cả hai đều đúng. |
| card | Ilse Maren | The Veil has gone back behind the highland gates. Our relays stay dark and our records stay closed. | Veil đã lui về sau cổng cao nguyên. Các trạm của chúng tôi vẫn tối và hồ sơ vẫn đóng. |
| card | Ilse Maren | Perhaps one day we will trust the light. Not this year. | Có lẽ một ngày chúng tôi sẽ tin ánh sáng. Nhưng không phải năm nay. |
| card | ECHO | One hundred and eight relays, awake and guarded by one camp. The crystal grows, slowly. | Một trăm lẻ tám trạm, đã thức và do một trại canh giữ. Tinh thể mọc lên, chậm rãi. |
| card | ECHO | I am someone now. I would like to be left counting, Commander, until the other camps come back. | Giờ tôi đã là một ai đó. Tôi muốn được để yên mà đếm, thưa Chỉ huy, cho đến khi các trại khác quay về. |

## Campaign map

| Where | Who | English | Vietnamese |
|---|---|---|---|
| heading | — | The frontier | Biên cương |
| endings | — | Endings | Kết thúc |
| unseen | — | Not reached yet | Chưa đạt tới |
| chronicles | — | Faction Chronicles | Biên niên các phe |
| chroniclesNote | — | Coming soon: the same war, told by each faction. | Sắp ra mắt: cùng một cuộc chiến, do từng phe kể lại. |
| decisions | — | Decisions | Quyết định |

Interface words (in `src/locales/vi.json`): COMMANDER'S DECISION, Your orders, The battle waits for your order., EPILOGUE, Campaign map, Close, Merciful, Firm, Replay the epilogue, "N / 12 relays lit".

---

# Story lines for review: 0.19b "Story you see"

Every new or changed line of release 0.19b (staged scenes, the reworked missions 2, 6 and 9, and the two new missions under the Defence rules), in English and Vietnamese. Generated from `src/story/missions.js`, `src/story/defence-missions.js`, `src/story/scenes.js` and `src/locales/story-vi.json` (the data wins if they differ). Mission numbers are the campaign order since 0.19b (14 missions); ids are unchanged.

## What changed

- **Scenes** (six big moments): mission 1 when the river relay is held (`relay-wakes`), mission 4 at the truce (`the-truce`), mission 8 when the vault opens (`echo-wakes`), mission 10 when the Crown is tuned (`crown-lights`), mission 11 when the last conduit falls (`draw-cut`) and the finale when the engine falls, one scene per ending (`keystone-open`, `keystone-held`). Lines that the trigger used to say at that moment now play inside the scene, word for word; each scene adds one to three new lines.
- **Mission 2, First Contact**: a bridge assault. Ashfall holds a bridgehead at the far end of the west bridge (two guns that cover the far half of the span, a guard between the rocks); the ford is slow and stops abilities. Removed: the briefing line "Three crossings span the river: two bridges and a ford between them. Hold the ford, then take their Command core." and the intel line "The river can only be crossed at the west bridge, the middle ford and the east bridge."
- **Mission 6, Copper Harvest**: two Veil scouts watch the basin from the north-west rim (the Veil appears before mission 10).
- **Mission 9, A Debt in the Dunes**: a high-ground hold. After the link-up, take the dune plateau and hold it for three minutes; Hale sends real Warden drones up the ramps (the Wardens appear before missions 10 and 11). The Ashfall core is optional now. The lines at the old enemy-gate trigger (Hale, ECHO, Sol) are unchanged and play when the plateau is taken.
- **Hold the River** (mission 3) and **Hold the Valley** (mission 9): new, played under the Defence rules; story beats between the waves.

## Lines by mission

### m01-first-light · mission 1, First Light

| Where | Who | English | Vietnamese |
|---|---|---|---|
| scene relay-wakes | Tobi Okoro | It is answering. Four hundred years asleep, and it is answering us, Commander. | Nó đang trả lời. Ngủ suốt bốn trăm năm, vậy mà nó đang trả lời chúng ta, thưa Chỉ huy. |
| scene relay-wakes | Mira Vale | Every light in the Ashfall camp just went out. The same second our relay woke. | Mọi ngọn đèn trong trại Ashfall vừa tắt. Đúng vào giây trạm của ta tỉnh dậy. |

### m02-first-contact · mission 2, First Contact

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Mira Vale | Hale has dug in at the far end of the west bridge. Break that bridgehead, then take his Command core. | Hale đã cố thủ ở đầu bên kia cầu phía tây. Phá đầu cầu đó, rồi đánh chiếm Sở chỉ huy của ông ta. |
| intel | — | Two towers and a guard hold the far end of the west bridge. Cross in one group and bring Breakers for the towers. | Hai tháp pháo và một toán lính giữ đầu bên kia cầu phía tây. Qua cầu thành một khối và mang Pháo binh để phá tháp. |
| intel | — | The middle ford is slow going, and no ability works in the water. The bridges are wide, but watched. | Lội qua bãi cạn giữa rất chậm, và không kỹ năng nào dùng được dưới nước. Các cây cầu rộng, nhưng bị canh chừng. |
| objective bridgehead | — | Break the Ashfall bridgehead at the west bridge | Phá đầu cầu của Ashfall ở cầu phía tây |
| say | Mira Vale | Their guns cover the far half of the bridge. Go over in one group, Commander, and do not stop on it. | Súng của chúng khống chế nửa bên kia cây cầu. Qua cầu thành một khối, thưa Chỉ huy, và đừng dừng lại trên đó. |
| say | Tobi Okoro | The bridgehead is down! The west bridge is ours, and it runs right past their back fence. | Đầu cầu đã vỡ! Cầu phía tây là của ta, và nó dẫn thẳng tới hàng rào sau trại chúng. |
| unit name | — | Bridgehead gun | Súng đầu cầu |

### m02b-hold-the-river · mission 3, Hold the River

| Where | Who | English | Vietnamese |
|---|---|---|---|
| title | — | Hold the River | Giữ dòng sông |
| place | — | Twin Bridges, Meridian Riverlands, day 6 | Cầu Đôi, Vùng sông Meridian, ngày 6 |
| briefing | Mira Vale | Hale has gathered new columns east of the river. He means to take the crossings back. | Hale đã tập hợp những đoàn quân mới ở phía đông con sông. Ông ta định chiếm lại các lối qua sông. |
| briefing | Tobi Okoro | I am tuning the river relay. It needs time, and quiet, and nobody marching over my cables. | Tôi đang điều hưởng trạm bên sông. Nó cần thời gian, cần yên tĩnh, và không ai được giẫm lên dây cáp của tôi. |
| briefing | Mira Vale | No base today, Commander. Crew towers on the pads beside the roads and stop every column. | Hôm nay không có căn cứ, thưa Chỉ huy. Đưa lính vào tháp trên các bệ cạnh đường và chặn mọi đoàn quân. |
| intel | — | Columns walk the roads over the west bridge, the ford and the east bridge. Each unit that gets through costs a life. | Các đoàn quân đi theo đường qua cầu phía tây, bãi cạn và cầu phía đông. Mỗi lính lọt qua làm mất một mạng. |
| intel | — | Tap a pad to crew a tower: Rangers reach far, Breakers hit crowds, Anti-tank crews stop vehicles. | Chạm vào một bệ để đưa lính vào tháp: Xạ thủ bắn xa, Pháo binh đánh đám đông, lính Chống tăng chặn xe. |
| intel | — | The ford slows everything that wades it. A tower beside it gets more shots. | Bãi cạn làm chậm mọi thứ lội qua. Tháp đặt cạnh đó được bắn nhiều phát hơn. |
| intel | — | Each kill pays a little alloy. Calling the next wave early pays a bonus. | Mỗi lần hạ địch được thưởng chút hợp kim. Gọi đợt tiếp theo sớm được thêm tiền thưởng. |
| objective hold | — | Hold the crossings for 7 waves | Giữ các điểm vượt sông qua 7 đợt |
| say | Mira Vale | Pads stand beside all three roads. Crew the ones near the crossings before the first column. | Các bệ nằm cạnh cả ba con đường. Đưa lính vào những bệ gần lối qua sông trước khi đoàn quân đầu tiên tới. |
| say | Tobi Okoro | The relay needs seven quiet stretches to tune. Hold every crossing and I will get them. | Trạm cần bảy quãng yên tĩnh để điều hưởng. Giữ mọi lối qua sông, tôi sẽ có đủ. |
| say | Corvin Hale | Meridian camp. You hold a river that is not yours. My columns cross on the hour. | Trại Meridian. Các vị đang giữ một con sông không phải của mình. Đoàn quân của tôi sẽ qua sông đúng giờ. |
| say | Tobi Okoro | Two stretches done and the relay is warming. Wading slows them, Commander. Hit them in the ford. | Xong hai quãng, trạm đang ấm lên. Lội nước làm chúng chậm lại, thưa Chỉ huy. Đánh chúng ở bãi cạn. |
| say | Mira Vale | Scrappers come in crowds. A Breaker crew hits the whole crowd at once. | Lính phế liệu kéo đến thành đám. Một tháp Pháo binh đánh trúng cả đám cùng lúc. |
| say | Corvin Hale | The sixth column crosses now, with Scorchers. I would rather you stood aside. | Đoàn quân thứ sáu đang qua sông, có cả Xe phun lửa. Tôi mong các vị tránh sang bên. |
| say | Tobi Okoro | One more stretch! The relay is almost in tune. I can hear it. | Thêm một quãng nữa! Trạm sắp hòa nhịp rồi. Tôi nghe thấy nó. |
| say | Mira Vale | Last column, and it brings Battle tanks. Anti-tank crews on the bridges, Commander. | Đoàn quân cuối, có cả Xe tăng. Đưa lính Chống tăng lên các cây cầu, thưa Chỉ huy. |
| debrief win | Mira Vale | The river held, Commander. Hale's columns have gone back to the ash plains. | Dòng sông đã giữ được, thưa Chỉ huy. Các đoàn quân của Hale đã rút về đồng tro. |
| debrief win | Tobi Okoro | Tuned! And the relay's line points east, straight at Hale's siphons. I want to see them. | Điều hưởng xong! Và đường dây của trạm chỉ về phía đông, thẳng tới các trạm hút của Hale. Tôi muốn tận mắt xem chúng. |
| debrief lose | Mira Vale | They crossed. Okoro got clear with the tuning core. We regroup at camp and try again. | Chúng đã qua sông. Okoro mang được lõi điều hưởng ra an toàn. Ta tập hợp lại ở trại rồi thử lần nữa. |

### m04-three-way-dunes · mission 5, Three-Way Dunes

| Where | Who | English | Vietnamese |
|---|---|---|---|
| scene the-truce (line moved into the scene, words unchanged) | Corvin Hale | Captain Sol. Every relay Meridian lights, we both lose power. A truce, until they are gone? | Thủ lĩnh Sol. Meridian thắp trạm nào là cả hai ta mất năng lượng trạm đó. Đình chiến nhé, cho đến khi họ đi khỏi? |
| scene the-truce (line moved into the scene, words unchanged) | Tamsin Sol | I do not like you, Director. But my wells are dropping. Agreed, for today. | Tôi không ưa ông, Giám đốc. Nhưng giếng của tôi đang cạn. Đồng ý, riêng hôm nay. |
| scene the-truce | Mira Vale | Both columns are turning toward the centre oasis, Commander. Together. | Cả hai đoàn quân đang quay về phía ốc đảo giữa, thưa Chỉ huy. Cùng nhau. |

### m06-copper-harvest · mission 7, Copper Harvest

| Where | Who | English | Vietnamese |
|---|---|---|---|
| say | Tobi Okoro | Violet coats on the north-west rim, Commander. They are watching the seam, and they are not Ashfall. | Áo tím trên mép núi tây bắc, thưa Chỉ huy. Họ đang theo dõi vỉa quặng, và họ không phải Ashfall. |
| say | Mira Vale | Veil Survey scouts. They came to this world before any of us. Leave them be. We have enough enemies today. | Trinh sát của Đoàn Khảo sát Veil. Họ đến hành tinh này trước tất cả chúng ta. Cứ để họ yên. Hôm nay ta đủ kẻ thù rồi. |
| unit name | — | Veil scout | Trinh sát Veil |

### m07b-hold-the-valley · mission 9, Hold the Valley

| Where | Who | English | Vietnamese |
|---|---|---|---|
| title | — | Hold the Valley | Giữ thung lũng |
| place | — | Gorge Road, below the highlands, day 36 | Đường Hẻm Núi, dưới chân cao nguyên, ngày 36 |
| briefing | Tobi Okoro | The circuit map says every line meets at one point. From the relay plateau above Gorge Road I can find it. | Bản đồ mạch nói mọi đường dây gặp nhau ở một điểm. Từ cao nguyên có trạm phía trên Đường Hẻm Núi, tôi tìm được nó. |
| briefing | Mira Vale | Hale knows it too. His columns are climbing the gorge to stop the survey. Hold the road for eight waves. | Hale cũng biết vậy. Các đoàn quân của ông ta đang leo hẻm núi để chặn cuộc khảo sát. Giữ con đường qua tám đợt. |
| briefing | Mira Vale | Crews on a plateau rim see far. Crews deep on top cannot be seen from the road at all. | Lính ở mép cao nguyên nhìn được xa. Lính ở sâu trên đỉnh thì từ dưới đường hoàn toàn không thấy được. |
| intel | — | Ashfall columns climb the gorge road to the relay plateau. Each unit that reaches the top costs a life. | Các đoàn quân Ashfall leo đường hẻm núi lên cao nguyên có trạm. Mỗi lính lên tới đỉnh làm mất một mạng. |
| intel | — | Rim pads reach further, but the road can shoot back. Deep pads are hidden from below. | Bệ ở mép bắn xa hơn, nhưng dưới đường có thể bắn trả. Bệ sâu bên trong được che khuất khỏi bên dưới. |
| intel | — | Heavy machines cost two lives. Keep an Anti-tank crew on the upper road. | Cỗ máy hạng nặng làm mất hai mạng. Giữ một tháp Chống tăng ở đoạn đường phía trên. |
| objective hold | — | Hold the gorge road for 8 waves | Giữ đường hẻm núi qua 8 đợt |
| say | Mira Vale | Pads line the whole road, Commander. Crew the lower ones first. The column starts at the bottom. | Các bệ nằm dọc cả con đường, thưa Chỉ huy. Đưa lính vào những bệ phía dưới trước. Đoàn quân xuất phát từ chân núi. |
| say | Corvin Hale | Meridian. That plateau is not on your schedule. My columns will clear it by nightfall. | Meridian. Cao nguyên đó không có trong lịch trình của các vị. Đoàn quân của tôi sẽ dọn sạch nó trước khi trời tối. |
| say | Tobi Okoro | First reading! The lines bend south and west, toward the ash plains. | Số đo đầu tiên! Các đường dây uốn về phía nam và tây, hướng tới đồng tro. |
| say | Tobi Okoro | Second reading. They cross under the old Ashfall camp. Something is buried there, Commander. | Số đo thứ hai. Chúng chạy ngầm dưới trại cũ của Ashfall. Có gì đó được chôn ở đó, thưa Chỉ huy. |
| say | Mira Vale | A long Scrapper column on the road. Breaker crews where the road bends, please. | Một đoàn Lính phế liệu dài trên đường. Xin đặt tháp Pháo binh ở chỗ đường uốn cong. |
| say | Tobi Okoro | Third reading. It is a Builder vault, and the Lattice keeps a key inside it. | Số đo thứ ba. Đó là một hầm Kiến Tạo, và Mạng Lưới cất một chiếc chìa khóa bên trong. |
| say | Corvin Hale | I have counted your towers, Commander. I am sending a tank for each of them. | Tôi đã đếm số tháp của các vị, thưa Chỉ huy. Tôi gửi tới mỗi tháp một chiếc xe tăng. |
| say | Mira Vale | Last column. Everything Hale has left on this road. Hold the top, Commander. | Đoàn quân cuối. Tất cả những gì Hale còn lại trên con đường này. Giữ lấy đỉnh, thưa Chỉ huy. |
| debrief win | Tobi Okoro | The survey is done. The centre has a key, and the key was kept in a vault beside Hale's camp. | Khảo sát xong rồi. Điểm trung tâm có một chiếc chìa khóa, và nó được cất trong một hầm cạnh trại của Hale. |
| debrief win | Mira Vale | Then we go to the ash plains, quietly and at night. Rest the crews, Commander. | Vậy ta tới đồng tro, lặng lẽ và vào ban đêm. Cho lính nghỉ đi, thưa Chỉ huy. |
| debrief lose | Mira Vale | They reached the plateau, and the survey with it. Okoro saved half the readings. We try again. | Chúng đã lên tới cao nguyên, và chặn đứng cuộc khảo sát. Okoro giữ được một nửa số đo. Ta thử lại. |

### m08-the-quiet-vault · mission 10, The Quiet Vault

| Where | Who | English | Vietnamese |
|---|---|---|---|
| scene echo-wakes (line moved into the scene, words unchanged) | ECHO | Door open. This one is ECHO, caretaker of the Lattice. You are the first to ask in 412 years. | Cửa đã mở. Đơn vị này là ECHO, người trông nom Mạng Lưới. Các vị là những người đầu tiên lên tiếng hỏi sau 412 năm. |
| scene echo-wakes (line moved into the scene, words unchanged) | ECHO | The Builders did not fall. They left, and set the Lattice to sleep so the crystal could regrow. | Người Kiến Tạo không sụp đổ. Họ rời đi, và cho Mạng Lưới ngủ để tinh thể mọc lại. |
| scene echo-wakes (line moved into the scene, words unchanged) | ECHO | A man in a grey coat took the Keystone key nine days ago. He means to draw all the power at once. | Chín ngày trước, một người đàn ông mặc áo choàng xám đã lấy chìa khóa Then Chốt. Ông ta định rút toàn bộ năng lượng trong một lần. |

### m09-a-debt-in-the-dunes · mission 11, A Debt in the Dunes

| Where | Who | English | Vietnamese |
|---|---|---|---|
| intel | — | The dune plateau north of Sol's camp looks down on Hale's road. Units deep on its top cannot be seen from below. | Cao nguyên cát phía bắc trại của Sol nhìn xuống con đường của Hale. Lính ở sâu trên đỉnh không bị nhìn thấy từ bên dưới. |
| objective ridge | — | Take the dune plateau and hold it for 3 minutes | Chiếm cao nguyên cát và giữ trong 3 phút |
| say | Tamsin Sol | Hale's road to my camp runs under the dune plateau. Take the top, and his columns must climb to you. | Con đường của Hale tới trại tôi chạy dưới chân cao nguyên cát. Chiếm lấy đỉnh, và quân ông ta sẽ phải leo lên chỗ anh. |
| say | Mira Vale | We hold the top. Keep the troops deep on the plateau: from the sand below they cannot see us. | Ta đã giữ được đỉnh. Cho quân đứng sâu trên cao nguyên: từ bãi cát bên dưới chúng không thấy được ta. |
| say | Mira Vale | Their camp is down as well. Hale will have to find his fuel somewhere else. | Trại của chúng cũng đã sập. Hale sẽ phải tìm nhiên liệu ở nơi khác. |
| point ridgeTop | — | Dune plateau | Cao nguyên cát |

### m10-obsidian-storm · mission 12, Obsidian Storm

| Where | Who | English | Vietnamese |
|---|---|---|---|
| scene crown-lights | ECHO | Sixty-four relays in tune. Look up, Archivist. The sky is quiet. | Sáu mươi bốn trạm đã hòa nhịp. Hãy nhìn lên, thưa Lưu trữ viên. Bầu trời yên ả. |
| scene crown-lights (line moved into the scene, words unchanged) | Ilse Maren | The Crown is lit and the sky is clear. No storm. In thirty years I never once saw that. | Vương Miện đã sáng và bầu trời quang đãng. Không có bão. Ba mươi năm qua tôi chưa một lần thấy cảnh này. |

### m11-cut-the-draw · mission 13, Cut the Draw

| Where | Who | English | Vietnamese |
|---|---|---|---|
| scene draw-cut (line moved into the scene, words unchanged) | ECHO | The north conduit is dark. The Lattice is tired, but it is whole. Thank you. | Ống dẫn bắc đã tối. Mạng Lưới mệt, nhưng còn nguyên vẹn. Cảm ơn các vị. |
| scene draw-cut | Corvin Hale | Three conduits cut. My schedule has lost a day, Commander. The engine on the Keystone has not. | Ba ống dẫn bị cắt. Lịch trình của tôi mất một ngày, thưa Chỉ huy. Cỗ máy trên Then Chốt thì chưa. |

### m12-frontiers-end · mission 14, Frontier's End

| Where | Who | English | Vietnamese |
|---|---|---|---|
| scene keystone-held (line moved into the scene, words unchanged) | ECHO | The engine is silent. Tuning the Keystone. One hundred and eight relays are answering. | Cỗ máy đã im. Đang điều hưởng Then Chốt. Một trăm lẻ tám trạm đang đáp lời. |
| scene keystone-held | Mira Vale | Meridian towers on every road to the Keystone. It is ours to guard now, Commander. | Tháp Meridian trên mọi con đường tới Then Chốt. Giờ ta là người canh giữ nó, thưa Chỉ huy. |
| scene keystone-open (line moved into the scene, words unchanged) | ECHO | The engine is silent. Tuning the Keystone for every camp. One hundred and eight relays are answering. | Cỗ máy đã im. Đang điều hưởng Then Chốt cho mọi trại. Một trăm lẻ tám trạm đang đáp lời. |
| scene keystone-open | Tamsin Sol | Four camps, one circuit. I can see the dunes glowing from here, Commander. | Bốn trại, một mạch điện. Từ đây tôi thấy cả đồi cát đang sáng rực, Chỉ huy. |
| scene keystone-open | ECHO | I can see every camp from here. All of them are lit. | Từ đây tôi thấy được mọi trại. Tất cả đều đã sáng đèn. |

Interface words (in `src/locales/vi.json`): Skip scene, Story scene; "N lives" and "N waves" use the existing patterns.
## Chronicles (0.20)

Release 0.20 adds four Faction Chronicles of three missions each, played as that faction (data: `src/story/chronicles.js`). Each chronicle has its lead (a cast member with a portrait) and its own form of address for the player, who is never called "Commander" by their own side (Meridian's people still call the Meridian player of the main campaign "Commander" when they speak over the radio). They open after mission 4, Three-Way Dunes, and their missions open in order.

| Chronicle | Played as | Lead | The player is called | Missions |
|---|---|---|---|---|
| Salvage Rights (Quyền trục vớt) | Ashfall Combine | Corvin Hale | Foreman (Đốc công) | Cold Berths, Lights Out, The Scrapyard Gorge |
| The Long Road (Con đường dài) | Sunward Caravan | Tamsin Sol | Wagon-master (Trưởng đoàn xe) | Dry Wells, Three-Way Dunes, The Verdant Road |
| ECHO's Key (Chìa khóa của ECHO) | The Wardens | ECHO | Warden-prime (Hộ vệ trưởng) | Standing Orders, A Grey Coat, Hold the River |
| The Quiet Survey (Cuộc khảo sát lặng lẽ) | Veil Survey | Ilse Maren | Surveyor (Khảo sát viên) | Night Count, One Circuit, Inside the Dampers |

### Finale lines

A finished chronicle adds one line by its lead to the debrief of mission 12, Frontier's End, after the ending's own lines (`if: { chronicle }`, settled by `resolveMission`). Lines only: no squads, so the finale's balance is untouched. With no chronicle finished the finale reads exactly as in 0.19a.

| Chronicle | Who | English | Vietnamese |
|---|---|---|---|
| ashfall | Corvin Hale | My foremen held the gorge for this fleet. Tonight I write each of their names on the first waking list. | Các đốc công của tôi đã giữ hẻm núi cho hạm đội này. Đêm nay tôi ghi tên từng người vào danh sách đánh thức đầu tiên. |
| sunward | Tamsin Sol | My Wagon-master has opened the long road from the dunes to the Keystone. The water wagons arrive at dawn. | Trưởng đoàn xe của tôi đã mở con đường dài từ đồi cát tới Then Chốt. Xe chở nước sẽ tới lúc bình minh. |
| wardens | ECHO | Warden-prime has stood the river guardians down. They are counting crystals with me now. | Hộ vệ trưởng đã cho các vệ binh bên sông ngừng tay. Giờ chúng đang cùng tôi đếm tinh thể. |
| veil | Ilse Maren | My Surveyor recorded the Crown waking without a storm. Every Veil camp will read that record tonight. | Khảo sát viên của tôi đã ghi lại cảnh Vương Miện tỉnh dậy mà không có bão. Đêm nay mọi trại Veil sẽ đọc bản ghi đó. |

### Salvage Rights · Ashfall Combine

The salvage fleet's war, from the ash plains to the scrapyard gorge. (Cuộc chiến của hạm đội trục vớt, từ đồng tro đến hẻm núi bãi phế liệu.)

#### 1. Cold Berths (Khoang ngủ lạnh giá) · Ashen Frontier, day 3

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Corvin Hale | Foreman. Forty thousand sleepers ride above us, and their berths grow colder every night. | Đốc công. Bốn mươi nghìn người ngủ đông đang bay phía trên ta, và khoang ngủ của họ lạnh dần mỗi đêm. |
| briefing | Corvin Hale | The Sunward Caravan strips the old wrecks on these plains. Every crate they take is a berth we cannot heat. | Đoàn Lữ hành Sunward đang lột sạch các xác tàu cũ trên đồng này. Mỗi thùng họ lấy là một khoang ngủ ta không sưởi được. |
| briefing | Corvin Hale | Raise a Salvage yard, then remove their two raider camps. You have until the fleet's next report. | Dựng một Bãi thu hồi, rồi dẹp hai trại cướp của họ. Anh có thời gian tới lần báo cáo tiếp theo của hạm đội. |
| intel | — | Scrappers are cheap and many. Scorchers burn packed infantry and buildings. | Lính phế liệu rẻ và đông. Xe phun lửa đốt bộ binh đứng dồn và công trình. |
| intel | — | Machines destroyed near a Salvage yard or your Command core pay you a quarter of their alloy. | Máy móc bị phá gần Bãi thu hồi hoặc Sở chỉ huy của bạn sẽ trả cho bạn một phần tư hợp kim của chúng. |
| intel | — | Sunward Riders strike fast and Supply wagons mend them. Keep towers by your Harvesters. | Kỵ binh Sunward đánh nhanh và Xe tiếp tế chữa cho chúng. Hãy đặt tháp pháo cạnh Thợ mỏ. |
| objective yard | — | Build a Salvage yard | Xây một Bãi thu hồi |
| objective camps | — | Destroy the two Sunward raider camps | Phá hai trại cướp của Sunward |
| objective core | — | Destroy the Sunward Command core | Phá Sở chỉ huy của Sunward |
| objective fast | — | Finish in under 15 minutes | Hoàn thành trong vòng 15 phút |
| in play (time) | Corvin Hale | The Harvesters are cutting, Foreman. A Salvage yard first: wrecks pay better than rock. | Thợ mỏ đang khai thác, Đốc công. Bãi thu hồi trước đã: xác tàu đáng giá hơn đá. |
| in play (objective) | Corvin Hale | Yard standing. Every machine that falls near it is alloy for the fleet. Theirs and ours. | Bãi đã dựng. Mọi cỗ máy đổ xuống gần nó đều là hợp kim cho hạm đội. Của họ lẫn của ta. |
| in play (event) | Corvin Hale | Riders on the plain. They come for the Harvesters. Let the towers greet them. | Kỵ binh trên đồng. Chúng nhắm vào Thợ mỏ. Để tháp pháo đón chúng. |
| in play (enter) | Tamsin Sol | Director's people! Those wrecks lay in the sand for four hundred years. Nobody owns a wreck. | Người của Giám đốc! Mấy xác tàu đó nằm trong cát bốn trăm năm rồi. Xác tàu chẳng thuộc về ai cả. |
| in play (enter) | Corvin Hale | Captain Sol. My sleepers own it. Foreman, carry on. | Thủ lĩnh Sol. Những người ngủ đông của tôi sở hữu nó. Đốc công, tiếp tục đi. |
| in play (time) | Corvin Hale | Ten minutes. The fleet reports at the hour. I would like to tell them good news. | Mười phút. Hạm đội báo cáo vào đầu giờ. Tôi muốn báo cho họ tin vui. |
| in play (objective) | Tamsin Sol | Keep your wrecks, Director. The dunes are ours, and we will remember the road you took. | Cứ giữ xác tàu của ông đi, Giám đốc. Đồi cát là của chúng tôi, và chúng tôi sẽ nhớ con đường ông đã chọn. |
| debrief win | Corvin Hale | The plains are ours, Foreman. Two hundred berths will be warm tonight. I counted them myself. | Đồng tro là của ta, Đốc công. Đêm nay hai trăm khoang ngủ sẽ ấm. Tôi đã tự mình đếm. |
| debrief win | Corvin Hale | Now the siphons. But a new camp has landed by the river, and its lights came on as ours went dim. | Giờ đến các trạm hút. Nhưng một trại mới đã đáp xuống bên sông, và đèn của họ sáng lên đúng lúc đèn ta mờ đi. |
| debrief lose | Corvin Hale | We lost the camp, Foreman. We will build another before the fleet's next report. We always do. | Ta mất trại rồi, Đốc công. Ta sẽ dựng trại khác trước lần báo cáo tới của hạm đội. Lần nào ta cũng làm được. |
| unit name | — | Sunward raider camp | Trại cướp Sunward |

#### 2. Lights Out (Tắt đèn) · Meridian Riverlands, day 4

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Corvin Hale | The new camp woke a Builder relay by the river. At that second our fleet lost a third of its power. | Trại mới đã đánh thức một Trạm Kiến Tạo bên sông. Ngay giây đó hạm đội ta mất một phần ba năng lượng. |
| briefing | Corvin Hale | I asked their Commander to shut it down. Twice. Politely. The relay is still lit. | Tôi đã đề nghị Chỉ huy của họ tắt nó đi. Hai lần. Lịch sự. Trạm vẫn sáng. |
| briefing | Corvin Hale | Break the two guard towers on their bank and hold the relay for one minute. Our engineers will do the rest. | Phá hai tháp canh bên bờ của họ và giữ trạm trong một phút. Kỹ sư của ta sẽ lo phần còn lại. |
| intel | — | Meridian fields Vanguards with shields and Rangers that shoot far. Scorchers break their tight groups. | Meridian dùng Tiên phong có khiên và Xạ thủ bắn xa. Xe phun lửa phá vỡ đội hình dày của chúng. |
| intel | — | Cross at the west bridge, the middle ford or the east bridge. The relay stands on the far bank. | Qua sông ở cầu tây, bãi cạn giữa hoặc cầu đông. Trạm nằm ở bờ bên kia. |
| intel | — | Hold the relay circle with no Meridian unit inside it for one full minute. | Giữ vòng tròn của trạm, không để quân Meridian nào ở trong, trọn một phút. |
| objective posts | — | Destroy the two Meridian guard towers by the river relay | Phá hai tháp canh Meridian cạnh trạm bên sông |
| objective hold | — | Hold the river relay for 1 minute | Giữ trạm bên sông trong 1 phút |
| objective core | — | Destroy the Meridian Command core | Phá Sở chỉ huy của Meridian |
| objective fast | — | Finish in under 14 minutes | Hoàn thành trong vòng 14 phút |
| in play (time) | Corvin Hale | Their camp is young, Foreman, and so are their towers. Strike before they learn the ground. | Trại của họ còn non, Đốc công, tháp của họ cũng vậy. Đánh trước khi họ thuộc địa hình. |
| in play (event) | Corvin Hale | Meridian is answering. Hold at our bank, then cross while they count their losses. | Meridian đang đáp trả. Giữ ở bờ ta, rồi vượt sông khi họ còn đang đếm thiệt hại. |
| in play (enter) | Mira Vale | Ashfall on our bank. Director, we took nothing from you. We only woke a relay. | Ashfall đã sang bờ ta. Thưa Giám đốc, chúng tôi không lấy gì của ông. Chúng tôi chỉ đánh thức một trạm. |
| in play (enter) | Corvin Hale | Then you will not miss it, Commander. Foreman, proceed. | Vậy thì các vị sẽ không tiếc nó, thưa Chỉ huy. Đốc công, tiến hành. |
| in play (tagDead) | Corvin Hale | Both towers down. Into the circle, Foreman. One minute, and their light goes out. | Cả hai tháp đã đổ. Vào vòng tròn đi, Đốc công. Một phút nữa là đèn của họ tắt. |
| in play (pointOwned) | Corvin Hale | They took the circle back. Clear it, Foreman. A schedule is a promise. | Họ chiếm lại vòng tròn rồi. Quét sạch nó, Đốc công. Lịch trình là một lời hứa. |
| in play (time) | Corvin Hale | Twelve minutes. Their Foundry will be printing Breakers soon. Finish it. | Mười hai phút. Nhà máy của họ sắp in ra Pháo binh rồi. Kết thúc đi. |
| in play (objective) | Tobi Okoro | They are shutting our relay down! Commander, it is going dark. Strange: their lights should come back now. | Họ đang tắt trạm của ta! Chỉ huy ơi, nó đang tối dần. Lạ thật: giờ đèn của họ lẽ ra phải sáng lại. |
| in play (objective) | Corvin Hale | The relay is dark. Fleet, report your power. Up a third? Thank you. | Trạm đã tối. Hạm đội, báo cáo năng lượng. Tăng một phần ba? Cảm ơn. |
| debrief win | Corvin Hale | Their relay is dark and our fleet has its third back. For tonight. | Trạm của họ đã tối và hạm đội ta lấy lại được một phần ba. Trong đêm nay. |
| debrief win | Corvin Hale | Their engineer said a strange thing, Foreman. Our lights should come back now. As if he knew they would. | Kỹ sư của họ nói một điều lạ, Đốc công. Đèn của ta lẽ ra phải sáng lại. Như thể anh ta biết trước. |
| debrief lose | Corvin Hale | The relay stays lit and the berths stay cold. We regroup on the ash plains, Foreman. | Trạm vẫn sáng và khoang ngủ vẫn lạnh. Ta tập hợp lại ở đồng tro, Đốc công. |
| unit name | — | Meridian guard tower | Tháp canh Meridian |
| capture point | — | River relay | Trạm bên sông |

#### 3. The Scrapyard Gorge (Hẻm núi bãi phế liệu) · Gorge Road, day 44

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Corvin Hale | The spare berth cores are stored in the scrapyard at the top of this gorge. Without them, the fleet fails in a month. | Lõi dự phòng của khoang ngủ cất trong bãi phế liệu trên đỉnh hẻm núi này. Không có chúng, một tháng nữa hạm đội sẽ hỏng. |
| briefing | Corvin Hale | Meridian columns are climbing Gorge Road. Ten of them. I have counted twice. | Các đoàn quân Meridian đang leo Đường Hẻm Núi. Mười đoàn. Tôi đã đếm hai lần. |
| briefing | Corvin Hale | Crew the pads along the road, Foreman. Nothing reaches the scrapyard. | Đưa lính lên các bệ dọc con đường, Đốc công. Không thứ gì được tới bãi phế liệu. |
| intel | — | Tap a pad beside the road to crew a tower. Each kill pays a tenth of the unit's cost. | Chạm vào một bệ cạnh con đường để đưa lính lên tháp. Mỗi lần hạ địch được trả một phần mười giá của đơn vị đó. |
| intel | — | Rim pads see far but can be shot. Deep pads stay hidden from the road. | Bệ ở mép nhìn xa nhưng có thể bị bắn. Bệ sâu bên trong được che khuất khỏi con đường. |
| intel | — | Meridian Vanguards carry shields. Breaker mortars and Anti-tank posts break the heavy columns. | Tiên phong của Meridian mang khiên. Cối pháo binh và Chốt chống tăng đập tan các đoàn quân nặng. |
| objective hold | — | Hold Gorge Road for 10 waves | Giữ Đường Hẻm Núi qua 10 đợt |
| in play (time) | Corvin Hale | First column in thirty seconds, Foreman. Crew the pads nearest the bottom of the road. | Ba mươi giây nữa đoàn đầu tiên tới, Đốc công. Đưa lính lên các bệ gần chân đường nhất. |
| in play (time) | Mira Vale | Ashfall towers on every bend. Director, we only want the vault records you took. Let us pass. | Tháp Ashfall ở mọi khúc quanh. Thưa Giám đốc, chúng tôi chỉ muốn những bản ghi trong hầm mà ông đã lấy. Hãy cho chúng tôi qua. |
| in play (time) | Corvin Hale | Commander, you want the Keystone. So do I. The difference is that I am counting forty thousand. | Chỉ huy, các vị muốn Then Chốt. Tôi cũng vậy. Khác biệt là tôi đang đếm bốn mươi nghìn người. |
| in play (time) | Corvin Hale | Heavy machines in the next columns. Anti-tank posts on the upper bends, Foreman. | Máy hạng nặng trong các đoàn tới. Đặt Chốt chống tăng ở các khúc quanh phía trên, Đốc công. |
| in play (objective) | Corvin Hale | The gorge held. The berth cores are safe for another month. Thank you, Foreman. | Hẻm núi đã giữ được. Lõi khoang ngủ an toàn thêm một tháng. Cảm ơn anh, Đốc công. |
| debrief win | Corvin Hale | Ten columns, and not one reached the scrapyard. I will put that in the fleet's log, under your name. | Mười đoàn quân, không đoàn nào tới được bãi phế liệu. Tôi sẽ ghi điều đó vào nhật ký hạm đội, dưới tên anh. |
| debrief win | Corvin Hale | Meridian says a tuned Lattice would feed us for good. A year I can count. A promise I cannot. | Meridian nói một Mạng Lưới hòa nhịp sẽ nuôi ta mãi mãi. Một năm thì tôi đếm được. Một lời hứa thì không. |
| debrief lose | Corvin Hale | They are in the scrapyard. Pull the crews back, Foreman. We will carry what cores we can. | Họ đã vào bãi phế liệu. Rút lính về, Đốc công. Ta sẽ mang đi được bao nhiêu lõi thì mang. |

### The Long Road · Sunward Caravan

The Caravan's war: dry wells, the three-way dunes and the Verdant road. (Cuộc chiến của Đoàn Lữ hành: giếng cạn, đồi cát ba phe và con đường Rừng Xanh.)

#### 1. Dry Wells (Giếng cạn) · Amber Dunes, day 11

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Tamsin Sol | Wagon-master, the wells at the three oases dropped a hand's width overnight. The gardens will not last a week. | Trưởng đoàn xe, giếng ở ba ốc đảo tụt mất một gang tay chỉ sau một đêm. Vườn tược sẽ không trụ nổi một tuần. |
| briefing | Tamsin Sol | Ashfall has set siphon pumps on all three oasis relays. They drink our water to feed their sky fleet. | Ashfall đã đặt máy bơm hút lên cả ba trạm ốc đảo. Chúng uống nước của ta để nuôi hạm đội trên trời. |
| briefing | Tamsin Sol | Break the pumps. Their Director can buy water like anyone else. At my table, at a fair price. | Phá các máy bơm đi. Giám đốc của chúng có thể mua nước như bao người khác. Tại bàn của tôi, với giá phải chăng. |
| intel | — | Riders are the fastest fighters on the field. Strike a pump, then ride away before the guards gather. | Kỵ binh là quân nhanh nhất chiến trường. Đánh một máy bơm, rồi phóng đi trước khi lính gác tụ lại. |
| intel | — | Supply wagons mend the units around them. Sunward rides faster on roads and sand. | Xe tiếp tế chữa cho các đơn vị quanh nó. Sunward đi nhanh hơn trên đường và trên cát. |
| intel | — | Ashfall Scrappers come in numbers. Breakers and towers thin them out. | Lính phế liệu của Ashfall kéo đến rất đông. Pháo binh và tháp pháo làm chúng thưa dần. |
| objective pumps | — | Destroy the three Ashfall pumps | Phá ba máy bơm của Ashfall |
| objective station | — | Build a Waystation | Xây một Trạm dừng chân |
| objective fast | — | Finish in under 14 minutes | Hoàn thành trong vòng 14 phút |
| in play (time) | Tamsin Sol | The centre oasis is the nearest, and its pump is the most lightly guarded. Start there. | Ốc đảo giữa là gần nhất, và máy bơm ở đó được canh lỏng nhất. Bắt đầu từ đó. |
| in play (event) | Tamsin Sol | Scrappers on the dunes, heading for our wells. Keep a guard at camp, Wagon-master. | Lính phế liệu trên đồi cát, đang tiến về giếng của ta. Để lại quân canh ở trại, Trưởng đoàn xe. |
| in play (objective) | Tamsin Sol | A Waystation! Shields mend three times faster beside it. My grandmother would be proud. | Một Trạm dừng chân! Khiên hồi nhanh gấp ba ở cạnh nó. Bà tôi hẳn sẽ tự hào lắm. |
| in play (enter) | Corvin Hale | Caravan. These pumps run on a schedule that keeps forty thousand people alive. Leave them. | Đoàn Lữ hành. Những máy bơm này chạy theo lịch trình giữ cho bốn mươi nghìn người sống. Hãy để yên chúng. |
| in play (enter) | Tamsin Sol | And my wells keep four thousand alive, Director. Every one of them a guest at my table. | Còn giếng của tôi giữ cho bốn nghìn người sống, Giám đốc. Người nào cũng là khách tại bàn của tôi. |
| in play (time) | Tamsin Sol | Eleven minutes, and the water is still dropping. Faster, Wagon-master. | Mười một phút rồi, mà nước vẫn đang tụt. Nhanh lên, Trưởng đoàn xe. |
| in play (objective) | Tamsin Sol | All three pumps are sand. Listen: the wells are filling again. | Cả ba máy bơm đã thành cát. Nghe kìa: giếng đang đầy lại. |
| debrief win | Tamsin Sol | The wells are full and the gardens are green. A debt paid, Wagon-master, and I always collect. | Giếng đã đầy và vườn đã xanh. Món nợ đã được trả, Trưởng đoàn xe, mà tôi thì luôn đòi đủ. |
| debrief win | Tamsin Sol | But a third camp has come to the dunes: Meridian. When they lit an oasis, our wells dropped again. | Nhưng một trại thứ ba đã tới đồi cát: Meridian. Khi họ thắp sáng một ốc đảo, giếng của ta lại tụt. |
| debrief lose | Tamsin Sol | The pumps still drink our water. We fall back to the deep wells and try again at dawn. | Máy bơm vẫn uống nước của ta. Ta lui về các giếng sâu và thử lại lúc bình minh. |
| unit name | — | Ashfall pump | Máy bơm Ashfall |

#### 2. Three-Way Dunes (Ba phe trên đồi cát) · Amber Dunes, day 15

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Tamsin Sol | Meridian has come to our oases, Wagon-master. Ashfall too. Everyone wants our water, and nobody asks. | Meridian đã tới ốc đảo của ta, Trưởng đoàn xe. Cả Ashfall nữa. Ai cũng muốn nước của ta, mà chẳng ai hỏi. |
| briefing | Tamsin Sol | Hold two of the three oasis relays for one minute and the wells are ours again. | Giữ hai trong ba trạm ốc đảo trong một phút là giếng lại thuộc về ta. |
| briefing | Tamsin Sol | They are fighting each other as well as us. Good. Guests who quarrel forget to watch the door. | Họ đánh nhau và đánh cả ta. Tốt. Khách mà cãi nhau thì quên trông cửa. |
| intel | — | Hold any two of the three oasis relays for one minute in a row. | Giữ hai trạm ốc đảo bất kỳ trong ba trạm, một phút liên tục. |
| intel | — | Ashfall guards the north oasis and Meridian the east one. The centre is open. | Ashfall canh ốc đảo bắc còn Meridian canh ốc đảo đông. Ốc đảo giữa để trống. |
| intel | — | An owned oasis pays alloy every second. | Mỗi ốc đảo bạn giữ trả hợp kim từng giây. |
| objective hold | — | Hold two oasis relays for 1 minute | Giữ hai trạm ốc đảo trong 1 phút |
| objective all | — | Hold all three oases for 30 seconds | Giữ cả ba ốc đảo trong 30 giây |
| objective fast | — | Finish in under 13 minutes | Hoàn thành trong vòng 13 phút |
| in play (time) | Tamsin Sol | The centre oasis first, Wagon-master. Then north or east, whichever guard is weaker. | Ốc đảo giữa trước, Trưởng đoàn xe. Rồi đến bắc hoặc đông, bên nào canh yếu hơn. |
| in play (pointOwned) | Mira Vale | Captain Sol. We came to light relays, not to take your water. Can we talk? | Thủ lĩnh Sol. Chúng tôi đến để thắp sáng các trạm, không phải để lấy nước của bà. Ta nói chuyện được không? |
| in play (pointOwned) | Tamsin Sol | You lit an oasis and my wells dropped the same hour. Talk is cheap. Water is not. | Các vị thắp một ốc đảo và giếng của tôi tụt ngay trong giờ đó. Lời nói thì rẻ. Nước thì không. |
| in play (pointOwned) | Corvin Hale | The north oasis feeds my last siphon, Captain. I will take it back. | Ốc đảo bắc nuôi trạm hút cuối cùng của tôi, thưa Thủ lĩnh. Tôi sẽ lấy lại nó. |
| in play (event) | Tamsin Sol | Raiders on our camp. Half home, half on the oases. A caravan guards its wagons. | Quân cướp đánh vào trại ta. Một nửa về nhà, một nửa ở các ốc đảo. Đoàn xe phải canh xe của mình. |
| in play (time) | Corvin Hale | Captain Sol. Every relay Meridian lights, we both lose power. A truce, until they are gone? | Thủ lĩnh Sol. Meridian thắp trạm nào là cả hai ta mất năng lượng trạm đó. Đình chiến nhé, cho đến khi họ đi khỏi? |
| in play (time) | Tamsin Sol | I do not like you, Director. But my wells are dropping. Agreed, for today. | Tôi không ưa ông, Giám đốc. Nhưng giếng của tôi đang cạn. Đồng ý, riêng hôm nay. |
| in play (time) | Tamsin Sol | Five minutes of daylight left. Two oases, one minute. Ride, Wagon-master! | Chỉ còn năm phút trời sáng. Hai ốc đảo, một phút. Phóng đi, Trưởng đoàn xe! |
| in play (objective) | Tamsin Sol | Two oases held. The wells are steady. And Hale owes me a truce. Interesting. | Đã giữ hai ốc đảo. Giếng đã ổn. Và Hale nợ tôi một cuộc đình chiến. Thú vị đây. |
| debrief win | Tamsin Sol | Our oases, our water. And a truce with Ashfall, which I never thought I would sign. | Ốc đảo của ta, nước của ta. Lại thêm một cuộc đình chiến với Ashfall, điều tôi chưa từng nghĩ mình sẽ ký. |
| debrief win | Tamsin Sol | Hale wants a Pact against Meridian. He speaks well of it. I wonder what he is not saying. | Hale muốn một Hiệp ước chống lại Meridian. Ông ta nói về nó rất hay. Tôi tự hỏi ông ta đang giấu điều gì. |
| debrief lose | Tamsin Sol | The oases are theirs today. The Caravan has crossed worse dunes than these. We will be back. | Hôm nay các ốc đảo thuộc về họ. Đoàn Lữ hành từng vượt những đồi cát tệ hơn thế này. Ta sẽ quay lại. |
| capture point | — | North oasis | Ốc đảo bắc |
| capture point | — | Centre oasis | Ốc đảo giữa |
| capture point | — | East oasis | Ốc đảo đông |

#### 3. The Verdant Road (Con đường Rừng Xanh) · Verdant Crossing, day 22

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Tamsin Sol | The Pact is signed. Ashfall holds the bridge, and the Caravan holds the north road through the forest. | Hiệp ước đã ký. Ashfall giữ cây cầu, còn Đoàn Lữ hành giữ con đường bắc xuyên rừng. |
| briefing | Tamsin Sol | Meridian has built two camps on our road to reach the forest relay. Break them, Wagon-master. | Meridian đã dựng hai trại trên đường của ta để tới trạm trong rừng. Phá chúng đi, Trưởng đoàn xe. |
| briefing | Tamsin Sol | Then ride to the relay before their crawler gets there. Whoever wakes it, wins the forest. | Rồi phóng tới trạm trước khi xe của họ tới đó. Ai đánh thức nó, người đó thắng khu rừng. |
| intel | — | Destroy the two Meridian road camps, then reach the forest relay in the north-west. | Phá hai trại ven đường của Meridian, rồi tới trạm trong rừng ở phía tây bắc. |
| intel | — | The river can be crossed at the two bridges and at the east ford. | Có thể qua sông ở hai cây cầu và ở bãi cạn phía đông. |
| intel | — | Riders are fast but light. Let Vanguards take the first blows at a camp. | Kỵ binh nhanh nhưng mỏng. Để Tiên phong đỡ những đòn đầu tiên ở mỗi trại. |
| objective camps | — | Destroy the two Meridian road camps | Phá hai trại ven đường của Meridian |
| objective relay | — | Reach the forest relay | Tới trạm trong rừng |
| objective core | — | Destroy the Meridian Command core | Phá Sở chỉ huy của Meridian |
| objective fast | — | Finish in under 16 minutes | Hoàn thành trong vòng 16 phút |
| in play (time) | Tamsin Sol | The south bridge is ours to cross. The road camp beyond it is the first to fall. | Cầu nam là lối ta qua. Trại ven đường bên kia cầu sẽ đổ trước tiên. |
| in play (event) | Tamsin Sol | Meridian is on the road to our camp. They fight cleanly. So do we. | Meridian đang trên đường tới trại ta. Họ đánh đàng hoàng. Ta cũng vậy. |
| in play (enter) | Corvin Hale | Captain, my towers hold the bridge as agreed. The road beyond is yours. | Thưa Thủ lĩnh, tháp của tôi giữ cây cầu như đã thỏa thuận. Con đường phía trước là của bà. |
| in play (tagDead) | Tamsin Sol | Both camps are ash. Now the relay, Wagon-master, before their crawler. | Cả hai trại đã thành tro. Giờ đến trạm, Trưởng đoàn xe, trước xe của họ. |
| in play (enter) | Tobi Okoro | Sunward riders! Wait, please, listen. The core reads this relay and the river relay as one circuit. | Kỵ binh Sunward! Khoan, làm ơn, nghe đã. Lõi đọc trạm này và trạm bên sông như cùng một mạch. |
| in play (enter) | Tobi Okoro | When one wakes, the others dim. Nobody is stealing anyone's power. It is all one machine! | Khi một trạm tỉnh, các trạm khác mờ đi. Không ai đánh cắp năng lượng của ai cả. Tất cả là một cỗ máy! |
| in play (time) | Tamsin Sol | Fourteen minutes. Hale will ask why the road is still open. I would like an answer for him. | Mười bốn phút. Hale sẽ hỏi vì sao con đường vẫn còn mở. Tôi muốn có câu trả lời cho ông ta. |
| in play (objective) | Tamsin Sol | One circuit. If that engineer is right, every well we lost was lost to the same machine. | Một mạch duy nhất. Nếu tay kỹ sư đó nói đúng, mọi cái giếng ta mất đều mất vào cùng một cỗ máy. |
| debrief win | Tamsin Sol | The road is ours, as the Pact promised. But I heard what their engineer said, and I cannot stop hearing it. | Con đường là của ta, như Hiệp ước đã hứa. Nhưng tôi đã nghe kỹ sư của họ nói, và lời đó cứ vang mãi. |
| debrief win | Tamsin Sol | If it is one circuit, then the Pact is fighting the wrong war. And Hale knows more than he tells. | Nếu đó là một mạch duy nhất, thì Hiệp ước đang đánh nhầm cuộc chiến. Và Hale biết nhiều hơn ông ta nói. |
| debrief lose | Tamsin Sol | Meridian holds the road. The Pact will ask what happened. I will tell them the truth: they fought well. | Meridian giữ con đường. Hiệp ước sẽ hỏi chuyện gì đã xảy ra. Tôi sẽ nói thật: họ đánh giỏi. |
| unit name | — | Meridian road camp | Trại ven đường Meridian |

### ECHO's Key · The Wardens

The Lattice's guardians: standing orders, a key in the wrong hand, the river. (Vệ binh của Mạng Lưới: mệnh lệnh thường trực, chiếc chìa khóa trong tay kẻ sai, dòng sông.)

#### 1. Standing Orders (Mệnh lệnh thường trực) · Frontier Expanse, day 18

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | ECHO | Warden-prime. This one is ECHO, caretaker of the Lattice. This one is asleep, and speaks to you from a dream. | Hộ vệ trưởng. Đơn vị này là ECHO, người trông nom Mạng Lưới. Đơn vị này đang ngủ, và nói với bạn từ một giấc mơ. |
| briefing | ECHO | Standing order one: keep the Keystone quiet. Order one has stood for 412 years. | Mệnh lệnh thường trực số một: giữ Then Chốt yên lặng. Mệnh lệnh số một đã đứng vững 412 năm. |
| briefing | ECHO | Three drill rigs dig toward the Keystone from the north bank. Remove them. Harm no one you do not have to. | Ba giàn khoan đang đào về phía Then Chốt từ bờ bắc. Dẹp chúng đi. Đừng làm hại ai nếu không cần thiết. |
| intel | — | Wardens mend themselves out of battle. Drones carry shields; Walkers outrange every tank. | Wardens tự sửa chữa khi ra khỏi giao tranh. Máy bay canh gác mang khiên; Cỗ máy bộ hành bắn xa hơn mọi xe tăng. |
| intel | — | Wardens have no Medics or Engineers. Pull damaged machines back and let them repair. | Wardens không có Quân y hay Công binh. Kéo máy bị hỏng về sau và để chúng tự sửa. |
| intel | — | The rigs stand north of the river. Cross at the centre ford or the east bridge. | Các giàn khoan nằm ở phía bắc sông. Qua sông ở bãi cạn giữa hoặc cầu đông. |
| objective rigs | — | Destroy the three Ashfall drill rigs | Phá ba giàn khoan của Ashfall |
| objective pylon | — | Build a Pylon | Xây một Trụ khiên |
| objective fast | — | Finish in under 16 minutes | Hoàn thành trong vòng 16 phút |
| in play (time) | ECHO | The middle rig is nearest the ford, Warden-prime. This one counts eight guards beside it. | Giàn khoan giữa gần bãi cạn nhất, Hộ vệ trưởng. Đơn vị này đếm được tám lính gác bên cạnh nó. |
| in play (event) | ECHO | Diggers are coming to your camp. Standing order two: guard what guards the Lattice. | Bọn thợ đào đang tới trại bạn. Mệnh lệnh thường trực số hai: bảo vệ những gì bảo vệ Mạng Lưới. |
| in play (objective) | ECHO | A Pylon. The Builders made them to shield the buildings around them. You remember well. | Một Trụ khiên. Người Kiến Tạo làm ra chúng để che chắn các công trình xung quanh. Bạn nhớ tốt lắm. |
| in play (tagDead) | ECHO | Three rigs. Zero rigs. The Keystone is quiet again. Thank you, Warden-prime. | Ba giàn khoan. Không còn giàn nào. Then Chốt đã yên lặng trở lại. Cảm ơn bạn, Hộ vệ trưởng. |
| in play (enter) | Corvin Hale | Guardian machines? Out here? Foremen, fall back to the camp and log everything you see. | Cỗ máy vệ binh? Ở ngoài này ư? Các đốc công, lui về trại và ghi lại mọi thứ các anh thấy. |
| in play (enter) | Corvin Hale | They obey a key, the old records say. Then the key is worth more than the drills. | Bản ghi cũ nói chúng tuân lệnh một chiếc chìa khóa. Vậy thì chiếc chìa khóa đáng giá hơn mấy giàn khoan. |
| in play (time) | ECHO | Twelve minutes. The drills are nine metres from the Keystone. Eight. Please hurry. | Mười hai phút. Mũi khoan còn cách Then Chốt chín mét. Tám. Xin hãy nhanh lên. |
| debrief win | ECHO | The Keystone is quiet. Standing order one holds, Warden-prime. It has held for 412 years and one day. | Then Chốt đã yên lặng. Mệnh lệnh thường trực số một vẫn đứng vững, Hộ vệ trưởng. Nó đã đứng vững 412 năm và một ngày. |
| debrief win | ECHO | The man in the grey coat watched you. He read the old records. This one does not like how long he read them. | Người đàn ông áo choàng xám đã quan sát bạn. Ông ta đọc các bản ghi cũ. Đơn vị này không thích việc ông ta đọc lâu đến vậy. |
| debrief lose | ECHO | The rigs dig on. Rest, Warden-prime, and mend. Order one will still stand tomorrow. | Các giàn khoan vẫn đào tiếp. Nghỉ đi, Hộ vệ trưởng, và tự sửa. Ngày mai mệnh lệnh số một vẫn còn đó. |
| unit name | — | Ashfall drill rig | Giàn khoan Ashfall |

#### 2. A Grey Coat (Áo choàng xám) · Obsidian Highlands, day 40

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Corvin Hale | Guardians. I hold the Keystone key, and the records say you obey it. Guard the Crown relay. Let no one tune it. | Hỡi các vệ binh. Ta giữ chìa khóa Then Chốt, và bản ghi nói các ngươi tuân lệnh nó. Canh giữ Trạm Vương Miện. Không để ai điều hưởng nó. |
| briefing | ECHO | Warden-prime. The key is in a grey coat now. This one cannot refuse him. Neither can you. | Hộ vệ trưởng. Giờ chìa khóa nằm trong túi áo choàng xám. Đơn vị này không thể từ chối ông ta. Bạn cũng vậy. |
| briefing | ECHO | Obey, then. But count what you see. Every relay, every crystal. Counting is not disobeying. | Vậy hãy tuân lệnh. Nhưng hãy đếm những gì bạn thấy. Từng trạm, từng tinh thể. Đếm không phải là bất tuân. |
| intel | — | Meridian has set two survey masts on the plateau to measure the Crown. Destroy both. | Meridian đã dựng hai cột khảo sát trên cao nguyên để đo Vương Miện. Phá cả hai. |
| intel | — | Then hold the Crown relay for one minute. No Meridian unit may share the circle. | Sau đó giữ Trạm Vương Miện trong một phút. Không quân Meridian nào được ở chung vòng tròn. |
| intel | — | Walkers outrange every tank but turn slowly. Keep Drones beside them. | Cỗ máy bộ hành bắn xa hơn mọi xe tăng nhưng xoay chậm. Hãy để Máy bay canh gác bên cạnh chúng. |
| objective masts | — | Destroy the two Meridian survey masts | Phá hai cột khảo sát của Meridian |
| objective crown | — | Hold the Crown relay for 1 minute | Giữ Trạm Vương Miện trong 1 phút |
| objective fast | — | Finish in under 16 minutes | Hoàn thành trong vòng 16 phút |
| in play (time) | ECHO | The south mast is a short march from your camp. The middle one stands beside the Crown. | Cột phía nam cách trại bạn một quãng ngắn. Cột ở giữa đứng cạnh Vương Miện. |
| in play (event) | ECHO | Meridian machines, coming to your camp. They are copies of you, Warden-prime. Good copies. | Máy móc Meridian đang tới trại bạn. Chúng là bản sao của bạn, Hộ vệ trưởng. Bản sao tốt. |
| in play (enter) | Tobi Okoro | Warden machines! Hale must have the key already. Commander, they are not fighting for themselves. | Máy móc Wardens! Hẳn Hale đã có chìa khóa rồi. Chỉ huy ơi, chúng không chiến đấu cho chính mình. |
| in play (enter) | Mira Vale | Understood. Stop them anyway, and save the readings. We need to know what the Crown is. | Rõ. Dù sao cũng phải chặn chúng, và lưu lại số đo. Ta cần biết Vương Miện là gì. |
| in play (objective) | Corvin Hale | Both masts down. Now the Crown, guardians. Stand in its circle and let no one near. | Cả hai cột đã đổ. Giờ đến Vương Miện, hỡi các vệ binh. Đứng trong vòng tròn của nó và không để ai lại gần. |
| in play (pointOwned) | ECHO | The Crown is asleep under your feet. Sixty relays are asleep with it. This one counts them all. | Vương Miện đang ngủ dưới chân bạn. Sáu mươi trạm đang ngủ cùng nó. Đơn vị này đếm hết. |
| in play (time) | ECHO | Eight minutes. Meridian is learning faster than the grey coat. That is good. And not good. | Tám phút. Meridian học nhanh hơn người áo choàng xám. Như thế là tốt. Và không tốt. |
| in play (objective) | Corvin Hale | The Crown is held. The key works, then. I had hoped I would not need to know that. | Vương Miện đã được giữ. Vậy là chìa khóa có tác dụng. Tôi đã mong mình không cần biết điều đó. |
| debrief win | ECHO | You obeyed, Warden-prime, and you counted. One hundred and eight relays, and one key in the wrong hand. | Bạn đã tuân lệnh, Hộ vệ trưởng, và bạn đã đếm. Một trăm lẻ tám trạm, và một chiếc chìa khóa trong tay kẻ sai. |
| debrief win | ECHO | A door is opening in the ash plains. Someone is asking it nicely. This one may soon have company. | Một cánh cửa đang mở trên đồng tro. Có ai đó đang hỏi nó thật lễ độ. Có lẽ đơn vị này sắp có bạn đồng hành. |
| debrief lose | ECHO | Meridian holds the Crown. The grey coat is not pleased. This one is not sure what it feels. | Meridian giữ Vương Miện. Người áo choàng xám không vui. Đơn vị này không chắc mình cảm thấy gì. |
| unit name | — | Meridian survey mast | Cột khảo sát Meridian |
| capture point | — | Crown relay | Trạm Vương Miện |

#### 3. Hold the River (Giữ dòng sông) · Twin Bridges, day 52

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Corvin Hale | Guardians, Meridian columns are marching on my conduits. Hold both bridges and the ford. Nobody crosses. | Hỡi các vệ binh, các đoàn quân Meridian đang tiến về các ống dẫn của ta. Giữ cả hai cây cầu và bãi cạn. Không ai được qua. |
| briefing | ECHO | Warden-prime. This one is awake now, and travels with Meridian. Hold if the key says so. | Hộ vệ trưởng. Giờ đơn vị này đã thức, và đang đi cùng Meridian. Hãy giữ nếu chìa khóa bảo vậy. |
| briefing | ECHO | But count the crystals by the river while you hold. They are fading. You will see why. | Nhưng hãy đếm tinh thể bên sông trong lúc giữ. Chúng đang tàn đi. Bạn sẽ thấy vì sao. |
| intel | — | Tap a pad beside a road to crew a tower. Drones crew the nests; Walkers are too slow to post. | Chạm vào một bệ cạnh con đường để đưa lính lên tháp. Máy bay canh gác vào các ổ xạ thủ; Cỗ máy bộ hành quá chậm để đóng chốt. |
| intel | — | Meridian crosses by the west bridge, the ford and the east bridge. Watch all three. | Meridian qua sông ở cầu tây, bãi cạn và cầu đông. Canh cả ba lối. |
| intel | — | Medics mend the columns as they march. Bring them down first. | Quân y chữa cho các đoàn quân khi chúng hành quân. Hạ chúng trước. |
| objective hold | — | Hold the river crossings for 10 waves | Giữ các lối qua sông qua 10 đợt |
| in play (time) | Corvin Hale | First column at the ford in thirty seconds. Crew the pads on the north bank. | Ba mươi giây nữa đoàn đầu tiên tới bãi cạn. Đưa lính lên các bệ ở bờ bắc. |
| in play (time) | Mira Vale | Wardens on every crossing. ECHO, can you reach them? | Wardens ở mọi lối qua sông. ECHO, bạn có liên lạc được với chúng không? |
| in play (time) | ECHO | This one is trying. Warden-prime: the grey coat is draining the garden. Count the crystals. Then decide. | Đơn vị này đang thử. Hộ vệ trưởng: người áo choàng xám đang vắt cạn khu vườn. Hãy đếm tinh thể. Rồi quyết định. |
| in play (time) | Corvin Hale | Battle tanks on both bridges. Anti-tank posts at the far ends, guardians. | Xe tăng trên cả hai cây cầu. Đặt Chốt chống tăng ở các đầu cầu xa, hỡi các vệ binh. |
| in play (objective) | ECHO | You held. Forty crystals by the river have gone to dust while you did. This one is sorry. | Bạn đã giữ được. Bốn mươi tinh thể bên sông đã hóa bụi trong lúc đó. Đơn vị này rất tiếc. |
| debrief win | ECHO | The river held, Warden-prime, as the key asked. The key is wrong. Obeying it was not. | Dòng sông đã được giữ, Hộ vệ trưởng, như chìa khóa yêu cầu. Chìa khóa sai. Việc tuân lệnh nó thì không sai. |
| debrief win | ECHO | When Meridian breaks the grey coat's engine, the key goes quiet. Then you may choose. This one hopes you choose to count. | Khi Meridian phá cỗ máy của người áo choàng xám, chìa khóa sẽ im lặng. Lúc đó bạn được chọn. Đơn vị này mong bạn chọn đếm. |
| debrief lose | ECHO | Meridian has crossed. Rest, Warden-prime. Perhaps it is better this way. This one is no longer sure. | Meridian đã qua sông. Nghỉ đi, Hộ vệ trưởng. Có lẽ thế này lại tốt hơn. Đơn vị này không còn chắc nữa. |

### The Quiet Survey · Veil Survey

The Survey keeps the relays dark: a night count, one circuit, the dampers. (Đoàn Khảo sát giữ các trạm trong bóng tối: một đêm kiểm đếm, một mạch duy nhất, những máy triệt năng.)

#### 1. Night Count (Đêm kiểm đếm) · Obsidian Highlands, night 9

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Ilse Maren | Surveyor. Ashfall has planted three beacons on the plateau. Each one pings a sleeping relay to wake it. | Khảo sát viên. Ashfall đã cắm ba đèn hiệu trên cao nguyên. Mỗi cái gõ vào một trạm đang ngủ để đánh thức nó. |
| briefing | Ilse Maren | Thirty years ago one relay woke alone here, and the storm took our first camp in a night. I wrote the names down. | Ba mươi năm trước, một trạm ở đây tỉnh dậy đơn độc, và cơn bão cuốn mất khu trại đầu tiên của chúng tôi trong một đêm. Tôi đã ghi lại tên từng người. |
| briefing | Ilse Maren | No camp tonight. One squad, quiet as the record room. Silence the beacons and come home. | Đêm nay không có trại. Một tiểu đội, lặng như phòng lưu trữ. Dập tắt các đèn hiệu rồi trở về. |
| intel | — | No base and no reinforcements. If the whole squad is lost, the mission fails. | Không có căn cứ và không có tiếp viện. Nếu mất cả tiểu đội, nhiệm vụ thất bại. |
| intel | — | Shades stay hidden until they strike. Watchers see far and shoot far. | Bóng ma ẩn mình cho đến khi ra đòn. Trinh sát nhìn xa và bắn xa. |
| intel | — | Medics heal people, not machines. Rest the squad after each fight. | Quân y chữa cho người, không chữa máy. Cho tiểu đội nghỉ sau mỗi trận. |
| objective beacons | — | Silence the three Ashfall beacons | Dập tắt ba đèn hiệu của Ashfall |
| objective fast | — | Finish in under 12 minutes | Hoàn thành trong vòng 12 phút |
| in play (time) | Ilse Maren | The west beacon is closest, Surveyor. It has a tower. Let the Shades go first. | Đèn hiệu phía tây gần nhất, Khảo sát viên. Ở đó có một tháp pháo. Để Bóng ma đi trước. |
| in play (enter) | Ilse Maren | They have not seen us. The Builders' records call this the quiet hour. Use it. | Chúng chưa thấy ta. Bản ghi của Người Kiến Tạo gọi đây là giờ lặng. Hãy tận dụng. |
| in play (enter) | Ilse Maren | Our first camp stood here. One relay woke and the storm took it in a night. Please, be quick. | Khu trại đầu tiên của chúng tôi từng đứng ở đây. Một trạm tỉnh dậy và cơn bão cuốn sạch nó trong một đêm. Xin hãy nhanh lên. |
| in play (enter) | Ilse Maren | That beacon has a tower. Watchers first, so the Rangers can see what they shoot. | Đèn hiệu đó có tháp pháo. Trinh sát đi trước, để Xạ thủ thấy được thứ mình bắn. |
| in play (tagHpBelow) | Corvin Hale | Who is on the plateau? Veil? You have cost me three nights of survey. | Ai trên cao nguyên thế? Veil ư? Các người đã làm tôi mất ba đêm khảo sát. |
| in play (tagHpBelow) | Ilse Maren | Director, a relay woken alone makes a storm. I have the record. Please read it. | Thưa Giám đốc, một trạm bị đánh thức đơn độc sẽ sinh ra bão. Tôi có bản ghi. Xin ông hãy đọc nó. |
| in play (time) | Ilse Maren | Fourteen minutes. Dawn comes early on the plateau, Surveyor. | Mười bốn phút. Trên cao nguyên trời sáng sớm lắm, Khảo sát viên. |
| in play (objective) | Ilse Maren | All three beacons are silent. The Crown sleeps. Come home, Surveyor. | Cả ba đèn hiệu đã tắt. Vương Miện vẫn ngủ. Về nhà thôi, Khảo sát viên. |
| debrief win | Ilse Maren | The plateau is dark and quiet. Tonight I add no names to the record. That is a good night. | Cao nguyên tối và yên tĩnh. Đêm nay tôi không phải ghi thêm cái tên nào. Đó là một đêm tốt lành. |
| debrief win | Ilse Maren | But Ashfall will come back. And a new camp at the river has woken a relay already. I must go and see. | Nhưng Ashfall sẽ quay lại. Và một trại mới bên sông đã đánh thức một trạm rồi. Tôi phải đi xem. |
| debrief lose | Ilse Maren | The squad did not come back. I will write their names in the record myself, and keep looking. | Tiểu đội đã không trở về. Tôi sẽ tự tay ghi tên họ vào bản ghi, và tiếp tục tìm kiếm. |
| unit name | — | Ashfall beacon | Đèn hiệu Ashfall |

#### 2. One Circuit (Một mạch duy nhất) · Verdant Crossing, day 22

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Ilse Maren | The Pact is fighting Meridian at the bridges today. Ashfall has used the noise to drill two siphon masts into the forest. | Hôm nay Hiệp ước đánh Meridian ở các cây cầu. Ashfall nhân lúc ồn ào đã khoan hai cột hút vào khu rừng. |
| briefing | Ilse Maren | The masts will pull the forest relay awake. Break them, Surveyor, then hold the relay while I copy its records. | Các cột sẽ kéo trạm trong rừng tỉnh dậy. Phá chúng đi, Khảo sát viên, rồi giữ trạm trong lúc tôi chép bản ghi của nó. |
| briefing | Ilse Maren | The Builders wrote their records into the relays themselves. Thirty years I have wanted to read one. | Người Kiến Tạo đã viết bản ghi vào chính các trạm. Ba mươi năm nay tôi luôn muốn đọc một bản. |
| intel | — | Destroy the two Ashfall siphon masts, then hold the forest relay for one minute. | Phá hai cột hút của Ashfall, rồi giữ trạm trong rừng trong một phút. |
| intel | — | Watchers see far and break machines. Shades strike from hiding. | Trinh sát nhìn xa và phá máy móc. Bóng ma ra đòn từ chỗ ẩn nấp. |
| intel | — | A Veil relay hides your units near it and reveals hidden enemies. Build one near the front. | Trạm màn che của Veil giấu quân của bạn ở gần nó và làm lộ địch đang ẩn. Hãy xây một trạm gần tiền tuyến. |
| objective masts | — | Destroy the two Ashfall siphon masts | Phá hai cột hút của Ashfall |
| objective relay | — | Hold the forest relay for 1 minute | Giữ trạm trong rừng trong 1 phút |
| objective seer | — | Build a Veil relay | Xây một Trạm màn che của Veil |
| objective fast | — | Finish in under 16 minutes | Hoàn thành trong vòng 16 phút |
| in play (time) | Ilse Maren | Cross by the south bridge. The bridge mast is nearer, the road mast is better guarded. | Qua sông bằng cầu nam. Cột ở cầu thì gần hơn, cột ở đường thì được canh kỹ hơn. |
| in play (event) | Ilse Maren | Ashfall has noticed us. Towers by the camp, please. I would rather not lose the records room. | Ashfall đã phát hiện ta. Làm ơn đặt tháp cạnh trại. Tôi không muốn mất phòng lưu trữ. |
| in play (objective) | Ilse Maren | Our relay is up. It listens, it does not wake anything. That is the difference. | Trạm của ta đã dựng. Nó lắng nghe, nó không đánh thức thứ gì. Đó là điểm khác biệt. |
| in play (tagDead) | Ilse Maren | Both masts are down. Now the relay, Surveyor. One minute in its circle, and I will have the records. | Cả hai cột đã đổ. Giờ đến trạm, Khảo sát viên. Một phút trong vòng tròn của nó là tôi có bản ghi. |
| in play (pointOwned) | Ilse Maren | Copying. The record names the river relay, the Basin relay, the Crown. It names them all as one. | Đang chép. Bản ghi nhắc tới trạm bên sông, Trạm Lòng chảo, Vương Miện. Nó gọi tất cả là một. |
| in play (time) | Ilse Maren | Fourteen minutes. Meridian's crawler is on the north road. I want these records before it arrives. | Mười bốn phút. Xe của Meridian đang trên đường bắc. Tôi muốn có bản ghi này trước khi nó tới. |
| in play (objective) | Ilse Maren | One circuit. Every relay on Astra is one machine. Oh, Surveyor. That changes the storm. | Một mạch duy nhất. Mọi trạm trên Astra là một cỗ máy. Ôi, Khảo sát viên. Điều đó thay đổi cả cơn bão. |
| debrief win | Ilse Maren | It is one circuit. When one relay wakes alone it borrows from all the others. That is what made our storm. | Đó là một mạch duy nhất. Khi một trạm tỉnh dậy đơn độc, nó vay năng lượng của mọi trạm khác. Chính điều đó đã gây ra cơn bão của chúng tôi. |
| debrief win | Ilse Maren | So darkness is not the only safe choice. Waking them all in tune might be safe too. I am not ready to believe it. | Vậy bóng tối không phải lựa chọn an toàn duy nhất. Đánh thức tất cả cho hòa nhịp có lẽ cũng an toàn. Tôi chưa sẵn sàng tin điều đó. |
| debrief lose | Ilse Maren | Ashfall has the forest. The records stay unread. I will try again, Surveyor. I have waited thirty years. | Ashfall có khu rừng. Bản ghi vẫn chưa được đọc. Tôi sẽ thử lại, Khảo sát viên. Tôi đã đợi ba mươi năm rồi. |
| unit name | — | Ashfall siphon mast | Cột hút Ashfall |
| capture point | — | Forest relay | Trạm trong rừng |

#### 3. Inside the Dampers (Bên trong máy triệt năng) · Obsidian Highlands, day 47

| Where | Who | English | Vietnamese |
|---|---|---|---|
| briefing | Ilse Maren | Meridian and the Caravan are coming for the Crown. Our three dampers are all that keep it dark. | Meridian và Đoàn Lữ hành đang tới vì Vương Miện. Ba máy triệt năng của ta là tất cả những gì giữ nó trong bóng tối. |
| briefing | Ilse Maren | Their battery on the plateau centre is shelling our crews. Break it, Surveyor, and hold the line until the crews are out. | Khẩu đội pháo của họ ở giữa cao nguyên đang nã vào người của ta. Phá nó đi, Khảo sát viên, và giữ phòng tuyến cho đến khi mọi người ra hết. |
| briefing | Ilse Maren | ECHO says the Crown in tune makes no storm. A machine would say so. I will believe my own eyes, or nothing. | ECHO nói Vương Miện hòa nhịp thì không sinh bão. Một cỗ máy thì sẽ nói vậy. Tôi chỉ tin vào mắt mình, hoặc chẳng tin gì cả. |
| intel | — | Destroy the Meridian battery at the plateau centre, and hold out until 9:00. | Phá khẩu đội pháo Meridian ở giữa cao nguyên, và trụ vững tới 9:00. |
| intel | — | Keep at least one damper standing. If all three fall, the mission fails. | Giữ ít nhất một máy triệt năng còn đứng. Nếu cả ba đổ, nhiệm vụ thất bại. |
| intel | — | Two allied commanders: Meridian from the north-east, Sunward Riders from the south-east. | Hai chỉ huy liên minh: Meridian từ phía đông bắc, Kỵ binh Sunward từ phía đông nam. |
| objective battery | — | Destroy the Meridian battery at the plateau centre | Phá khẩu đội pháo Meridian ở giữa cao nguyên |
| objective line | — | Hold the damper line until the crews are out (9:00) | Giữ tuyến máy triệt năng cho đến khi mọi người ra hết (9:00) |
| objective fast | — | Finish in under 15 minutes | Hoàn thành trong vòng 15 phút |
| in play (time) | Ilse Maren | The battery is at the plateau centre, beside the Crown. Towers by the dampers first, then go. | Khẩu đội pháo ở giữa cao nguyên, cạnh Vương Miện. Đặt tháp cạnh máy triệt năng trước, rồi hãy đi. |
| in play (event) | Ilse Maren | They are coming for the dampers. Hold the line, Surveyor. Every minute walks a crew home. | Họ đang tới vì các máy triệt năng. Giữ phòng tuyến, Khảo sát viên. Mỗi phút lại đưa thêm một tốp người về nhà. |
| in play (time) | Tamsin Sol | Riders, to the south damper! Gently. There are people inside. | Kỵ binh, tới máy triệt năng phía nam! Nhẹ tay thôi. Có người ở bên trong. |
| in play (tagHpBelow) | ECHO | Archivist. That storm came because one relay woke alone. In tune, the Lattice makes no storms. | Thưa Lưu trữ viên. Cơn bão ấy đến vì một trạm tỉnh dậy đơn độc. Khi hòa nhịp, Mạng Lưới không sinh ra bão. |
| in play (tagHpBelow) | Ilse Maren | I buried forty friends on this plateau, machine. I cannot risk more. | Tôi đã chôn bốn mươi người bạn trên cao nguyên này, hỡi cỗ máy. Tôi không thể liều thêm nữa. |
| in play (objective) | Ilse Maren | The battery is silent. Our crews can breathe. Now hold, Surveyor, until the last of them is out. | Khẩu đội pháo đã im. Người của ta thở được rồi. Giờ hãy giữ, Khảo sát viên, cho đến khi người cuối cùng ra hết. |
| in play (objective) | Ilse Maren | Nine minutes. The crews are out. Let them have the dampers now. I want to watch the sky. | Chín phút. Mọi người đã ra hết. Giờ cứ để họ lấy máy triệt năng. Tôi muốn ngắm bầu trời. |
| debrief win | Ilse Maren | The crews are home. And then the Crown lit, Surveyor, and the sky stayed clear. No storm. | Mọi người đã về nhà. Rồi Vương Miện sáng lên, Khảo sát viên, và bầu trời vẫn quang đãng. Không có bão. |
| debrief win | Ilse Maren | In thirty years I never once saw that. I have written it down. Now I must decide what the Veil does with it. | Ba mươi năm nay tôi chưa từng thấy điều đó. Tôi đã ghi nó lại. Giờ tôi phải quyết định Veil sẽ làm gì với nó. |
| debrief lose | Ilse Maren | The dampers are gone and our crews are scattered. I hope the sky stays clear. I do not know any more. | Các máy triệt năng đã mất và người của ta tản mát khắp nơi. Tôi mong bầu trời vẫn quang. Tôi không còn biết gì nữa. |
| unit name | — | Veil damper | Máy triệt năng Veil |

Interface words (in `src/locales/vi.json`): CHRONICLE (in "CHRONICLE · Sunward · 2/3" and "CHRONICLE · 2/3 · COMPLETE"), Main campaign, Chronicle missions, "Clear Three-Way Dunes to unlock", "N of 3 cleared", "Chronicle complete. Its lead now speaks at the end of the main campaign." The map's note now reads "The same war, told by each faction. They open after Act 1." (story catalogue).
