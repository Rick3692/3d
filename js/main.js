/* ============================================================
   ROOMCRAFT 3D — main app wiring
   ============================================================ */

let activeCategory = "hall";

function renderCatTabs(){
  const wrap = document.getElementById("cat-tabs");
  wrap.innerHTML = "";
  Object.keys(ROOM_CATEGORIES).forEach(key=>{
    const cat = ROOM_CATEGORIES[key];
    if(cat.shared) return;   // Doors & Windows are listed under every room instead
    const btn = document.createElement("button");
    btn.className = "cat-tab" + (key === activeCategory ? " active" : "");
    btn.textContent = cat.icon + " " + cat.name;
    btn.addEventListener("click", ()=>{
      activeCategory = key;
      renderCatTabs();
      renderCatalogList();
    });
    wrap.appendChild(btn);
  });
}

function renderCatalogList(){
  const list = document.getElementById("catalog-list");
  list.innerHTML = "";
  const items = getCatalogByCategory(activeCategory);
  const shared = getCatalog().filter(i=>{
    const c = ROOM_CATEGORIES[i.category];
    return c && c.shared && i.category !== activeCategory;
  });

  if(items.length === 0){
    list.innerHTML = `<div class="empty-note">No items in this room yet. Add some from the Admin page.</div>`;
  }
  items.forEach(item=> list.appendChild(buildCatalogRow(item)));

  if(shared.length){
    const head = document.createElement("div");
    head.className = "empty-note";
    head.style.cssText = "margin:14px 0 6px;font-weight:600;color:var(--muted);";
    head.textContent = "Doors & windows";
    list.appendChild(head);
    shared.forEach(item=> list.appendChild(buildCatalogRow(item)));
  }
}

function buildCatalogRow(item){
  const row = document.createElement("div");
  row.className = "catalog-item";
  const wallNote = isWallModel(item.model) ? " · on wall" : "";
  row.innerHTML = `
    <div class="swatch" style="background:${item.color};">${modelEmoji(item.model)}</div>
    <div class="info">
      <strong>${item.name}</strong>
      <span>${item.width}×${item.height}×${item.depth} ft${wallNote}</span>
    </div>
    <button data-id="${item.id}">Add</button>
  `;
  row.querySelector("button").addEventListener("click", ()=>{
    Scene3D.addItem(item);
    renderRoomItemsList();
  });
  return row;
}

function modelEmoji(model){
  const map = {
    box:"📦", wardrobe:"🚪", bed:"🛏️", chair:"🪑", table:"🍽️", sofa:"🛋️",
    counter:"🧱", sink:"🚰", commode:"🚽", bathtub:"🛁", shrine:"🪔", lamp:"💡",
    tv:"📺", fridge:"🧊", door:"🚪", window:"🪟", loft:"🗄️",
    kitchen_cabinet:"🗄️", l_kitchen:"📐", mod_base:"🗄️", mod_drawer:"🗃️",
    mod_sink:"🚰", mod_hob:"🔥", mod_tall:"🚪", mod_wall:"🗄️", mod_chimney:"♨️"
  };
  return map[model] || "🔷";
}

/* ---------------- room build ---------------- */
document.getElementById("build-room-btn").addEventListener("click", ()=>{
  const w = parseFloat(document.getElementById("room-width").value) || 12;
  const d = parseFloat(document.getElementById("room-depth").value) || 10;
  const h = parseFloat(document.getElementById("room-height").value) || 9;
  Scene3D.buildRoom(w, d, h);
  Scene3D.clearItems();
  renderRoomItemsList();
  hideSelectionPanel();
});

document.getElementById("reset-room-btn").addEventListener("click", ()=>{
  if(!confirm("Clear everything currently placed in the room?")) return;
  Scene3D.clearItems();
  renderRoomItemsList();
  hideSelectionPanel();
});

/* ---------------- selection panel ---------------- */
function showSelectionPanel(info){
  document.getElementById("no-selection").style.display = "none";
  const panel = document.getElementById("selection-panel");
  panel.style.display = "block";
  document.getElementById("sel-name").textContent = info.name;
  document.getElementById("sel-w").value = round1(info.w);
  document.getElementById("sel-d").value = round1(info.d);
  document.getElementById("sel-h").value = round1(info.h);
  // wall-mounted items (door / window / loft): show height-from-floor, hide free rotation
  document.getElementById("sel-elev-field").style.display = info.isWall ? "block" : "none";
  document.getElementById("sel-rotate-field").style.display = info.isWall ? "none" : "block";
  document.getElementById("sel-wall-hint").style.display = info.isWall ? "block" : "none";
  document.getElementById("sel-e").value = round1(info.elev || 0);
  renderColorSwatches(info.color);
}
// keeps the elevation box in sync after a drag (e.g. a loft snapping on top of a wardrobe)
function refreshSelectionValues(){
  const uid = Scene3D.getSelectedUid();
  if(!uid) return;
  const info = Scene3D.getItemInfo(uid);
  if(info && info.isWall) document.getElementById("sel-e").value = round1(info.elev || 0);
}
function hideSelectionPanel(){
  document.getElementById("no-selection").style.display = "block";
  document.getElementById("selection-panel").style.display = "none";
}
function round1(n){ return Math.round(n*10)/10; }

