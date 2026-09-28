// js/inteligencia.js

const DB_KEY = 'sqlGenArticulosInteligentes';
const BASE_URL = 'js/inteligencia-base.json';

// Capa base (solo lectura, se carga una vez del JSON)
let BBDD_BASE = {};
let baseCargada = false;

const GRUPOS_URL = 'js/grupos-nombres.json';
let GRUPOS_NOMBRES = {};
let gruposCargados = false;

export async function cargarGrupos() {
    if (gruposCargados) return GRUPOS_NOMBRES;
    try {
        const r = await fetch(GRUPOS_URL + '?v=' + Date.now());
        GRUPOS_NOMBRES = r.ok ? await r.json() : {};
    } catch (e) {
        console.warn('No se pudo cargar el diccionario de grupos:', e);
        GRUPOS_NOMBRES = {};
    }
    gruposCargados = true;
    return GRUPOS_NOMBRES;
}

export function nombreGrupo(id) {
    if (id === undefined || id === null || id === '') return '—';
    return GRUPOS_NOMBRES[String(id)] || `Grupo ${id}`;
}

export function listarGrupos() {
    return Object.entries(GRUPOS_NOMBRES)
        .map(([id, nombre]) => ({ id: Number(id), nombre }))
        .sort((a, b) => a.id - b.id);
}

// ============================================================
// GESTIÓN DE LA BASE DE DATOS LOCAL
// ============================================================
let _bbddCache = null;

export function obtenerBBDD() {
    if (_bbddCache) return _bbddCache;
    try { _bbddCache = JSON.parse(localStorage.getItem(DB_KEY) || '{}'); }
    catch (e) { console.warn('sqlGenArticulosInteligentes corrupto, se reinicia.', e); _bbddCache = {}; }
    return _bbddCache;
}

export function guardarBBDD(db) {
    _bbddCache = db;
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) { console.warn('No se pudo guardar la BD IA (localStorage lleno?)', e); }
}

// Limpiar caché cuando se resetea externamente
export function borrarTodaLaBBDD() { _bbddCache = null; localStorage.removeItem(DB_KEY); }
export function resetearUsuario()    { _bbddCache = null; localStorage.removeItem(DB_KEY); }

// ============================================================
// CAPA BASE (JSON pre-clasificado, solo lectura)
// ============================================================
export async function cargarBase() {
    if (baseCargada) return BBDD_BASE;
    try {
        const r = await fetch(BASE_URL + '?v=' + Date.now());
        if (r.ok) BBDD_BASE = await r.json();
        else BBDD_BASE = {};
    } catch (e) {
        console.warn('No se pudo cargar la base IA:', e);
        BBDD_BASE = {};
    }
    baseCargada = true;
    if (Object.keys(BBDD_BASE).length === 0) {
        console.warn('⚠️ Base IA vacía: revisa que js/inteligencia-base.json exista');
    }
    return BBDD_BASE;
}

export function baseEstaCargada() { return baseCargada; }
export function contarBase() { return Object.keys(BBDD_BASE).length; }
export function contarUsuario() { return Object.keys(obtenerBBDD()).length; }

/**
 * Aprende un artículo. Si ya existe y `forzar` es false, no sobreescribe.
 * Devuelve true si se guardó, false si se omitió por duplicado.
 */
export function aprenderArticulo(codigo, nombre, idGrupo, motivo, forzar = false) {
    if (!codigo) return false;
    const db = obtenerBBDD();  // solo capa USUARIO
    const codStr = String(codigo);
    const baseValor = BBDD_BASE[codStr];

    // Si ya está en la base común con el mismo grupo y no forzamos, no duplicar
    if (!forzar && baseValor !== undefined && parseInt(baseValor) === parseInt(idGrupo)) {
        return false;
    }

    if (db[codStr] && !forzar) {
        // Si cambia el grupo, actualizamos solo el grupo (no es sobreescribir "a ciegas")
        if (String(db[codStr].grupo) !== String(idGrupo)) {
            db[codStr] = { ...db[codStr], grupo: parseInt(idGrupo), motivo, fecha: new Date().toISOString() };
            guardarBBDD(db);
            return true;
        }
        return false;
    }

    db[codStr] = {
        nombre: nombre || '',
        grupo: parseInt(idGrupo),
        motivo: motivo || '',
        fecha: new Date().toISOString()
    };
    guardarBBDD(db);
    return true;
}

