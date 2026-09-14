# Cf_Miiverse material integrated into WUT

## Scope

The supplied `Cf_Miiverse.rar` snapshot was used as a structural reference for
the Cafe OLV Portal views. The three uploaded copies were byte-identical:

```text
SHA-256 8495837aeb967ae249d85c7e19490b47cb8f52392aa69214b8e573120168d156
```

The archive contains a Wii U Portal client, an off-device client, PHP view
templates, database helpers, styles, scripts and the usual Miiverse image bank.
WUT does not import that application as a second runtime. It keeps one
permanent WUT shell and adapts only the useful information hierarchy.

## Source-to-WUT mapping

| Cf_Miiverse reference | Pattern retained in WUT | WUT destination |
| --- | --- | --- |
| `Static/olv_template.html` | Permanent global menu with a replaceable body | `cafe/olv/cafe-olv-portal.html` |
| `grp_portal-php/root.php` and `lib/htmCommunity.php` | Activity Feed post anatomy: user, community, body, Yeah/reply metadata | Activity Feed panel + `style/olv_sections.css` |
| `grp_portal-php/users.php` and `lib/htmUser.php` | Profile identity, counters and profile tabs | User Page panel |
| `grp_portal-php/messages.php` | Friend conversation rows with Mii, nickname, ID, timestamp and preview | Messages panel |
| `grp_portal-php/news.php` and `friendrequests.php` | Updates/Friend Requests tabs and notification rows | Notifications panel |
| `grp_portal-php/communities.php` | Community directory as its own Portal view | Existing WUT Communities panel |

All new selectors use the `wut-` prefix. The UI is rewritten for the current
1280 x 720 WUT stage and its ES5/GamePad controller.

## Deliberately not imported

- MySQL queries, credentials, schemas and PHP sessions
- Clone-specific URLs and PJAX/AJAX request contracts
- Message sending, friend actions, posts, replies or Yeah mutations
- The large `complete.js` bundles
- Off-device webfonts
- The complete 850 KB Portal stylesheet

Those pieces depend on the clone's unfinished server model and would create a
second, conflicting architecture inside WUT. Visible demo rows therefore state
when their future WUT API is not connected.

## Current interaction contract

- D-Pad Up/Down moves through the global menu.
- A opens the selected Portal section.
- D-Pad Right enters the visible section.
- D-Pad Up/Down moves through rows or tabs inside that section.
- A selects the focused preview item.
- D-Pad Left or B returns from content to its global-menu button.
- B from the global menu requests Portal close.
- Touch, mouse and keyboard remain available for development.

The User Page binds its name, PNID/user ID, network, Game Experience and Mii
through `WUTSession` and `WUTMii` when those adapters have resolved data.

## Validation status

Static contracts and emulated runtime navigation are covered by the Node test
suite. The earlier Communities view was observed in Cemu by the project owner.
The newly integrated Feed, User Page, Messages and Notifications views still
need a Cemu pass and then a separate physical-Wii-U pass; neither is claimed by
the source tests.

