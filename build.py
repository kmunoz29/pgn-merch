#!/usr/bin/env python3
"""
Build the PGN merch site.

    python build.py

Reads products.py + template.html + styles.css + app.js, inlines the images
from assets/, and writes a single self-contained dist/index.html you can host
anywhere (GitHub Pages, Netlify, JMU web space, or just open in a browser).
"""
import base64
import html
import json
from pathlib import Path

import products as P

ROOT = Path(__file__).parent
ASSETS = ROOT / "assets"
DIST = ROOT / "dist"

_cache = {}
def data_uri(filename):
    """Return a base64 data URI for an image in assets/ (cached)."""
    if filename in _cache:
        return _cache[filename]
    path = ASSETS / filename
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    uri = f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()
    _cache[filename] = uri
    return uri


def esc(s):
    return html.escape(str(s), quote=True)


def price_label(v):
    """What the shopper sees. Numbers get a $ (and cents only when needed);
    a string like "TBA" passes straight through."""
    if isinstance(v, str):
        return esc(v)
    if isinstance(v, float) and not v.is_integer():
        return f"${v:.2f}"
    return f"${int(v)}"


def price_value(v):
    """What the cart does math with. TBA-style prices count as 0."""
    return 0 if isinstance(v, str) else v


def render_media(p):
    cat = esc(p["category"])
    if p.get("soldout"):
        badge = '<span class="badge soldout">Sold out</span>'
    elif p.get("badge"):
        badge = f'<span class="badge">{esc(p["badge"])}</span>'
    else:
        badge = ""
    overlay = f'<span class="cat-tag">{cat}</span>{badge}'

    colors = p.get("colors")
    if colors:
        slides = "".join(
            f'<img class="color-slide {"active" if i == 0 else ""}" '
            f'src="{data_uri(c["file"])}" alt="{esc(p["name"])} — {esc(c["name"])}">'
            for i, c in enumerate(colors)
        )
        return (f'<div class="card-media color-media"><div class="color-slides">{slides}</div>{overlay}</div>')

    imgs = p.get("images")
    if imgs:
        slides = "".join(
            f'<div class="slide" data-label="{esc(im["label"])}">'
            f'<img src="{data_uri(im["file"])}" alt="{esc(p["name"])} — {esc(im["label"])}"></div>'
            for im in imgs
        )
        dots = "".join(
            f'<span class="dot {"active" if i == 0 else ""}" data-dot="{i}"></span>'
            for i in range(len(imgs))
        )
        return (
            '<div class="card-media carousel">'
            f'<div class="slides">{slides}</div>'
            '<button class="car-nav prev" data-nav="-1" aria-label="Previous view">‹</button>'
            '<button class="car-nav next" data-nav="1" aria-label="Next view">›</button>'
            f'<div class="car-dots">{dots}</div>'
            f'<span class="car-label">{esc(imgs[0]["label"])}</span>'
            + (f'<span class="fit-ref">{esc(p["fit_ref"])}</span>' if p.get("fit_ref") else "")
            + f'{overlay}</div>'
        )

    if p.get("image"):
        fit = (f'<span class="fit-ref">{esc(p["fit_ref"])}</span>' if p.get("fit_ref") else "")
        return (f'<div class="card-media"><img src="{data_uri(p["image"])}" '
                f'alt="{esc(p["name"])}">{fit}{overlay}</div>')

    mark = P.CHAPTER["monogram"].replace(" · ", "").replace(" ", "")
    return (f'<div class="card-media"><div class="ph">'
            f'<span class="mono-mark">{esc(mark)}</span>'
            f'<span class="ph-name">{esc(p["name"])}</span></div>{overlay}</div>')


def render_swatches(p):
    colors = p.get("colors")
    if not colors:
        return ""
    dots = "".join(
        f'<button type="button" class="swatch {"active" if i == 0 else ""}" '
        f'data-i="{i}" style="background:{esc(c["hex"])}" title="{esc(c["name"])}" '
        f'aria-label="{esc(c["name"])}"></button>'
        for i, c in enumerate(colors)
    )
    return f'<div class="swatches">{dots}<span class="swatch-name">{esc(colors[0]["name"])}</span></div>'


def render_card(p):
    link = p.get("link")
    link_label = p.get("link_label", "Order online")

    # Coming Soon: show the card, but no sizes and no way to order it yet.
    # Set "coming_soon": True, or just give it the "Coming Soon" badge.
    soon = bool(p.get("coming_soon")) or p.get("badge") == "Coming Soon"

    stock = p.get("stock") or {}
    # products that link out, or aren't orderable yet, don't show size pickers
    if p.get("sizes") and not link and not soon:
        btns = ""
        for s in p["sizes"]:
            q = stock.get(s)
            attr = f' data-stock="{q}"' if q is not None else ""
            btns += f'<button class="size" data-size="{esc(s)}"{attr}>{esc(s)}</button>'
        sizes = f'<div class="sizes">{btns}</div>'
        if stock:
            rows = " ".join(f'<span class="stk" data-stk-size="{esc(s)}">{esc(s)}: {stock.get(s,0)}</span>'
                            for s in p["sizes"])
            sizes += f'<div class="stock-line" data-stock-for="{esc(p["name"])}">In stock — {rows}</div>'
    else:
        sizes = ""

    if link:
        add = (f'<a class="add add-link" href="{esc(link)}" target="_blank" '
               f'rel="noopener">{esc(link_label)} ↗</a>')
    elif soon:
        add = '<button class="add coming" disabled>Coming soon</button>'
    elif p.get("soldout"):
        add = '<button class="add soldout" disabled>Sold out</button>'
    else:
        add = '<button class="add" data-add="1">Add to order</button>'
    return (
        f'<article class="card" data-category="{esc(p["category"])}" '
        f'data-name="{esc(p["name"])}" data-price="{esc(price_value(p["price"]))}" '
        f'data-price-label="{price_label(p["price"])}">'
        f'{render_media(p)}'
        '<div class="card-body">'
        f'<h3>{esc(p["name"])}</h3>'
        f'<p class="desc">{esc(p["desc"])}</p>'
        f'{render_swatches(p)}'
        f'{sizes}'
        '<div class="card-foot">'
        f'<span class="price">{price_label(p["price"])}</span>{add}'
        '</div></div></article>'
    )



