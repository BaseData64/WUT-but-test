# Grape reference notes

Reference files examined for the Wii U portal path include `olv_template.html`, `portal-grp.css`, `grp_portal-php/lib/htm.php`, and `grp_portal-php/root.php`.

Current WUT takeaways:

1. Keep the Wii U shell simple and old-WebKit compatible.
2. Treat `#body` as the future replaceable content region.
3. Keep normal Wii U portal text on generic `sans-serif`.
4. Do not assume Grape's off-device `MiiverseSymbols` webfont path is the Wii U portal path.
5. Prefer image-backed UI icons on the Wii U runtime until hardware tests prove otherwise.

This directory contains notes only; it does not vendor Grape source code.
