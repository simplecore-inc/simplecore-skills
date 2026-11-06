"""Shortest paths from GC roots to every instance of a class in an HPROF dump, without Eclipse MAT.

Usage: python3 hprof-paths.py <dump.hprof> <class name> [max instances] [strong|soft] [paths|referrers|strings]

  strong     follows strong references only (the default)
  soft       also follows SoftReference and FinalReference referents, labelled as such
  paths      the shortest chain from a GC root to each instance (the default)
  referrers  four levels of direct referrers of each instance
  strings    each instance's String fields, decoded (pool names, JDBC URLs)

Weak references and the implicit instance-to-class edge are never followed. Take the dump with
`jcmd <pid> GC.heap_dump <file>` (live objects only) and delete it by name afterwards.
Needs numpy; a 450 MB dump reads in about 15 seconds.
"""
import mmap
import struct
import sys
from collections import deque

import numpy as np

BASIC_SIZE = {2: None, 4: 1, 5: 2, 6: 4, 7: 8, 8: 1, 9: 2, 10: 4, 11: 8}
ROOT_NAMES = {0xFF: "unknown", 0x01: "jni-global", 0x02: "jni-local", 0x03: "java-frame",
              0x04: "native-stack", 0x05: "sticky-class", 0x06: "thread-block",
              0x07: "monitor-used", 0x08: "thread-object"}


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    path, target_name = sys.argv[1], sys.argv[2]
    max_paths = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    f = open(path, "rb")
    m = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    end_header = m.find(b"\0")
    ids = struct.unpack(">I", m[end_header + 1:end_header + 5])[0]
    assert ids == 8, "only 8-byte identifiers are handled"
    pos = end_header + 1 + 4 + 8
    rid = lambda p: int.from_bytes(m[p:p + 8], "big")
    BASIC_SIZE[2] = ids

    strings = {}
    class_name_id = {}
    classes = {}  # class id -> (super id, loader id, [(name id, type)] instance fields, statics [(name, value id)])
    roots = {}
    src, dst, lab = [], [], []
    labels = {}
    label_list = []
    instances = []  # (object id, class id, data offset, data length)
    byte_arrays = {}
    obj_class = {}

    def label(text):
        i = labels.get(text)
        if i is None:
            i = len(label_list)
            labels[text] = i
            label_list.append(text)
        return i

    size = len(m)
    while pos < size:
        tag = m[pos]
        length = struct.unpack(">I", m[pos + 5:pos + 9])[0]
        body = pos + 9
        if tag == 0x01:
            strings[rid(body)] = m[body + 8:body + length].decode("utf-8", "replace")
        elif tag == 0x02:
            class_name_id[rid(body + 4)] = rid(body + 16)
        elif tag in (0x0C, 0x1C):
            p = body
            stop = body + length
            while p < stop:
                sub = m[p]
                p += 1
                if sub in ROOT_NAMES:
                    roots.setdefault(rid(p), ROOT_NAMES[sub])
                    p += {0xFF: 8, 0x01: 16, 0x02: 16, 0x03: 16, 0x04: 12, 0x05: 8, 0x06: 12,
                          0x07: 8, 0x08: 16}[sub]
                elif sub == 0x20:
                    cid = rid(p)
                    sup = rid(p + 12)
                    loader = rid(p + 20)
                    p += 8 + 4 + 8 * 6 + 4
                    cp = struct.unpack(">H", m[p:p + 2])[0]
                    p += 2
                    for _ in range(cp):
                        t = m[p + 2]
                        p += 3 + BASIC_SIZE[t]
                    ns = struct.unpack(">H", m[p:p + 2])[0]
                    p += 2
                    statics = []
                    for _ in range(ns):
                        name = rid(p)
                        t = m[p + 8]
                        if t == 2:
                            statics.append((name, rid(p + 9)))
                        p += 9 + BASIC_SIZE[t]
                    nf = struct.unpack(">H", m[p:p + 2])[0]
                    p += 2
                    fields = []
                    for _ in range(nf):
                        fields.append((rid(p), m[p + 8]))
                        p += 9
                    classes[cid] = (sup, loader, fields, statics)
                elif sub == 0x21:
                    oid = rid(p)
                    cid = rid(p + 12)
                    n = struct.unpack(">I", m[p + 20:p + 24])[0]
                    instances.append((oid, cid, p + 24, n))
                    p += 24 + n
                elif sub == 0x22:
                    oid = rid(p)
                    n = struct.unpack(">I", m[p + 12:p + 16])[0]
                    acid = rid(p + 16)
                    obj_class[oid] = acid
                    base = p + 24
                    raw = np.frombuffer(m, dtype=">u8", count=n, offset=base) if n else None
                    if n:
                        nz = raw[raw != 0].astype(np.int64)
                        src.append(np.full(len(nz), oid, dtype=np.int64))
                        dst.append(nz)
                        lab.append(np.full(len(nz), -1, dtype=np.int32))
                    p = base + 8 * n
                elif sub == 0x23:
                    n = struct.unpack(">I", m[p + 12:p + 16])[0]
                    t = m[p + 16]
                    if t == 8:
                        byte_arrays[rid(p)] = (p + 17, n)
                    p += 17 + n * BASIC_SIZE[t]
                else:
                    raise ValueError("unknown sub-record 0x%x at %d" % (sub, p - 1))
        pos = body + length

    def cname(cid):
        return strings.get(class_name_id.get(cid), "?%x" % cid).replace("/", ".")

    # Reference field offsets per class, own fields first, then the superclass chain.
    ref_cid = next(c for c in classes if cname(c) == "java.lang.ref.Reference")
    layout = {}
    SOFT = len(sys.argv) > 4 and sys.argv[4] == "soft"

    def soft_kind(cid):
        c = cid
        while c and c in classes:
            n = cname(c)
            if n in ("java.lang.ref.SoftReference", "java.lang.ref.FinalReference"):
                return n.rsplit(".", 1)[-1] + " " + cname(cid)
            c = classes[c][0]
        return None

    def offsets(cid):
        got = layout.get(cid)
        if got is not None:
            return got
        out = []
        off = 0
        c = cid
        while c and c in classes:
            sup, _, fields, _ = classes[c]
            for name_id, t in fields:
                if t == 2:
                    fname = strings.get(name_id, "?")
                    weak = c == ref_cid and fname in ("referent", "discovered")
                    if weak and fname == "referent" and SOFT and soft_kind(cid):
                        out.append((off, label("(%s referent)" % soft_kind(cid))))
                    elif not weak:
                        out.append((off, label(cname(c).rsplit(".", 1)[-1] + "." + fname)))
                off += BASIC_SIZE[t]
            c = sup
        layout[cid] = out
        return out

    s_buf, d_buf, l_buf = [], [], []
    for oid, cid, data, n in instances:
        obj_class[oid] = cid
        for off, lb in offsets(cid):
            v = int.from_bytes(m[data + off:data + off + 8], "big")
            if v:
                s_buf.append(oid)
                d_buf.append(v)
                l_buf.append(lb)
    for cid, (sup, loader, _, statics) in classes.items():
        obj_class.setdefault(cid, None)
        for name_id, v in statics:
            if v:
                s_buf.append(cid)
                d_buf.append(v)
                l_buf.append(label("static " + cname(cid) + "." + strings.get(name_id, "?")))
        if loader:
            s_buf.append(cid)
            d_buf.append(loader)
            l_buf.append(label("<class loader>"))
    src.append(np.array(s_buf, dtype=np.int64))
    dst.append(np.array(d_buf, dtype=np.int64))
    lab.append(np.array(l_buf, dtype=np.int32))
    S = np.concatenate(src)
    D = np.concatenate(dst)
    L = np.concatenate(lab)
    order = np.argsort(D, kind="stable")
    S, D, L = S[order], D[order], L[order]
    print("objects %d, classes %d, edges %d, roots %d" % (len(obj_class), len(classes), len(S), len(roots)))

    def referrers(oid):
        lo = np.searchsorted(D, oid, "left")
        hi = np.searchsorted(D, oid, "right")
        return zip(S[lo:hi].tolist(), L[lo:hi].tolist())

    def describe(oid):
        c = obj_class.get(oid)
        if oid in classes:
            return "class " + cname(oid)
        return (cname(c) if c else "?") + "@%x" % oid

    targets = [oid for oid, cid, _, _ in instances if cname(cid) == target_name]
    print("instances of %s: %d" % (target_name, len(targets)))
    inst_at = {oid: (cid, data) for oid, cid, data, _ in instances}

    def fields_of(oid):
        cid, data = inst_at[oid]
        out = {}
        off = 0
        c = cid
        while c and c in classes:
            sup, _, fields, _ = classes[c]
            for name_id, t in fields:
                size = BASIC_SIZE[t]
                raw = m[data + off:data + off + size]
                out.setdefault(strings.get(name_id, "?"), (t, int.from_bytes(raw, "big")))
                off += size
            c = sup
        return out

    def text(oid):
        if not oid or oid not in inst_at:
            return None
        f = fields_of(oid)
        v = f.get("value")
        if not v or v[1] not in byte_arrays:
            return None
        start, n = byte_arrays[v[1]]
        coder = f.get("coder", (0, 0))[1]
        return m[start:start + n].decode("latin-1" if coder == 0 else "utf-16-be", "replace")

    if len(sys.argv) > 5 and sys.argv[5] == "strings":
        for t in targets[:max_paths]:
            f = fields_of(t)
            print(describe(t), {k: text(v) for k, (ty, v) in f.items() if ty == 2 and text(v) is not None})
        return
    if len(sys.argv) > 5 and sys.argv[5] == "referrers":
        for t in targets[:max_paths]:
            print("\n== %s" % describe(t))
            level = [(t, "")]
            for depth in range(4):
                nxt = []
                for o, ind in level:
                    for r, lb in referrers(o):
                        print("   %s<-%s- %s" % (ind, label_list[lb] if lb >= 0 else "[]", describe(r)))
                        nxt.append((r, ind + "  "))
                level = nxt[:30]
        return
    for t in targets[:max_paths]:
        parent = {t: None}
        q = deque([t])
        found = None
        while q:
            o = q.popleft()
            if o in roots:
                found = o
                break
            for r, lb in referrers(o):
                if r not in parent:
                    parent[r] = (o, lb)
                    q.append(r)
        print("\n== %s" % describe(t))
        if found is None:
            print("   no strong path to a GC root (only weak or implicit edges)")
            continue
        chain = []
        o = found
        while o is not None:
            nxt = parent[o]
            chain.append((o, nxt[1] if nxt else None))
            o = nxt[0] if nxt else None
        print("   root (%s) %s" % (roots[found], describe(found)))
        for o, lb in chain[:-1]:
            print("     --%s--> %s" % (label_list[lb] if lb >= 0 else "[]", describe(parent[o][0])))


if __name__ == "__main__":
    main()