def render_deadline():
    d = getattr(P, "DEADLINE", {}) or {}
    if not d.get("date"):
        return ""
    return (f'<div class="deadline-banner">{esc(d.get("message","Orders close"))} '
            f'<strong>{esc(d["date"])}</strong></div>')


def render_analytics():
    gid = getattr(P, "ANALYTICS_ID", "") or ""
    if not gid:
        return ""
    gid = esc(gid)
    return (
        f'<script async src="https://www.googletagmanager.com/gtag/js?id={gid}"></script>\n'
        '<script>window.dataLayer=window.dataLayer||[];'
        'function gtag(){dataLayer.push(arguments);}gtag("js",new Date());'
        f'gtag("config","{gid}");</script>'
    )



def build():
    live = list(dict.fromkeys(p["category"] for p in P.PRODUCTS))
    pref = getattr(P, "CATEGORY_ORDER", []) or []
    # listed order first (skipping any with nothing in stock), then the rest
    cats = ["All"] + [c for c in pref if c in live] + [c for c in live if c not in pref]
    all_label = getattr(P, "ALL_LABEL", "") or "All"
    chips = "".join(
        f'<button class="chip {"active" if i == 0 else ""}" data-cat="{esc(c)}">'
        f'{esc(all_label if c == "All" else c)}</button>'
        for i, c in enumerate(cats)
    )
    FEATURED = ["Spring Recruitment T-Shirt 2026", "Fall Recruitment T-Shirt 2026", "Spring Away Weekend T-Shirt 2026", "Chapter Hoodie", "Flag", "PGN Shot Glass", "Parents Weekend T-Shirt 2026"]
    ordered = [p for name in FEATURED for p in P.PRODUCTS if p["name"] == name] \
              + [p for p in P.PRODUCTS if p["name"] not in FEATURED]
    cards = "".join(render_card(p) for p in ordered)
    pillars = "".join(f"<span>{esc(x)}</span>" for x in P.CHAPTER["pillars"])

    ch = P.CHAPTER
    foot_meta = " · ".join([ch["org_name"], ch["chapter"], ch["university"], ch["instagram"]])
    pay = getattr(P, "PAYMENT", {}) or {}
    config = {
        "orderEndpoint": P.ORDER_ENDPOINT,
        "token": getattr(P, "ORDER_TOKEN", ""),
        "merchEmail": ch["merch_email"],
        "university": ch["university"],
        "chapter": ch["chapter"],
        "payUrl": pay.get("cheddarup_url", ""),
        "payMsg": pay.get("instructions", ""),
        "ideaUrl": getattr(P, "IDEA_FORM_URL", ""),
    }

    out = (ROOT / "template.html").read_text(encoding="utf-8")
    swaps = {
        "{{STYLES}}":      (ROOT / "styles.css").read_text(encoding="utf-8"),
        "{{APP_JS}}":      (ROOT / "app.js").read_text(encoding="utf-8"),
        "{{CREST}}":       data_uri(P.CREST),
        "{{ORG_NAME}}":    esc(ch["org_name"]),
        "{{UNIVERSITY}}":  esc(ch["university"]),
        "{{CHAPTER}}":     esc(ch["chapter"]),
        "{{MONOGRAM}}":    esc(ch["monogram"]),
        "{{SLOGAN}}":      esc(ch["slogan"]),
        "{{PILLARS}}":     pillars,
        "{{CHIPS}}":       chips,
        "{{CARDS}}":       cards,
        "{{FOOT_META}}":   esc(foot_meta),
        "{{CONFIG_JSON}}": json.dumps(config),
        "{{DEADLINE_BANNER}}": render_deadline(),
        "{{ANALYTICS}}": render_analytics(),
    }
    for k, v in swaps.items():
        out = out.replace(k, v)

    DIST.mkdir(exist_ok=True)
    target = DIST / "index.html"
    target.write_text(out, encoding="utf-8")

    # GitHub Pages serves the copy in the repo root, so write it there too.
    # Saves having to remember `copy dist\index.html index.html` every time.
    root_copy = ROOT / "index.html"
    root_copy.write_text(out, encoding="utf-8")

    kb = len(out.encode()) / 1024
    print(f"✓ Built {target}  ({kb:.0f} KB, {len(P.PRODUCTS)} products)")
    print(f"  also wrote {root_copy}  (this is what GitHub Pages serves)")
    if not P.ORDER_ENDPOINT:
        print("  note: ORDER_ENDPOINT is empty — checkout shows a thank-you but")
        print("        orders aren't saved yet. See order-sheet/SETUP.md.")


if __name__ == "__main__":
    build()
