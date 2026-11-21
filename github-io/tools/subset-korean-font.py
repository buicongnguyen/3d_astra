"""Builds the Korean UI font: Noto Sans KR (OFL), cut to the Hangul the game uses.

The game's own faces (Baloo 2, Inter / Segoe UI / Arial stacks) have no Hangul. The page names
"Frontier KR" in its font stacks only while Korean is shown (src/language.css), and the
@font-face carries a Hangul-only unicode-range, so English and Vietnamese players never fetch it.

Subset = every Hangul syllable / jamo / CJK punctuation in src/locales/ko.json and
story-ko.json, and nothing else (a full KS X 1001 set would cost far more). After new Korean text,
run this again; tests/i18n-ko.test.js fails while a catalog uses a syllable the font lacks.

  python tools/subset-korean-font.py <path to NotoSansKR[wght].ttf>

Source: https://github.com/google/fonts/tree/main/ofl/notosanskr (variable, wght 100-900).
Output: src/fonts/noto-sans-kr-subset.woff2 (variable, wght 400-800) and
src/fonts/noto-sans-kr-chars.txt (the characters it covers).
"""
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ROOT / "src" / "locales"
FONTS = ROOT / "src" / "fonts"


def korean_chars():
    chars = set()
    for name in ("ko.json", "story-ko.json"):
        catalog = json.loads((LOCALES / name).read_text(encoding="utf8"))
        values = list(catalog.get("messages", {}).values()) + [t for _, t in catalog.get("patterns", [])]
        for text in values:
            for ch in text:
                cp = ord(ch)
                if 0xAC00 <= cp <= 0xD7A3 or 0x1100 <= cp <= 0x11FF or 0x3130 <= cp <= 0x318F or 0x3000 <= cp <= 0x303F:
                    chars.add(ch)
    # The language picker's own label.
    chars.update("한국어")
    return "".join(sorted(chars))


def main(source):
    chars = korean_chars()
    font = TTFont(source)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "ccmp", "locl", "mark", "mkmk"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.hinting = False
    sub = subset.Subsetter(options)
    sub.populate(text=chars)
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, {"wght": (400, 800)})
    out = FONTS / "noto-sans-kr-subset.woff2"
    font.flavor = "woff2"
    font.save(out)
    (FONTS / "noto-sans-kr-chars.txt").write_text(chars + "\n", encoding="utf8")
    print(f"{len(chars)} characters, {out.stat().st_size} bytes -> {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
