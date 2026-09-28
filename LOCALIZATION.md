# English and Vietnamese

Choose **Language / Ngôn ngữ** on the start screen, or open **Settings** during a paused game. English is the default. In Settings, **Apply settings / Áp dụng** saves the choice; **Cancel / Hủy** discards the draft.

The choice is saved independently in each game. Switching languages does not restart the match, spend resources, clear production queues, change saved campaign progress or remap keyboard shortcuts.

## Implementation

- Three.js uses github-io/src/locales/vi.json and github-io/src/i18n.js. The presentation adapter preserves original English text and translates changed text nodes and accessible labels. It never changes HTML, element IDs, option values, game definitions or order types. Weak references track live text nodes; the translation cache is bounded. Numeric-only values are skipped, and the observer is disconnected in English.
- Godot uses the same catalog at data/vi.json. scripts/language_translation.gd provides a [Godot Translation resource](https://docs.godotengine.org/en/stable/classes/class_translation.html) for native controls; custom-drawn command captions use tr(). The resource is unregistered when the game exits.
- The catalogs cover menus, command labels, object names/descriptions, training, objectives and gameplay feedback. Full-message patterns preserve numbers and translate embedded object names. Unknown text falls back to its English source.
- Compact labels such as **Thợ mỏ**, **Tiến đánh**, **Nhà máy** and **Chống tăng** fit the command tiles. Descriptions and tooltips carry longer explanations.
- The Three.js start screen uses a dropdown; Godot uses two 44-pixel-high buttons, suitable for touch.

## Extending translations

Add exact English/Vietnamese pairs to messages. Use an anchored regular expression in patterns for dynamic text and {1}, {2}, etc. for captured values. Put specific patterns before general ones; avoid matching a common word anywhere inside a sentence. Keep the two copies of vi.json identical.

Keep shortcuts, entity IDs and simulation data unchanged. Do not translate resource/type keys before game logic compares them. For DOM text comparisons, compare the canonical source or its translated presentation explicitly.

## Checks

- Three.js: npm test, npm run build, npm run test:language.
- Godot: headless tests/language_test.gd, Web export, npm run test:language.
- Browser checks cover saved language, reverting Settings drafts, switching during active production, readable Vietnamese command labels and desktop/phone layouts. The release workflows include the language checks.
- Mobile browser checks emulate touch; they are not physical Android performance measurements.
