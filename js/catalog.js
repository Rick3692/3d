/* ============================================================
   ROOMCRAFT 3D — catalog data layer
   Furniture items are described, not modeled by hand: each item
   picks a generic "model" shape (bed, chair, table...) and gives
   it width/height/depth (in feet) and a colour. scene3d.js turns
   that description into an actual 3D mesh. This is what lets the
   admin panel add/edit items with no 3D modelling required.
   ============================================================ */

const RC_KEYS = {
  catalog: "rc_catalog_v1",
  design:  "rc_design_v1",
  version: "rc_catalog_ver"
};
const RC_CATALOG_VERSION = "3";
// Starter items added in each version. Used to top up catalogs that were
// saved earlier, without re-adding anything an admin has deleted before.
const RC_CATALOG_ADDITIONS = {
  "2": ["w-door","w-maindoor","w-window","w-bigwin","w-vent","b-loft","o-loft"],
  "3": ["k-cab","k-lkitchen","k-mbase","k-mdrawer","k-msink","k-mhob","k-mtall","k-mwall","k-mchimney"]
};

const ROOM_CATEGORIES = {
  hall:    { name: "Hall / Living Room", icon: "🛋️" },
  kitchen: { name: "Kitchen",            icon: "🍳" },
  bedroom: { name: "Bedroom",            icon: "🛏️" },
  toilet:  { name: "Toilet / Bathroom",  icon: "🚿" },
  pooja:   { name: "Pooja Room",         icon: "🪔" },
  others:  { name: "Others",             icon: "📦" },
  // "shared" categories aren't a tab in the designer — their items are
  // listed under every room so doors & windows are always one click away.
  openings:{ name: "Doors & Windows",    icon: "🪟", shared: true }
};

/* Generic shape builders available to every item — see scene3d.js
   for how each is turned into geometry. Admin picks one of these. */
const MODEL_TYPES = [
  { id: "box",      label: "Simple Box" },
  { id: "wardrobe", label: "Wardrobe / Cabinet" },
  { id: "bed",      label: "Bed" },
  { id: "chair",    label: "Chair" },
  { id: "table",    label: "Table" },
  { id: "sofa",     label: "Sofa" },
  { id: "counter",  label: "Counter / Slab Unit" },
  { id: "sink",     label: "Sink / Basin" },
  { id: "commode",  label: "Commode" },
  { id: "bathtub",  label: "Bathtub" },
  { id: "shrine",   label: "Mandir / Shrine" },
  { id: "lamp",     label: "Lamp / Stand" },
  { id: "tv",       label: "TV / Screen Unit" },
  { id: "fridge",   label: "Refrigerator" },
  { id: "door",     label: "Door (fits in wall)" },
  { id: "window",   label: "Window (fits in wall)" },
  { id: "loft",     label: "Loft (wall-mounted, above wardrobe)" },
  { id: "kitchen_cabinet", label: "Kitchen Cabinet (base, with counter top)" },
  { id: "l_kitchen",       label: "L-Shaped Kitchen Cabinet" },
  { id: "mod_base",        label: "Modular: Base Unit" },
  { id: "mod_drawer",      label: "Modular: Drawer Unit" },
  { id: "mod_sink",        label: "Modular: Sink Unit" },
  { id: "mod_hob",         label: "Modular: Hob / Cooktop Unit" },
  { id: "mod_tall",        label: "Modular: Tall / Pantry Unit" },
  { id: "mod_wall",        label: "Modular: Wall Unit (wall-mounted)" },
  { id: "mod_chimney",     label: "Modular: Chimney / Hood (wall-mounted)" }
];

/* Wall-mounted shapes. They snap to a wall instead of standing on the floor.
   "opening" shapes also cut a hole through the wall. "elevation" is how high
   (ft) the bottom of the item sits above the floor. Picking one of these
   shapes in the admin panel pre-fills the size/colour/elevation below. */
