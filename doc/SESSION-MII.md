# First Run session + Mii bootstrap

This milestone turns the welcome flow from a visual demo into persistent setup state while keeping identity and Mii rendering behind adapters.

## What comes from revival research

### Grape / Wii U Portal

Grape's Portal shell checks for a server session PID before showing the Activity Feed, emits user/profile data into the generated page, and uses a server-side Mii URL in the global menu. Its profile settings store game experience as:

- `0` Beginner
- `1` Intermediate
- `2` Expert

WUT now uses the same numeric game-skill contract. The code was reimplemented for WUT rather than copying Grape's PHP backend wholesale.

### Miiverse applet request context

Reverse-engineering tools document that the Wii U Miiverse applet sends these request headers to the Portal:

- `X-Nintendo-ServiceToken`
- `X-Nintendo-ParamPack`

WUT's PHP bootstrap now detects those headers automatically. The raw ServiceToken is never exposed to JavaScript and is not persisted by WUT localStorage. WUT only stores a short SHA-256 fingerprint for diagnostics.

**Important:** detecting the headers is implemented. Decrypting/verifying the ServiceToken into PID/PNID/Mii identity is still a separate unresolved adapter.

### ariankordi/nwf-mii-cemu-toy

That renderer frontend accepts Mii data, NNID/PNID, or PID and can render a PNG through `/miis/image.png`. It also documents `/mii_data/{nnid}`, with `api_id=1` for Pretendo IDs. WUT's Mii proxy follows that API contract.

## Runtime files

- `cafe/olv/script/olv_store.js` — setup-only local persistence.
- `cafe/olv/script/olv_session.js` — one shared WUT session/profile object.
- `cafe/olv/script/olv_identity.js` — server bootstrap + future Portal body-data bridge.
- `cafe/olv/script/olv_mii.js` — current-user Mii image adapter.
- `net/olv/v1/bootstrap.php` — safe server-side console/header probe.
- `net/olv/v1/profile/setup.php` — prototype profile setup persistence.
- `net/olv/v1/mii/render.php` — same-origin proxy to an FFL renderer.

## Current behavior

1. Selecting Beginner/Intermediate/Expert stores `0/1/2` locally immediately.
2. The choice is restored when WUT is reopened.
3. Finishing First Run stores `setup_complete=1`.
4. When running under PHP/XAMPP, setup state is also mirrored to the PHP session.
5. `bootstrap.php` automatically detects Miiverse request headers when they reach WUT.
6. If identity has been resolved and an FFL renderer is configured, `wut_mii.js` can obtain the current user's Mii without asking the user to type an ID.

## Renderer configuration

Run a compatible `nwf-mii-cemu-toy` + FFL-Testing renderer and set `WUT_MII_RENDERER_BASE`, or edit `net/cfg/wut.php`.

Example:

```php
'mii_renderer_base' => 'http://127.0.0.1:8080'
```

The Wii U requests WUT's same-origin `mii/render.php`; PHP talks to the local renderer. This avoids requiring the console to reach a localhost-only renderer port.

## Development identity test

Only from localhost, this build supports a development identity injection so the Mii pipeline can be tested before the ServiceToken resolver exists:

`net/olv/v1/bootstrap.php?wutdev=1&pid=123&pnid=ExamplePNID&network=pretendo&mii_name=Example`

This is development-only and is not the production identity mechanism.
