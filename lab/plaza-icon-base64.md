# Plaza icon Base64 override

The user-supplied transparent PNG is embedded directly in `cafe/olv/style/olv_beta_menu.css`.

- Normal Plaza state: exact uploaded PNG bytes encoded as Base64.
- Selected/focused Plaza state: same alpha mask and dimensions, recolored to beta cyan `#00A9D8`.
- CSS background box: 90x90 px; actual drawing is about 87x64 px due to transparent padding.
- No external image file is required by the Portal at runtime.
