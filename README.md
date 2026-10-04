# RoomCraft 3D — Interior Designer

A browser-based 3D room configurator: pick a room size, drag in furniture,
doors, windows and modular kitchen pieces from the catalog, move/resize/
recolour/rotate each piece, and view it all in a live 3D scene. An Admin
page lets you manage the furniture catalog and now also manage who can
log in.

## 1. Open it

Open `login.html` (double-click it, or visit it first if you're hosting
the folder). It needs an internet connection the first time it loads (to
fetch the free 3D engine and fonts from their CDNs) — after that it runs
entirely in your browser.

## 2. Logging in

- The very first time you open the app, a single default admin account
  is created automatically: **username `admin`, password `admin123`**.
  The login page shows this as a hint until the password is changed.
- **Please change that password** (or add your own admin account and
  delete the default one) from the Admin page's new **Manage users**
  section as soon as you're in.
- Everyone needs to log in before using the designer (`index.html`) —
  if you're not logged in it sends you to `login.html` automatically.
- **Normal users** only see the designer. The **Admin ↗** link in the
  top bar is hidden for them, and if they try to open `admin.html`
  directly they're bounced back to the designer with a notice.
- **Admins** see the Admin link and can open `admin.html`, which now
  has a **Manage users** card where an admin can:
  - add a new user (choosing Normal user or Admin)
  - change any user's role
  - set/reset any user's password
  - delete a user (you can't delete the account you're currently
    logged in as, or the very last remaining admin, so nobody can
    accidentally lock everyone out)
- "Log out" is in the top bar on both the designer and the Admin page.

**Important — this is not real security.** RoomCraft 3D has no server;
everything, including the account list and passwords, is stored in
this browser's own storage in plain text. This is enough to keep a
normal user from casually poking around the Admin page on a shared
family/office computer, but anyone who opens the browser's developer
tools can read it. Don't use this app to protect anything sensitive,
and don't reuse an important password here.

## 3. Using the designer

- **Right panel, top:** set Width / Breadth / Height in feet and click
  **Build / resize room**. This is the shell you decorate.
- **Left panel:** switch between room tabs and click **Add** on any
  item to drop it into the room. Doors, windows and lofts are listed
  under every room and snap to / slide along the walls.
- **In the 3D view:** drag empty space to orbit the camera, scroll to
  zoom, click an item to select it, then drag the item itself to move
  it around the floor (or along a wall, for wall-mounted pieces).
- **Right panel, Selected item:** change width/height/depth, pick a new
  colour, rotate 15° at a time (free-standing items) or adjust height
  off the floor (wall-mounted items), or remove it.
- **Items in room:** a running list — click a name to reselect it, or
  remove it from there.
- **Top bar:** Save design / Load design keep your layout in this
  browser between visits; Download image saves a PNG snapshot; Reset
  room clears everything you've placed.

## 4. Admin — catalog and users

Open `admin.html` (also linked from the top bar, admins only).
- **Manage users:** see "Logging in" above.
- **Add a new item:** choose a room, a shape, a name, dimensions and a
  colour (wall-mounted shapes also get a height-off-floor field), then
  **Add item**. It appears in the designer immediately.
- **Edit an existing item:** change it directly in the table and click
  **Save** on that row. **Delete** removes it from the catalog.
- **Backup / restore:** export the whole catalog as a `.json` file, or
  restore the original starter catalog.

## 5. Where things are stored

Room designs, the furniture catalog, and the user accounts are all
stored in this browser's own storage (`localStorage`), the same way on
every page, so they're shared across the whole app **on the same
browser/device**. A different computer, or clearing browser data,
starts back at the defaults — export a catalog backup from Admin, or
"Save design" / "Download image", to keep a copy elsewhere.

## 6. Putting it online

Any free static host works, since there's no server code — GitHub
Pages, Netlify Drop, or Cloudflare Pages all just need this folder.
Remember the "not real security" note above before putting this
somewhere other people can reach, since the account data lives in
each visitor's own browser rather than a shared server.

## 7. Files

```
login.html      Login page
index.html      Designer app (catalog + 3D room + properties panel)
admin.html      Admin page — manage users + add/edit/delete catalog items
css/style.css   All styling
js/auth.js      User accounts & login/session logic (localStorage)
js/catalog.js   Furniture catalog data + save/load (localStorage)
js/scene3d.js   3D engine: room building, furniture shapes, camera, drag-to-move
js/main.js      Designer page UI wiring
js/admin.js     Admin page UI wiring (catalog + user management)
```
