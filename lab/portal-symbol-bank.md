# 0010 — Portal CSS symbol bank for WUT

## HECHO

- Source used for this pass: Makii-provided `portal-grp(2).css` (12,309 lines).
- `portal-grp(2).css` uses `font-family: sans-serif` for body text; these action symbols are embedded PNG `data:image/...;base64,...` payloads, not MiiverseSymbols glyphs.
- WUT First Run now uses the exact Base64 payload from `.fixed-bottom-button.back-button` for Back.
- WUT First Run now uses the exact Base64 payload from `.fixed-bottom-button.next-button` for Next / Accept / Start.
- Close intentionally has no image because the Portal `.fixed-bottom-button.close-button` / `.exit-button` rule does not add one.
- Existing WUT First Run geometry and GamePad navigation were left intact; this pass changes the symbol source, not the flow.

## EXTRACTED ASSET CHECKS

| Symbol | Type | Decoded bytes | Dimensions | SHA-256 |
|---|---:|---:|---:|---|
| `back` | png | 1950 | 64x40 | `b2635ca7a798a3e5e3a9fbd14aa639ed6471a0178dff23f9976990cd2ae373a1` |
| `next` | png | 1034 | 37x36 | `a00fb514068d70b2964db7da76e34e9096294ba8f415119bd4811f87d1afe065` |
| `search` | png | 1534 | 36x38 | `a0561de13c731191acca5bb7bbdea7ec8e87b0dc8373ff193d7ceeb812e53a25` |
| `check` | png | 412 | 31x30 | `7a873e2740d6c0f24e7f509ed0a5904f482dde69c94614c5c6acb47526183ecc` |
| `platform_wiiu` | png | 597 | 104x24 | `684b1cb0d003d3dd8909dfadf0df8ce06f9aefa8daf540a9db972f8208f205f3` |
| `platform_3ds` | png | 617 | 104x24 | `48c39156b4d89a552032631544841b153c0303da1bfcc9e8a4cac714a8dc20e3` |
| `platform_both` | png | 1235 | 104x24 | `a8782ff7e5341777f11ab484bfc9a745f74c0a808ec54b90749c92e168d1b397` |
| `empathy` | png | 945 | 21x27 | `5f3fc781871cca2f19c4f1838cb23263cb68916d8404fb66976084e296c66749` |

## DESCONOCIDO / PENDIENTE

- This patch does not claim that every rule in `portal-grp(2).css` is required by the Miiverse applet.
- Hardware validation on the real Wii U remains the result that decides whether the visual output matches the target environment.
