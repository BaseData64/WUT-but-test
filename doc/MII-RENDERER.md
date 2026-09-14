# Real Mii renderer gateway

WUT now has a complete server-side gateway for the HTTP API exposed by
`ariankordi/nwf-mii-cemu-toy` and its FFL renderer backend. The Wii U client
does not run FFL and does not contact the renderer directly. It only downloads
a same-origin PNG from PHP.

## Runtime flow

1. A trusted WUT account-link handler verifies the account.
2. That handler stores PID/PNID or, preferably, the user's Wii U
   FFLStoreData/FFSD in the PHP session with `wut_store_linked_identity()`.
3. `bootstrap.php` returns only safe identity metadata and a short cache key.
   Raw Mii data stays on the server.
4. `olv_mii.js` requests `net/olv/v1/mii/render.php`.
5. The gateway calls `/miis/image.png` on the configured renderer.
6. The response is accepted only if it is a bounded, valid PNG, then cached.
7. Global Menu, Activity Feed and User Page rebind automatically after the
   `wut:account-linked` event refreshes the bootstrap session.

The preset sent upstream is:

```text
type=face
expression=normal
shaderType=wiiu
resourceType=middle
scale=1
```

The renderer's own documentation describes `face` as the NNID/Mii Maker style
used by Miiverse, and `middle` as the Wii U-era resource quality.

## Configure the renderer

Run a compatible HTTP frontend locally, then set one of these:

```text
WUT_MII_RENDERER_BASE=http://127.0.0.1:8080
```

or edit `net/cfg/wut.php`:

```php
'mii_renderer_base' => 'http://127.0.0.1:8080',
```

The current reference implementation is split into two programs:

- `ariankordi/nwf-mii-cemu-toy`, branch `ffl-renderer-proto-integrate`:
  HTTP frontend, identity lookup and renderer load balancing.
- `ariankordi/FFL-Testing`, branch `renderer-server-prototype`:
  native FFL rendering worker.

WUT deliberately does not vendor either repository. It also does not contain
or redistribute Nintendo's proprietary Mii resource files. Supply required
resources from hardware/content you are authorized to use.

For a quick development-only experiment the configured base may point to
`https://mii-unsecure.ariankordi.net`, but self-hosting is recommended. The
maintainer explicitly warns that the public service can go down or fluctuate,
and using it sends the selected render input to a third-party server.

## Account-link contract

After the link provider has verified the account on the server, its callback
should call the shared helper. Do not accept these fields from an unauthenticated
browser request.

```php
require '/absolute/path/to/net/olv/v1/_common.php';

wut_start_session();
wut_store_linked_identity(array(
    'network' => 'pretendo',
    'pid' => $verifiedAccount['pid'],
    'pnid' => $verifiedAccount['pnid'],
    'mii_name' => $verifiedAccount['mii_name'],
    'mii_data' => $verifiedAccount['mii_data'],
), 'wut-account-link');
```

`mii_data` is the preferred source because it makes rendering independent of
future account lookups. If it is absent, the gateway falls back to PID and then
PNID. Pretendo lookup automatically adds `api_id=1`.

For legacy Nintendo NNIDs, the original account Mii endpoint has been offline
since May 2024. The reference frontend therefore needs its separately hosted
NNID archive/database, or WUT's link provider must supply StoreData directly.

After a successful link response, a client link screen can refresh all visible
Mii images without reloading the Portal:

```js
var event = document.createEvent("Event");
event.initEvent("wut:account-linked", true, true);
window.dispatchEvent(event);
```

This event contains no credential or Mii data. It only tells
`olv_identity.js` to request a fresh server bootstrap.

## Diagnostics

Open:

```text
cafe/olv/olv_probe.html
```

It reports whether the renderer is configured and whether the linked session
has a renderable source. The machine-readable status endpoint is:

```text
net/olv/v1/mii/status.php
```

With a valid linked session, this URL should return a PNG:

```text
net/olv/v1/mii/render.php?width=128&type=face
```

For a localhost Pretendo smoke test, first visit the bootstrap URL using a real
PNID (URL-encode every value), then open `olv_probe.html` in the same browser so
it keeps the same `WUTSESSID` cookie:

```text
net/olv/v1/bootstrap.php?wutdev=1&pnid=YOUR_PNID&network=pretendo&mii_name=Example
```

Response header `X-WUT-Mii-Cache` is `HIT`, `MISS` or `STALE`. A stale cached
icon is used temporarily when the renderer is unavailable.

## What this milestone does not solve

The rendering path is implemented. Automatic identity extraction from the
real Wii U Miiverse applet is not. Detecting ServiceToken/ParamPack is already
implemented, but those values are not yet verified and resolved into a trusted
PID/PNID. Until that adapter exists, use a real WUT account-link callback or the
localhost-only development identity hook.

Reference sources:

- https://github.com/ariankordi/nwf-mii-cemu-toy/tree/ffl-renderer-proto-integrate
- https://github.com/ariankordi/FFL-Testing/tree/renderer-server-prototype
- https://mii-unsecure.ariankordi.net/