const MODEL_DEFAULTS = {
  door:   { wall:true, opening:true,  width:3, height:6.8, depth:0.3, elevation:0, color:"#8B5E34",
            hint:"Doors snap to a wall and cut an opening in it. Depth is the thickness of the door frame." },
  window: { wall:true, opening:true,  width:4, height:3.5, depth:0.3, elevation:3, color:"#F2F1EC",
            hint:"Windows snap to a wall and cut an opening in it. Elevation is the height of the window sill from the floor." },
  loft:   { wall:true, opening:false, width:4, height:2,   depth:2,   elevation:7, color:"#5B4636",
            hint:"Lofts are fixed to a wall at the given elevation. Drop one over a wardrobe and it sits right on top of it." },

  // kitchen shapes: sizes are pre-filled in the admin form. The last two hang on a wall.
  kitchen_cabinet: { wall:false, width:3,   height:3,   depth:2,   elevation:0, color:"#D9C79E",
            hint:"Base cabinet with a drawer row, doors and a dark counter top. Height includes the counter top (3 ft is standard)." },
  l_kitchen:       { wall:false, width:9,   height:3,   depth:8,   elevation:0, color:"#D9C79E",
            hint:"Width x Depth is the outer size of the L; each arm is up to 2 ft deep. The corner is at the back-left, so push it into a room corner (use Rotate to flip it)." },
  mod_base:        { wall:false, width:2,   height:3,   depth:2,   elevation:0, color:"#D9C79E", hint:"Modular base unit with doors and a counter top." },
  mod_drawer:      { wall:false, width:2,   height:3,   depth:2,   elevation:0, color:"#D9C79E", hint:"Modular base unit with three drawers." },
  mod_sink:        { wall:false, width:4,   height:3,   depth:2,   elevation:0, color:"#D9C79E", hint:"Modular sink unit with a steel basin and tap." },
  mod_hob:         { wall:false, width:3,   height:3,   depth:2,   elevation:0, color:"#D9C79E", hint:"Modular unit with a built-in hob / cooktop." },
  mod_tall:        { wall:false, width:2,   height:7,   depth:2,   elevation:0, color:"#D9C79E", hint:"Tall pantry / storage unit with upper and lower doors." },
  mod_wall:        { wall:true,  opening:false, width:3, height:2.5, depth:1.1, elevation:4.5, color:"#D9C79E",
            hint:"Wall unit hangs on a wall at the given elevation. About 4.5 ft leaves room above a 3 ft counter." },
  mod_chimney:     { wall:true,  opening:false, width:2.5, height:3, depth:1.8, elevation:5.5, color:"#B9BCBF",
            hint:"Chimney / hood hangs on a wall. Set the elevation so it sits above the hob unit (about 5.5 ft)." }
};
function isWallModel(m){ return !!(MODEL_DEFAULTS[m] && MODEL_DEFAULTS[m].wall); }
function isOpeningModel(m){ return !!(MODEL_DEFAULTS[m] && MODEL_DEFAULTS[m].opening); }
function itemElevation(item){
  if(item && typeof item.elevation === "number") return item.elevation;
  const d = item && MODEL_DEFAULTS[item.model];
  return d ? d.elevation : 0;
}

const SWATCHES = ["#8B5E34","#C9A46A","#5B6B57","#7A8FA6","#B4463C","#3E4A56","#D9C79E","#4B4038","#9C8264","#2E2E2E"];

