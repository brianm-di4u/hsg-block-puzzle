# Thermal Blocks: town content

Every place, fact, name, color and story used in the game, with its source in the shared corpus
(`research/`). Nothing here is new research. File references are relative to the repo root.
Where the corpus records a conflict, the game shows the hedged value listed here.

## 1. How Hot Springs shows up in the game

| Game element | Hot Springs content | Source |
|---|---|---|
| Board | A 9×9 bathhouse tile floor whose nine 3×3 boxes are drawn as thermal pools framed by lead came, like a skylight of sea-colored glass | `research/visual-style-guide.md` → Per-game hooks → Thermal Blocks (Motif 4 leaded glass frame); Fordyce glass "floating in a sea of blue and green" (Motif library intro, SAH Archipedia) |
| Pieces | Glazed tiles; each era recolors them from that era's palette | `shared/design/tokens.js` `PALETTES`, `ERA_PALETTE` |
| Clear effect | Steam curls rise, the cleared cells flash algae green `#2A9D8F`, ripple rings spread | Style guide → Thermal water, steam, tufa and algae rendering; Motif 7 (steam curls) |
| Heat meter | A thermometer from 60°F to 143°F (average spring temperature); above that it reads "boiling", after Dunbar's "boiling springs" | `geography-lakes-mountains.md` → Temperature (NPS Display Spring: about 143°F); trivia `hs-0004` (Dunbar letter, Aug. 17, 1804) |
| Tufa stones | Gray pre-filled blocks in puzzles and the Daily: tufa `#9A968C`, rim `#C8C3B6`, damp streaks `#6E6A60` | Style guide → Tufa recipe; `geography-lakes-mountains.md` → Tufa, algae and steam |
| Spring vents | Springs-mode blocks drawn as a small steaming pool in a tufa ring; tapping 47 of them wins the mode | Count of 47 springs: `geography-lakes-mountains.md` → Count (Britannica, Wikipedia); hedge: "43 presumed flowing" (Wikipedia HSNP), "about four dozen" (NPS) |
| Era backgrounds | Classic mode climbs through the 7 era ids as score rises | `research/timeline.json` `eras`; `00-INDEX.md` era table |
| "Water's age" stat | Lifetime lines cleared count up toward 4,400 "years underground" (10 years per line) | `geography-lakes-mountains.md` → Age of the water (USGS PP 1044-C: about 4,400 years) |
| Spring Trail campaign | 12 puzzles named after real places; each unlocks a fact card | `research/places.json`, `research/trivia-bank.json` (see §4) |
| Loading/ticker lines | Short spring facts shown on the title screen and between campaign puzzles | §3 below |

## 2. Eras (Classic mode backgrounds)

Era ids, names and ranges come from `research/timeline.json` (`eras`). Score thresholds are game design.
Each era's caption is one confirmed `timeline.json` event (or corpus fact) tied to the springs.

| Era id | Name (timeline.json) | Score to reach | Palette (tokens) | Background art (game design, after style-guide era looks) | Caption shown on arrival | Source |
|---|---|---|---|---|---|---|
| `ancient` | Ancient Valley | 0 | `ouachita-forest` | Dark pine ridges, pale novaculite outcrops, steam rising from the valley | "Steam off the springs gave the valley its old nickname: the Valley of Vapors." | `geography-lakes-mountains.md` → Tufa, algae and steam (npshistory.com, via search summary) |
| `frontier` | Frontier Springs | 400 | `frontier-valley` | Plank huts over steaming pools along the creek | "1804: William Dunbar writes Jefferson about 'the boiling springs.'" | `timeline.json` 1804-08-17 (EOA Hunter-Dunbar) |
| `gilded-spa` | Gilded Spa | 1,000 | `gilded-spa` | Cream brick and red tile bathhouse silhouettes, magnolia band | "1832 to 1921: the reservation grows into Bathhouse Row. The Hale (1892) is the oldest bathhouse still standing." | `timeline.json` 1832-04-20, 1892; trivia `hs-0061` |
| `roaring` | Roaring Spa Town | 2,000 | `deco-neon` | Night sky, limestone towers, neon tube outlines | "March 4, 1921: the reservation becomes Hot Springs National Park, the 18th." | trivia `hs-0033`, `hs-0034` (NPS) |
| `midcentury` | Midcentury Vapors | 3,500 | `motor-hotel` | Pool-sky blue, slab motor-hotel tower, starbursts | "Bathing peaked in 1946, then declined. The Fordyce was the first Row bathhouse to close, in 1962." | trivia `hs-0050`, `hs-0089` |
| `revival` | Revival Years | 5,500 | `nps-rustic` | Trail scene in native stone and routed wood | "1982: NPS creates the Thermal Water Cascade. 1989: the Fordyce reopens as the visitor center." | `places.json` `thermal-water-cascade`; trivia `hs-0096` |
| `modern` | Modern Spa City | 8,000 | `lake-life` | Lake blues, restored brick, sunset gold | "Today the Buckstaff still gives traditional baths, and the Superior is a brewery." | `places.json` `buckstaff-bathhouse`, `superior-bathhouse` |

