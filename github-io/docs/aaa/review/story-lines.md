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
