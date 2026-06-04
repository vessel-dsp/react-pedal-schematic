---
name: create-symbol
description: Draw or revise schematic-component SVG symbols for circuit-preview-editor. Use with the svg skill when adding a new component glyph (resistor, BJT variant, opto, IC block, jack, footswitch, etc.), redrawing an existing one, or auditing the project's symbol library for stylistic consistency.
metadata:
  dependencies:
    - svg
---

# Create Symbol

Authoring rules for the project's hand-drawn schematic glyphs. Symbols live as standalone SVG files in `src/preview/symbols/*.svg`. They are the source of truth for the schematic-view appearance — not the inline `Primitive[]` table in `src/preview/symbols.ts`. New symbols MUST follow this style guide so the schematic preview reads as one coherent symbol set.

## Skill Dependencies

- Load and apply the `svg` skill for general SVG syntax, path construction, optimization, and validation when creating or revising symbol files.
- Treat this skill as the project-specific authority for `circuit-preview-editor` symbol style, canvas size, terminal anchors, stroke hierarchy, and fixture workflow when it conflicts with generic SVG guidance.

## Where Symbols Live

- One SVG per symbol, kebab-cased file name: `resistor.svg`, `capacitor-electrolytic.svg`, `bjt-npn.svg`, `bjt-pnp.svg`, `jfet-n.svg`, `mosfet-p.svg`, `opamp.svg`, `jack-input.svg`, `footswitch-3pdt.svg`, `unsupported.svg`.
- Variants of the same `ComponentKind` (NPN vs PNP, input vs output jack, SPDT vs 3PDT) are SEPARATE files, selected at render time via `sourceTypeName`.
- Do not import EDA symbol packs. Hand-redraw from common guitar-pedal schematic conventions and from the bundled fixtures, in the style described below.

## Canvas And Coordinate System

Every symbol uses the same root attributes so the renderer can place them interchangeably:

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25 -25 50 50"
     fill="none"
     stroke="currentColor"
     stroke-width="1.5"
     stroke-linecap="round"
     stroke-linejoin="round">
  <g stroke-width="0.95">
    <!-- leads / connectors go here -->
  </g>
  <!-- body shapes (envelope, plates, zigzag, triangle, arrow head, …) inherit 1.5 -->
