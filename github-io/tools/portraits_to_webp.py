"""Convert the cast bust PNGs rendered by tools/blender/render_cast_portraits.py to webp (Pillow).

    python tools/portraits_to_webp.py [folder]   (default public/portraits; PNGs are removed)
"""
import sys
from pathlib import Path
from PIL import Image

folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'public' / 'portraits'
for png in sorted(folder.glob('*.png')):
    Image.open(png).convert('RGB').save(png.with_suffix('.webp'), quality=84, method=6)
    png.unlink()
    print(png.stem, png.with_suffix('.webp').stat().st_size, 'bytes')
