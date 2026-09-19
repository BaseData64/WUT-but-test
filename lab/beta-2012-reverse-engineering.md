# 2012 Miiverse demo frame — WUT reverse-engineering notes

Target: the user-supplied photographed early Miiverse/Wii U demo frame.

## What is directly observable

- Logical composition is a 16:9 surface with a persistent left menu.
- The left menu occupies about 11–13% of screen width, matching WUT's existing
  160 / 1280 Portal menu ratio (12.5%).
- The top-right menu corner is strongly rounded; the bottom control is a dark
  Back item with a broad curved arrow.
- There is no later-era green page-title header in the photographed frame.
- The main stream begins about 19–20% from the screen's left edge, leaving a
  visible gap between the menu and content.
- The stream panel ends a few percent before the right edge, leaving room for a
  lower-right quarter-circle Comment affordance.
- The visible stream fits roughly four full compact rows plus partial content;
  normalized to WUT's 1280x720 surface this implies approximately 115–125px per
  row rather than the previous ~218px card pitch.
- Rows are translucent/flat and separated subtly. They do not use the later WUT
  WIP's large white speech bubbles, deep shadows, community bars, or Yeah/meta
  footer controls.
- Mii tiles are approximately 60–70 logical pixels on a 1280-wide reconstruction.
- Selection is communicated mainly by cyan icon/text in the left menu.
- Background is a gray large-tile Portal pattern, visibly darker than the WUT
  WIP before this pass.

## Reconstruction choices

- Preserve WUT's 1280x720 logical stage and existing scale code.
- Preserve the exact Portal-derived menu PNG symbols already present in the
  project; no replacement icon artwork is generated.
- Preserve native identity and Mii render code untouched.
- Add a final override stylesheet (`olv_beta_2012.css`) instead of rewriting the
  proven Portal/base CSS. This keeps rollback easy and isolates uncertain visual
  inferences from known-working Wii U code.
- Root bottom behavior still exits the host, but is visually labeled Back like
  the photographed demo.
- The lower-right Comment control is UI-only until the real composer exists.

## Confidence

High: menu ratio, missing green header, inset content, compact row density,
Back control, cyan selection, lower-right Comment shape.

Medium: exact panel alpha, precise row height, precise menu/text sizes because
source is a perspective photograph rather than a direct framebuffer capture.

Unknown: exact prototype CSS values, internal Nintendo asset names, and whether
this exact demo build used the same resources as the later production Portal.