</svg>
```

- `viewBox="-25 -25 50 50"` — 50×50 unit canvas centered on the symbol's origin `(0, 0)`. The origin is the component's pivot point for rotation/flip.
- The drawable interior stays inside roughly `(-22, -22) … (22, 22)`. Leave a tiny breathing margin so dragged junction dots and selection halos do not clip.
- **Y axis follows SVG convention: `y = -20` is the TOP, `y = +20` is the BOTTOM.** This matches the existing symbol primitives in `src/preview/symbols.ts`. The catalog's `local.y` for terminals is rotation-resolved by `src/formats/schx/transforms.ts`, so authoring the SVG in SVG-y-down is the correct convention.
- Terminals exit the symbol at the standard offsets used by the catalog (`src/formats/schx/catalog.ts`). For two-terminal components, that means `(0, ±20)`. For three-terminal devices (BJT/JFET/MOSFET/Triode), see the per-component table below.

## Line Style — Modern / Cyber Thin-Line

The project's house style is consistent thin geometric strokes with a deliberate **two-weight hierarchy**: structural body shapes are slightly heavier than the leads that connect to them. The thinness of the leads is the project's stylistic signature — it lets the symbol's characteristic gesture (zigzag, triangle, envelope circle, plate gap) read as the dominant shape while the leads visually recede.

- `stroke="currentColor"` — never hardcode a color. The host page drives theming through CSS.
- **Body shapes: `stroke-width="1.5"`** — envelope circles, polygons, plates, zigzag bodies, internal bars, arrow heads, decorative arrows (LED emission, opto light arrows), tube grids, and any other element that defines the component's identity.
- **Leads / connectors: `stroke-width="0.95"`** — any line whose at least one endpoint is at a terminal anchor position (typically `(0, ±20)`, `(±20, 0)`, `(±10, ±40)`, etc.). Group leads inside a single `<g stroke-width="0.95">` so the SVG stays tidy and the intent is obvious to the next author.
- A line that lives entirely inside the body envelope and never touches a terminal is **body**, not a lead, even if it visually looks like a wire (e.g. JFET drain/source stubs, BJT collector/emitter slants inside the circle, transformer core bars).
- `stroke-linecap="round"` and `stroke-linejoin="round"` — gives the modern, slightly soft look. Sharp/square joins look brittle next to the rest of the library.
- `fill="none"` is the default on the root `<svg>`. Override only for solid arrow heads, filled triangles inside diodes, and electrolytic-capacitor `+` markers.
- Filled glyph pieces (diode triangle, BJT/JFET emitter/gate arrow head) set `fill="currentColor" stroke="none"` on that specific element so they sit inside the surrounding outline without doubling the edge.
- Do not embed `<text>` for the value or component name. Names render outside the symbol via the schematic renderer. Inline text is reserved for permanent type markers (`+`/`-` on op-amp inputs, `+` on electrolytic, `V`/`I`/`B` on port-style sources).
- No drop shadows, gradients, blurs, masks, clip paths, `filter`, or `style` attributes. Keep the SVG declarative so the renderer can embed and recolor it.

## Geometric Conventions

Keep the same module sizes across the library so dense schematics still read at low zoom:

| Element | Size in symbol units |
|---|---|
| Lead length from terminal to body | 10 units (lead from `(0, -20)` to `(0, -10)`) |
| Resistor body (zigzag) | x ∈ [-5, 5], y ∈ [-10, 10] |
| Capacitor plate length | x ∈ [-8, 8], plate gap y ∈ [-3, 3] |
| Inductor humps | 4 arcs along y ∈ [-10, 10], peak amplitude 3.5 |
| Diode triangle | base width 12 (x ∈ [-6, 6]), height 9, cathode bar at y = 4, x ∈ [-7, 7] |
| BJT/JFET/MOSFET envelope | `circle r="11"` at origin (when an envelope is drawn at all) |
| Op-amp triangle | apex at `(10, 0)`, base from `(-11, -10)` to `(-11, 10)` |
| Triode envelope | `circle r="11"` at origin, plate bar y = -5, grid dashes y = 0, cathode "U" y = 5 |
| Port / source circle | `circle r="7"` at origin |
| Ground stack | three horizontal lines at y = 4, 8, 12, widths 14 / 8 / 4 |

Use these numbers as defaults. Deviate only when a real geometric reason exists (more terminals, asymmetric layout), and document the deviation in a comment at the top of the SVG file.

## Terminal Anchors (Schematic View)

Terminals are the contract between the SVG glyph and the document model. The body shape may move, but a terminal anchor MUST stay where the catalog says it is, or wires will detach. Reference the catalog at `src/formats/schx/catalog.ts` before authoring a new symbol.

Default anchors for the most common components (after rotation resolution; see also `BJT_TERMINALS`, `JFET_TERMINALS`, etc. in the catalog):

| Component | Terminal | SVG-space position |
|---|---|---|
| Resistor / Capacitor / Inductor / Diode (etc., two-terminal vertical) | a (top) | `(0, -20)` |
|  | b (bottom) | `(0, 20)` |
| Diode-family `anode` / `cathode` | anode | `(0, 20)` (cathode is `(0, -20)`) |
| BJT | collector | `(0, -20)` (visually top) |
|  | base | `(-20, 0)` |
|  | emitter | `(10, 20)` (note the +10 X offset — LiveSPICE slants the emitter) |
| JFET (standard) | drain | `(0, -20)` |
|  | gate | `(-20, 0)` |
|  | source | `(0, 20)` |
| JFET (`JunctionFieldEffectTransistor` LiveSPICE) | drain | `(10, -20)` (slanted) |
|  | gate | `(-20, 0)` |
|  | source | `(10, 20)` (slanted) |
| MOSFET | drain | `(0, -20)` |
|  | gate | `(-20, 0)` |
|  | source | `(0, 20)` |
|  | body | `(10, 0)` |
| Op-amp | vin+ | `(-30, 10)` |
|  | vin- | `(-30, -10)` |
|  | vout | `(30, 0)` |
|  | vcc | `(0, -20)` |
|  | vee | `(0, 20)` |
| Triode | plate | `(0, -20)` |
|  | grid | `(-20, 0)` |
|  | cathode | `(-10, 20)` |
| Potentiometer | a / wiper / b | `(-10, -40)` / `(10, 0)` / `(-10, 40)` |

For any new kind, look up `src/formats/schx/catalog.ts` first and copy the terminal offsets into the SVG comment header. If the LiveSPICE source uses a non-symmetric anchor (e.g. BJT emitter at `x = 10`), the symbol's emitter lead MUST end at that exact point, or the schematic's wires will float when the user drags the part.

## Per-Component Drawing Notes

### Passives

- **Resistor**: zigzag body, 6 peaks alternating ±5 in x along y ∈ [-10, 10]. Keep the entry/exit points exactly on `(0, ±10)` so the lead lines join cleanly.
- **Variable resistor / trimpot**: resistor body + diagonal arrow crossing the body from `(-10, 10)` to `(10, -10)`, with an arrow head at the top end. Arrow stroke matches body weight.
- **Potentiometer**: resistor body + wiper arrow on the right pointing left into the body — `polyline` from `(10, 0)` to `(5, 0)` with a small triangle head. Wiper terminal at `(10, 0)`.
- **Capacitor**: two equal parallel plate lines, plate gap of 6 units centered on origin.
- **Electrolytic capacitor**: top plate straight, bottom plate a shallow arc bowing downward; add a small `<text x="-6" y="-6" font-size="6" fill="currentColor" stroke="none">+</text>` to mark the positive lead. Positive terminal is the top lead `(0, -20)`.
- **Inductor**: 4 small arcs going downward (each arc spans 5 units in y). Either `<path>` with cubic Béziers or repeated short arcs — match the visual rhythm of the existing inductor symbol.

### Semiconductors

- **Diode**: filled triangle `M -6 -5 L 6 -5 L 0 4 Z` (`fill="currentColor" stroke="none"`) + cathode bar at y = 4. Anode lead `(0, 20)`, cathode lead `(0, -20)`.
- **Zener diode**: same body, replace the straight cathode bar with a Z-shape — two small flags at the ends bending outward.
- **Schottky**: cathode bar gets small square "S" flags at both ends.
- **LED**: diode body + two short parallel arrows pointing outward from the upper-right of the triangle. Use two arrow `<path>` glyphs at ~45° from the body, each ~6 units long with a 2-unit arrow head.
- **BJT**:
  - Envelope `circle r="11"` at origin.
  - Base lead horizontal from `(-20, 0)` to `(-6, 0)`, base bar vertical from `(-6, -5)` to `(-6, 5)`.
  - Collector slant from `(-6, -3)` to `(4, -7)` then vertical lead to `(0, -20)`.
  - Emitter slant from `(-6, 3)` to `(4, 7)` then lead to `(10, 20)` (the catalog anchor — do not shortcut to `(0, 20)`).
  - **NPN**: filled triangle on emitter slant, arrow head AT THE EMITTER END, pointing OUTWARD (away from base).
  - **PNP**: same triangle, flipped so the arrow points INWARD (toward base).
- **JFET**:
  - Same envelope, base/gate, channel as BJT but with a single straight channel bar from `(-6, -8)` to `(-6, 8)` and no slants — channel connects to drain/source via small in-circle stubs.
  - **N-channel**: gate arrow head sits on the gate lead just outside the channel bar, pointing INTO the channel (toward +x).
  - **P-channel**: gate arrow points OUT of the channel (toward -x).
- **MOSFET**:
  - Same envelope. Gate is isolated: gate lead stops 1 unit short of the channel bar — leave a clear gap so the symbol reads as "insulated gate."
  - Channel drawn as three short bars (drain stub, source stub, body stub) to imply enhancement-mode segmentation.
  - **N-channel**: arrow on the body terminal pointing INTO the channel.
  - **P-channel**: arrow points OUT.
- **Optocoupler / vactrol**: outer rounded rectangle envelope, LED on the left half (use the LED glyph at half scale), phototransistor or LDR on the right. Two arrows between them pointing from LED to receiver.
- **Photoresistor / LDR**: resistor body inside a circle envelope with two inward-pointing arrows on the upper-left.

### Tubes

- **Triode**: `circle r="11"`, plate is a thick horizontal bar at y = -5, grid is 3 short dashes at y = 0, cathode is a "U" opening upward at y = 4..8. Leads exit per the catalog table.
- **Pentode**: triode + two extra dashed grids (screen and suppressor) between plate and control grid; an extra screen lead exits at `(10, 10)` (negative-y), suppressor at `(10, -10)` per catalog.
- **Tube diode / rectifier**: just the plate + cathode "U" inside the envelope (no grids).

### Op-amp / IC

- **Op-amp**: triangle with apex on the right (`(10, 0)`) and base on the left from `(-11, -10)` to `(-11, 10)`. Inputs marked with small `+` / `-` glyphs near the base corners. Power leads exit top `(0, -20)` and bottom `(0, 20)`.
- **Opaque IC block** (BBD, PT2399, regulator, OTA, codec): rounded rectangle of width 26, height ~28 centered on origin. Show 3–5 short pin stubs on each side, but do NOT draw all package pins — the renderer adds the real terminal dots on top.

### Switches

- **SPST switch**: two contact dots on the same axis, a slanted lever line between them in the OPEN position.
- **SPDT switch**: single pole on the left, two throws on the right — lever drawn in the "up" throw position. Two filled dots for throws, one for the pole.
- **3PDT footswitch**: three stacked SPDT poles aligned vertically, with a dashed vertical line connecting the three levers (ganged actuation).
- **Toggle switch**: same as SPDT visually, no extra physical hardware detail.
- **Rotary switch**: circular envelope with N evenly spaced throws and a single pole arrow indicating the selected throw.

### Sources / Power

- **Ground**: three decreasing horizontal lines below the origin (widths 14 / 8 / 4 at y = 4, 8, 12).
- **Rail (`+9V`, `+VCC`)**: small upward-pointing arrow above origin with a `V` glyph next to it. The terminal sits at `(0, 0)`.
- **Battery**: alternating long/short horizontal bars stacked vertically. Use two pairs (4 bars total) — long bar at y = -3, short bar at y = -1, long at y = 1, short at y = 3.
- **DC power jack**: outer cylinder + inner barrel ring, with two leads exiting bottom.
- **Voltage source**: `circle r="7"` with `<text>+</text>` and `<text>-</text>` inside or with a `V` glyph centered.
- **Current source**: `circle r="7"` with a single arrow inside pointing in the conventional current direction (top to bottom).

### Jacks

For schematic view, jacks are drawn abstractly:
- **Input jack**: small rounded rectangle on the left side of the origin with two short leads. Label "INPUT" in 6 px text.
- **Output jack**: same but labeled "OUTPUT".

### View-Only / Diagnostics

- **Label**: no primitives — the renderer reads the `Text` / `Subtext` property. SVG file may be empty (`<svg>...</svg>` with no children) or omitted.
- **Named wire**: small circle + a short outbound stroke pointing to the label position.
- **Port / test point**: `circle r="7"` with the letter `P` inside.
- **Unsupported placeholder**: `circle r="7"` with a centered `?`. Use this for any kind whose source type cannot be modeled yet.

## Variants And `sourceTypeName`

Variants do not get a separate `ComponentKind`. They get a separate SVG and are selected at render time by `sourceTypeName` (the LiveSPICE `_Type`, or `ltspice:*` for LTspice imports).

Naming convention:

```
<kind>.svg                — default for the kind
<kind>-<variant>.svg      — explicit variant
```

Examples:

- `bjt.svg`, `bjt-npn.svg`, `bjt-pnp.svg`
- `jfet-n.svg`, `jfet-p.svg`
- `mosfet-n.svg`, `mosfet-p.svg`
- `diode.svg`, `diode-zener.svg`, `diode-schottky.svg`, `diode-tunnel.svg`
- `capacitor.svg`, `capacitor-electrolytic.svg`, `capacitor-variable.svg`
- `jack-input.svg`, `jack-output.svg`, `jack-dc.svg`
- `switch-spst.svg`, `switch-spdt.svg`, `switch-3pdt.svg`, `switch-rotary.svg`

The renderer's `symbolFor(kind, sourceTypeName)` is the single place that maps `sourceTypeName → variant`. Do not add per-symbol logic to the SVGs.

## Authoring Checklist

Before committing a new symbol:

1. **Root attributes match the template** (viewBox, stroke, stroke-width, linecaps). If you copy-paste from an existing symbol, double-check you did not pick up an inline `stroke="black"` or extra `style=` attribute.
2. **Origin is at `(0, 0)`** and the symbol is visually centered on it. Rotation in the schematic preview pivots around this point.
3. **Terminal anchor positions match the catalog** for this kind (see the terminal-anchor table above and `src/formats/schx/catalog.ts`).
4. **Leads end exactly at the terminal positions.** Off-by-one or off-by-half-pixel breaks junction detection because the wire endpoint will not coincide with the terminal point.
5. **No inline colors, fonts, or styles.** `stroke="currentColor"` only; filled accents `fill="currentColor"`.
6. **Reads at small size.** Open the SVG at ~24 px width — the symbol must still be recognizable as that component (zigzag visible, arrow visible, polarity mark visible). If it goes muddy, simplify rather than thickening lines.
7. **Header comment** with the kind, variant, and terminal anchors so future authors can verify intent without leaving the file:

   ```xml
   <!--
     kind: bjt
     variant: pnp
     terminals: collector(0,-20), base(-20,0), emitter(10,20)
   -->
   ```

8. **Looks like the rest of the library.** Compare against `resistor.svg`, `capacitor.svg`, `bjt-npn.svg` side by side. If yours is visually heavier, thinner, sharper-cornered, or stylistically off, fix it before merging.

## Adding A New Symbol — Workflow

1. Look up the kind in `src/formats/schx/catalog.ts` to confirm terminal anchors and the `_Type` aliases that should map to this glyph.
2. Sketch the symbol following the per-component notes above. Reuse helper geometry from sibling symbols (`circle r="11"` envelope, the standard arrow-head triangle, the standard plate lengths).
3. Save the file under `src/preview/symbols/<name>.svg` with the header comment.
4. Wire it into the preview by either:
   - Updating `src/preview/symbols.ts` to consume the SVG (e.g. via `?raw` import) and pass it through to the schematic renderer, OR
   - Adding the variant to `symbolFor(kind, sourceTypeName)` mapping in `src/preview/symbols.ts`.
5. Add or update a fixture that exercises the new symbol (a `.schx` with at least one instance of the component) so the playground can preview it.
6. If you added a new `ComponentKind`, also update:
   - `src/model/types.ts` (`ComponentKind` union)
   - `src/formats/schx/catalog.ts` (terminal map + property schema)
   - `src/model/validation.ts` (property rules)
   - `src/model/netlist.ts` (SPICE letter / node order if applicable)
   - `tests/preview/symbols.test.ts` (every `ComponentKind` has a symbol)

## Anti-Patterns

- ❌ Hardcoding colors (`stroke="#000"`, `fill="black"`).
- ❌ Per-symbol or per-element stroke widths beyond the body-1.5 / lead-0.95 hierarchy ("make it pop", "boost the arrow").
- ❌ Embedding the component name or value inside the SVG.
- ❌ Drawing terminals as decorative dots inside the symbol — the renderer adds terminal dots at the catalog positions on top of the symbol, so duplicating them looks doubled at certain zoom levels.
- ❌ Using `<g transform="rotate(...)">` to rotate the whole symbol. Rotation is the renderer's job. Author every symbol in its canonical 0° orientation.
- ❌ Importing or pasting third-party symbol packs without a clear license trail. The project is hand-redrawn on purpose.
- ❌ Adding a new envelope shape just because "it would look cool." Stick to the geometric vocabulary above so a 30-component schematic still reads as one design.
