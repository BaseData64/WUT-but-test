# Auto-Mii Native Identity V1

This local prototype avoids a PNID/login form. The separate Aroma plugin reads
the active Wii U account through `nn::act` and posts account ID, PID, persistent
ID and 96-byte FFLStoreData to XAMPP. PHP stores the latest registration in the
system temporary directory, not under the public web root.

On each `bootstrap.php` request, WUT imports a fresh native registration into
the normal PHP session with source `wiiu-native-act`. Existing `WUTSession`,
`WUTIdentity`, `WUTMii`, `render.php`, Global Menu, Activity Feed and User Page
then work without a second identity system.

The current V1 is designed for one local development console. A public/multi-
console deployment must bind registrations to the specific browser/session
instead of trusting one most-recent local registration.
