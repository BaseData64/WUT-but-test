# Plaza Lite 2012 — Wii U old-WebKit performance pass

## HECHO (observed in this WUT build)

- The previous Plaza stylesheet used multiple blurred `box-shadow` layers, gradients, translucent `rgba()` backgrounds and a focus state that changed width/height/margins.
- The previous controller rewrote the hidden spotlight panel and reassigned its image every time selection moved.
- The previous list displayed source artwork around 1080x1080 (and one 1408x1408 JPEG) at roughly 62x62 CSS pixels.
- The nine original community artworks total about 4.29 MiB compressed and about 43.16 MiB when decoded as 32-bit pixel surfaces.

## THIS PASS

- Plaza is only a vertical community list.
- No filters, spotlight, population pills, extra panels, animations or transitions.
- No gradients, translucent paint layers, visual shadows or text shadows in the active Plaza stylesheet.
- Focus changes flat colors only; box geometry stays unchanged.
- Community navigation changes only the old and new selection classes instead of walking every row on each D-Pad move.
- Navigation no longer calls `link.focus()` on every D-Pad selection, avoiding the extra focus event path.
- Scroll math uses the fixed row height instead of reading `offsetTop` / `offsetHeight` after style mutations.
- New 56x56 thumbnails are generated from the supplied artwork. The ten thumbnails total about 51 KiB and about 0.12 MiB decoded.
- The legacy `olv_communities.css` is no longer loaded by the Portal; `olv_plaza_concept.css` owns the Plaza presentation.

## NOT CHANGED

- Auto-Mii / renderer
- identity / session
- backend / native bridge
- global Portal menu
- Activity Feed, User Page, Messages or News
- the Portal's global 1280x720 stage scaling
