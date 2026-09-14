# WUT Cafe OLV architecture

## Naming

The new tree intentionally uses short development-style names: `cafe` for the Wii U-facing client layer, `olv` for the Miiverse/OLV web service layer, and `net` for host/server code. These are WUT conventions, not a claim about Nintendo's original source tree.

## Layers

- `cafe/olv/` — hardware-facing HTML/CSS/ES5. `index.html` is the current First Run entry.
- `cafe/olv/style/` — First Run geometry/skin, Portal symbol bank, permanent Portal shell, Communities, and demo-section presentation.
- `cafe/olv/script/` — persistent setup/session, identity bridge, Mii adapter, GamePad input, setup navigation, Portal shell navigation and view-specific focus controllers.
- `cafe/olv/res/olv/` — current First Run assets plus the useful Portal asset bank for the next milestone.
- `net/olv/v1/` — PHP bootstrap/profile endpoints plus a bounded, cached Mii
  PNG gateway for an external FFL renderer.
- `net/cfg/` — local configuration.
- `lab/` — only evidence that still affects implementation decisions.
- `test/` — current regression checks.

## Cleanup rule

Historical visual patches, unused mock scripts, empty placeholder directories, off-device font experiments, duplicated UI assets, and tests for removed experiments are intentionally not carried into this tree.

## Runtime rules

- old WebKit/ES5 first
- no framework requirement
- no webfont dependency on Wii U
- image-backed Portal symbols
- do not expose raw console ServiceToken to JavaScript
- do not expose raw Mii StoreData to JavaScript
- accept renderer output only from the administrator-configured HTTP base and
  only after PNG signature/size validation
- do not treat automatic identity as complete until verified on real console

## Portal view boundary

`cafe-olv-portal.html` owns the permanent global menu and one panel per section.
`olv_portal.js` switches panels and routes input. `olv_communities.js` owns the
community directory, while `olv_sections.js` owns the read-only Feed, User Page,
Messages and Notifications demos. The latter can later be fed by WUT APIs
without importing the supplied clone's PHP/MySQL runtime.
