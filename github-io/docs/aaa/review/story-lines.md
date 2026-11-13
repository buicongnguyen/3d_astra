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