export function consultarArticulo(codigo) {
    if (!codigo) return null;
    const codStr = String(codigo);
    // 1. Capa usuario (tiene prioridad porque puede tener correcciones)
    const usuario = obtenerBBDD()[codStr];
    if (usuario) return { ...usuario, fuente: 'usuario' };
    // 2. Capa base (solo grupo, sin nombre ni motivo)
    const base = BBDD_BASE[codStr];
    if (base !== undefined) return { grupo: parseInt(base), nombre: '', motivo: 'base común', fuente: 'base' };
    return null;
}

export function borrarArticulo(codigo) {
    const db = obtenerBBDD();
    delete db[String(codigo)];
    guardarBBDD(db);
}


// ============================================================
// EXPORTAR / IMPORTAR / RESETEAR CAPA USUARIO
// ============================================================
export function exportarUsuario() {
    return JSON.stringify(obtenerBBDD());
}

export function importarUsuario(jsonText, modoMerge = true) {
    try {
        const data = JSON.parse(jsonText);
        if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato inválido');
        const db = modoMerge ? obtenerBBDD() : {};
        Object.assign(db, data);
        guardarBBDD(db);
        return { ok: true, importados: Object.keys(data).length, total: Object.keys(db).length };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

export function volverABase(codigo) {
    const db = obtenerBBDD();
    delete db[String(codigo)];
    guardarBBDD(db);
}

export function listarArticulosAprendidos() {
    const map = {};
    // Base primero (luego usuario sobreescribe)
    for (const [cod, grupo] of Object.entries(BBDD_BASE)) {
        map[cod] = { codigo: cod, grupo: parseInt(grupo), nombre: '', motivo: 'base común', fuente: 'base' };
    }
    for (const [cod, data] of Object.entries(obtenerBBDD())) {
        map[cod] = { codigo: cod, ...data, fuente: 'usuario' };
    }
    return Object.values(map);
}

// ============================================================
// UTILIDADES
// ============================================================
function normalizar(s) {
    if (!s) return "";
    let str = String(s).trim().toLowerCase();
    str = str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    str = str.replace(/[^a-z0-9 ]+/g, " ");
    return str.replace(/\s+/g, " ").trim();
}

function toks(s) { return new Set(s.match(/[a-z0-9]+/g) || []); }

// ============================================================
// CLASIFICADOR — PORT 1:1 DE ARTS.py (Python)
// Cualquier cambio aquí debe replicarse también en ARTS.py
// ============================================================
export function clasificar(nombre_raw, fam_raw = "", sub_raw = "") {
    const n = normalizar(nombre_raw);
    const f = normalizar(fam_raw);
    const s = normalizar(sub_raw);
    const wn = toks(n), wf = toks(f), ws = toks(s);

    // has(wn, "foo") → true si "foo", "foos" o "fooes" está en wn (igual que Python)
    const has = (words, ...kws) => kws.some(kw => {
        return words.has(kw) || words.has(kw + "s") || words.has(kw + "es");
    });

    const name_has = (...subs) => subs.some(x => n.includes(x));
    const sub_has  = (...subs) => subs.some(x => s.includes(x));
    const fam_is   = (...vals) => vals.includes(f);
    const sub_is   = (...vals) => vals.includes(s);

    const R = (id, motivo) => ({ id_grupo: id, motivo });

    // ============================================================
    // 0) NOMBRE VACÍO → no alimentario
    // ============================================================
    if (!n.trim()) return R(92, "sin nombre");

    // ============================================================
    // 1) MENÚ / COMBO / VOUCHER / BONO
    // ============================================================
    if (fam_is("menu") || sub_has("menu", "combo")) return R(100, "menu/combo");
    if (n.startsWith("menu ") || n.startsWith("combo ") || n.startsWith("voucher ") || n.startsWith("bono "))
        return R(100, "menu por nombre");
    if (wn.has("voucher") && wn.has("menu")) return R(100, "voucher menú");

    // ============================================================
    // 2) SUPLEMENTOS
    // ============================================================
    if (sub_is("suplementos") || wn.has("suplemento")) return R(104, "suplemento");

    // ============================================================
    // 3) SERVICIOS Y PROMOCIONES
    // ============================================================
    if (fam_is("servicios y promociones")) return R(93, "servicios y promociones");

    // ============================================================
    // 4) NO ALIMENTARIO → 92
    // ============================================================
    if (fam_is("consumible", "limpieza",
               "maquinaria mobiliario y exposicion",
               "utillaje y menaje", "farmacia y electronica"))
        return R(92, "no alimentario");

    // ============================================================
    // 5) ETIQUETAS / VITOLAS / FAJINES
    // ============================================================
    if (wn.has("vitola") || wn.has("fajin")) return R(92, "etiqueta/vitola/fajín");

    // ============================================================
    // 6) CAVA / CHAMPAGNE
    // ============================================================
    if (fam_is("cava") || wn.has("cava") || wn.has("champagne")) {
        if (wn.has("copa") || ws.has("copa")) return R(17, "cava copa");
        if (sub_has("barra", "botella") || name_has("barra", "botella")) return R(16, "cava botella");
        return R(15, "cava tienda");
    }

    // ============================================================
    // 7) SANGRÍA
    // ============================================================
    if (wn.has("sangria")) {
        if (wn.has("copa")) return R(8, "sangría copa");
        if (sub_has("barra", "botella") || name_has("barra", "botella")) return R(7, "sangría botella");
        return R(6, "sangría tienda");
    }

    // ============================================================
    // 8) VINOS GENEROSOS
    // ============================================================
    const es_familia_vino = fam_is("vino") || wf.has("vino") || wn.has("vino");
    const es_generoso_nombre =
        ["fino", "manzanilla", "oloroso", "amontillado"].some(x => wn.has(x))
        || (wn.has("palo") && wn.has("cortado"))
        || wn.has("macharnudo");
    const es_exclusion_generoso =
        fam_is("conservas", "alinos", "para cafe e infusiones", "cafe e infusiones")
        || ["infusion", "tisane", "caja", "tarro", "aceituna", "aceitunas",
            "mejillon", "mejillones", "atun", "bonito", "sardina", "anchoa",
            "escabeche"].some(x => wn.has(x));
    if (es_generoso_nombre && es_familia_vino && !es_exclusion_generoso) {
        if (wn.has("copa")) return R(11, "generoso copa");
        if (sub_has("barra", "botella")) return R(10, "generoso botella");
        return R(9, "generoso tienda");
    }

    // ============================================================
    // 9) ALCOHOL
    // ============================================================
    const KW_ALCOHOL = ["brandy", "whisky", "whiskey", "ginebra", "ron", "vodka",
        "tequila", "licor", "orujo", "aguardiente", "absenta",
        "vermout", "vermut", "vermouth", "sidra", "mistela",
        "gomeron", "patxaran", "limoncello", "cointreau", "bacardi",
        "fundador", "soberano", "mascaro", "brizard", "dewar",
        "cazadores", "magas", "bristol", "spritz", "mojito",
        "martini", "fiero", "ratafia", "cassis"];

    const tiene_gin = wn.has("gin") && !wn.has("ginger");
    let es_alcohol = fam_is("alcohol") || has(wn, ...KW_ALCOHOL) || tiene_gin;

    if (es_alcohol && (fam_is("dulce", "postres") ||
        ["chocolate", "bombon", "turron", "tableta", "tarta", "galleta",
         "postre", "helado", "caramelo", "cookie", "palmerita"].some(x => wn.has(x))))
        es_alcohol = false;
    if (es_alcohol && fam_is("platos principales", "tapas", "raciones",
                             "catas y raciones", "aperitivos")) es_alcohol = false;
    if (wn.has("carajillo")) es_alcohol = false;
    if (wn.has("tonica") || wn.has("ginger")) es_alcohol = false;
    if (wn.has("bitter") && wn.has("kas")) es_alcohol = false;
    if (wn.has("crema") && !["licor", "orujo", "whisky", "ron", "brandy",
                             "cassis", "naranja", "torrija", "harveys", "arroz",
                             "catalana"].some(x => wn.has(x))) es_alcohol = false;

    if (es_alcohol) {
        if (wn.has("copa") || wn.has("chupito")) return R(21, "alcohol copa");
        if (sub_has("barra", "botella") || name_has("barra", "botella")) return R(20, "alcohol botella");
        return R(19, "alcohol");
    }

    // ============================================================
    // 10) VINOS
    // ============================================================
    if (fam_is("vino") || wf.has("vino")) {
        const vt = (base) => {
            if (wn.has("copa") || ws.has("copa")) return base + 2;
            if (sub_has("barra", "botella") || name_has("barra", "botella")) return base + 1;
            return base;
        };
        if (ws.has("rosado") || wn.has("rosado") || wn.has("rosat") || wn.has("blush"))
            return R(vt(12), "vino rosado");
        if (ws.has("blanco") || wn.has("blanco")) return R(vt(9), "vino blanco");
        if (["albarino", "verdejo", "godello", "chardonnay", "malvasia",
             "ribeiro", "rueda", "txakoli", "pansa", "garnatxa",
             "gewurztraminer", "viura", "macabeo", "xarel", "parellada",
             "moscatel", "riesling", "sauvignon"].some(x => wn.has(x)))
            return R(vt(9), "vino blanco (variedad)");
        if (["pedro", "ximenez", "px", "harveys", "oloroso",
             "amontillado", "fino", "manzanilla"].some(x => wn.has(x)))
            return R(vt(9), "vino generoso blanco");
        return R(vt(6), "vino tinto");
    }

    // ============================================================
    // 11) CERVEZA / REFRESCO / AGUA
    // ============================================================
    if (fam_is("cerveza") || wf.has("cerveza")) return R(24, "cerveza");
    if (fam_is("refresco") || wf.has("refresco")) return R(23, "refresco");
    if (fam_is("agua") || wf.has("agua")) return R(22, "agua");

    const KW_REF = ["cocacola", "fanta", "sprite", "nestea", "aquarius", "powerade",
        "redbull", "schweppes", "kombucha", "tonica", "mirinda"];
    if (has(wn, ...KW_REF)) return R(23, "refresco");
    if (wn.has("coca") && wn.has("cola")) return R(23, "refresco (coca cola)");
    if (wn.has("red") && wn.has("bull")) return R(23, "refresco (red bull)");
    if (wn.has("bitter") && wn.has("kas")) return R(23, "refresco (bitter kas)");
    if (wn.has("ginger") && wn.has("ale")) return R(23, "refresco (ginger ale)");

    // ============================================================
    // 12) CAFÉ E INFUSIONES
    // ============================================================
    if (fam_is("para cafe e infusiones", "cafe e infusiones")) {
        if (["infusion", "infusiones", "te", "manzanilla", "menta", "poleo",
             "rojos", "chai", "matcha", "vitalzen", "verde", "rojo", "pakistani",
             "frambuesa", "manzana", "jengibre", "acerola", "dammann",
             "tisane", "breakfast", "cacao", "colacao", "tila"].some(x => wn.has(x)))
            return R(44, "infusion");
        return R(43, "cafe mp");
    }
    if (wn.has("te") && wn.has("frio")) return R(44, "te frio");
    if (wn.has("tisane") || wn.has("dammann")) return R(44, "tisane");

    // ============================================================
    // 13) OTRAS BEBIDAS
    // ============================================================
    if (fam_is("otras bebidas")) {
        if (["cafe", "cortado", "espresso", "expresso", "latte", "capuccino",
             "cappuccino", "macchiato", "moka", "frappe", "carajillo",
             "americano", "sharerato", "flat", "vienes", "bombon",
             "chai", "matcha"].some(x => wn.has(x))) return R(43, "cafe");
        return R(25, "bebida zumo/lactea");
    }

    // ⚠️ "cortado" SOLO dispara si está en familia café u otras bebidas
    if (["cafe", "espresso", "expresso", "latte", "capuccino", "cappuccino",
         "macchiato", "moka", "americano", "sharerato", "vienes", "carajillo"]
        .some(x => wn.has(x))) return R(43, "cafe (por nombre)");
    if (wn.has("cortado") && fam_is("otras bebidas", "cafe e infusiones", "para cafe e infusiones"))
        return R(43, "cafe cortado");
    if (wn.has("cortado") && wn.has("hielo")) return R(43, "cafe cortado hielo");
    if (wn.has("bombon") && (wn.has("cafe") || wn.has("cortado"))) return R(43, "cafe bombón");
    if (wn.has("chocolate") && wn.has("taza")) return R(43, "chocolate a la taza");

    // ============================================================
    // 14) DULCE / POSTRES / BOLLERÍA
    // ============================================================
    if (fam_is("dulce")) {
        if (wn.has("croissant")) return R(26, "croissant");
        if (wn.has("empanada")) return R(28, "empanada");
        if (["tarta", "coulant", "tiramisu", "porcion", "racion", "flan",
             "natilla", "postre", "yogur", "brownie", "muffin"].some(x => wn.has(x)))
            return R(102, "postre/tarta");
        if (["ensaimada", "donut", "dot", "napolitana", "berlina"].some(x => wn.has(x)))
            return R(27, "bolleria");
        return R(90, "dulce");
    }
    if (fam_is("postres")) return R(102, "postres");

    if (["chocolate", "bombon", "turron", "tableta", "galleta", "cookie",
         "palmerita", "magdalena", "caramelo", "gominola", "chucheria",
         "regaliz", "polvoron", "mantecado", "lacasitos", "conguitos",
         "haribo", "fini", "milka", "kinder", "oreo", "lotus", "helado",
         "muffin", "brownie", "donut", "waffle", "gofre", "crepe",
         "crepes", "tortita"].some(x => wn.has(x))) {
        if (wn.has("chocolate") && wn.has("taza")) return R(43, "chocolate a la taza");
        if (wn.has("brownie") || wn.has("muffin")) return R(90, "dulce");
        return R(90, "dulce (por nombre)");
    }

    if (["mermelada", "confitura", "miel"].some(x => wn.has(x))) return R(88, "conservas");

    if (fam_is("precocinado")) {
        if (wn.has("tortilla")) return R(98, "tortilla");
        return R(94, "precocinado");
    }
    if (wn.has("empanada") && fam_is("precocinado", "empanada")) return R(28, "empanada");

    // ============================================================
    // 15) ZUMOS / LECHE / BATIDOS
    // ============================================================
    if (has(wn, "zumo", "batido", "horchata", "smoothie", "granizado", "nectar", "cacaolat"))
        return R(25, "zumo/batido");
    if (wn.has("leche") && !["chocolate", "bombon", "turron", "tarta", "galleta",
                             "cafe", "colacao", "caramelo", "queso"].some(x => wn.has(x)))
        return R(25, "leche");

    // ============================================================
    // 16) CONOS
    // ============================================================
    if (fam_is("conos") || wn.has("cono") || n.startsWith("cono "))
        return R(103, "conos");

    // ============================================================
    // 17) BOCADILLOS Y SIMILARES
    // ============================================================
    if (wn.has("tomason") || wn.has("tomasito")) return R(41, "tomasón");

    if (["focaccia", "foccacia", "focaccella", "focatina"].some(x => wn.has(x))) {
        if (["nutella", "pistacho", "dulce"].some(x => wn.has(x))) return R(102, "focaccia dulce");
        return R(40, "focaccia");
    }
    if (fam_is("flautin") || wn.has("flautin")) return R(38, "flautín");
    if (wn.has("flauta")) return R(38, "flauta");
    if (fam_is("mollete") || wn.has("mollete")) return R(39, "mollete");
    if (fam_is("coca") || (wn.has("coca") && !wn.has("cola"))) return R(37, "coca bocadillo");
    if (wn.has("pan") && wn.has("coca")) return R(37, "pan de coca");
    if (wn.has("pizzella") || wn.has("pize")) return R(94, "pizzella");
    if (wn.has("pizza")) return R(94, "pizza");

    if (fam_is("grande")) {
        if (["jamon", "paleta", "iberico", "bellota"].some(x => wn.has(x))) return R(30, "boc grande jamón");
        if (["chorizo", "salchichon", "lomo", "fuet", "longaniza", "sobrasada", "embutido"].some(x => wn.has(x)))
            return R(31, "boc grande embutido");
        return R(32, "boc grande otros");
    }
    if (fam_is("pequeno")) {
        if (["jamon", "paleta", "iberico", "bellota"].some(x => wn.has(x))) return R(34, "boc pequeño jamón");
        if (["chorizo", "salchichon", "lomo", "fuet", "longaniza", "sobrasada", "embutido"].some(x => wn.has(x)))
            return R(35, "boc pequeño embutido");
        return R(36, "boc pequeño otros");
    }
    if (fam_is("otros bocadillos", "bocadillo") || wf.has("bocadillos")) {
        if (wn.has("tomason")) return R(41, "tomasón");
        return R(32, "otros bocadillos");
    }
    if (["bocadillo", "bocata", "bikini", "panini", "wrap", "bagel",
         "sandwich", "montadito"].some(x => wn.has(x))) {
        if (["pequeno", "mini"].some(x => wn.has(x))) {
            if (["jamon", "paleta"].some(x => wn.has(x))) return R(34, "boc pequeño jamón");
            if (["chorizo", "salchichon", "lomo", "fuet", "sobrasada"].some(x => wn.has(x))) return R(35, "boc pequeño embutido");
            return R(36, "boc pequeño otros");
        }
        if (["jamon", "paleta"].some(x => wn.has(x))) return R(30, "boc grande jamón");
        if (["chorizo", "salchichon", "lomo", "fuet", "sobrasada"].some(x => wn.has(x))) return R(31, "boc grande embutido");
        return R(32, "boc grande otros");
    }

    // ============================================================
    // 18) RACIONES (jamón, paleta, lomo, embutido, tortilla)
    // ============================================================
    if (wn.has("racion") || ws.has("raciones")) {
        if (["jamon", "paleta", "iberico", "embutido", "lomo", "chorizo", "salchichon"].some(x => wn.has(x)))
            return R(95, "ración jamón/embutido");
        if (wn.has("tortilla")) return R(98, "ración tortilla");
    }

    // ============================================================
    // 19) JAMÓN COCIDO / PECHUGA PAVO
    // ============================================================
    if (wn.has("cocido") && (wn.has("jamon") || wn.has("pavo"))) return R(82, "jamón cocido");
    if (fam_is("cocidos")) {
        if (["jamon", "pechuga", "pavo", "mortadela", "chopped", "lacon"].some(x => wn.has(x)))
            return R(82, "cocidos jamón");
        return R(83, "cocidos otros");
    }

    // ============================================================
    // 20) PATÉS / FOIE / OTROS EMBUTIDOS
    // ============================================================
    if (wn.has("pate") || wn.has("foie") || wn.has("mousse")) return R(84, "paté/foie");
    if (fam_is("otros embutidos")) return R(83, "otros embutidos");

    // ============================================================
    // 21) VIRUTAS / TAQUITOS / LASCAS / ENSAMBLAJES
    // ============================================================
    if (["viruta", "virutas", "lasca", "lascas", "repelo"].some(x => wn.has(x))) {
        if (wn.has("paleta") && !wn.has("jamon")) return R(68, "viruta/repelo paleta");
        return R(62, "viruta/repelo jamón");
    }
    if (wn.has("taquito") || wn.has("taquitos")) {
        if (wn.has("paleta") && !wn.has("jamon")) return R(68, "taquitos paleta");
        return R(62, "taquitos jamón");
    }
    if (wn.has("lonchas") && wn.has("rotas")) {
        if (wn.has("paleta") && !wn.has("jamon")) return R(68, "lonchas rotas paleta");
        return R(62, "lonchas rotas jamón");
    }
    if (wn.has("ensamblaje") || wn.has("ensamblaj")) return R(62, "ensamblaje -> viruta");

    // ============================================================
    // 22) EXCEPCIONES Y SUBPRODUCTOS
    // ============================================================
    if (["croqueta", "croquetas", "empanadilla", "canelon", "canelones", "lasana"].some(x => wn.has(x)))
        return R(94, "precocinado/elaborado");

    if (wn.has("queso") && (wn.has("jamon") || wn.has("iberico"))) {
        if (wn.has("crema") || wn.has("tarro")) return R(80, "tarro crema queso con jamón");
        return R(79, "queso con jamón");
    }

    if (wn.has("hueso") || wn.has("huesos")) {
        if (wn.has("caldo")) return R(96, "huesos para caldo");
        return R(61, "huesos jamón/paleta");
    }
    if (wn.has("grasa")) return R(61, "grasa jamón/paleta");
    if (wn.has("corteza")) return R(61, "corteza jamón/paleta");
    if (wn.has("tostada")) return R(97, "tostada -> tapa fría");

    // ============================================================
    // 23) JAMÓN / PALETA
    // ============================================================
    const es_paleta = wn.has("paleta") || wn.has("paletilla") || ws.has("paleta")
        || name_has("schulter");
    const es_jamon  = wn.has("jamon") || ws.has("jamon")
        || name_has("schinken", "weideschinken", "eichelmastschinken");

    if (wn.has("promo") && wn.has("sobre")) return R(64, "promo sobre jamón");

    if (es_paleta) {
        if (sub_has("sobre") || wn.has("sobre")) return R(70, "paleta sobre");
        if (n.includes("al corte") || s.includes("al corte") || ws.has("maquina"))
            return R(69, "paleta al corte");
        if (wn.has("pack") || wn.has("lote") || ws.has("pack")
            || fam_is("cestas y lotes") || wn.has("surtido"))
            return R(71, "paleta pack/lote");
        return R(67, "paleta pieza");
    }
    if (es_jamon) {
        if (sub_has("sobre") || wn.has("sobre")) return R(64, "jamón sobre");
        if (n.includes("al corte") || s.includes("al corte") || ws.has("maquina"))
            return R(63, "jamón al corte");
        if (wn.has("pack") || wn.has("lote") || ws.has("pack")
            || fam_is("cestas y lotes") || wn.has("surtido"))
            return R(65, "jamón pack/lote");
        return R(61, "jamón pieza");
    }
    if (fam_is("sobres loncheado") || fam_is("sobres de loncheado")) return R(64, "sobre loncheado genérico");

    // ============================================================
    // 24) EMBUTIDOS
    // ============================================================
    if (fam_is("chorizo") || wn.has("chorizo")) return R(73, "chorizo");
    if (fam_is("salchichon") || wn.has("salchichon")) return R(74, "salchichón");
    if (fam_is("lomo") || wn.has("lomo")) return R(75, "lomo");
    if (["longaniza", "fuet", "sobrasada", "morcilla", "butifarra",
         "salchicha", "camaiot", "butifarron", "salami"].some(x => wn.has(x)))
        return R(76, "longaniza/fuet");
    if (fam_is("curado")) return R(72, "otros curados");

    // ============================================================
    // 25) QUESOS
    // ============================================================
    if (fam_is("queso") || wf.has("queso")) {
        if (ws.has("cuna") || n.includes("cuña") || n.includes("cuna")) return R(78, "queso cuña");
        if (ws.has("pieza") || ws.has("entero")) return R(79, "queso pieza");
        return R(80, "queso al corte");
    }

    // ============================================================
    // 26) PAN
    // ============================================================
    if (fam_is("pan") || wf.has("pan")) {
        if (["racion", "tostada", "tapa", "pico", "picatoste",
             "baston", "regana"].some(x => wn.has(x))) return R(101, "pan para comer");
        return R(87, "pan tienda");
    }

    // ============================================================
    // 27) ALIÑOS
    // ============================================================
    if (fam_is("alinos") || sub_has("aceite", "vinagre", "especias", "salsas"))
        return R(85, "aliños");

    // ============================================================
    // 28) OLIVAS / CONSERVAS
    // ============================================================
    if (["oliva", "olivas", "aceituna", "aceitunas"].some(x => wn.has(x))) {
        if (["bonito", "atun", "sardina", "sardinilla", "mejillon", "ventresca",
             "anchoa", "boqueron", "calamar", "pulpo", "navaja", "berberecho",
             "salmon", "rabil", "tuna"].some(x => wn.has(x)))
            return R(88, "conserva de pescado");
        return R(86, "olivas");
    }
    if (fam_is("conservas")) return R(88, "conservas");

    // ============================================================
    // 29) CARNES
    // ============================================================
    if (fam_is("pollo"))   return R(47, "pollo");
    if (fam_is("ternera")) return R(45, "ternera");
    if (fam_is("cerdo"))   return R(46, "cerdo");
    if (fam_is("pavo"))    return R(48, "pavo");
    if (fam_is("cordero", "conejo", "pato", "otras carnes")) return R(49, "otras carnes");

    // ============================================================
    // 30) FRUTA / VERDURA
    // ============================================================
    if (fam_is("fruta y verdura")) return R(91, "fruta/verdura");

    // ============================================================
    // 31) PATATAS / SNACKS
    // ============================================================
    if (wn.has("patata") || wn.has("patatas")) {
        if (["frita", "fritas", "chips", "snack", "snacks", "pringles",
             "ganchitos", "triblis", "tronkess", "ruedas", "bocafrit",
             "texicos", "chilli", "boniato", "sweet", "frit", "confitada",
             "extra", "crujiente"].some(x => wn.has(x))) return R(89, "patatas snack");
        if (["enteras", "tortilla", "peladas", "prefritas", "congeladas", "para"].some(x => wn.has(x)))
            return R(91, "patata cruda");
        return R(89, "patatas snack");
    }
    if (["pringles", "ganchitos", "triblis", "tronkess", "ruedas", "snack"].some(x => wn.has(x)))
        return R(89, "snack");

    // ============================================================
    // 32) PARA COMER
    // ============================================================
    if (fam_is("catas y raciones", "raciones")) return R(95, "raciones jamón/embutido");
    if (fam_is("platos principales", "plato")) {
        if (wn.has("ensalada") || wn.has("ensaladilla")) return R(99, "ensalada");
        return R(94, "plato principal");
    }
    if (fam_is("ensaladas")) return R(99, "ensalada");
    if (fam_is("tapas")) {
        if (["bravas", "patatas", "tortilla", "caliente", "plancha", "huevo",
             "carne", "pollo", "gamba", "pulpo", "croqueta", "empanada",
             "carrillera", "nachos", "alitas", "salpicon", "callos",
             "mechada"].some(x => wn.has(x))) return R(98, "tapa caliente");
        return R(97, "tapa fría");
    }
    if (fam_is("aperitivos")) {
        if (["crema", "caldo", "gazpacho", "salmorejo"].some(x => wn.has(x))) return R(96, "crema/caldo");
        return R(97, "tapa fría");
    }
    if (["crema", "caldo", "gazpacho", "salmorejo"].some(x => wn.has(x))
        && fam_is("platos principales", "precocinado", "aperitivos"))
        return R(96, "crema/caldo");

    // ============================================================
    // 33) CESTAS Y LOTES
    // ============================================================
    if (fam_is("cestas y lotes")) return R(71, "cesta/lote");

    // ============================================================
    // 34) PACKS
    // ============================================================
    if (fam_is("pack")) return R(91, "pack");

    // ============================================================
    // 35) FALLBACK
    // ============================================================
    if (fam_is("otros productos")) return R(91, "otros productos");
    if (wn.has("sobre") && (wn.has("vacio") || wn.has("carton"))) return R(92, "sobre vacío");
    return R(91, "fallback");
}