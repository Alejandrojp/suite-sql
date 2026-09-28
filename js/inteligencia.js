// js/inteligencia.js

const DB_KEY = 'sqlGenArticulosInteligentes';

// ============================================================
// GESTIÓN DE LA BASE DE DATOS LOCAL
// ============================================================
export function obtenerBBDD() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '{}'); }
    catch (e) { console.warn('sqlGenArticulosInteligentes corrupto, se reinicia.', e); return {}; }
}

export function guardarBBDD(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) { console.warn('No se pudo guardar la BD IA (localStorage lleno?)', e); }
}

/**
 * Aprende un artículo. Si ya existe y `forzar` es false, no sobreescribe.
 * Devuelve true si se guardó, false si se omitió por duplicado.
 */
export function aprenderArticulo(codigo, nombre, idGrupo, motivo, forzar = false) {
    if (!codigo) return false;
    const db = obtenerBBDD();
    const codStr = String(codigo);

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
    return obtenerBBDD()[String(codigo)] || null;
}

export function borrarArticulo(codigo) {
    const db = obtenerBBDD();
    delete db[String(codigo)];
    guardarBBDD(db);
}

export function borrarTodaLaBBDD() {
    localStorage.removeItem(DB_KEY);
}

export function listarArticulosAprendidos() {
    return Object.entries(obtenerBBDD()).map(([codigo, data]) => ({ codigo, ...data }));
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

// Singularización básica para plurales castellanos comunes
function singul(w) {
    if (!w || w.length < 4) return w;
    if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s')) return w.slice(0, -1);
    return w;
}

// ============================================================
// CLASIFICADOR (PORTADO Y CORREGIDO)
// ============================================================
export function clasificar(nombre_raw, fam_raw = "", sub_raw = "") {
    const n = normalizar(nombre_raw);
    const f = normalizar(fam_raw);
    const s = normalizar(sub_raw);
    const wn = toks(n), wf = toks(f), ws = toks(s);

    const has = (words, ...kws) => kws.some(kw => {
        const k = normalizar(kw);
        if (!k) return false;
        if (words.has(k)) return true;
        // Prueba plural / singular
        const sing = singul(k);
        const plu = k + 's';
        const pluEs = k + 'es';
        return words.has(sing) || words.has(plu) || words.has(pluEs);
    });

    const name_has = (...subs) => subs.some(x => n.includes(normalizar(x)));
    const sub_has = (...subs) => subs.some(x => s.includes(normalizar(x)));
    const fam_is = (...vals) => vals.includes(f);
    const sub_is = (...vals) => vals.includes(s);

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
              "utillaje y menaje", "farmacia y electronica")) {
        return R(92, "no alimentario");
    }
    if (wn.has("vitola") || wn.has("fajin")) return R(92, "etiqueta/vitola/fajín");
    if (wn.has("sobre") && (wn.has("vacio") || wn.has("carton")) && !fam_is("sobres loncheado", "sobres de loncheado"))
        return R(92, "sobre vacío");

    // ============================================================
    // 5) PACKS / CESTAS / LOTES / NTC (antes de sus componentes)
    // ============================================================
    const esPackFam = fam_is("cestas y lotes", "pack");
    const esNtc = wn.has("ntc") || (wn.has("no") && wn.has("te") && wn.has("cortes"));
    const esPackNombre = wn.has("pack") || wn.has("lote") || wn.has("cesta") ||
        wn.has("surtido") && (wn.has("iberic") || wn.has("jamon") || wn.has("paleta"));

    if (esNtc) {
        if (wn.has("paleta")) return R(71, "NTC paleta");
        if (wn.has("jamon")) return R(65, "NTC jamón");
        return R(71, "NTC");
    }

    // Cata / Cata vertical / Cata 4 sabores / Menú Cata
    if ((wn.has("cata") || wn.has("catas")) && !wn.has("bota")) {
        if (wn.has("menu")) return R(100, "menu cata");
        if (wn.has("paleta")) return R(71, "cata paleta");
        if (wn.has("jamon") || wn.has("iberic")) return R(65, "cata jamón");
        return R(95, "cata");
    }

    if (esPackFam || (esPackNombre && (wn.has("jamon") || wn.has("paleta") || wn.has("iberic")))) {
        if (wn.has("paleta") && !wn.has("jamon")) return R(71, "pack/lote paleta");
        if (wn.has("jamon") || wn.has("iberic")) return R(65, "pack/lote jamón");
        if (fam_is("cestas y lotes")) return R(71, "cesta/lote");
        // Packs genéricos de tienda (no jamón/paleta)
        if (fam_is("pack")) return R(91, "pack tienda");
    }

    // ============================================================
    // 6) DULCE / POSTRES / BOLLERÍA (ANTES que cava, café, alcohol)
    // ============================================================
    const esDulceNombre = [
        "chocolate", "bombon", "turron", "tableta", "galleta", "cookie",
        "palmerita", "magdalena", "caramelo", "gominola", "chucheria",
        "regaliz", "polvoron", "mantecado", "lacasitos", "conguitos",
        "haribo", "fini", "milka", "kinder", "oreo", "lotus", "helado",
        "muffin", "brownie", "donut", "waffle", "gofre", "crepe",
        "tortita", "turrones", "nougat", "guirlache", "praline",
        "crema catalana", "flan", "natilla", "yogur", "arroz con leche",
        "tiramisu", "coulant", "ensaimada", "sobao", "quesada",
        "cortadillo", "pestino", "tarta", "bizcocho", "queque",
        "pastel", "dona", "berlina", "napolitana", "palmera",
        "socorrito", "carquiñoli", "neula", "mantecado", "alfajor",
        "rosquilla", "roscos", "mazapan", "hojaldre", "empanadilla dulce",
        "tortitas", "obrador", "mermelada dulce"
    ].some(x => wn.has(x) || n.includes(x));

    if (fam_is("dulce", "postres") || esDulceNombre) {
        // Excepciones: siropes, salsas, sirope de caramelo → aliños
        if (wn.has("sirope") && !fam_is("dulce", "postres")) return R(85, "sirope/aliño");

        if (wn.has("croissant") || n.includes("croissant")) return R(26, "croissant");
        if (wn.has("empanada") || wn.has("empanadilla")) return R(28, "empanada");
        if (fam_is("postres") || ["tarta", "coulant", "tiramisu", "porcion",
            "racion", "flan", "natilla", "postre", "yogur", "brownie", "muffin",
            "quesada"].some(x => wn.has(x))) return R(102, "postre/tarta");
        if (["ensaimada", "donut", "dot", "napolitana", "berlina",
             "palmera", "berlina"].some(x => wn.has(x))) return R(27, "bolleria");
        if (["turron", "turrones", "nougat", "guirlache", "polvoron",
             "mantecado", "alfajor", "mazapan"].some(x => wn.has(x))) return R(90, "turron/dulce");
        return R(90, "dulce");
    }

    // ============================================================
    // 7) CAVA / CHAMPAGNE (ahora ya sin turrones)
    // ============================================================
    if (fam_is("cava") || wn.has("cava") || wn.has("champagne")) {
        if (wn.has("copa") || ws.has("copa")) return R(17, "cava copa");
        if (sub_has("barra", "botella") || name_has("barra", "botella")) return R(16, "cava botella");
        return R(15, "cava tienda");
    }

    // ============================================================
    // 8) SANGRÍA
    // ============================================================
    if (wn.has("sangria")) {
        if (wn.has("copa")) return R(8, "sangría copa");
        if (sub_has("barra", "botella") || name_has("barra", "botella")) return R(7, "sangría botella");
        return R(6, "sangría tienda");
    }

    // ============================================================
    // 9) VINOS GENEROSOS (fino, manzanilla, oloroso, amontillado...)
    // ============================================================
    const es_familia_vino = fam_is("vino") || wf.has("vino") || wn.has("vino");
    const es_generoso_nombre = (
        ["fino", "manzanilla", "oloroso", "amontillado"].some(x => wn.has(x))
        || (wn.has("palo") && wn.has("cortado"))
        || wn.has("macharnudo")
    );
    const es_exclusion_generoso = (
        fam_is("conservas", "alinos", "para cafe e infusiones", "cafe e infusiones")
        || ["infusion", "tisane", "caja", "tarro", "aceituna", "aceitunas",
            "mejillon", "mejillones", "atun", "bonito", "sardina", "anchoa",
            "escabeche"].some(x => wn.has(x))
    );
    if (es_generoso_nombre && es_familia_vino && !es_exclusion_generoso) {
        if (wn.has("copa")) return R(11, "generoso copa");
        if (sub_has("barra", "botella")) return R(10, "generoso botella");
        return R(9, "generoso tienda");
    }

    // ============================================================
    // 10) ALCOHOL
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
         "postre", "helado", "caramelo", "cookie", "palmerita",
         "turrones", "nougat"].some(x => wn.has(x)))) es_alcohol = false;
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
    // 11) VINOS
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
    // 12) CERVEZA / REFRESCO / AGUA
    // ============================================================
    if (fam_is("cerveza") || wf.has("cerveza")) return R(24, "cerveza");
    if (fam_is("refresco") || wf.has("refresco")) return R(23, "refresco");
    if (fam_is("agua") || wf.has("agua")) return R(22, "agua");

    const KW_REF = ["cocacola", "fanta", "sprite", "nestea", "aquarius",
        "powerade", "redbull", "schweppes", "kombucha", "tonica", "mirinda"];
    if (has(wn, ...KW_REF)
        || (wn.has("coca") && wn.has("cola"))
        || (wn.has("red") && wn.has("bull"))
        || (wn.has("bitter") && wn.has("kas"))
        || (wn.has("ginger") && wn.has("ale"))) return R(23, "refresco");

    // ============================================================
    // 13) CAFÉ E INFUSIONES
    // ============================================================
    if (fam_is("para cafe e infusiones", "cafe e infusiones")) {
        if (["infusion", "infusiones", "te", "manzanilla", "menta", "poleo",
             "rojos", "chai", "matcha", "vitalzen", "verde", "rojo", "pakistani",
             "frambuesa", "manzana", "jengibre", "acerola", "dammann",
             "tisane", "breakfast", "cacao", "colacao", "tila"].some(x => wn.has(x)))
            return R(44, "infusion");
        return R(43, "cafe mp");
    }
    if ((wn.has("te") && wn.has("frio")) || wn.has("tisane") || wn.has("dammann"))
        return R(44, "te frio/tisane");

    // Café por nombre (pero excluir chocolates con café, turrones con café...)
    if (["cafe", "espresso", "expresso", "latte", "capuccino", "cappuccino",
         "macchiato", "moka", "americano", "sharerato", "vienes", "carajillo",
         "bombon cafe", "chocolate a la taza", "cortado"].some(x => wn.has(x) || n.includes(x))) {
        if (["chocolate", "turron", "tableta", "bombon de", "tarta", "galleta",
             "helado", "caramelo"].some(x => wn.has(x))) return R(90, "dulce con café");
        return R(43, "cafe (por nombre)");
    }
    if (wn.has("chocolate") && wn.has("taza")) return R(43, "chocolate a la taza");

    // ============================================================
    // 14) OTRAS BEBIDAS / ZUMOS / LECHE / BATIDOS
    // ============================================================
    if (fam_is("otras bebidas")) {
        if (["cafe", "cortado", "espresso", "expresso", "latte", "capuccino",
             "cappuccino", "macchiato", "moka", "frappe", "carajillo",
             "americano", "sharerato", "flat", "vienes", "bombon",
             "chai", "matcha"].some(x => wn.has(x))) return R(43, "cafe");
        return R(25, "bebida zumo/lactea");
    }

    if (has(wn, "zumo", "batido", "horchata", "smoothie", "granizado",
            "nectar", "cacaolat")) return R(25, "zumo/batido");
    if (wn.has("leche") && !["chocolate", "bombon", "turron", "tarta",
        "galleta", "cafe", "colacao", "caramelo", "queso"].some(x => wn.has(x)))
        return R(25, "leche");

    // ============================================================
    // 15) CONOS
    // ============================================================
    if (fam_is("conos") || wn.has("cono") || n.startsWith("cono "))
        return R(103, "conos");

    // ============================================================
    // 16) BOCADILLOS — orden INTERNO: embutido > jamón
    // ============================================================
    if (wn.has("tomason") || wn.has("tomasito")) return R(41, "tomasón");

    if (["focaccia", "foccacia", "focaccella", "focatina"].some(x => wn.has(x))) {
        if (["nutella", "pistacho", "dulce"].some(x => wn.has(x))) return R(102, "focaccia dulce");
        return R(40, "focaccia");
    }
    if (fam_is("flautin") || wn.has("flautin")) return R(38, "flautín");
    if (wn.has("flauta")) return R(38, "flauta");
    if (fam_is("mollete") || wn.has("mollete")) return R(39, "mollete");
    if (fam_is("coca") || (wn.has("coca") && !wn.has("cola")) || (wn.has("pan") && wn.has("coca")))
        return R(37, "coca bocadillo");

    if (wn.has("pizzella") || wn.has("pize") || wn.has("pizza")) return R(94, "pizza");

    // Detección de embutido vs jamón para bocadillos
    const kwEmbutido = ["chorizo", "salchichon", "lomo", "fuet", "longaniza",
        "sobrasada", "embutido", "morcilla", "butifarra", "salami"];
    const kwJamon = ["jamon", "paleta", "iberico", "bellota"];

    if (fam_is("grande") || fam_is("pequeno") || fam_is("otros bocadillos", "bocadillo")
        || ["bocadillo", "bocata", "bikini", "panini", "wrap", "bagel",
            "sandwich", "montadito"].some(x => wn.has(x) || n.includes(x))) {

        const es_pequeno = fam_is("pequeno") || wn.has("pequeno") || wn.has("mini");
        const tieneEmbutido = kwEmbutido.some(x => wn.has(x));
        const tieneJamon = kwJamon.some(x => wn.has(x));

        // Regla: embutido gana si aparece explícito, salvo que solo haya jamón
        if (tieneEmbutido) return R(es_pequeno ? 35 : 31, "boc embutido");
        if (tieneJamon) return R(es_pequeno ? 34 : 30, "boc jamón");
        return R(es_pequeno ? 36 : 32, "boc otros");
    }

    // ============================================================
    // 17) RACIONES / PLATOS / TAPAS / ENSALADAS
    //     (ANTES de viruta/taquito/jamón, para no robar)
    // ============================================================
    const esRacion = wn.has("racion") || wn.has("raciones") || ws.has("raciones");

    // Ración de gazpacho, salmorejo, crema → 96
    if (esRacion && ["gazpacho", "salmorejo", "crema", "caldo"].some(x => wn.has(x)))
        return R(96, "ración crema/caldo");

    // Tostadas → tapa fría
    if (wn.has("tostada") || wn.has("tostadas")) return R(97, "tostada");

    // Raciones que llevan jamón/paleta/embutido → 95, no 62
    if (esRacion) {
        if (wn.has("tortilla")) return R(98, "ración tortilla");
        if (["jamon", "paleta", "iberico", "lomo", "chorizo", "salchichon",
             "embutido", "fuet", "queso", "surtido"].some(x => wn.has(x)))
            return R(95, "ración jamón/embutido");
        return R(94, "ración");
    }

    // Platos con jamón (huevos rotos, carne con tomate...) → 94, no 61
    if (fam_is("platos principales", "plato")) {
        if (wn.has("ensalada") || wn.has("ensaladilla")) return R(99, "ensalada");
        return R(94, "plato principal");
    }
    if (fam_is("ensaladas")) return R(99, "ensalada");

    // Tapas (pero "tapa de jamón" con "ración" ya filtrada)
    if (fam_is("tapas")) {
        if (["bravas", "patatas", "tortilla", "caliente", "plancha",
             "huevo", "carne", "pollo", "gamba", "pulpo", "croqueta",
             "empanada", "carrillera", "nachos", "alitas", "salpicon",
             "callos", "mechada"].some(x => wn.has(x))) return R(98, "tapa caliente");
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
    // 18) DETECCIONES ANTI-FALSOS-POSITIVOS antes de jamón/viruta
    // ============================================================

    // Patatas snacks con sabor jamón (Frit Ravich)
    if (["patata", "patatas", "chips", "snack", "snacks", "pringles",
         "ganchitos", "triblis", "tronkess", "ruedas", "bocafrit",
         "texicos", "chilli", "sweet", "frit"].some(x => wn.has(x))
        && ["frita", "fritas", "chips", "snack", "snacks", "premium",
            "extra", "crujiente", "40g", "36", "gr"].some(x => wn.has(x) || n.includes(x)))
        return R(89, "patatas snack con sabor");

    // Aceitunas / olivas (antes que jamón)
    if (["oliva", "olivas", "aceituna", "aceitunas"].some(x => wn.has(x))) {
        // Aceitunas rellenas de pescado → conserva 88
        if (["bonito", "atun", "sardina", "sardinilla", "mejillon",
             "ventresca", "anchoa", "boqueron", "calamar", "pulpo",
             "navaja", "berberecho", "salmon", "rabil", "tuna"].some(x => wn.has(x)))
            return R(88, "conserva de pescado");
        return R(86, "olivas");
    }

    // Cremas de queso con jamón → 80 (no 61)
    if ((wn.has("crema") || wn.has("tarro")) && wn.has("queso") && wn.has("jamon"))
        return R(80, "crema/tarro queso con jamón");

    // Picos / pan con jamón → pan (no jamón)
    if ((wn.has("pico") || wn.has("picos") || wn.has("pan")) && wn.has("jamon"))
        return R(87, "pan con jamón");

    // Plato en nombre pero no es comida: plato universal, plato óvalo...
    if (wn.has("plato") && (wn.has("universal") || wn.has("ovalo") || wn.has("gourmet")
        || wn.has("llano") || wn.has("hondo") || wn.has("postre") || wn.has("redondo")
        || wn.has("carton") || wn.has("cristal") || wn.has("cambio")))
        return R(92, "plato/utensilio");

    // Tostada con jamón cocido o patés → 97 / 82 (ya cubierto arriba)
    // Vinagre con miel → aliños, no conservas
    if (wn.has("vinagre") && wn.has("miel")) return R(85, "vinagre con miel");
    if (wn.has("vinagre")) return R(85, "vinagre");

    // Siropes → aliños
    if (wn.has("sirope") && !fam_is("dulce", "postres")) return R(85, "sirope");

    // ============================================================
    // 19) VIRUTAS / TAQUITOS / LASCAS / ENSAMBLAJES
    // ============================================================
    if (["viruta", "virutas", "lasca", "lascas", "repelo"].some(x => wn.has(x))) {
        // Si es sobre / bolsa genérica, es todavía la clasificación jamón/paleta
        if (wn.has("paleta") && !wn.has("jamon")) return R(68, "viruta paleta");
        return R(62, "viruta jamón");
    }
    if (wn.has("taquito") || wn.has("taquitos")) {
        if (wn.has("paleta") && !wn.has("jamon")) return R(68, "taquitos paleta");
        return R(62, "taquitos jamón");
    }
    if (wn.has("lonchas") && wn.has("rotas")) return R(62, "lonchas rotas");
    if (wn.has("ensamblaje") || wn.has("ensamblaj")) return R(62, "ensamblaje -> viruta");

    // ============================================================
    // 20) JAMÓN / PALETA (piezas, sobres, packs, al corte)
    // ============================================================
    const es_paleta = wn.has("paleta") || wn.has("paletilla") || ws.has("paleta")
        || n.includes("schulter") || n.includes("eichelmastschulter");
    const es_jamon = wn.has("jamon") || ws.has("jamon")
        || n.includes("schinken") || n.includes("weideschinken")
        || n.includes("eichelmastschinken");

    // Paletilla de cordero → otras carnes
    if (es_paleta && fam_is("cordero", "otras carnes", "conejo", "pato")) return R(49, "paletilla cordero");
    // Lomo de vacuno/ternera → no es lomo curado
    if (wn.has("lomo") && fam_is("ternera", "vacuno", "pollo")) return R(45, "lomo fresco");

    if (es_paleta && !wn.has("cocido")) {
        if (sub_has("sobre") || wn.has("sobre")) return R(70, "paleta sobre");
        if (n.includes("al corte") || s.includes("al corte") || ws.has("maquina"))
            return R(69, "paleta al corte");
        if (wn.has("pack") || wn.has("lote") || ws.has("pack")
            || fam_is("cestas y lotes") || wn.has("surtido"))
            return R(71, "paleta pack/lote");
        return R(67, "paleta pieza");
    }

    if (es_jamon && !wn.has("cocido")) {
        if (sub_has("sobre") || wn.has("sobre")) return R(64, "jamón sobre");
        if (n.includes("al corte") || s.includes("al corte") || ws.has("maquina"))
            return R(63, "jamón al corte");
        if (wn.has("pack") || wn.has("lote") || ws.has("pack")
            || fam_is("cestas y lotes") || wn.has("surtido"))
            return R(65, "jamón pack/lote");
        return R(61, "jamón pieza");
    }

    // ============================================================
    // 21) EMBUTIDOS
    // ============================================================
    if (fam_is("chorizo") || wn.has("chorizo")) return R(73, "chorizo");
    if (fam_is("salchichon") || wn.has("salchichon")) return R(74, "salchichón");
    if (fam_is("lomo") || wn.has("lomo")) return R(75, "lomo");
    if (["longaniza", "fuet", "sobrasada", "morcilla", "butifarra",
         "salchicha", "camaiot", "butifarron", "salami"].some(x => wn.has(x)))
        return R(76, "longaniza/fuet");
    if (fam_is("curado")) return R(72, "otros curados");

    // ============================================================
    // 22) QUESOS
    // ============================================================
    if (fam_is("queso") || wf.has("queso") || wn.has("queso")) {
        if (ws.has("cuna") || n.includes("cuña") || n.includes("cuna")) return R(78, "queso cuña");
        if (ws.has("pieza") || ws.has("entero")) return R(79, "queso pieza");
        return R(80, "queso al corte");
    }

    // ============================================================
    // 23) PAN
    // ============================================================
    if (fam_is("pan") || wf.has("pan")) {
        if (["racion", "tostada", "tapa", "pico", "picatoste",
             "baston", "regana"].some(x => wn.has(x))) return R(101, "pan para comer");
        return R(87, "pan tienda");
    }

    // ============================================================
    // 24) ALIÑOS
    // ============================================================
    if (fam_is("alinos") || sub_has("aceite", "vinagre", "especias", "salsas"))
        return R(85, "aliños");

    // ============================================================
    // 25) CONSERVAS / OLIVAS (segunda pasada, ya capturadas arriba)
    // ============================================================
    if (fam_is("conservas")) return R(88, "conservas");
    if (["mermelada", "confitura", "miel"].some(x => wn.has(x))) return R(88, "conservas");

    // ============================================================
    // 26) PATÉS / FOIE / OTROS EMBUTIDOS
    // ============================================================
    if (wn.has("pate") || wn.has("foie") || wn.has("mousse")) return R(84, "paté/foie");
    if (fam_is("otros embutidos")) return R(83, "otros embutidos");
    if ((wn.has("cocido") && (wn.has("jamon") || wn.has("pavo")))
        || (fam_is("cocidos") && ["jamon", "pechuga", "pavo", "mortadela",
                                   "chopped", "lacon"].some(x => wn.has(x))))
        return R(82, "cocidos jamón/pavo");
    if (fam_is("cocidos")) return R(83, "cocidos otros");

    // ============================================================
    // 27) CARNES FRESCAS
    // ============================================================
    if (fam_is("pollo")) return R(47, "pollo");
    if (fam_is("ternera")) return R(45, "ternera");
    if (fam_is("cerdo")) return R(46, "cerdo");
    if (fam_is("pavo")) return R(48, "pavo");
    if (fam_is("cordero", "conejo", "pato", "otras carnes")) return R(49, "otras carnes");

    // ============================================================
    // 28) FRUTA / VERDURA / PATATAS / SNACKS
    // ============================================================
    if (fam_is("fruta y verdura")) return R(91, "fruta/verdura");

    if (wn.has("patata") || wn.has("patatas")) {
        if (["frita", "fritas", "chips", "snack", "snacks", "pringles",
             "ganchitos", "triblis", "tronkess", "ruedas", "bocafrit",
             "texicos", "chilli", "boniato", "sweet", "frit", "confitada",
             "extra", "crujiente"].some(x => wn.has(x))) return R(89, "patatas snack");
        if (["enteras", "tortilla", "peladas", "prefritas",
             "congeladas", "para"].some(x => wn.has(x))) return R(91, "patata cruda");
        return R(89, "patatas snack");
    }
    if (["pringles", "ganchitos", "triblis", "tronkess", "ruedas"].some(x => wn.has(x)))
        return R(89, "snack");

    // ============================================================
    // 29) REGLAS PUNTUALES (antes de fallback)
    // ============================================================
    if (wn.has("grasa") || wn.has("corteza")) return R(61, "grasa/corteza jamón/paleta");
    if (wn.has("hueso") || wn.has("huesos")) {
        if (wn.has("caldo")) return R(96, "huesos para caldo");
        return R(61, "huesos jamón/paleta");
    }
    if (wn.has("promo") && wn.has("sobre")) return R(64, "promo sobre jamón");
    if (wn.has("surtido") && (wn.has("tapa") || wn.has("tapas"))
        && (wn.has("iberic") || wn.has("jamon"))) return R(65, "pack surtido jamón");

    // ============================================================
    // 30) FALLBACK
    // ============================================================
    if (fam_is("otros productos")) return R(91, "otros productos");
    return R(91, "fallback");
}