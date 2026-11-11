"""Render labelled game-angle color and greyscale approval sheets from exported candidates."""
import sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import preview_assets
ROOT=HERE.parents[1]
OUT=ROOT/'docs/aaa/review';OUT.mkdir(parents=True,exist_ok=True)
FACTIONS={'ashfall':(['scrapper','scorcher','salvageyard'],'ef7660'),'sunward':(['rider','wagon','waystation'],'edc76f'),'wardens':(['drone','walker','pylon'],'689dff'),'veil':(['shade','watcher','veilrelay'],'b397ee')}
for faction,(types,color) in FACTIONS.items():
    for grey in [False,True]:
        suffix='-greyscale' if grey else '-color'
        sys.argv=['preview_assets.py','--',str(OUT/(faction+suffix+'.png')),'game',*types,'--team='+color,*(['--greyscale'] if grey else [])]
        preview_assets.main()
