/* ============================================================
   ROOMCRAFT 3D — 3D engine (built on three.js)
   Everything furniture-shaped here is generated from primitives
   (boxes/cylinders/cones) parametrized by width/height/depth, so
   the admin panel can create new catalog items without anyone
   needing to model or upload a 3D file.
   ============================================================ */

const Scene3D = (function(){

  let scene, camera, renderer, canvasEl, container;
  let itemsGroup, roomGroup, floorPickPlane;
  let wallsGroup, wallMat;
  let selectedHelper = null;
  let placed = {};           // uid -> {group, model, w,h,d, color, name, catalogId}
  let selectedUid = null;
  let roomDims = { width: 12, depth: 10, height: 9 };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  // camera orbit state (spherical around target)
  const cam = { theta: Math.PI*0.28, phi: Math.PI*0.36, radius: 22, target: new THREE.Vector3(0,3,0) };
  let isOrbiting = false, lastX=0, lastY=0, moved=0;
  let dragging = null; // {uid, offsetX, offsetZ}

  let onSelectCallback = null;
  let onDeselectCallback = null;
  let onChangeCallback = null; // fires after drag/rotate so UI can refresh

  /* ---------------- colour helper ---------------- */
  function shade(hex, amt){
    const c = new THREE.Color(hex);
    if(amt >= 0){ c.lerp(new THREE.Color(0xffffff), amt); }
    else{ c.lerp(new THREE.Color(0x000000), -amt); }
    return c;
  }
  function mat(hex){
    return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, metalness: 0.05 });
  }

  function addBox(group, w,h,d, x,y,z, color, castShadow){
    const geo = new THREE.BoxGeometry(Math.max(w,0.02), Math.max(h,0.02), Math.max(d,0.02));
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x,y,z);
    m.castShadow = castShadow !== false;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function addCyl(group, rTop,rBottom,h, x,y,z, color, seg){
    const geo = new THREE.CylinderGeometry(rTop, rBottom, Math.max(h,0.02), seg||14);
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x,y,z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  }

  function addGlass(group, w,h, x,y,z){
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(w,0.02), Math.max(h,0.02), 0.03),
      new THREE.MeshStandardMaterial({ color: 0xBFE0F0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 })
    );
    m.position.set(x,y,z);
    group.add(m);
    return m;
  }

  // Frame thickness for doors/windows. Shared by the mesh builders and by the
  // wall-opening code so the hole in the wall always matches the frame.
  function frameOf(model, w, h){
    if(model === "door")   return Math.min(0.2,  w*0.25);
    if(model === "window") return Math.min(0.15, w*0.2, h*0.2);
    return 0;
  }

  /* ---------------- kitchen helpers ----------------
     Base units are built facing +z (front) with the origin at the bottom
     centre, like every other shape. The L-shaped kitchen is made from two
     base runs, one of them turned to face +x. */
  const K_TOP = "#2E2C29", K_STEEL = "#B9BCBF", K_PLINTH = "#1F1F1F";

  function kDoors(g, w, y0, hgt, fz, color, n){
    n = n || Math.max(1, Math.round(w/1.8));
    const pw = (w - 0.06)/n;
    for(let i=0;i<n;i++){
      const x = -w/2 + 0.03 + pw*(i+0.5);
      addBox(g, pw-0.04, hgt, 0.04, x, y0+hgt/2, fz, color);
      const hx = (i%2===0) ? x + pw/2 - 0.12 : x - pw/2 + 0.12;
      addBox(g, 0.03, Math.min(0.4, hgt*0.5), 0.03, hx, y0+hgt/2, fz+0.035, K_STEEL);
    }
  }
  function kDrawers(g, w, y0, hgt, fz, color, n){
    const dh = hgt/n;
    for(let i=0;i<n;i++){
      const y = y0 + dh*(i+0.5);
      addBox(g, w-0.06, dh-0.04, 0.04, 0, y, fz, color);
      addBox(g, Math.min(0.5, w*0.4), 0.03, 0.03, 0, y + (dh-0.04)*0.25, fz+0.035, K_STEEL);
    }
  }
  // kind: "doors" | "drawers" | "cabinet" (drawer row over doors) | "sink" | "hob"
  function kBase(w,h,d,color,kind,withTop){
    const g = new THREE.Group();
    const plinth = 0.3, slab = 0.12, bodyH = Math.max(h - plinth - slab, 0.3);
    const fz = d/2 + 0.02;
    addBox(g, Math.max(w-0.04,0.05), plinth, Math.max(d-0.15,0.05), 0, plinth/2, -0.075, K_PLINTH);
    addBox(g, w, bodyH, d, 0, plinth + bodyH/2, 0, shade(color,-0.2));
    if(withTop !== false) addBox(g, w+0.02, slab, d+0.08, 0, h - slab/2, 0.04, K_TOP);
    const y0 = plinth + 0.04, fh = bodyH - 0.08;
    if(kind === "drawers"){
      kDrawers(g, w, y0, fh, fz, color, 3);
    } else if(kind === "cabinet"){
      const dh = Math.min(0.55, fh*0.22);
      kDrawers(g, w, y0 + fh - dh, dh, fz, color, 1);
      kDoors(g, w, y0, fh - dh - 0.04, fz, color);
    } else {
      kDoors(g, w, y0, fh, fz, color);
    }
    if(kind === "sink"){
      addBox(g, w*0.6, 0.02, d*0.62, 0, h+0.01, 0.03, K_STEEL);
      addBox(g, w*0.5, 0.025, d*0.5, 0, h+0.02, 0.03, "#8E9296");
      addCyl(g, 0.03,0.03, 0.45, 0, h+0.225, -d*0.36, K_STEEL, 10);
      addBox(g, 0.03, 0.03, 0.26, 0, h+0.45, -d*0.36+0.12, K_STEEL);
    }
    if(kind === "hob"){
      addBox(g, w*0.86, 0.02, d*0.78, 0, h+0.01, 0.03, "#0F0F0F");
      const cols = w >= 2.2 ? 2 : 1;
      for(let cx=0; cx<cols; cx++){
        for(let rz=0; rz<2; rz++){
          const x = cols === 1 ? 0 : (cx === 0 ? -w*0.2 : w*0.2);
          const z = 0.03 + (rz === 0 ? -d*0.2 : d*0.2);
          addCyl(g, 0.2, 0.2, 0.02, x, h+0.03, z, "#4A4A4A", 20);
          addCyl(g, 0.1, 0.1, 0.03, x, h+0.04, z, "#1A1A1A", 16);
        }
      }
    }
    return g;
  }

  /* ---------------- model builders ----------------
     Each takes (w,h,d,color) and returns a THREE.Group whose
     origin sits at the bottom-centre of the item's footprint. */
  const MODEL_BUILDERS = {

    box(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w,h,d, 0,h/2,0, color);
      return g;
    },

    wardrobe(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w,h,d, 0,h/2,0, color);
      addBox(g, 0.03, h*0.85, 0.02, 0, h/2, d/2+0.01, shade(color,-0.4));
      addCyl(g, 0.035,0.035,0.28, -w*0.08, h*0.52, d/2+0.05, shade(color,-0.5));
      addCyl(g, 0.035,0.035,0.28,  w*0.08, h*0.52, d/2+0.05, shade(color,-0.5));
      return g;
    },

    bed(w,h,d,color){
      const g = new THREE.Group();
      const baseH = h*0.32, mattH = h*0.26;
      addBox(g, w, baseH, d, 0, baseH/2, 0, shade(color,-0.25));
      addBox(g, w*0.96, mattH, d*0.94, 0, baseH+mattH/2, -d*0.01, "#F2EEE2");
      addBox(g, w, h*0.85, 0.18, 0, h*0.85/2, -d/2+0.09, shade(color,-0.1));
      addBox(g, w*0.9, mattH*0.5, d*0.22, 0, baseH+mattH+mattH*0.25, -d*0.28, "#E7DFC9"); // pillow-ish
      return g;
    },

    chair(w,h,d,color){
      const g = new THREE.Group();
      const seatY = h*0.45;
      addBox(g, w, h*0.09, d, 0, seatY, 0, color);
      addBox(g, w*0.92, h*0.5, 0.09, 0, seatY + h*0.5/2, -d/2+0.045, shade(color,-0.15));
      const legR = 0.045;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
        addCyl(g, legR,legR, seatY, sx*(w/2-0.12), seatY/2, sz*(d/2-0.12), shade(color,-0.4));
      });
      return g;
    },

    table(w,h,d,color){
      const g = new THREE.Group();
      const topH = Math.max(h*0.08, 0.12);
      addBox(g, w, topH, d, 0, h-topH/2, 0, color);
      const legR = 0.06;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
        addCyl(g, legR,legR, h-topH, sx*(w/2-0.15), (h-topH)/2, sz*(d/2-0.15), shade(color,-0.3));
      });
      return g;
    },

    sofa(w,h,d,color){
      const g = new THREE.Group();
      const baseH = h*0.42;
      addBox(g, w, baseH, d, 0, baseH/2, 0, color);
      addBox(g, w, h*0.55, d*0.24, 0, baseH + h*0.55/2, -d/2+d*0.12, shade(color,-0.12));
      const armW = Math.max(w*0.1, 0.35);
      addBox(g, armW, h*0.62, d, -w/2+armW/2, h*0.62/2, 0, shade(color,-0.08));
      addBox(g, armW, h*0.62, d,  w/2-armW/2, h*0.62/2, 0, shade(color,-0.08));
      return g;
    },

    counter(w,h,d,color){
      const g = new THREE.Group();
      const bodyH = h*0.86;
      addBox(g, w, bodyH, d, 0, bodyH/2, 0, color);
      addBox(g, w*1.02, h*0.1, d*1.05, 0, bodyH + h*0.05, 0, "#2E2C29");
      return g;
    },

    sink(w,h,d,color){
      const g = new THREE.Group();
      addCyl(g, w*0.14, w*0.18, h*0.78, 0, h*0.78/2, 0, shade(color,-0.15));
      addCyl(g, w*0.46, w*0.5, h*0.14, 0, h*0.78+h*0.07, 0, color, 22);
      addCyl(g, 0.03,0.03, h*0.16, 0, h*0.78+h*0.14+h*0.08, -d*0.25, shade(color,-0.6));
      addBox(g, 0.12,0.03,0.03, 0, h*0.78+h*0.14+h*0.16, -d*0.19, shade(color,-0.6));
      return g;
    },

    commode(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w*0.7, h*0.35, d*0.24, 0, h*0.65+h*0.175, -d/2+d*0.12, color);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(w*0.4,18,12), mat(color));
      bowl.scale.set(1,0.55,1.3);
      bowl.position.set(0, h*0.34, d*0.06);
      bowl.castShadow = true; bowl.receiveShadow = true;
      g.add(bowl);
      addCyl(g, w*0.26, w*0.32, h*0.34, 0, h*0.17, d*0.02, shade(color,-0.1));
      return g;
    },

    bathtub(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w, h, d, 0, h/2, 0, color);
      addBox(g, w*0.84, h*0.62, d*0.72, 0, h*0.62/2 + h*0.32, 0, "#DCEAF2");
      return g;
    },

    shrine(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w, h*0.14, d, 0, h*0.07, 0, shade(color,-0.2));
      addBox(g, w*0.78, h*0.5, d*0.68, 0, h*0.14+h*0.25, 0, color);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w*0.55, h*0.28, 4), mat(shade(color,-0.15)));
      roof.rotation.y = Math.PI/4;
      roof.position.set(0, h*0.14+h*0.5+h*0.14, 0);
      roof.castShadow = true;
      g.add(roof);
      addCyl(g, 0.05,0.05, h*0.5, -w*0.34, h*0.14+h*0.25, d*0.3, shade(color,-0.3));
      addCyl(g, 0.05,0.05, h*0.5,  w*0.34, h*0.14+h*0.25, d*0.3, shade(color,-0.3));
      return g;
    },

    lamp(w,h,d,color){
      const g = new THREE.Group();
      addCyl(g, w*0.4, w*0.45, h*0.05, 0, h*0.025, 0, shade(color,-0.3));
      addCyl(g, 0.045,0.06, h*0.82, 0, h*0.05+h*0.41, 0, shade(color,-0.1));
      const top = new THREE.Mesh(new THREE.ConeGeometry(w*0.42, h*0.22, 16, 1, true), mat(color));
      top.position.set(0, h*0.9, 0);
      top.castShadow = true;
      g.add(top);
      return g;
    },

    tv(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w, h*0.4, d, 0, h*0.2, 0, color);
      addBox(g, w*0.68, h*0.5, 0.06, 0, h*0.4+h*0.25, -d/2+0.03, "#141414");
      return g;
    },

    fridge(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w, h, d, 0, h/2, 0, color);
      addBox(g, w*0.9, 0.03, d*0.02, 0, h*0.6, d/2+0.005, shade(color,-0.5));
      addCyl(g, 0.03,0.03, 0.4, w*0.32, h*0.72, d/2+0.05, shade(color,-0.4));
      addCyl(g, 0.03,0.03, 0.5, w*0.32, h*0.3, d/2+0.05, shade(color,-0.4));
      return g;
    },

    /* ---- wall-mounted shapes: back face sits at z = -d/2 (the wall plane) ---- */

    door(w,h,d,color){
      const g = new THREE.Group();
      const f = frameOf("door", w, h);
      const dark = shade(color,-0.3);
      addBox(g, f, h, d, -w/2+f/2, h/2, 0, dark);
      addBox(g, f, h, d,  w/2-f/2, h/2, 0, dark);
      addBox(g, w, f, d, 0, h-f/2, 0, dark);
      const lw = w-2*f, lh = h-f, lz = -d/2 + 0.08;
      addBox(g, lw, lh, 0.1, 0, lh/2, lz, color);
      const pw = lw*0.72, pz = lz + 0.055, pc = shade(color,-0.1);
      addBox(g, pw, lh*0.36, 0.03, 0, lh*0.73, pz, pc);
      addBox(g, pw, lh*0.36, 0.03, 0, lh*0.27, pz, pc);
      const brass = "#B4823E", hx = w/2 - f - 0.3;
      const knob = addCyl(g, 0.045,0.045, 0.14, hx, lh*0.48, lz+0.11, brass, 12);
      knob.rotation.x = Math.PI/2;
      addBox(g, 0.32, 0.05, 0.04, hx-0.14, lh*0.48, lz+0.17, brass);
      return g;
    },

    window(w,h,d,color){
      const g = new THREE.Group();
      const f = frameOf("window", w, h);
      addBox(g, f, h, d, -w/2+f/2, h/2, 0, color);
      addBox(g,  f, h, d,  w/2-f/2, h/2, 0, color);
      addBox(g, w-2*f, f, d, 0, f/2, 0, color);
      addBox(g, w-2*f, f, d, 0, h-f/2, 0, color);
      // pale "sky" behind the glass so the opening doesn't look like a black hole
      const sky = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(w-2*f,0.02), Math.max(h-2*f,0.02)),
        new THREE.MeshBasicMaterial({ color: 0xD6E8F2, side: THREE.DoubleSide })
      );
      sky.position.set(0, h/2, -d/2 - 0.02);
      g.add(sky);
      const gz = -d/2 + 0.09;
      addGlass(g, w-2*f, h-2*f, 0, h/2, gz);
      const bar = shade(color,-0.08);
      addBox(g, 0.06, h-2*f, 0.05, 0, h/2, gz, bar);
      addBox(g, w-2*f, 0.06, 0.05, 0, h/2, gz, bar);
      addBox(g, w+0.3, 0.08, d+0.14, 0, 0.04, 0.07, shade(color,-0.15)); // sill
      return g;
    },

    loft(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w, h, d, 0, h/2, 0, shade(color,-0.2));
      const n = w >= 5 ? 4 : w >= 3.2 ? 3 : w >= 1.8 ? 2 : 1;
      const pw = (w - 0.1) / n;
      for(let i=0;i<n;i++){
        const x = -w/2 + 0.05 + pw*(i+0.5);
        addBox(g, pw-0.04, Math.max(h-0.1,0.05), 0.03, x, h/2, d/2+0.012, color);
        const kx = (i%2===0) ? x + pw/2 - 0.14 : x - pw/2 + 0.14;
        const knob = addCyl(g, 0.03,0.03, 0.06, kx, h/2, d/2+0.06, shade(color,-0.5), 10);
        knob.rotation.x = Math.PI/2;
      }
      addBox(g, w+0.04, 0.05, d+0.04, 0, 0.025, 0, shade(color,-0.35));
      return g;
    },

    /* ---- kitchen cabinets ---- */

    // Base cabinet: drawer row on top, doors below, dark counter top.
    kitchen_cabinet(w,h,d,color){
      return kBase(w, h, d, color, "cabinet", true);
    },

    // L-shaped run. w x d is the outer size of the "L"; the corner sits at
    // the back-left, so it tucks into the back-left corner of the room.
    l_kitchen(w,h,d,color){
      const g = new THREE.Group();
      const a = Math.max(0.8, Math.min(2, w*0.4, d*0.4));       // depth of each arm
      const sideLen = Math.max(d - a, 0.3);

      const back = kBase(w, h, a, color, "doors", false);       // along the back wall (includes the corner)
      back.position.set(0, 0, -d/2 + a/2);
      g.add(back);

      const side = kBase(sideLen, h, a, color, "drawers", false); // along the left wall, facing +x
      side.rotation.y = Math.PI/2;
      side.position.set(-w/2 + a/2, 0, a/2);
      g.add(side);

      // one continuous L-shaped counter top
      const t = 0.12, ty = h - t/2;
      addBox(g, w+0.02, t, a+0.04, 0, ty, -d/2 + (a+0.04)/2, K_TOP);
      addBox(g, a+0.05, t, sideLen, -w/2 + (a+0.03)/2, ty, a/2 + 0.04, K_TOP);

      if(w >= 6){                                               // sink + tap on the back run
        const sx = w/2 - 1.3, sz = -d/2 + a/2 + 0.03;
        addBox(g, 1.6, 0.02, a*0.6, sx, h+0.01, sz, K_STEEL);
        addBox(g, 1.4, 0.025, a*0.48, sx, h+0.02, sz, "#8E9296");
        addCyl(g, 0.03,0.03, 0.45, sx, h+0.225, -d/2 + 0.2, K_STEEL, 10);
        addBox(g, 0.03, 0.03, 0.26, sx, h+0.45, -d/2 + 0.32, K_STEEL);
      }
      return g;
    },

    /* ---- modular kitchen units ---- */

    mod_base(w,h,d,color){   return kBase(w, h, d, color, "doors",   true); },
    mod_drawer(w,h,d,color){ return kBase(w, h, d, color, "drawers", true); },
    mod_sink(w,h,d,color){   return kBase(w, h, d, color, "sink",    true); },
    mod_hob(w,h,d,color){    return kBase(w, h, d, color, "hob",     true); },

    // Tall pantry / oven-tower style unit: lower + upper doors, no counter top.
    mod_tall(w,h,d,color){
      const g = new THREE.Group();
      const plinth = 0.3, bodyH = Math.max(h - plinth, 0.5);
      addBox(g, Math.max(w-0.04,0.05), plinth, Math.max(d-0.15,0.05), 0, plinth/2, -0.075, K_PLINTH);
      addBox(g, w, bodyH, d, 0, plinth + bodyH/2, 0, shade(color,-0.2));
      const fz = d/2 + 0.02, y0 = plinth + 0.04, fh = bodyH - 0.08, lowH = fh*0.55;
      kDoors(g, w, y0, lowH, fz, color);
      kDoors(g, w, y0 + lowH + 0.04, fh - lowH - 0.04, fz, color);
      return g;
    },

    // Wall unit (wall-mounted): hangs at an elevation, back against the wall.
    mod_wall(w,h,d,color){
      const g = new THREE.Group();
      addBox(g, w, h, d, 0, h/2, 0, shade(color,-0.2));
      const n = Math.max(1, Math.round(w/1.5)), pw = (w - 0.06)/n;
      for(let i=0;i<n;i++){
        const x = -w/2 + 0.03 + pw*(i+0.5);
        addBox(g, pw-0.04, Math.max(h-0.08,0.05), 0.04, x, h/2, d/2+0.02, color);
        addBox(g, Math.min(0.3, pw*0.5), 0.03, 0.03, x, 0.2, d/2+0.055, K_STEEL);
      }
      return g;
    },

    // Chimney / hood (wall-mounted): canopy plus a flue against the wall.
    mod_chimney(w,h,d,color){
      const g = new THREE.Group();
      const canopyH = Math.min(0.5, h*0.3);
      addBox(g, w, canopyH, d, 0, canopyH/2, 0, color);
      addBox(g, w*0.84, 0.03, d*0.8, 0, 0, 0.02, "#151515");
      const fh = Math.max(h - canopyH, 0.1), fw = w*0.38, fd = d*0.5;
      addBox(g, fw, fh, fd, 0, canopyH + fh/2, -d/2 + fd/2, shade(color,0.1));
      return g;
    }
  };

  function buildModelGroup(model, w, h, d, color){
    const builder = MODEL_BUILDERS[model] || MODEL_BUILDERS.box;
    return builder(w, h, d, color);
  }

  /* ---------------- walls (with door / window openings) ----------------
     Walls are rebuilt from flat rectangles around each opening, so a door or
     window really is a hole you can see through — and it follows the item
     when it is dragged, resized or removed.
     "u" = position along a wall in world units: x for the back wall, z for
     the left/right walls (0 = middle of the wall). */
  function wallInfo(wall){
    const W = roomDims.width, D = roomDims.depth;
    if(wall === "back") return { length: W, pos:[0,0,-D/2], rotY: 0,           flip:false };
    if(wall === "left") return { length: D, pos:[-W/2,0,0], rotY: Math.PI/2,   flip:true  };
    return                     { length: D, pos:[ W/2,0,0], rotY:-Math.PI/2,   flip:false };
  }

  function collectOpenings(wall){
    const H = roomDims.height, info = wallInfo(wall), out = [];
    Object.values(placed).forEach(r=>{
      if(r.wall !== wall || !isOpeningModel(r.model)) return;
      const f = frameOf(r.model, r.w, r.h);
      let a = r.u - (r.w/2 - f), b = r.u + (r.w/2 - f);
      if(info.flip){ const t = a; a = -b; b = -t; }   // left wall's local x runs opposite to u
      const y0 = r.model === "door" ? r.elev : r.elev + f;
      out.push({ x0:a, x1:b, y0:Math.max(0,y0), y1:Math.min(H, r.elev + r.h - f) });
    });
    return out;
  }

  function wallRects(L, H, ops){
    const half = L/2, clamp = v => Math.max(-half, Math.min(half, v));
    const cuts = new Set([-half, half]);
    ops.forEach(o=>{ cuts.add(clamp(o.x0)); cuts.add(clamp(o.x1)); });
    const xs = Array.from(cuts).sort((a,b)=>a-b);
    const rects = [];
    for(let i=0;i<xs.length-1;i++){
      const xa = xs[i], xb = xs[i+1];
      if(xb - xa < 1e-4) continue;
      const mid = (xa+xb)/2;
      const spans = ops.filter(o=>o.x0 < mid && o.x1 > mid && o.y1 > o.y0)
                       .map(o=>[o.y0,o.y1]).sort((p,q)=>p[0]-q[0]);
      let cursor = 0;
      spans.forEach(sp=>{
        if(sp[0] > cursor + 1e-4) rects.push({ x0:xa, x1:xb, y0:cursor, y1:sp[0] });
        cursor = Math.max(cursor, sp[1]);
      });
      if(cursor < H - 1e-4) rects.push({ x0:xa, x1:xb, y0:cursor, y1:H });
    }
    return rects;
  }

  function rebuildWalls(){
    if(!wallsGroup) return;
    while(wallsGroup.children.length){
      const c = wallsGroup.children[0];
      wallsGroup.remove(c);
      c.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });
    }
    const H = roomDims.height;
    ["back","left","right"].forEach(wall=>{
      const info = wallInfo(wall);
      const holder = new THREE.Group();
      holder.position.set(info.pos[0], info.pos[1], info.pos[2]);
      holder.rotation.y = info.rotY;
      wallRects(info.length, H, collectOpenings(wall)).forEach(r=>{
        const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1-r.x0, r.y1-r.y0), wallMat);
        m.position.set((r.x0+r.x1)/2, (r.y0+r.y1)/2, 0);
        m.receiveShadow = true;
        holder.add(m);
      });
      wallsGroup.add(holder);
    });
  }

  /* ---------------- wall-mounted items (door / window / loft) ---------------- */
  function footprintBounds(rec){
    const p = rec.group.position, th = rec.group.rotation.y;
    const c = Math.cos(th), sn = Math.sin(th);
    let minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      const lx = sx*rec.w/2, lz = sz*rec.d/2;
      const x = p.x + lx*c + lz*sn, z = p.z - lx*sn + lz*c;
      minX = Math.min(minX,x); maxX = Math.max(maxX,x);
      minZ = Math.min(minZ,z); maxZ = Math.max(maxZ,z);
    });
    return { minX, maxX, minZ, maxZ };
  }

  // A floor-standing tall unit that a loft can sit on.
  function isLoftSupport(o){
    return o.model === "wardrobe" && !o.wall && o.h >= 4.5;
  }

  // Is there a wardrobe against this wall near position u? If so return its
  // centre along the wall and its top height, so the loft can sit on it.
  function findLoftSupport(rec, wall, u){
    const W = roomDims.width, D = roomDims.depth;
    let best = null;
    Object.values(placed).forEach(o=>{
      if(o === rec || !isLoftSupport(o)) return;
      const b = footprintBounds(o);
      let gap, lo, hi;
      if(wall === "back"){       gap = b.minZ + D/2; lo = b.minX; hi = b.maxX; }
      else if(wall === "left"){  gap = b.minX + W/2; lo = b.minZ; hi = b.maxZ; }
      else {                     gap = W/2 - b.maxX; lo = b.minZ; hi = b.maxZ; }
      if(gap > 0.6) return;                       // not standing against this wall
      const centre = (lo+hi)/2, span = hi-lo;
      const dist = Math.abs(u - centre);
      if(dist > (span + rec.w)/2) return;         // not near enough along the wall
      if(!best || dist < best.dist) best = { u: centre, top: o.h, dist };
    });
    return best;
  }

  function placeOnWall(rec, wall, u, snap){
    const W = roomDims.width, D = roomDims.depth, H = roomDims.height;
    const clampU = v => {
      const m = Math.max(0, (wall === "back" ? W : D)/2 - rec.w/2);
      return Math.max(-m, Math.min(m, v));
    };
    u = clampU(u);
    if(snap && rec.model === "loft"){
      const sup = findLoftSupport(rec, wall, u);
      if(sup){ u = clampU(sup.u); rec.elev = sup.top; }
    }
    rec.elev = Math.max(0, Math.min(Math.max(0, H - rec.h), rec.elev));
    rec.wall = wall; rec.u = u;
    const g = rec.group;
    if(wall === "back"){       g.position.set(u, rec.elev, -D/2 + rec.d/2);  g.rotation.y = 0; }
    else if(wall === "left"){  g.position.set(-W/2 + rec.d/2, rec.elev, u);  g.rotation.y = Math.PI/2; }
    else {                     g.position.set( W/2 - rec.d/2, rec.elev, u);  g.rotation.y = -Math.PI/2; }
  }

  function spawnOnWall(rec){
    const W = roomDims.width, D = roomDims.depth;
    let wall = "back", u = 0, snap = false;

    if(rec.model === "loft"){
      // If a wardrobe is already in the room, drop the loft right on top of it.
      const sup = Object.values(placed).find(o=>o !== rec && isLoftSupport(o));
      if(sup){
        const b = footprintBounds(sup);
        const gaps = { back: b.minZ + D/2, left: b.minX + W/2, right: W/2 - b.maxX };
        wall = Object.keys(gaps).sort((a,c)=>gaps[a]-gaps[c])[0];
        u = wall === "back" ? (b.minX+b.maxX)/2 : (b.minZ+b.maxZ)/2;
        snap = true;
      }
    } else {
      // Doors/windows: use the first free spot along the back wall.
      const others = Object.values(placed).filter(o=>o !== rec && o.wall === "back" && isOpeningModel(o.model));
      const steps = [0, 1, -1, 2, -2, 3, -3];
      for(const k of steps){
        const cand = k * (rec.w + 0.6);
        if(Math.abs(cand) > W/2 - rec.w/2) continue;
        if(!others.some(o=>Math.abs(o.u - cand) < (o.w + rec.w)/2 + 0.1)){ u = cand; break; }
      }
    }
    placeOnWall(rec, wall, u, snap);
  }

  /* ---------------- room ---------------- */
  function makeFloorTexture(){
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#D9CCB0";
    ctx.fillRect(0,0,256,256);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    const step = 32;
    for(let i=0;i<=256;i+=step){
      ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(256,i); ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  function buildRoom(width, depth, height){
    roomDims = { width, depth, height };
    if(roomGroup) scene.remove(roomGroup);
    roomGroup = new THREE.Group();

    const floorTex = makeFloorTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(width/2, depth/2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI/2;
    floor.receiveShadow = true;
    roomGroup.add(floor);

    wallMat = new THREE.MeshStandardMaterial({ color: 0xF3EFE4, roughness: 0.95, side: THREE.DoubleSide });
    wallsGroup = new THREE.Group();
    roomGroup.add(wallsGroup);
    rebuildWalls();

    const grid = new THREE.GridHelper(Math.max(width,depth), Math.max(width,depth), 0x000000, 0x000000);
    grid.material.opacity = 0.06;
    grid.material.transparent = true;
    grid.position.y = 0.01;
    roomGroup.add(grid);

    scene.add(roomGroup);

    floorPickPlane = floor;

    cam.target.set(0, height*0.32, 0);
    cam.radius = Math.max(width, depth, height) * 1.55;
    cam.theta = Math.PI*0.28;
    cam.phi = Math.PI*0.36;
    updateCamera();
  }

  /* ---------------- items ---------------- */
  function clearItems(){
    Object.keys(placed).forEach(removeItem);
  }

  function addItem(catalogItem){
    const uid = "it_" + Math.random().toString(36).slice(2,10);
    const group = buildModelGroup(catalogItem.model, catalogItem.width, catalogItem.height, catalogItem.depth, catalogItem.color);
    // Spawn in a small deterministic grid near room centre so new items are
    // easy to spot and don't all stack in exactly the same spot.
    const count = Object.keys(placed).length;
    const col = (count % 3) - 1, row = Math.floor(count / 3) % 3 - 1;
    const wallItem = isWallModel(catalogItem.model);
    group.userData.uid = uid;
    itemsGroup.add(group);

    placed[uid] = {
      group, uid,
      catalogId: catalogItem.id,
      model: catalogItem.model,
      name: catalogItem.name,
      w: catalogItem.width, h: catalogItem.height, d: catalogItem.depth,
      color: catalogItem.color,
      elev: wallItem ? itemElevation(catalogItem) : 0,
      wall: null, u: 0
    };
    if(wallItem){
      spawnOnWall(placed[uid]);
      if(isOpeningModel(catalogItem.model)) rebuildWalls();
    } else {
      const spawnX = clampX(col * Math.min(2.5, roomDims.width*0.12), catalogItem.width);
      const spawnZ = clampZ(row * Math.min(2.5, roomDims.depth*0.12), catalogItem.depth);
      group.position.set(spawnX, 0, spawnZ);
    }
    selectItem(uid);
    if(onChangeCallback) onChangeCallback();
    return uid;
  }

  function removeItem(uid){
    const rec = placed[uid];
    if(!rec) return;
    itemsGroup.remove(rec.group);
    delete placed[uid];
    if(rec.wall && isOpeningModel(rec.model)) rebuildWalls();
    if(selectedUid === uid) deselectItem();
    if(onChangeCallback) onChangeCallback();
  }

  function rebuildItemMesh(uid){
    const rec = placed[uid];
    if(!rec) return;
    const pos = rec.group.position.clone();
    const rot = rec.group.rotation.y;
    itemsGroup.remove(rec.group);
    const newGroup = buildModelGroup(rec.model, rec.w, rec.h, rec.d, rec.color);
    newGroup.position.copy(pos);
    newGroup.rotation.y = rot;
    newGroup.userData.uid = uid;
    itemsGroup.add(newGroup);
    rec.group = newGroup;
    if(selectedUid === uid) attachHelper(rec.group);
  }

  function updateItemDims(uid, w, h, d){
    const rec = placed[uid];
    if(!rec) return;
    rec.w = w; rec.h = h; rec.d = d;
    rebuildItemMesh(uid);
    if(rec.wall){
      placeOnWall(rec, rec.wall, rec.u, false);
      if(isOpeningModel(rec.model)) rebuildWalls();
    } else {
      clampItemToRoom(uid);
    }
    if(onChangeCallback) onChangeCallback();
  }
  function updateItemElevation(uid, elev){
    const rec = placed[uid];
    if(!rec || !rec.wall) return;
    rec.elev = Math.max(0, elev);
    placeOnWall(rec, rec.wall, rec.u, false);
    if(isOpeningModel(rec.model)) rebuildWalls();
    if(onChangeCallback) onChangeCallback();
  }
  function updateItemColor(uid, color){
    const rec = placed[uid];
    if(!rec) return;
    rec.color = color;
    rebuildItemMesh(uid);
  }
  function setItemPosition(uid, x, z){
    const rec = placed[uid];
    if(!rec) return;
    rec.group.position.x = clampX(x, rec.w);
    rec.group.position.z = clampZ(z, rec.d);
  }
  function rotateItem(uid, deltaDeg){
    const rec = placed[uid];
    if(!rec || rec.wall) return;
    rec.group.rotation.y += deltaDeg * Math.PI/180;
  }
  function setItemRotationDeg(uid, deg){
    const rec = placed[uid];
    if(!rec || rec.wall) return;
    rec.group.rotation.y = deg * Math.PI/180;
  }

  function clampX(x, w){
    const half = roomDims.width/2 - w/2;
    return Math.max(-half, Math.min(half, x));
  }
  function clampZ(z, d){
    const half = roomDims.depth/2 - d/2;
    return Math.max(-half, Math.min(half, z));
  }
  function clampItemToRoom(uid){
    const rec = placed[uid];
    if(!rec) return;
    rec.group.position.x = clampX(rec.group.position.x, rec.w);
    rec.group.position.z = clampZ(rec.group.position.z, rec.d);
  }

  function getItemInfo(uid){
    const rec = placed[uid];
    if(!rec) return null;
    return {
      uid, name: rec.name, model: rec.model, color: rec.color,
      w: rec.w, h: rec.h, d: rec.d,
      isWall: !!rec.wall, wall: rec.wall, elev: rec.elev,
      x: rec.group.position.x, z: rec.group.position.z,
      rotationDeg: (rec.group.rotation.y * 180/Math.PI + 360) % 360
    };
  }
  function getPlacedList(){
    return Object.values(placed).map(r=>({ uid: r.uid, name: r.name }));
  }
  function getRoomDims(){ return {...roomDims}; }

  function serializeDesign(){
    return {
      room: roomDims,
      items: Object.values(placed).map(r=>({
        catalogId: r.catalogId, model: r.model, name: r.name, color: r.color,
        w: r.w, h: r.h, d: r.d,
        wall: r.wall, u: r.u, elev: r.elev,
        x: r.group.position.x, z: r.group.position.z, rot: r.group.rotation.y
      }))
    };
  }
  function loadDesign(design){
    if(!design) return;
    buildRoom(design.room.width, design.room.depth, design.room.height);
    clearItems();
    design.items.forEach(it=>{
      const uid = addItem({ id: it.catalogId, model: it.model, name: it.name, color: it.color, width: it.w, height: it.h, depth: it.d, elevation: it.elev });
      const rec = placed[uid];
      if(isWallModel(it.model) && it.wall){
        rec.elev = it.elev || 0;
        placeOnWall(rec, it.wall, it.u || 0, false);
      } else {
        rec.group.position.set(it.x, 0, it.z);
        rec.group.rotation.y = it.rot || 0;
      }
    });
    rebuildWalls();
    deselectItem();
  }

  /* ---------------- selection ---------------- */
  function attachHelper(group){
    if(selectedHelper) scene.remove(selectedHelper);
    selectedHelper = new THREE.BoxHelper(group, 0xB4823E);
    scene.add(selectedHelper);
  }
  function selectItem(uid){
    if(!placed[uid]) return;
    selectedUid = uid;
    attachHelper(placed[uid].group);
    if(onSelectCallback) onSelectCallback(getItemInfo(uid));
  }
  function deselectItem(){
    selectedUid = null;
    if(selectedHelper){ scene.remove(selectedHelper); selectedHelper = null; }
    if(onDeselectCallback) onDeselectCallback();
  }
  function getSelectedUid(){ return selectedUid; }

  function findRootGroup(obj){
    while(obj && obj.parent !== itemsGroup){ obj = obj.parent; }
    return obj;
  }

  /* ---------------- camera ---------------- */
  function updateCamera(){
    cam.phi = Math.max(0.12, Math.min(1.5, cam.phi));
    const x = cam.target.x + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
    const y = cam.target.y + cam.radius * Math.cos(cam.phi);
    const z = cam.target.z + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);
    camera.position.set(x,y,z);
    camera.lookAt(cam.target);
  }

  /* ---------------- pointer interaction ---------------- */
  function setNdc(e){
    const rect = canvasEl.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickItemAt(e){
    setNdc(e);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(itemsGroup.children, true);
    if(hits.length === 0) return null;
    const root = findRootGroup(hits[0].object);
    return root ? root.userData.uid : null;
  }
  function pickFloorPoint(e){
    setNdc(e);
    raycaster.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);
    return point;
  }

  // Where does the mouse ray meet a wall? Returns the nearest wall hit that
  // lies inside that wall's extent, plus the position along it (u).
  function pickWallPoint(e){
    setNdc(e);
    raycaster.setFromCamera(ndc, camera);
    const W = roomDims.width, D = roomDims.depth, H = roomDims.height;
    // "outside" = the camera is on the far side of that wall, so its inner face
    // can't be what the person is pointing at — skip it.
    const cp = camera.position;
    const defs = [
      { wall:"back",  plane:new THREE.Plane(new THREE.Vector3(0,0,1),  D/2), uOf:p=>p.x, len:W, outside: cp.z < -D/2 },
      { wall:"left",  plane:new THREE.Plane(new THREE.Vector3(1,0,0),  W/2), uOf:p=>p.z, len:D, outside: cp.x < -W/2 },
      { wall:"right", plane:new THREE.Plane(new THREE.Vector3(-1,0,0), W/2), uOf:p=>p.z, len:D, outside: cp.x >  W/2 }
    ];
    const pt = new THREE.Vector3();
    let best = null;
    defs.forEach(df=>{
      if(df.outside) return;
      if(!raycaster.ray.intersectPlane(df.plane, pt)) return;
      const u = df.uOf(pt);
      if(Math.abs(u) > df.len/2 + 0.5 || pt.y < -0.5 || pt.y > H + 0.5) return;
      const t = pt.distanceTo(raycaster.ray.origin);
      if(!best || t < best.t) best = { wall: df.wall, u, t };
    });
    return best;
  }

  function onPointerDown(e){
    canvasEl.setPointerCapture(e.pointerId);
    lastX = e.clientX; lastY = e.clientY; moved = 0;
    const uid = pickItemAt(e);
    if(uid){
      selectItem(uid);
      const rec = placed[uid];
      if(rec.wall){
        const hit = pickWallPoint(e);
        dragging = { uid, offU: (hit && hit.wall === rec.wall) ? hit.u - rec.u : 0 };
      } else {
        const p = pickFloorPoint(e);
        dragging = { uid, offX: p.x - rec.group.position.x, offZ: p.z - rec.group.position.z };
      }
    } else {
      isOrbiting = true;
    }
  }
  function onPointerMove(e){
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;

    if(dragging){
      const rec = placed[dragging.uid];
      if(rec && rec.wall){
        // wall items slide along walls and hop to another wall when dragged there
        const hit = pickWallPoint(e);
        if(hit){
          const off = hit.wall === rec.wall ? dragging.offU : 0;
          placeOnWall(rec, hit.wall, hit.u - off, true);
          if(isOpeningModel(rec.model)) rebuildWalls();
        }
      } else if(rec){
        const p = pickFloorPoint(e);
        setItemPosition(dragging.uid, p.x - dragging.offX, p.z - dragging.offZ);
      }
      if(selectedHelper) selectedHelper.update();
    } else if(isOrbiting){
      cam.theta -= dx * 0.0065;
      cam.phi   -= dy * 0.0065;
      updateCamera();
    }
  }
  function onPointerUp(e){
    if(!dragging && isOrbiting && moved < 4){
      // plain click on empty space
      deselectItem();
    }
    if(dragging && onChangeCallback) onChangeCallback();
    dragging = null;
    isOrbiting = false;
  }
  function onWheel(e){
    e.preventDefault();
    const min = Math.max(roomDims.width, roomDims.depth) * 0.4;
    const max = Math.max(roomDims.width, roomDims.depth) * 3.5;
    cam.radius = Math.max(min, Math.min(max, cam.radius * (1 + e.deltaY*0.0012)));
    updateCamera();
  }

  /* ---------------- lifecycle ---------------- */
  function resize(){
    const w = container.clientWidth, h = container.clientHeight;
    if(w === 0 || h === 0) return;
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  }

  function animate(){
    requestAnimationFrame(animate);
    if(selectedHelper) selectedHelper.update();
    renderer.render(scene, camera);
  }

  function init(canvasElement, containerElement){
    canvasEl = canvasElement;
    container = containerElement;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, container.clientWidth/container.clientHeight, 0.1, 500);

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.HemisphereLight(0xfff3dc, 0x2a2620, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0da, 0.9);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    itemsGroup = new THREE.Group();
    scene.add(itemsGroup);

    buildRoom(roomDims.width, roomDims.depth, roomDims.height);
    resize();

    canvasEl.addEventListener("pointerdown", onPointerDown);
    canvasEl.addEventListener("pointermove", onPointerMove);
    canvasEl.addEventListener("pointerup", onPointerUp);
    canvasEl.addEventListener("pointerleave", onPointerUp);
    canvasEl.addEventListener("wheel", onWheel, { passive:false });
    window.addEventListener("resize", resize);

    animate();
  }

  function getScreenPosition(uid){
    const rec = placed[uid];
    if(!rec) return null;
    const worldPos = new THREE.Vector3();
    rec.group.getWorldPosition(worldPos);
    worldPos.y += rec.h * 0.4;
    const projected = worldPos.clone().project(camera);
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height
    };
  }

  function exportImage(){
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  }

  return {
    init, resize, buildRoom, addItem, removeItem, clearItems,
    updateItemDims, updateItemColor, updateItemElevation, setItemPosition, rotateItem, setItemRotationDeg,
    getItemInfo, getPlacedList, getRoomDims, getSelectedUid,
    selectItem, deselectItem,
    serializeDesign, loadDesign, exportImage, getScreenPosition,
    onSelect(cb){ onSelectCallback = cb; },
    onDeselect(cb){ onDeselectCallback = cb; },
    onChange(cb){ onChangeCallback = cb; }
  };
})();
