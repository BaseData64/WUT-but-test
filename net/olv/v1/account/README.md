# WUT Account Core V2

A completed First Run persists the user's Mii StoreData inside the WUT account as canonical Base64 plus a SHA-256 fingerprint. Public account APIs expose only metadata, never raw `mii_data`.

On later resolved sessions, `wut_accounts_reconcile_current_identity()` keeps the account and console Mii synchronized:

1. If fresh console StoreData is present and its SHA-256 changed, update the stored Mii and display name.
2. If the session has a stable WUT identity but no StoreData, restore the setup-time Mii from the account into the PHP session.

This keeps WUT's native FFLStoreData renderer while using the persistent-Mii account pattern found in the supplied Miiverse revival.


## Persistent Auto-Mii renderer (V2.1)

After First Run creates an account, the account's canonical `mii_data` snapshot
is the renderer source. The native bridge only refreshes that snapshot when the
console Mii changes. A temporary bridge outage therefore does not remove the
user's Mii from Portal rendering. Numeric WUT IDs remain internal keys.
