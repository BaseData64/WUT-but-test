# WUT Account Core V1

## Rule
A WUT account is created automatically when a resolved Wii U user completes First Run. There is no login, email or password in V1.

## Persistent identity
Account matching prefers the resolved numeric PID. If PID is unavailable, AccountId or PNID can be used as a fallback. Re-entering WUT with the same stable identity recovers the existing account instead of creating a duplicate.

## Public WUT ID
Every account receives a 9-digit public ID such as `000000001`. Private Messages use this WUT ID rather than raw PID/AccountId.

## Storage
`net/olv/v1/account/data/accounts.json`

## Endpoints
- `account/ensure.php` — create or recover the current account.
- `account/current.php` — return the account attached to the current identity.
- `account/lookup.php?id=000000001` — resolve an existing public WUT ID.

## First Run
`profile/setup.php` creates/retrieves the account when `setup_complete=1`. `bootstrap.php` then treats the persistent account as the source of `setup_complete`, so an existing account skips First Run on later visits.

## Messages
Messages now require a real WUT account. Recipients must be existing 9-digit WUT IDs. Messages also includes a New Message panel so two real users can test delivery without hand-editing JSON.
