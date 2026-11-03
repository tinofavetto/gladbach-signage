# ESYON Gladbach Live

Digital-Signage-Szene für das ESYON-Büro in Mönchengladbach (Helmut-Grashoff-Str. 20):
ein isometrisches three.js-Diorama mit dem ista-Borussia-Park und der echten Umgebung aus
OpenStreetMap, live mit Wetter, Sonnenstand, Borussia-Ergebnis und RP-Schlagzeilen.

## Was passiert auf dem Screen

- **Echte Umgebung:** Gebäude, Straßen, Parkplätze, Wiesen, Bäume und Stadion stammen aus
  OpenStreetMap (`data/osm-scene.js`). Die Bäume tragen die Farben der Jahreszeit.
- **Tag und Nacht:** Sonne und Mond (mit Mondphase) werden für Gladbach in Echtzeit berechnet.
  Morgens Sonnenaufgang, abends Dämmerung, nachts brennen Laternen, Fenster und die Stadionfassade.
- **Wetter (Open-Meteo, alle 10 min):** Wolken ziehen mit der echten Windrichtung, Regen, Schnee
  mit wachsender Schneedecke, Nebel, Gewitter mit Blitzen. Die Bäume wiegen sich im Wind.
- **Das Büro:** Tino, Ben, Steffi und Labrador Hilde. Das rote Model Y fährt morgens vor,
  abends fährt es wieder weg. Am Vormittag gibt es Kaffeerunden, und Hilde besucht die Schreibtische.
  - **12:00–12:40 Mittagsdarts** (501, Double-Out): Die Pfeile fliegen, die Punkte stehen an der Kreidetafel und im Overlay.
  - **12:40–13:20 Gassirunde** mit Hilde ums Stadion, inklusive Ballwerfen.
- **Borussia (OpenLigaDB, alle 15 min):** letztes Ergebnis, Form, Tabellenplatz und nächstes Spiel.
  Das Ergebnis läuft auch über das Medienband der Stadionfassade. **Am Heimspieltag** strömen
  Fans zum Stadion, beim Spiel brennt das Flutlicht, auf dem Rasen wird gespielt und auf den Rängen läuft die La-Ola.
- **RP Online:** Schlagzeilen aus Mönchengladbach und zur Borussia im Ticker und auf der LED-Tafel an der Straße.
- **Umgebung:** Verkehr nach Tageszeit, Flugzeuge mit Kondensstreifen, Wildgänse im Herbst,
  fallendes Laub und ein Mähroboter auf dem Rasen.
- **Kameraregie:** Totale, Büro-Nahaufnahme (das Dach blendet aus), Stadion, LED-Tafel und
  Umgebung im Wechsel. Zur Darts-Zeit und beim Gassigehen folgt die Kamera dem Geschehen.

## Veröffentlichen (GitHub Pages)

1. Repo anlegen, Inhalt dieses Ordners pushen.
2. *Settings → Pages → Deploy from a branch → `main` / root*.
3. *Settings → Actions → General → Workflow permissions → Read and write* aktivieren.
   Dann schreibt der Workflow `feeds.yml` die RP-Schlagzeilen alle 30 Minuten nach `data/feeds.json`.
   Ohne den Workflow holt die Seite die Schlagzeilen über rss2json.com bzw. öffentliche Proxys.

Es gibt keinen Build-Schritt. three.js kommt per Import-Map von jsDelivr (Version 0.170.0).

## Auf dem Signage-Screen

Chrome oder Chromium im Kiosk-Modus, z. B.:

```
chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required https://<user>.github.io/<repo>/
```

- Die Seite lädt sich täglich um 4:00 Uhr neu und nach einem Verlust des WebGL-Kontexts auch.
- Bei Netzausfall bleiben die letzten Werte stehen (in `localStorage` gespeichert).
- Schwache Hardware: `?q=low` (weniger Schatten, kein Bloom und kein Tilt-Shift, weniger Partikel).
  Mit `?fps=30` lässt sich die Bildrate begrenzen.

## URL-Parameter zum Testen

| Parameter | Wirkung |
|---|---|
| `?t=12:05` | Uhrzeit vorstellen (läuft ab da weiter); auch `?t=2026-11-21T14:30` |
| `?speed=60` | Zeitraffer (60 = eine Minute pro Sekunde) |
| `?wetter=regen` | `klar`, `wolkig`, `bedeckt`, `nebel`, `niesel`, `regen`, `starkregen`, `schnee`, `gewitter` |
| `?shot=buero` | Kamera festhalten: `weit`, `buero`, `darts`, `gassi`, `stadion`, `tafel`, `umgebung` |
| `?anstoss=-60` | Heimspiel simulieren (Minuten relativ zum Anpfiff, negativ = davor) |
| `?wochenende` | Büro leer, wie am Wochenende |
| `?debug` | fps, Draw-Calls und Dreiecke im Fenstertitel |

Beispiel: `index.html?t=11:58&speed=20&shot=darts` zeigt den Start der Darts-Runde im Zeitraffer.

## Anpassen

- **Figuren, Farben, Ankunftszeiten, Darts- und Gassizeiten, Autofarbe:** `src/config.js`
- **Umgebung neu aus OSM laden:** `python3 tools/build-osm.py` (Radius und Mittelpunkt oben im Skript)
- Aufbau: `welt.js` (Gelände, Gebäude, Bäume), `stadion.js`, `buero.js` (Innenraum und Tagesablauf),
  `himmel.js` (Licht und Wetter), `leben.js` (Verkehr, Flugzeuge, Fans), `werbetafel.js`, `hud.js`, `main.js` (Regie).

## Quellen und Lizenzen

- Kartendaten © OpenStreetMap-Mitwirkende, ODbL 1.0
- Wetter: Open-Meteo.com (CC BY 4.0)
- Fußballdaten: OpenLigaDB
- Schlagzeilen: RP Online (RSS). Angezeigt werden nur Titel mit Quellenangabe, gedacht für den internen Bildschirm im Büro.
- Vereinsfarben ja, Vereinswappen bewusst nicht: Die Szene verwendet keine Logos der Borussia.
