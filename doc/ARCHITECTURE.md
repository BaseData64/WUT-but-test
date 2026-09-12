# WUT Cafe OLV architecture

## Naming

The new tree intentionally uses short development-style names: `cafe` for the Wii U-facing client layer, `olv` for the Miiverse/OLV web service layer, and `net` for host/server code. These are WUT conventions, not a claim about Nintendo's original source tree.

## Layers

- `cafe/olv/` — hardware-facing HTML/CSS/ES5. `index.html` is the current First Run entry.
- `cafe/olv/style/` — only three active style layers: base/setup geometry, Portal symbol bank, and final setup skin.
- `cafe/olv/script/` — persistent setup/session, identity bridge, Mii adapter, GamePad input and setup navigation.
- `cafe/olv/res/olv/` — current First Run assets plus the useful Portal asset bank for the next milestone.
- `net/olv/v1/` — PHP bootstrap/profile/Mii endpoints.
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
- do not treat automatic identity as complete until verified on real console
