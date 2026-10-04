/* ============================================================
   ROOMCRAFT 3D — login & user accounts
   This is a client-only app (no server), so "accounts" just means a
   username/password list kept in this browser's localStorage. That's
   enough to keep casual/normal users away from the Admin page on a
   shared computer, but it is NOT real security — anyone who opens the
   browser's dev tools can read the stored passwords. Don't use this to
   protect anything sensitive.
   ============================================================ */

const RC_AUTH_KEYS = {
  users:   "rc_users_v1",
  session: "rc_session_v1"
};

/* Seed a single default admin account the very first time the app is
   opened, so nobody is ever locked out. */
function seedUsersIfNeeded(){
  if(!localStorage.getItem(RC_AUTH_KEYS.users)){
    const seed = [{ username: "admin", password: "admin123", role: "admin" }];
    localStorage.setItem(RC_AUTH_KEYS.users, JSON.stringify(seed));
  }
}

function getUsers(){
  try{
    const raw = localStorage.getItem(RC_AUTH_KEYS.users);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveUsers(list){ localStorage.setItem(RC_AUTH_KEYS.users, JSON.stringify(list)); }

function findUser(username){
  if(!username) return null;
  return getUsers().find(u => u.username.toLowerCase() === String(username).toLowerCase()) || null;
}

function addUser(username, password, role){
  username = (username || "").trim();
  password = (password || "").trim();
  if(!username) throw new Error("Enter a username.");
  if(!password) throw new Error("Enter a password.");
  if(findUser(username)) throw new Error(`The username "${username}" is already taken.`);
  const list = getUsers();
  list.push({ username, password, role: role === "admin" ? "admin" : "user" });
  saveUsers(list);
}

function deleteUser(username){
  const list = getUsers();
  const target = list.find(u => u.username === username);
  if(!target) return;
  if(target.role === "admin"){
    const adminCount = list.filter(u => u.role === "admin").length;
    if(adminCount <= 1) throw new Error("Can't delete the last remaining admin account.");
  }
  saveUsers(list.filter(u => u.username !== username));
}

function setUserRole(username, role){
  const list = getUsers();
  const u = list.find(x => x.username === username);
  if(!u) throw new Error("User not found.");
  if(u.role === "admin" && role !== "admin"){
    const adminCount = list.filter(x => x.role === "admin").length;
    if(adminCount <= 1) throw new Error("Can't demote the last remaining admin.");
  }
  u.role = role === "admin" ? "admin" : "user";
  saveUsers(list);
}

function changePassword(username, newPassword){
  newPassword = (newPassword || "").trim();
  if(!newPassword) throw new Error("Enter a new password.");
  const list = getUsers();
  const u = list.find(x => x.username === username);
  if(!u) throw new Error("User not found.");
  u.password = newPassword;
  saveUsers(list);
}

/* ---------- session ---------- */
function login(username, password){
  const u = findUser(username);
  if(!u || u.password !== password) return null;
  localStorage.setItem(RC_AUTH_KEYS.session, u.username);
  return u;
}
function logout(){ localStorage.removeItem(RC_AUTH_KEYS.session); }
function getCurrentUsername(){ return localStorage.getItem(RC_AUTH_KEYS.session); }
function getCurrentUser(){ return findUser(getCurrentUsername()); }
function isLoggedIn(){ return !!getCurrentUser(); }
function isAdmin(){ const u = getCurrentUser(); return !!u && u.role === "admin"; }

/* Call at the very top of a page that needs someone logged in. */
function requireLogin(){
  seedUsersIfNeeded();
  if(!isLoggedIn()){
    window.location.href = "login.html";
    return false;
  }
  return true;
}
/* Call at the very top of a page that only admins may see. */
function requireAdmin(){
  if(!requireLogin()) return false;
  if(!isAdmin()){
    alert("That page is for admins only.");
    window.location.href = "index.html";
    return false;
  }
  return true;
}

seedUsersIfNeeded();
