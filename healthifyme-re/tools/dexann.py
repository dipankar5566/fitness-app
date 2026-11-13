"""Minimal read-only DEX annotation parser: Retrofit endpoints + Gson/Moshi model fields."""
import struct, glob, json, sys

def uleb(b, o):
    r = s = 0
    while True:
        x = b[o]; o += 1
        r |= (x & 0x7f) << s; s += 7
        if x < 0x80: return r, o

class Dex:
    def __init__(self, path):
        b = self.b = open(path, "rb").read()
        u = lambda off: struct.unpack_from("<I", b, off)[0]
        self.ns, so = u(0x38), u(0x3C)
        self.str_off = struct.unpack_from("<%dI" % self.ns, b, so)
        nt, to = u(0x40), u(0x44)
        self.types = struct.unpack_from("<%dI" % nt, b, to)
        self.proto_off = u(0x4C)
        self.field_off = u(0x54)
        self.meth_off = u(0x5C)
        self.ncd, self.cd_off = u(0x60), u(0x64)
        self._sc = {}

    def s(self, i):
        if i in self._sc: return self._sc[i]
        _, o = uleb(self.b, self.str_off[i])
        e = self.b.index(b"\0", o)
        v = self.b[o:e].decode("utf-8", "replace"); self._sc[i] = v; return v
    def t(self, i): return self.s(self.types[i])
    def method(self, i):
        c, p, n = struct.unpack_from("<HHI", self.b, self.meth_off + 8 * i)
        return self.t(c), self.s(n), p
    def field(self, i):
        c, ty, n = struct.unpack_from("<HHI", self.b, self.field_off + 8 * i)
        return self.t(c), self.t(ty), self.s(n)
    def proto(self, i):
        _, ret, poff = struct.unpack_from("<III", self.b, self.proto_off + 12 * i)
        params = []
        if poff:
            n = struct.unpack_from("<I", self.b, poff)[0]
            params = [self.t(x) for x in struct.unpack_from("<%dH" % n, self.b, poff + 4)]
        return self.t(ret), params

    def value(self, o):
        h = self.b[o]; o += 1
        vt, va = h & 0x1f, h >> 5
        if vt == 0x1c:
            n, o = uleb(self.b, o); out = []
            for _ in range(n):
                v, o = self.value(o); out.append(v)
            return out, o
        if vt == 0x1d: return self.enc_ann(o)
        if vt == 0x1e: return None, o
        if vt == 0x1f: return bool(va), o
        raw = int.from_bytes(self.b[o:o + va + 1], "little"); o += va + 1
        if vt == 0x17: return self.s(raw), o
        if vt == 0x18: return self.t(raw), o
        if vt == 0x1b: return self.field(raw)[2], o
        return raw, o

    def enc_ann(self, o):
        ti, o = uleb(self.b, o); n, o = uleb(self.b, o); el = {}
        for _ in range(n):
            ni, o = uleb(self.b, o); v, o = self.value(o); el[self.s(ni)] = v
        return {"type": self.t(ti), "el": el}, o

    def ann_set(self, off):
        if not off: return []
        n = struct.unpack_from("<I", self.b, off)[0]; out = []
        for k in range(n):
            ao = struct.unpack_from("<I", self.b, off + 4 + 4 * k)[0]
            a, _ = self.enc_ann(ao + 1); out.append(a)
        return out

    def classes(self):
        for k in range(self.ncd):
            ci, _, _, _, _, ao, _, _ = struct.unpack_from("<8I", self.b, self.cd_off + 32 * k)
            yield self.t(ci), ao

    def annotations(self, ao):
        ca, nf, nm, np_ = struct.unpack_from("<4I", self.b, ao); o = ao + 16
        fa, ma, pa = [], [], []
        for _ in range(nf):
            fi, off = struct.unpack_from("<II", self.b, o); o += 8; fa.append((fi, self.ann_set(off)))
        for _ in range(nm):
            mi, off = struct.unpack_from("<II", self.b, o); o += 8; ma.append((mi, self.ann_set(off)))
        for _ in range(np_):
            mi, off = struct.unpack_from("<II", self.b, o); o += 8
            n = struct.unpack_from("<I", self.b, off)[0]
            sets = [self.ann_set(struct.unpack_from("<I", self.b, off + 4 + 4 * j)[0]) for j in range(n)]
            pa.append((mi, sets))
        return self.ann_set(ca), fa, ma, pa

HTTP = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "HTTP"}
PARAM = {"Body", "Query", "Path", "Field", "Part", "Header", "QueryMap", "FieldMap", "PartMap", "Url", "HeaderMap"}
SER = ("Lcom/google/gson/annotations/SerializedName;", "Lcom/squareup/moshi/Json;", "Lkotlinx/serialization/SerialName;",
       "Lzh/c;")  # Gson SerializedName, renamed by R8 in this build
def short(t): return t.rsplit("/", 1)[-1].rstrip(";")
def sig(anns):
    for a in anns:
        if a["type"] == "Ldalvik/annotation/Signature;": return "".join(a["el"]["value"])
    return None

endpoints, models = [], {}
for f in sorted(glob.glob(sys.argv[1] + "/classes*.dex")):
    d = Dex(f)
    for cname, ao in d.classes():
        if not ao: continue
        _, fa, ma, pa = d.annotations(ao)
        pmap = dict(pa)
        for mi, anns in ma:
            verb = [a for a in anns if a["type"].startswith("Lretrofit2/http/") and short(a["type"]) in HTTP]
            if not verb: continue
            v = verb[0]; _, mname, pi = d.method(mi); ret, params = d.proto(pi)
            sets = pmap.get(mi, [])
            ps = []
            for j, pt in enumerate(params):
                tag = ""
                for a in (sets[j] if j < len(sets) else []):
                    if a["type"].startswith("Lretrofit2/http/") and short(a["type"]) in PARAM:
                        val = a["el"].get("value")
                        tag = "@%s(%s)" % (short(a["type"]), val) if isinstance(val, str) else "@" + short(a["type"])
                ps.append({"ann": tag, "type": pt})
            endpoints.append({"verb": short(v["type"]), "path": v["el"].get("value") or v["el"].get("path"),
                              "iface": cname, "method": mname, "returns": sig(anns) or ret, "params": ps})
        flds = []
        for fi, anns in fa:
            for a in anns:
                if a["type"] in SER:
                    _, ft, fn = d.field(fi)
                    flds.append({"json": a["el"].get("value") or a["el"].get("name"), "field": fn, "type": sig(anns) or ft})
        if flds: models[cname] = flds
json.dump({"endpoints": endpoints, "models": models}, open(sys.argv[2], "w", encoding="utf-8"), indent=1)
print(len(endpoints), "endpoints;", len(models), "models with serialized fields")
