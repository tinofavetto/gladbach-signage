#!/usr/bin/env python3
"""Baut data/osm-scene.js aus OpenStreetMap-Daten rund um Borussia-Park und ESYON-Büro.

Aufruf:  python3 tools/build-osm.py            (lädt frisch über Overpass)
         python3 tools/build-osm.py osm.json   (nutzt eine gespeicherte Antwort)

Koordinaten: Meter, Ursprung = ORIGIN, x nach Osten, y nach Norden.
Daten © OpenStreetMap-Mitwirkende, ODbL 1.0.
"""
import json, math, sys, urllib.request, urllib.parse, pathlib

ORIGIN = (51.1738, 6.3860)          # zwischen Stadion und Büro
OFFICE = (51.1730489, 6.3866316)    # Helmut-Grashoff-Str. 20
RADIUS = 470                        # Radius der Diorama-Scheibe in m
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "osm-scene.js"

Q = f"""[out:json][timeout:90];(
way["building"](around:{RADIUS+60},{ORIGIN[0]},{ORIGIN[1]});
way["highway"](around:{RADIUS+150},{ORIGIN[0]},{ORIGIN[1]});
way["landuse"](around:{RADIUS+150},{ORIGIN[0]},{ORIGIN[1]});
way["leisure"](around:{RADIUS+150},{ORIGIN[0]},{ORIGIN[1]});
way["natural"](around:{RADIUS+150},{ORIGIN[0]},{ORIGIN[1]});
way["amenity"="parking"](around:{RADIUS+150},{ORIGIN[0]},{ORIGIN[1]});
node["natural"="tree"](around:{RADIUS},{ORIGIN[0]},{ORIGIN[1]});
);out geom tags;"""


def load():
    if len(sys.argv) > 1:
        return json.load(open(sys.argv[1]))
    req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                 data=urllib.parse.urlencode({"data": Q}).encode(),
                                 headers={"User-Agent": "esyon-gladbach-signage/1.0"})
    return json.load(urllib.request.urlopen(req, timeout=120))


def xy(lat, lon):
    return ((lon - ORIGIN[1]) * 111320 * math.cos(math.radians(ORIGIN[0])),
            (lat - ORIGIN[0]) * 110574)


def r(v):
    return round(v * 2) / 2


def pts(e):
    return [xy(p["lat"], p["lon"]) for p in e["geometry"]]


def centroid(P):
    return sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P)


def inside(pt, poly):
    x, y = pt
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def area(P):
    return abs(sum(P[i][0] * P[i - 1][1] - P[i - 1][0] * P[i][1] for i in range(len(P)))) / 2


def clip_line(P, R):
    """teilt eine Linie an der Kreisgrenze; Punkte außerhalb fallen weg."""
    out, cur = [], []
    for p in P:
        if math.hypot(*p) <= R:
            cur.append(p)
        else:
            if len(cur) > 1:
                out.append(cur)
            cur = []
    if len(cur) > 1:
        out.append(cur)
    return out


def clip_poly(P, R):
    """Polygon an die Scheibe anpassen: Punkte außerhalb auf den Rand ziehen."""
    Q = []
    for x, y in P:
        d = math.hypot(x, y)
        Q.append((x * R / d, y * R / d) if d > R else (x, y))
    return Q if area(Q) > 4 else None


def flat(P):
    return [v for p in P for v in (r(p[0]), r(p[1]))]


HEIGHTS = {"garage": 3, "garages": 3, "guardhouse": 3.5, "kiosk": 3, "shed": 3, "toilets": 3,
           "apartments": 15, "office": 13, "commercial": 11, "retail": 7, "industrial": 9,
           "military": 9, "service": 4, "terrace": 9, "hotel": 18, "fire_station": 8,
           "parking": 9, "grandstand": 7}