function defaultCatalog(){
  return [
    // HALL
    { id:"h-sofa",    category:"hall", model:"sofa",     name:"3-Seater Sofa",   width:6.5, height:2.8, depth:2.8, color:"#8B5E34" },
    { id:"h-table",   category:"hall", model:"table",    name:"Center Table",    width:3.5, height:1.4, depth:2,   color:"#C9A46A" },
    { id:"h-tv",      category:"hall", model:"tv",       name:"TV Unit",         width:5,   height:2,   depth:1.2, color:"#2E2E2E" },
    { id:"h-shelf",   category:"hall", model:"wardrobe", name:"Bookshelf",       width:3,   height:6,   depth:1.2, color:"#5B4636" },
    { id:"h-chair",   category:"hall", model:"chair",    name:"Armchair",        width:2.5, height:3,   depth:2.5, color:"#7A8FA6" },

    // KITCHEN
    { id:"k-counter", category:"kitchen", model:"counter", name:"Kitchen Counter", width:8,  height:3, depth:2,   color:"#D9C79E" },
    { id:"k-fridge",  category:"kitchen", model:"fridge",  name:"Refrigerator",    width:2.5,height:6, depth:2.3, color:"#E8E6E1" },
    { id:"k-dtable",  category:"kitchen", model:"table",   name:"Dining Table",    width:5,  height:2.5,depth:3,  color:"#8B5E34" },
    { id:"k-dchair",  category:"kitchen", model:"chair",   name:"Dining Chair",    width:1.6, height:3, depth:1.6, color:"#5B4636" },
    { id:"k-cabinet", category:"kitchen", model:"wardrobe",name:"Overhead Cabinet",width:6,  height:2.5,depth:1.2,color:"#B4463C" },
    { id:"k-cab",      category:"kitchen", model:"kitchen_cabinet", name:"Kitchen Cabinet",     width:3,  height:3,   depth:2,   color:"#D9C79E" },
    { id:"k-lkitchen", category:"kitchen", model:"l_kitchen",       name:"L-Shaped Kitchen",    width:9,  height:3,   depth:8,   color:"#D9C79E" },
    { id:"k-mbase",    category:"kitchen", model:"mod_base",        name:"Modular Base Unit",   width:2,  height:3,   depth:2,   color:"#D9C79E" },
    { id:"k-mdrawer",  category:"kitchen", model:"mod_drawer",      name:"Modular Drawer Unit", width:2,  height:3,   depth:2,   color:"#D9C79E" },
    { id:"k-msink",    category:"kitchen", model:"mod_sink",        name:"Modular Sink Unit",   width:4,  height:3,   depth:2,   color:"#D9C79E" },
    { id:"k-mhob",     category:"kitchen", model:"mod_hob",         name:"Modular Hob Unit",    width:3,  height:3,   depth:2,   color:"#D9C79E" },
    { id:"k-mtall",    category:"kitchen", model:"mod_tall",        name:"Modular Tall Unit",   width:2,  height:7,   depth:2,   color:"#D9C79E" },
    { id:"k-mwall",    category:"kitchen", model:"mod_wall",        name:"Modular Wall Unit",   width:3,  height:2.5, depth:1.1, color:"#D9C79E", elevation:4.5 },
    { id:"k-mchimney", category:"kitchen", model:"mod_chimney",     name:"Chimney / Hood",      width:2.5,height:3,   depth:1.8, color:"#B9BCBF", elevation:5.5 },

    // BEDROOM
    { id:"b-bed",     category:"bedroom", model:"bed",      name:"Double Bed",     width:6,  height:2.2, depth:6.5, color:"#8B5E34" },
    { id:"b-wardrobe",category:"bedroom", model:"wardrobe", name:"Wardrobe",       width:4,  height:7,   depth:2,   color:"#5B4636" },
    { id:"b-study",   category:"bedroom", model:"table",    name:"Study Table",    width:4,  height:2.5, depth:2,   color:"#C9A46A" },
    { id:"b-chair",   category:"bedroom", model:"chair",    name:"Study Chair",    width:1.6, height:3,  depth:1.6, color:"#3E4A56" },
    { id:"b-dresser", category:"bedroom", model:"counter",  name:"Dressing Table", width:3.5, height:2.5,depth:1.6, color:"#D9C79E" },
    { id:"b-loft",    category:"bedroom", model:"loft",     name:"Wardrobe Loft",  width:4,  height:2,   depth:2,   color:"#5B4636", elevation:7 },

    // TOILET
    { id:"t-commode", category:"toilet", model:"commode", name:"Commode",     width:1.6, height:1.4, depth:2.2, color:"#F2F1EC" },
    { id:"t-sink",    category:"toilet", model:"sink",    name:"Wash Basin",  width:2,   height:2.8, depth:1.4, color:"#F2F1EC" },
    { id:"t-tub",     category:"toilet", model:"bathtub", name:"Bathtub",     width:5,   height:1.6, depth:2.6, color:"#EDEBE4" },
    { id:"t-cabinet", category:"toilet", model:"wardrobe",name:"Mirror Cabinet",width:2.5,height:2.5,depth:0.8,color:"#7A8FA6" },

    // POOJA
    { id:"p-mandir",  category:"pooja", model:"shrine", name:"Mandir / Shrine", width:3,   height:5,   depth:1.6, color:"#B4823E" },
    { id:"p-chowki",  category:"pooja", model:"table",  name:"Puja Chowki",     width:2,   height:1.2, depth:2,   color:"#8B5E34" },
    { id:"p-diya",    category:"pooja", model:"lamp",   name:"Diya Stand",      width:1,   height:3.5, depth:1,   color:"#B4823E" },

    // OTHERS
    { id:"o-shoe",    category:"others", model:"wardrobe", name:"Shoe Rack",   width:3,  height:3,   depth:1.2, color:"#5B4636" },
    { id:"o-box",     category:"others", model:"box",      name:"Storage Box", width:2,  height:2,   depth:2,   color:"#9C8264" },
    { id:"o-plant",   category:"others", model:"lamp",     name:"Plant Stand", width:1.2,height:3,   depth:1.2, color:"#5B6B57" },
    { id:"o-loft",    category:"others", model:"loft",     name:"Wall Loft",   width:4,  height:1.8, depth:1.5, color:"#9C8264", elevation:7 },

    // DOORS & WINDOWS (listed under every room in the designer)
    { id:"w-door",    category:"openings", model:"door",   name:"Door",         width:3,   height:6.8, depth:0.3, color:"#8B5E34", elevation:0 },
    { id:"w-maindoor",category:"openings", model:"door",   name:"Main Door",    width:3.5, height:7,   depth:0.3, color:"#5B4636", elevation:0 },
    { id:"w-window",  category:"openings", model:"window", name:"Window",       width:4,   height:3.5, depth:0.3, color:"#F2F1EC", elevation:3 },
    { id:"w-bigwin",  category:"openings", model:"window", name:"Large Window", width:6,   height:4.5, depth:0.3, color:"#F2F1EC", elevation:2 },
    { id:"w-vent",    category:"openings", model:"window", name:"Ventilator",   width:2,   height:1.5, depth:0.3, color:"#F2F1EC", elevation:6.5 }
  ];
}

