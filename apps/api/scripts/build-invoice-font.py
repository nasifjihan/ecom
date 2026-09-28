"""
Builds assets/fonts/InvoiceSans-{Regular,Bold}.ttf: Noto Sans (Latin, punctuation, currency signs)
merged with Noto Sans Bengali (Bangla and ৳), so invoices need only one font. Both are SIL OFL 1.1
(assets/fonts/OFL.txt).

  pip install fonttools
  # the four static TTFs from https://github.com/notofonts/notofonts.github.io (fonts/*/hinted/ttf)
  python3 scripts/build-invoice-font.py <folder with NotoSans-*.ttf and NotoSansBengali-*.ttf>
"""
import os
import sys

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
LATIN = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x180))  # Latin-1 and Latin Extended-A
    + list(range(0x2000, 0x2070))  # general punctuation
    + list(range(0x20A0, 0x20C1))  # currency signs
    + [0x2116, 0x2122, 0x2190, 0x2192, 0x2212, 0x25CF, 0x2713]
)


def options():
    o = subset.Options()
    o.layout_features = ["*"]
    o.name_IDs = ["*"]
    o.notdef_outline = True
    o.hinting = False
    return o


for weight in ["Regular", "Bold"]:
    latin = TTFont(os.path.join(src, f"NotoSans-{weight}.ttf"))
    s = subset.Subsetter(options())
    s.populate(unicodes=LATIN)
    s.subset(latin)
    latin.save("/tmp/latin.ttf")

    bengali = TTFont(os.path.join(src, f"NotoSansBengali-{weight}.ttf"))
    s = subset.Subsetter(options())
    s.populate(unicodes=[u for u in bengali.getBestCmap() if u not in LATIN])
    s.subset(bengali)
    bengali.save("/tmp/bengali.ttf")

    merged = Merger().merge(["/tmp/latin.ttf", "/tmp/bengali.ttf"])
    names = {1: "Invoice Sans", 4: f"Invoice Sans {weight}", 6: f"InvoiceSans-{weight}", 16: "Invoice Sans", 17: weight}
    for rec in merged["name"].names:
        if rec.nameID in names:
            rec.string = names[rec.nameID]
    merged.save(os.path.join(out, f"InvoiceSans-{weight}.ttf"))
    print("wrote", f"InvoiceSans-{weight}.ttf")
