WUT Identity Bridge 0.1.2
=========================

V1.2
----
- Uses modern WUT BSD socket headers.
- Does NOT call legacy socket_lib_init().
- Runs on the Wii U Menu title IDs as well as Miiverse IDs.
- Retries registration for about 45 seconds after application start.

Why the Wii U Menu?
-------------------
Miiverse is a system applet. A WUPS plugin is guaranteed to receive normal
application lifecycle hooks for the Wii U Menu, while relying on the applet
itself as the trigger is less reliable.

Build:
  .\build-plugin.ps1

Install:
  /fs/vol/external01/wiiu/environments/aroma/plugins/WUTIdentityBridge.wps

Do NOT replace Inkay.

Test V1.2 BEFORE opening Miiverse:
1. PC/XAMPP on.
2. Full coldboot Aroma.
3. Stay on the Wii U Menu.
4. Run on PC:

   curl.exe -s "http://192.168.1.75/WUT-miiverse/net/olv/v1/native/status.php"

If registered:true appears there, Auto-Mii extraction is working.
