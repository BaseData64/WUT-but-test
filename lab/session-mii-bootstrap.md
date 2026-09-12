# 0012 — First Run session + Mii bootstrap

## HECHO

- Grape's profile settings use game experience values 0/1/2 for Beginner/Intermediate/Expert.
- Grape's Portal requires server-side session identity and injects user/profile data into the page shell.
- Reverse-engineering tooling shows the Miiverse applet sends `X-Nintendo-ServiceToken` and `X-Nintendo-ParamPack` to the Portal.
- ariankordi's Mii renderer frontend accepts Mii data, PID, or NNID/PNID and exposes PNG rendering through `/miis/image.png`.
- WUT now persists game skill/setup state and has adapters for console context and Mii rendering.

## DESCONOCIDO / PENDIENTE

- WUT does not yet decrypt or validate `X-Nintendo-ServiceToken` into a trusted PID/PNID.
- Therefore automatic real-console identity is not yet complete even though the server can now receive/detect the headers.
- Wii U hardware validation is still required for the new PHP bootstrap path.

## DECISIÓN

Do not ask users for Pretendo passwords. The production identity path must derive identity from console/appet request context or another trusted console-side bridge.