ROADW = {"motorway": 14, "trunk": 12, "primary": 11, "secondary": 9, "tertiary": 8,
         "unclassified": 6.5, "residential": 6, "living_street": 5, "service": 4,
         "pedestrian": 5, "footway": 2, "path": 1.6, "cycleway": 2.2, "track": 2.5, "steps": 2}

AREAKIND = {"grass": "grass", "meadow": "meadow", "greenery": "grass", "village_green": "grass",
            "forest": "forest", "wood": "forest", "scrub": "scrub", "grassland": "meadow",
            "farmland": "farm", "residential": "urban", "commercial": "urban", "retail": "urban",
            "industrial": "urban", "military": "urban", "construction": "dirt",
            "water": "water", "park": "grass", "pitch": "pitch", "sports_centre": "urban",
            "parking": "parking", "nature_reserve": None, "stadium": None}


def main():
    d = load()
    R = RADIUS
    office_pt = xy(*OFFICE)
    out = {"origin": ORIGIN, "radius": R, "office": None, "stadium": None, "pitch": None,
           "buildings": [], "roads": [], "areas": [], "trees": [], "treerows": [],
           "attribution": "© OpenStreetMap-Mitwirkende (ODbL)"}

    for e in d["elements"]:
        t = e.get("tags", {})
        if e["type"] == "node":
            p = xy(e["lat"], e["lon"])
            if math.hypot(*p) < R - 4:
                out["trees"].append([r(p[0]), r(p[1])])
            continue
        if "geometry" not in e:
            continue
        P = pts(e)

        if t.get("leisure") == "stadium":
            if "Borussia" in t.get("name", ""):
                out["stadium"] = flat(P[:-1])
            continue
        if t.get("leisure") == "pitch" and area(P) > 6000 and math.hypot(*centroid(P)) < 140:
            out["pitch"] = flat(P[:-1])
            continue

        if "building" in t:
            if math.hypot(*centroid(P)) > R - 6:
                continue
            if inside(office_pt, P):
                out["office"] = flat(P[:-1])
                continue
            lv = t.get("building:levels")
            try:
                h = float(lv) * 3.3 + 1 if lv else HEIGHTS.get(t["building"], 8)
            except ValueError:
                h = 8
            if t["building"] == "yes" and not lv:
                a = area(P)
                h = 4 if a < 120 else 8 if a < 900 else 12
            kind = t["building"]
            out["buildings"].append({"p": flat(P[:-1]), "h": r(h), "k": kind,
                                     "n": t.get("name", "")})
            continue

        if "highway" in t:
            hw = t["highway"]
            if hw not in ROADW or t.get("area") == "yes":
                continue
            for seg in clip_line(P, R - 2):
                out["roads"].append({"p": flat(seg), "w": ROADW[hw], "k": hw,
                                     "n": t.get("name", "")})
            continue

        if t.get("natural") == "tree_row":
            for seg in clip_line(P, R - 3):
                out["treerows"].append(flat(seg))
            continue

        key = t.get("landuse") or t.get("leisure") or t.get("natural") or (
            "parking" if t.get("amenity") == "parking" else None)
        kind = AREAKIND.get(key)
        if kind and P[0] == P[-1] and len(P) > 3:
            Q = clip_poly(P[:-1], R - 1)
            if Q:
                out["areas"].append({"p": flat(Q), "k": kind, "a": round(area(Q))})

    # große Flächen zuerst zeichnen, kleine darüber
    out["areas"].sort(key=lambda a: -a["a"])
    for a in out["areas"]:
        del a["a"]
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("// generiert von tools/build-osm.py — Daten © OpenStreetMap-Mitwirkende, ODbL 1.0\n"
                   "export const OSM = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(f"{OUT}: {len(out['buildings'])} Gebäude, {len(out['roads'])} Straßen, "
          f"{len(out['areas'])} Flächen, {len(out['trees'])} Bäume, office={'ok' if out['office'] else '—'}, "
          f"stadium={'ok' if out['stadium'] else '—'}, pitch={'ok' if out['pitch'] else '—'}, "
          f"{OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