function renderColorSwatches(activeColor){
  const wrap = document.getElementById("sel-colors");
  wrap.innerHTML = "";
  SWATCHES.forEach(c=>{
    const dot = document.createElement("div");
    dot.className = "color-dot" + (c.toLowerCase() === activeColor.toLowerCase() ? " active" : "");
    dot.style.background = c;
    dot.addEventListener("click", ()=>{
      const uid = Scene3D.getSelectedUid();
      if(!uid) return;
      Scene3D.updateItemColor(uid, c);
      renderColorSwatches(c);
    });
    wrap.appendChild(dot);
  });
}

document.getElementById("sel-e").addEventListener("change", ()=>{
  const uid = Scene3D.getSelectedUid();
  if(!uid) return;
  const e = parseFloat(document.getElementById("sel-e").value);
  Scene3D.updateItemElevation(uid, isNaN(e) ? 0 : e);
});

["sel-w","sel-d","sel-h"].forEach(id=>{
  document.getElementById(id).addEventListener("change", applyDimsFromPanel);
});
function applyDimsFromPanel(){
  const uid = Scene3D.getSelectedUid();
  if(!uid) return;
  const w = parseFloat(document.getElementById("sel-w").value) || 0.5;
  const d = parseFloat(document.getElementById("sel-d").value) || 0.5;
  const h = parseFloat(document.getElementById("sel-h").value) || 0.5;
  Scene3D.updateItemDims(uid, w, h, d);
}

document.getElementById("rotate-left").addEventListener("click", ()=>{
  const uid = Scene3D.getSelectedUid();
  if(uid) Scene3D.rotateItem(uid, -15);
});
document.getElementById("rotate-right").addEventListener("click", ()=>{
  const uid = Scene3D.getSelectedUid();
  if(uid) Scene3D.rotateItem(uid, 15);
});
document.getElementById("remove-item-btn").addEventListener("click", ()=>{
  const uid = Scene3D.getSelectedUid();
  if(uid) Scene3D.removeItem(uid);
});

/* ---------------- items-in-room list ---------------- */
function renderRoomItemsList(){
  const wrap = document.getElementById("room-items-list");
  const list = Scene3D.getPlacedList();
  wrap.innerHTML = "";
  if(list.length === 0){
    wrap.innerHTML = `<div class="empty-note">Nothing placed yet.</div>`;
    return;
  }
  list.forEach(it=>{
    const row = document.createElement("div");
    row.className = "room-item-row";
    row.innerHTML = `<span class="rname">${it.name}</span><button data-uid="${it.uid}">Remove</button>`;
    row.querySelector(".rname").addEventListener("click", ()=> Scene3D.selectItem(it.uid));
    row.querySelector("button").addEventListener("click", ()=> Scene3D.removeItem(it.uid));
    wrap.appendChild(row);
  });
}

/* ---------------- save / load / export ---------------- */
document.getElementById("save-design-btn").addEventListener("click", ()=>{
  saveDesign(Scene3D.serializeDesign());
  alert("Design saved in this browser. Use Load design to bring it back anytime.");
});
document.getElementById("load-design-btn").addEventListener("click", ()=>{
  const d = getSavedDesign();
  if(!d){ alert("No saved design found yet."); return; }
  document.getElementById("room-width").value = d.room.width;
  document.getElementById("room-depth").value = d.room.depth;
  document.getElementById("room-height").value = d.room.height;
  Scene3D.loadDesign(d);
  renderRoomItemsList();
  hideSelectionPanel();
});
document.getElementById("download-img-btn").addEventListener("click", ()=>{
  const dataUrl = Scene3D.exportImage();
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "roomcraft-3d-design.png";
  a.click();
});

/* ---------------- account (login / admin visibility) ---------------- */
function applyAccountUI(){
  const user = getCurrentUser();
  document.getElementById("admin-link").style.display = (user && user.role === "admin") ? "" : "none";
  document.getElementById("user-pill").textContent = user ? `${user.username} · ${user.role}` : "";
}
document.getElementById("logout-btn").addEventListener("click", ()=>{
  logout();
  window.location.href = "login.html";
});

/* ---------------- init ---------------- */
window.addEventListener("DOMContentLoaded", ()=>{
  applyAccountUI();
  renderCatTabs();
  renderCatalogList();

  Scene3D.init(document.getElementById("three-canvas"), document.getElementById("viewport"));
  Scene3D.onSelect(showSelectionPanel);
  Scene3D.onDeselect(hideSelectionPanel);
  Scene3D.onChange(()=>{ renderRoomItemsList(); refreshSelectionValues(); });

  renderRoomItemsList();
});