function rcRead(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function rcWrite(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function initCatalog(){
  if(!localStorage.getItem(RC_KEYS.catalog)){
    rcWrite(RC_KEYS.catalog, defaultCatalog());
    localStorage.setItem(RC_KEYS.version, RC_CATALOG_VERSION);
    return;
  }
  // Catalogs saved by an earlier version: add only the starter items introduced
  // since then, without touching anything the admin already changed or deleted.
  const stored = parseInt(localStorage.getItem(RC_KEYS.version) || "1", 10);
  if(stored < parseInt(RC_CATALOG_VERSION, 10)){
    const list = getCatalog();
    const have = new Set(list.map(i=>i.id));
    const wanted = new Set();
    Object.keys(RC_CATALOG_ADDITIONS).forEach(v=>{
      if(parseInt(v,10) > stored) RC_CATALOG_ADDITIONS[v].forEach(id=>wanted.add(id));
    });
    defaultCatalog().filter(i=>wanted.has(i.id) && !have.has(i.id)).forEach(i=>list.push(i));
    saveCatalog(list);
    localStorage.setItem(RC_KEYS.version, RC_CATALOG_VERSION);
  }
}

function getCatalog(){ return rcRead(RC_KEYS.catalog, defaultCatalog()); }
function getCatalogByCategory(cat){ return getCatalog().filter(i=>i.category===cat); }
function saveCatalog(list){ rcWrite(RC_KEYS.catalog, list); }

function upsertCatalogItem(item){
  const list = getCatalog();
  const i = list.findIndex(x=>x.id===item.id);
  if(i>=0) list[i] = item; else list.push(item);
  saveCatalog(list);
}
function deleteCatalogItem(id){
  saveCatalog(getCatalog().filter(x=>x.id!==id));
}
function findCatalogItem(id){
  return getCatalog().find(x=>x.id===id);
}

/* ---------- saved room designs ---------- */
function getSavedDesign(){ return rcRead(RC_KEYS.design, null); }
function saveDesign(design){ rcWrite(RC_KEYS.design, design); }
function clearSavedDesign(){ localStorage.removeItem(RC_KEYS.design); }

initCatalog();