Every hex color is an estimate from `shared/design/` (see that README's caveats); none is official.

## 3. Spring facts used as ticker lines

All `confidence: confirmed` in `trivia-bank.json` (category Nature & Lakes or Places & Landmarks).

| Line in game | Trivia id | Source named there |
|---|---|---|
| Hot Springs water averages about 143°F, the hottest springs east of the Rockies (NPS). | hs-0147, hs-0154 | NPS: Maurice Historic Display Spring |
| Most of the water fell as rain about 4,400 years ago (USGS tritium and carbon-14 dating). | hs-0145, hs-0149 | USGS PP 1044-C |
| Rain soaks into Bigfork Chert and Arkansas Novaculite, then heats to about 160°F a mile down. | hs-0150, hs-0153 | USGS PP 1044-C; NPS Display Spring |
| Two thrust faults, "alpha" and "beta", carry the heated water up like pipes. | hs-0151, hs-0152 | NPS Display Spring |
| The springs give over 700,000 gallons a day (NPS); other sources say up to about a million. | hs-0146 | NPS Display Spring |
| Usually counted as 47 springs; one source says 43 still flow. | hs-0148 | Britannica; Wikipedia HSNP |
| Bicarbonate, about 130 ppm, is the water's main dissolved mineral. | hs-0155 | Wikipedia HSNP |
| Tufa is the white-to-tan rock left where spring water evaporates. | hs-0156 | Wikipedia HSNP |
| In 1904 Bertram Boltwood found the waters slightly radioactive (radon). | hs-0116, hs-0158 | NPS 1920 brochure; Wikipedia HSNP |
| Dunbar and Hunter counted four principal springs in 1804. | hs-0113 | EOA Hunter-Dunbar |
| A prescribed 1920 bath "course" was 21 baths. | hs-0022 | NPS 1920 brochure |

## 4. Spring Trail campaign: places and fact cards

Twelve hand-designed puzzles. Each card shows the place name, the year from `places.json` (`built`), two
facts and the source line. Puzzle layouts are game design; only the card text is presented as fact.

| # | Puzzle name | places.json id | Card facts (from places.json `facts` and the trivia item) | Trivia id | Source |
|---|---|---|---|---|---|
| 1 | Display Spring | `display-spring` | Uncovered in the 1930s after decades under a grate. Water emerges at about 143°F into Hot Springs Creek. | hs-0120 | NPS: Maurice Historic Display Spring |
| 2 | Hale Bathhouse | `hale-bathhouse` | Oldest surviving Row bathhouse (1892–93). Its facade was remodeled in Mission style in 1939–40. | hs-0061, hs-0080 | EOA / Wikipedia: Bathhouse Row |
| 3 | Maurice Spring Fountain | `maurice-spring-fountain` | Completed on Bathhouse Row in 1903. The Noble Fountain was moved to the Promenade's south end in 1957. | hs-0091 | Wikipedia: Bathhouse Row |
| 4 | Buckstaff Bathhouse | `buckstaff-bathhouse` | Has offered baths continuously since 1912. Cream brick with brass "Buckstaff Baths" letters. | hs-0062, hs-0069 | EOA / Wikipedia: Bathhouse Row |
| 5 | Fordyce Bathhouse | `fordyce-bathhouse` | Built 1914–15 for $212,749.55. Spring number 46 sits in a glazed-tile basement room. | hs-0064, hs-0075 | Wikipedia: Bathhouse Row |
| 6 | Superior Bathhouse | `superior-bathhouse` | The northernmost Row house (1916), with green tile medallions. A brewery and distillery since 2012. | hs-0066, hs-0102 | Wikipedia: Bathhouse Row / Hot Springs |
| 7 | Quapaw Bathhouse | `quapaw-bathhouse` | Planned as the Platt Bathhouse; renamed after Native artifacts and a tufa cave turned up in its basement. Crowned by a chevron-mosaic dome. | hs-0078, hs-0082 | EOA / Wikipedia: Bathhouse Row |
| 8 | Ozark Bathhouse | `ozark-bathhouse` | Mann & Stern, 1922, with twin towers. Reopened in 2014 as a cultural center. | hs-0085, hs-0104 | Wikipedia: Bathhouse Row |
| 9 | Lamar Bathhouse | `lamar-bathhouse` | Its 1923 opening completed Bathhouse Row. Bathing ended in November 1985. | hs-0077, hs-0097 | NPS / Wikipedia: Bathhouse Row |
| 10 | Grand Promenade | `grand-promenade` | A brick walk about half a mile long behind the Row. Construction began in the 1930s. | hs-0163, hs-0086 | NPS trails; Wikipedia: Bathhouse Row |
| 11 | Tufa Terrace Trail | `tufa-terrace-trail` | 0.3 mile, paved, 6% grade. Tufa forms where thermal water evaporates and leaves minerals. | hs-0156 | NPS trails; Wikipedia HSNP |
| 12 | Thermal Water Cascade | `thermal-water-cascade` | Created by NPS in 1982. When the springs were enclosed in 1901, water was diverted into a thermal cascade. | — | places.json; EOA photo entry (via `geography-lakes-mountains.md`) |

## 5. Colors used (all estimates)

| Use | Hex | From |
|---|---|---|
| Pool depth / board base | `#1F5F6B` | thermal-water bg |
| Algae flash on clear | `#2A9D8F` | thermal-water primary |
| Emerald algae fringe | `#2F8F5B` | thermal-water secondary |
| Tufa stone, rim, streak | `#9A968C`, `#C8C3B6`, `#6E6A60` | style guide tufa recipe |
| Lead came between pools | `#2A2A2A` | Motif 4 |
| Steam | `#FFFFFF` at 15–35% alpha | Motif 7 |
| Brass trim (thermometer, frames) | `#C9A23F` | material swatch "brass lettering" |
| Era tile colors | primary/secondary/accent/highlight roles of each era palette | `shared/design/tokens.js` |

## 6. Things deliberately not used

- No spring numbers other than No. 46 (Fordyce), since the corpus has no numbered spring list.
- No fires or floods as mechanics; the corpus warns these are metaphors, and the game doesn't need them.
- No logos (no NPS arrowhead) and no business endorsement; the Superior brewery fact is history only.
- Legends (de Soto at the springs) are not used.
