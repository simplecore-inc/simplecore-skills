"""The figure reference check: links, captions, placements, copies."""
import re

# ── references ─────────────────────────────────────────────────────────────
MD_IMAGE = re.compile(r"!\[([^\]]*)\]\(([^)]+\.svg)\)")


FENCE = re.compile(r"^```.*?^```", re.S | re.M)


def references(cfg):
    """(problems, links, placed, files) for the figure references, or None.

    Every figure a manuscript links or a deck places exists; none is linked
    twice in one manuscript; each link's caption matches its alternative text
    when `caption` is set; a deck's copy of a figure equals the source when
    `copies` is set; and no figure file is left that nothing links or places.
    Always over the whole set, whatever names were asked for, because an
    unplaced file is a property of the set. A fenced code block shows the
    manuscript format, so a link inside one is an example and is skipped.
    """
    spec = cfg.get("references")
    if not spec:
        return None
    out_dir = cfg.out
    problems, used, links = [], set(), 0
    caption = re.compile(spec["caption"]) if spec.get("caption") else None
    for pattern in spec.get("manuscripts", []):
        for md in cfg.glob(pattern):
            seen = {}
            text = FENCE.sub("", md.read_text(encoding="utf-8"))
            rel = cfg.rel(md)
            for m in MD_IMAGE.finditer(text):
                links += 1
                alt, href = m.groups()
                target = (md.parent / href).resolve()
                seen[target] = seen.get(target, 0) + 1
                if not target.exists():
                    problems.append(f"broken link {rel} -> {href}")
                if caption:
                    c = caption.match(text, m.end())
                    if not c:
                        problems.append(f"missing caption {rel} -> {href}")
                    elif c.group(1).strip() != alt.strip():
                        problems.append(f"caption differs {rel} -> {href}: "
                                        f"{alt.strip()!r} != {c.group(1).strip()!r}")
                used.add(target)
            for target, n in seen.items():
                if n > 1:
                    problems.append(f"linked {n} times in {rel} -> {target.name}")
    by_md = set(used)
    for place in spec.get("placements", []):
        rx = re.compile(place["pattern"])
        copies = cfg.resolve(place["copies"]) if place.get("copies") else None
        for page in cfg.glob(place["glob"]):
            for stem in rx.findall(page.read_text(encoding="utf-8")):
                drawn = out_dir / f"{stem}.svg"
                if not drawn.exists():
                    problems.append(f"no figure for {cfg.rel(page)} -> {stem}")
                    continue
                used.add(drawn.resolve())
                if copies is not None:
                    copy = copies / f"{stem}.svg"
                    if not copy.exists():
                        problems.append(f"no copy at {cfg.rel(copy)} for "
                                        f"{cfg.rel(page)}")
                    elif copy.read_bytes() != drawn.read_bytes():
                        problems.append(f"stale copy {cfg.rel(copy)} differs "
                                        f"from {cfg.rel(drawn)}")
    files = {f.resolve() for f in out_dir.glob("*.svg")}
    for f in sorted(files - used):
        problems.append(f"placed nowhere: {cfg.rel(f)}")
    return problems, links, len(used - by_md), len(files)
