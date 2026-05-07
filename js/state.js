// js/state.js

export const EXCEL_ITEMS_PER_PAGE = 20;

export const state = {
    excel: {
        // TPVs
        mass: { data: [], page: 1, search: '' },
        del:  { data: [], page: 1, search: '' },
        swap: { data: [], page: 1, search: '' },
        // Plantillas
        p_add: { data: [], page: 1, search: '' },
        p_del: { data: [], page: 1, search: '' },
        p_upd: { data: [], page: 1, search: '' }
    },
    currentTabForModal: 'mass',
    tiendasData: [],
    customGroups: {},
    lastChecked: null,
    generatedQueries: {},
    groupHistory: [],
    collapsedGroups: {}
};

function safeSetLocalStorage(key, value) {
    try { localStorage.setItem(key, value); } 
    catch (e) { console.warn(`No se pudo guardar [${key}].`, e); }
}

// --- GESTIÓN DE TIENDAS UNIFICADA ---
export function cargarTiendas(defaultTiendas) {
    const customData = localStorage.getItem('sqlGenStores');
    if (customData) {
        try { state.tiendasData = JSON.parse(customData); } 
        catch(e) { state.tiendasData = [...defaultTiendas]; }
    } else {
        state.tiendasData = [...defaultTiendas];
    }
    return state.tiendasData;
}

export function guardarTiendas(newStores) {
    safeSetLocalStorage('sqlGenStores', JSON.stringify(newStores));
    state.tiendasData = newStores;
}

export function restaurarTiendasOriginales() {
    localStorage.removeItem('sqlGenStores');
}

// --- GESTIÓN DE GRUPOS PERSONALIZADOS ---
export function cargarGruposPersonalizados() {
    const saved = localStorage.getItem('sqlGenCustomGroups');
    if (saved) state.customGroups = JSON.parse(saved);
    return state.customGroups;
}

export function guardarGrupoCustom(name, ids) {
    state.customGroups[name] = ids;
    safeSetLocalStorage('sqlGenCustomGroups', JSON.stringify(state.customGroups));
}

export function borrarGrupoCustom(name) {
    delete state.customGroups[name];
    safeSetLocalStorage('sqlGenCustomGroups', JSON.stringify(state.customGroups));
}

// --- GESTIÓN DE HISTORIAL ---
export function cargarHistorial() {
    const saved = localStorage.getItem('sqlGroupHistory');
    if (saved) state.groupHistory = JSON.parse(saved);
    return state.groupHistory;
}

export function agregarHistorial(val) {
    if (!val) return;
    if (!state.groupHistory.includes(val)) {
        state.groupHistory.unshift(val);
        if (state.groupHistory.length > 20) state.groupHistory.pop();
        safeSetLocalStorage('sqlGroupHistory', JSON.stringify(state.groupHistory));
    }
}

export function borrarHistorialLocal() {
    localStorage.removeItem('sqlGroupHistory');
    state.groupHistory = [];
}

// --- ACORDEONES COLAPSADOS ---
export function cargarGruposColapsados() {
    const savedCollapsed = localStorage.getItem('sqlGenCollapsedGroups');
    if (savedCollapsed) state.collapsedGroups = JSON.parse(savedCollapsed);
}

export function toggleGrupoColapsado(groupId) {
    if (state.collapsedGroups[groupId]) { delete state.collapsedGroups[groupId]; } 
    else { state.collapsedGroups[groupId] = true; }
    safeSetLocalStorage('sqlGenCollapsedGroups', JSON.stringify(state.collapsedGroups));
    return state.collapsedGroups[groupId]; 
}

// --- ESTADO GENERAL ---
export function guardarEstadoFormulario(formStateObj) {
    safeSetLocalStorage('sqlGenState', JSON.stringify(formStateObj));
}

export function cargarEstadoFormulario() {
    const saved = localStorage.getItem('sqlGenState');
    return saved ? JSON.parse(saved) : null;
}

export function limpiarEstadoCompleto() {
    localStorage.removeItem('sqlGenState');
    localStorage.removeItem('sqlGenCollapsedGroups');
    localStorage.removeItem('sqlGenTheme'); // <--- Para borrar la memoria caché del tema
}

// --- TEMA ---
export function getTheme() { 
    const savedTheme = localStorage.getItem('sqlGenTheme');
    if (savedTheme) return savedTheme;
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}
export function setTheme(theme) { safeSetLocalStorage('sqlGenTheme', theme); }