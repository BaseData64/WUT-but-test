# WUT-Miiverse / WUT Cafe OLV

Wii U-focused Miiverse revival/prototype maintained by Makii.

## Active layout

```text
WUT-Cafe/
  cafe/olv/       Wii U WebKit client (First Run now, Portal next)
  net/olv/v1/     PHP bootstrap/profile/Mii HTTP endpoints
  net/cfg/        local server configuration
  doc/            current architecture docs
  lab/            evidence/reverse-engineering notes worth keeping
  test/           regression checks
```

The folder names are WUT project conventions chosen to feel closer to a Cafe/OLV development tree. They are not claimed to be Nintendo SDK directory names.

## Run with XAMPP

Put `WUT-Cafe` in `C:\xampp\htdocs\`.

PC:

```text
http://localhost/WUT-Cafe/cafe/olv/
```

Wii U on the same LAN:

```text
http://IP-DE-LA-PC/WUT-Cafe/cafe/olv/
```

Identity/header and PHP tests require Apache/PHP, not VS Code Live Server.

## Current runtime

- ES5/old-WebKit-oriented JavaScript.
- First Run persists Game Experience (`0/1/2`) and setup completion.
- Server bootstrap detects Miiverse request context without exposing the raw ServiceToken to browser JS.
- Mii rendering stays behind a same-origin proxy and still requires a trusted identity resolver + configured renderer.
- Wii U text uses generic `sans-serif`; action symbols are PNG data URIs from the supplied Portal CSS reference.

See `doc/ARCHITECTURE.md` and `doc/SESSION-MII.md`.
