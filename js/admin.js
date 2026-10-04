/* ============================================================
   ROOMCRAFT 3D — admin panel logic
   ============================================================ */

let adminActiveCat = "all";

function populateSelect(el, options, valueKey, labelKey){
  el.innerHTML = options.map(o=>`<option value="${o[valueKey]}">${o[labelKey]}</option>`).join("");
}

function initAdminForm(){
  const catSelect = document.getElementById("np-category");
  catSelect.innerHTML = Object.keys(ROOM_CATEGORIES).map(key=>
    `<option value="${key}">${ROOM_CATEGORIES[key].icon} ${ROOM_CATEGORIES[key].name}</option>`
  ).join("");

  const modelSelect = document.getElementById("np-model");
  modelSelect.innerHTML = MODEL_TYPES.map(m=>`<option value="${m.id}">${m.label}</option>`).join("");
  modelSelect.addEventListener("change", ()=> applyModelDefaults(modelSelect.value));
  applyModelDefaults(modelSelect.value);
}

// Door / Window / Loft are wall-mounted: show the elevation field and
// pre-fill sensible sizes so the admin doesn't have to guess.
function applyModelDefaults(modelId){
  const wall = isWallModel(modelId);
  document.getElementById("np-elev-field").style.display = wall ? "" : "none";
  const hint = document.getElementById("np-shape-hint");
  const d = MODEL_DEFAULTS[modelId];
  hint.style.display = d ? "block" : "none";
  hint.textContent = d ? d.hint : "";
  if(d){
    document.getElementById("np-width").value  = d.width;
    document.getElementById("np-height").value = d.height;
    document.getElementById("np-depth").value  = d.depth;
    document.getElementById("np-elev").value   = d.elevation;
    document.getElementById("np-color").value  = d.color;
  }
}

function renderAdminTabs(){
  const wrap = document.getElementById("admin-cat-tabs");
  wrap.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className = "cat-tab" + (adminActiveCat === "all" ? " active" : "");
  allBtn.textContent = "All rooms";
  allBtn.addEventListener("click", ()=>{ adminActiveCat = "all"; renderAdminTabs(); renderAdminTable(); });
  wrap.appendChild(allBtn);

  Object.keys(ROOM_CATEGORIES).forEach(key=>{
    const cat = ROOM_CATEGORIES[key];
    const btn = document.createElement("button");
    btn.className = "cat-tab" + (adminActiveCat === key ? " active" : "");
    btn.textContent = cat.icon + " " + cat.name;
    btn.addEventListener("click", ()=>{ adminActiveCat = key; renderAdminTabs(); renderAdminTable(); });
    wrap.appendChild(btn);
  });
}

function renderAdminTable(){
  const tbody = document.getElementById("admin-items-tbody");
  tbody.innerHTML = "";
  const items = adminActiveCat === "all" ? getCatalog() : getCatalogByCategory(adminActiveCat);

  if(items.length === 0){
    tbody.innerHTML = `<tr><td colspan="8" style="padding:16px;color:var(--muted);">No items yet.</td></tr>`;
    return;
  }

  items.forEach(item=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="color" data-role="color" value="${item.color}" style="height:30px;width:40px;padding:1px;"></td>
      <td><input type="text" data-role="name" value="${item.name}"></td>
      <td>
        <select data-role="model">
          ${MODEL_TYPES.map(m=>`<option value="${m.id}" ${m.id===item.model?"selected":""}>${m.label}</option>`).join("")}
        </select>
      </td>
      <td><input type="number" step="0.1" data-role="width" value="${item.width}" style="width:70px;"></td>
      <td><input type="number" step="0.1" data-role="height" value="${item.height}" style="width:70px;"></td>
      <td><input type="number" step="0.1" data-role="depth" value="${item.depth}" style="width:70px;"></td>
      <td><input type="number" step="0.1" min="0" data-role="elevation" value="${itemElevation(item)}" ${isWallModel(item.model) ? "" : "disabled"} style="width:70px;"></td>
      <td style="white-space:nowrap;">
        <button class="btn small" data-act="save">Save</button>
        <button class="btn small danger" data-act="delete">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);

    // elevation only applies to wall-mounted shapes
    tr.querySelector('[data-role="model"]').addEventListener("change", (ev)=>{
      const elevInput = tr.querySelector('[data-role="elevation"]');
      const wall = isWallModel(ev.target.value);
      elevInput.disabled = !wall;
      if(wall && !parseFloat(elevInput.value)) elevInput.value = MODEL_DEFAULTS[ev.target.value].elevation;
    });

    tr.querySelector('[data-act="save"]').addEventListener("click", ()=>{
      const elevRaw = parseFloat(tr.querySelector('[data-role="elevation"]').value);
      const updated = {
        ...item,
        name: tr.querySelector('[data-role="name"]').value.trim() || item.name,
        model: tr.querySelector('[data-role="model"]').value,
        width: parseFloat(tr.querySelector('[data-role="width"]').value) || item.width,
        height: parseFloat(tr.querySelector('[data-role="height"]').value) || item.height,
        depth: parseFloat(tr.querySelector('[data-role="depth"]').value) || item.depth,
        color: tr.querySelector('[data-role="color"]').value,
        elevation: isWallModel(tr.querySelector('[data-role="model"]').value) ? (isNaN(elevRaw) ? 0 : elevRaw) : 0
      };
      upsertCatalogItem(updated);
      flashSaved(tr);
    });
    tr.querySelector('[data-act="delete"]').addEventListener("click", ()=>{
      if(confirm(`Delete "${item.name}"? This won't remove copies already placed in a saved design.`)){
        deleteCatalogItem(item.id);
        renderAdminTable();
      }
    });
  });
}

function flashSaved(tr){
  tr.style.background = "#EFF6EF";
  setTimeout(()=>{ tr.style.background = ""; }, 500);
}

/* ---------------- manage users ---------------- */
function renderUsersTable(){
  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";
  const current = getCurrentUser();
  const users = getUsers();
  const adminCount = users.filter(u => u.role === "admin").length;

  users.forEach(u=>{
    const isLastAdmin = u.role === "admin" && adminCount <= 1;
    const isYou = current && u.username === current.username;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.username}</strong>${isYou ? ' <span class="tag">you</span>' : ""}</td>
      <td>
        <select data-role="role" ${isLastAdmin ? "disabled" : ""}>
          <option value="user" ${u.role === "user" ? "selected" : ""}>Normal user</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
        ${isLastAdmin ? '<div style="font-size:.68rem;color:var(--muted);margin-top:3px;">last admin — can\'t change</div>' : ""}
      </td>
      <td><input type="text" data-role="newpass" placeholder="Leave blank to keep current"></td>
      <td style="white-space:nowrap;">
        <button class="btn small" data-act="save">Save</button>
        <button class="btn small danger" data-act="delete" ${(isYou || isLastAdmin) ? "disabled" : ""}>Delete</button>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector('[data-act="save"]').addEventListener("click", ()=>{
      try{
        const newRole = tr.querySelector('[data-role="role"]').value;
        setUserRole(u.username, newRole);
        const newPass = tr.querySelector('[data-role="newpass"]').value.trim();
        if(newPass) changePassword(u.username, newPass);
        flashSaved(tr);
        tr.querySelector('[data-role="newpass"]').value = "";
        renderUsersTable();
      }catch(e){ alert(e.message); renderUsersTable(); }
    });
    tr.querySelector('[data-act="delete"]').addEventListener("click", ()=>{
      if(isYou){ alert("You can't delete the account you're currently logged in as."); return; }
      if(!confirm(`Delete user "${u.username}"? This can't be undone.`)) return;
      try{ deleteUser(u.username); renderUsersTable(); }
      catch(e){ alert(e.message); }
    });
  });
}

document.getElementById("add-user-btn").addEventListener("click", ()=>{
  const username = document.getElementById("nu-username").value.trim();
  const password = document.getElementById("nu-password").value.trim();
  const role = document.getElementById("nu-role").value;
  try{
    addUser(username, password, role);
    document.getElementById("nu-username").value = "";
    document.getElementById("nu-password").value = "";
    document.getElementById("nu-role").value = "user";
    renderUsersTable();
  }catch(e){ alert(e.message); }
});

function applyAdminAccountUI(){
  const user = getCurrentUser();
  document.getElementById("user-pill").textContent = user ? `${user.username} · ${user.role}` : "";
}
document.getElementById("logout-btn").addEventListener("click", ()=>{
  logout();
  window.location.href = "login.html";
});

document.getElementById("add-item-btn").addEventListener("click", ()=>{
  const category = document.getElementById("np-category").value;
  const model = document.getElementById("np-model").value;
  const name = document.getElementById("np-name").value.trim();
  const width = parseFloat(document.getElementById("np-width").value) || 1;
  const height = parseFloat(document.getElementById("np-height").value) || 1;
  const depth = parseFloat(document.getElementById("np-depth").value) || 1;
  const color = document.getElementById("np-color").value;

  if(!name){ alert("Give the item a name."); return; }

  const id = category + "-" + Date.now().toString(36);
  const elevation = isWallModel(model) ? (parseFloat(document.getElementById("np-elev").value) || 0) : 0;
  upsertCatalogItem({ id, category, model, name, width, height, depth, color, elevation });

  document.getElementById("np-name").value = "";
  adminActiveCat = category;
  renderAdminTabs();
  renderAdminTable();
});

document.getElementById("export-catalog-btn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(getCatalog(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "roomcraft-catalog-backup.json";
  a.click();
});

document.getElementById("reset-catalog-btn").addEventListener("click", ()=>{
  if(!confirm("Replace the current catalog with the original starter items? This can't be undone.")) return;
  saveCatalog(defaultCatalog());
  renderAdminTable();
});

window.addEventListener("DOMContentLoaded", ()=>{
  applyAdminAccountUI();
  renderUsersTable();
  initAdminForm();
  renderAdminTabs();
  renderAdminTable();
});
