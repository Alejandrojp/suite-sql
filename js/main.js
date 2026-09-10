// js/main.js
import { defaultTiendasData, excepcionesTiendas } from './data.js';
import * as State from './state.js';
import * as UI from './ui.js';
import * as SQL from './sql.js';
import * as Parser from './excelParser.js';

// --- UTILIDAD DE DEBOUNCE PARA AUTOGUARDADO ---
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const guardadoReactivo = debounce(() => {
    guardarEstadoGlobal();
}, 500);

// --- EJECUCIÓN ASÍNCRONA PARA NO BLOQUEAR LA UI ---
function ejecutarGeneracionAsincrona(btn, taskFn) {
    const originalText = btn.innerText;

    // 1. Mostrar estado de carga
    btn.innerText = "⏳ Generando SQL...";
    btn.disabled = true;
    document.body.style.cursor = 'wait';

    // 2. Ceder el hilo al navegador para pintar la UI y ejecutar la tarea pesada
    setTimeout(() => {
        try {
            taskFn();
        } catch (error) {
            console.error("Error en generación asíncrona:", error);
            UI.showNotification("⚠️ Error generando el script. Revisa la consola.");
        } finally {
            // 3. Restaurar estado
            btn.innerText = originalText;
            btn.disabled = false;
            document.body.style.cursor = 'default';
        }
    }, 50);
}

// ==========================================
// 1. GESTIÓN DE ESTADO LOCAL (Formulario)
// ==========================================
function buildStateObj() {
    return {
        noprovArtsDel: document.getElementById('noprov-articulos-del')?.value || '',
        modo_masivo: document.querySelector('input[name="modo_masivo"]:checked')?.value || 'simple',
        modo_borrar: document.querySelector('input[name="modo_borrar"]:checked')?.value || 'simple',
        modo_swap: document.querySelector('input[name="modo_swap"]:checked')?.value || 'simple',
        posicion_insercion: document.querySelector('input[name="posicion_insercion"]:checked')?.value || 'top',

        articulos_excel: document.getElementById('articulos_excel')?.value || '',
        articulos_excel_del: document.getElementById('articulos_excel_del')?.value || '',
        articulos_excel_swap: document.getElementById('articulos_excel_swap')?.value || '',

        articulos: document.getElementById('articulos')?.value || '',
        articulos_borrar: document.getElementById('articulos_borrar')?.value || '',

        busq1: document.getElementById('busq1')?.value || '',
        busq2: document.getElementById('busq2')?.value || '',
        filter_mass: document.getElementById('filter-mass')?.value || '',

        busq1_del: document.getElementById('busq1_del')?.value || '',
        busq2_del: document.getElementById('busq2_del')?.value || '',
        filter_delete: document.getElementById('filter-delete')?.value || '',

        busq1_swap: document.getElementById('busq1_swap')?.value || '',
        busq2_swap: document.getElementById('busq2_swap')?.value || '',
        filter_swap: document.getElementById('filter-swap')?.value || '',

        busq1_repair: document.getElementById('busq1_repair')?.value || '',
        busq2_repair: document.getElementById('busq2_repair')?.value || '',
        filter_repair: document.getElementById('filter-repair')?.value || '',

        auditGrupoEspecifico: document.getElementById('auditGrupoEspecifico')?.checked ?? true,
        auditGrupoEspecificoSwap: document.getElementById('auditGrupoEspecificoSwap')?.checked ?? true,

        safeMode: document.getElementById('safeMode')?.checked ?? true,
        safeModePlant: document.getElementById('safeModePlant')?.checked ?? true,

        tipoBusqueda: document.getElementById('tipoBusqueda')?.value || 'contains',
        campoBusqueda: document.getElementById('campoBusqueda')?.value || 'nombre',

        tipoBusqueda_del: document.getElementById('tipoBusqueda_del')?.value || 'contains',
        campoBusqueda_del: document.getElementById('campoBusqueda_del')?.value || 'nombre',

        tipoBusqueda_swap: document.getElementById('tipoBusqueda_swap')?.value || 'contains',
        campoBusqueda_swap: document.getElementById('campoBusqueda_swap')?.value || 'nombre',

        tipoBusqueda_repair: document.getElementById('tipoBusqueda_repair')?.value || 'contains',
        campoBusqueda_repair: document.getElementById('campoBusqueda_repair')?.value || 'nombre',

        // Plantillas State
        pasteAdd: document.getElementById('paste-add')?.value || '',
        provNombre: document.getElementById('prov-nombre')?.value || '',
        provStock: document.getElementById('prov-stock')?.value || '1',
        provArts: document.getElementById('prov-articulos')?.value || '',
        modo_p_add: document.querySelector('input[name="modo_p_add"]:checked')?.value || 'excel_cod',

        // Plantillas Delete State
        pasteDel: document.getElementById('paste-del')?.value || '',
        provNombreDel: document.getElementById('prov-nombre-del')?.value || '',
        provArtsDel: document.getElementById('prov-articulos-del')?.value || '',
        modo_p_del: document.querySelector('input[name="modo_p_del"]:checked')?.value || 'excel_cod',

        inputEmpty: document.getElementById('input-empty')?.value || '',
        consProv: document.getElementById('cons-prov')?.value || '',
        consClientes: document.getElementById('cons-clientes')?.value || '',
        pasteUpd: document.getElementById('paste-upd')?.value || '',
        tpv_nivel: document.getElementById('tpv-nivel')?.value || 'GRUPO',
        tpv_accion: document.getElementById('tpv-accion')?.value || 'INSERT',
        tpv_id: document.getElementById('tpv-id')?.value || '',
        tpv_nombre: document.getElementById('tpv-nombre')?.value || '',
        tpv_desc: document.getElementById('tpv-desc')?.value || '',
        tpv_padre: document.getElementById('tpv-padre')?.value || '0',
        tpv_macro_enlace: document.getElementById('tpv-macro-enlace')?.value || '',
        filter_grupos: document.getElementById('filter-grupos')?.value || '',
        trasProvOrigen: document.getElementById('tras-prov-origen')?.value || '',
        trasProvDestino: document.getElementById('tras-prov-destino')?.value || '',
        trasArticulos: document.getElementById('tras-articulos')?.value || '',
        filterTraspaso: document.getElementById('filter-traspaso')?.value || ''
    };
}

function guardarEstadoGlobal() {
    State.guardarEstadoFormulario(buildStateObj());
}

function cargarEstadoFormulario() {
    const s = State.cargarEstadoFormulario();
    if (!s) return;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // TPV
    setVal('noprov-articulos-del', s.noprovArtsDel);
    setVal('articulos', s.articulos); setVal('articulos_excel', s.articulos_excel);
    setVal('articulos_borrar', s.articulos_borrar); setVal('articulos_excel_del', s.articulos_excel_del);
    setVal('articulos_excel_swap', s.articulos_excel_swap);

    if (s.modo_masivo) { const r = document.querySelector(`input[name="modo_masivo"][value="${s.modo_masivo}"]`); if (r) { r.checked = true; toggleModoMasivo(); } }
    if (s.modo_borrar) { const r = document.querySelector(`input[name="modo_borrar"][value="${s.modo_borrar}"]`); if (r) { r.checked = true; toggleModoBorrar(); } }
    if (s.modo_swap) { const r = document.querySelector(`input[name="modo_swap"][value="${s.modo_swap}"]`); if (r) { r.checked = true; toggleModoSwap(); } }
    if (s.posicion_insercion) { const r = document.querySelector(`input[name="posicion_insercion"][value="${s.posicion_insercion}"]`); if (r) r.checked = true; }

    setVal('busq1', s.busq1); setVal('busq2', s.busq2); setVal('filter-mass', s.filter_mass); if (s.filter_mass) filtrarTiendas('list-mass', 'filter-mass');
    setVal('busq1_del', s.busq1_del); setVal('busq2_del', s.busq2_del); setVal('filter-delete', s.filter_delete); if (s.filter_delete) filtrarTiendas('list-delete', 'filter-delete');
    setVal('busq1_swap', s.busq1_swap); setVal('busq2_swap', s.busq2_swap); setVal('filter-swap', s.filter_swap); if (s.filter_swap) filtrarTiendas('list-swap', 'filter-swap');
    setVal('busq1_repair', s.busq1_repair); setVal('busq2_repair', s.busq2_repair); setVal('filter-repair', s.filter_repair); if (s.filter_repair) filtrarTiendas('list-repair', 'filter-repair');

    setCheck('auditGrupoEspecifico', s.auditGrupoEspecifico); setCheck('auditGrupoEspecificoSwap', s.auditGrupoEspecificoSwap);
    setCheck('safeMode', s.safeMode); setCheck('safeModePlant', s.safeModePlant);

    if (s.tipoBusqueda) { setVal('tipoBusqueda', s.tipoBusqueda); UI.gestionarInputsBusqueda('tipoBusqueda', 'busq2'); } setVal('campoBusqueda', s.campoBusqueda);
    if (s.tipoBusqueda_del) { setVal('tipoBusqueda_del', s.tipoBusqueda_del); UI.gestionarInputsBusqueda('tipoBusqueda_del', 'busq2_del'); } setVal('campoBusqueda_del', s.campoBusqueda_del);
    if (s.tipoBusqueda_swap) { setVal('tipoBusqueda_swap', s.tipoBusqueda_swap); UI.gestionarInputsBusqueda('tipoBusqueda_swap', 'busq2_swap'); } setVal('campoBusqueda_swap', s.campoBusqueda_swap);
    if (s.tipoBusqueda_repair) { setVal('tipoBusqueda_repair', s.tipoBusqueda_repair); UI.gestionarInputsBusqueda('tipoBusqueda_repair', 'busq2_repair'); } setVal('campoBusqueda_repair', s.campoBusqueda_repair);

    // Plantillas
    setVal('paste-add', s.pasteAdd); setVal('prov-nombre', s.provNombre); setVal('prov-stock', s.provStock); setVal('prov-articulos', s.provArts);
    if (s.modo_p_add) { const r = document.querySelector(`input[name="modo_p_add"][value="${s.modo_p_add}"]`); if (r) { r.checked = true; toggleModoPAdd(); } }

    setVal('paste-del', s.pasteDel); setVal('prov-nombre-del', s.provNombreDel); setVal('prov-articulos-del', s.provArtsDel);
    if (s.modo_p_del) { const r = document.querySelector(`input[name="modo_p_del"][value="${s.modo_p_del}"]`); if (r) { r.checked = true; toggleModoPDel(); } }

    setVal('input-empty', s.inputEmpty); setVal('cons-prov', s.consProv); setVal('cons-clientes', s.consClientes); setVal('paste-upd', s.pasteUpd);
    setVal('tpv-nivel', s.tpv_nivel); setVal('tpv-accion', s.tpv_accion);
    setVal('tpv-id', s.tpv_id); setVal('tpv-nombre', s.tpv_nombre); setVal('tpv-desc', s.tpv_desc);
    setVal('tpv-padre', s.tpv_padre); setVal('tpv-macro-enlace', s.tpv_macro_enlace);
    setVal('filter-grupos', s.filter_grupos); if (s.filter_grupos) filtrarTiendas('list-grupos', 'filter-grupos');
    setVal('tras-prov-origen', s.trasProvOrigen);
    setVal('tras-prov-destino', s.trasProvDestino);
    setVal('tras-articulos', s.trasArticulos);
    setVal('filter-traspaso', s.filterTraspaso);
    if (s.filterTraspaso) filtrarTiendas('list-traspaso', 'filter-traspaso');
    if (s.tpv_nivel) {
        const wrapCampos = document.getElementById('wrap-campos-grupo');
        if (wrapCampos) wrapCampos.style.display = s.tpv_nivel === 'GRUPO' ? 'flex' : 'none';
    }
}

// ==========================================
// 2. LÓGICA DE UI Y EXCEL (Unificada)
// ==========================================
function switchTab(tabId) {
    const targetTab = document.getElementById(tabId);
    if (!targetTab) return;
    const parentApp = targetTab.closest('.app-section');

    parentApp.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    parentApp.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    targetTab.classList.add('active');
    const btn = parentApp.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');

    if (parentApp.id === 'app-tpvs') {
        localStorage.setItem('sqlGenActiveTabTpvs', tabId);
    } else {
        localStorage.setItem('sqlGenActiveTabPlantillas', tabId);
    }
}

function toggleModoMasivo() {
    let modo = document.querySelector('input[name="modo_masivo"]:checked').value;
    let isExcel = modo.includes('excel');
    let isExcelTienda = modo === 'excel_tienda';

    document.getElementById('wrap-modo-simple-mass').style.display = isExcel ? 'none' : 'block';
    document.getElementById('wrap-modo-excel-mass').style.display = isExcel ? 'block' : 'none';

    let secConfigGrupo = document.getElementById('sec-config-grupo-mass');
    let secSelectorTiendas = document.getElementById('sec-selector-tiendas-mass');
    let thead = document.getElementById('thead-mass-excel');
    let textarea = document.getElementById('articulos_excel');
    let labelExcel = document.getElementById('label-excel-mass');

    if (isExcel) {
        secConfigGrupo.classList.add('disabled-section');
        procesarExcel('mass');
    } else {
        secConfigGrupo.classList.remove('disabled-section');
        UI.actualizarContadorArticulosGenerico('articulos', 'art-count-mass');
    }

    if (isExcelTienda) {
        if (secSelectorTiendas) secSelectorTiendas.style.display = 'none';
        if (labelExcel) labelExcel.innerHTML = "Pega aquí las 3 columnas de tu Excel <strong>(Nº Tienda, Cód. Artículo y Grupo)</strong>.";
        textarea.placeholder = "Ejemplo:\n71\t50493\tVinos\n85\t50494\tBebidas";
        if (thead) thead.innerHTML = "<tr><th>Nº Tienda</th><th>Cód. Artículo</th><th>Grupo Detectado</th></tr>";
    } else if (modo === 'excel') {
        if (secSelectorTiendas) secSelectorTiendas.style.display = 'block';
        if (labelExcel) labelExcel.innerHTML = "Pega aquí las 2 columnas de tu Excel <strong>(Cód. Artículo y Grupo)</strong>.";
        textarea.placeholder = "Ejemplo:\n50493\tVinos\n50494\tBebidas";
        if (thead) thead.innerHTML = "<tr><th>Cód. Artículo</th><th>Grupo Detectado</th></tr>";
    } else {
        if (secSelectorTiendas) secSelectorTiendas.style.display = 'block';
    }
}

function toggleModoBorrar() {
    let isExcel = document.querySelector('input[name="modo_borrar"]:checked').value === 'excel';
    document.getElementById('wrap-modo-simple-del').style.display = isExcel ? 'none' : 'block';
    document.getElementById('wrap-modo-excel-del').style.display = isExcel ? 'block' : 'none';
    let secConfigGrupo = document.getElementById('sec-config-grupo-del');
    if (isExcel) { secConfigGrupo.classList.add('disabled-section'); procesarExcel('del'); }
    else { secConfigGrupo.classList.remove('disabled-section'); UI.actualizarContadorArticulosGenerico('articulos_borrar', 'art-count-del'); }
}

function toggleModoSwap() {
    let isExcel = document.querySelector('input[name="modo_swap"]:checked').value === 'excel';
    document.getElementById('wrap-modo-simple-swap').style.display = isExcel ? 'none' : 'block';
    document.getElementById('wrap-modo-excel-swap').style.display = isExcel ? 'block' : 'none';
    if (isExcel) { procesarExcel('swap'); } else { actualizarBadgeSwap(); }
}

function toggleModoPAdd() {
    let modo = document.querySelector('input[name="modo_p_add"]:checked')?.value || 'excel_cod';
    let wrapExcel = document.getElementById('wrap-excel-add');
    let wrapManual = document.getElementById('wrap-manual-add');
    let wrapStores = document.getElementById('wrap-stores-add');

    let label = document.getElementById('label-paste-add');
    let textarea = document.getElementById('paste-add');
    let thead = document.getElementById('thead-p_add');

    switch (modo) {
        case 'excel_tienda':
            wrapExcel.style.display = 'block';
            wrapManual.style.display = 'none';
            wrapStores.style.display = 'none';
            label.innerText = "Pegar celdas de Excel (Nº Tienda, Artículo, Stock, Proveedor):";
            textarea.placeholder = "71\t48727\t10\tFrio";
            thead.innerHTML = "<tr><th>Nº Tienda</th><th>ID Artículo</th><th>Stock</th><th>Proveedor</th></tr>";
            break;
        case 'excel_cod':
            wrapExcel.style.display = 'block';
            wrapManual.style.display = 'none';
            wrapStores.style.display = 'none';
            label.innerText = "Pegar celdas de Excel (Cód. Plantilla, Artículo, Stock):";
            textarea.placeholder = "1475\t48727\t10";
            thead.innerHTML = "<tr><th>Cód Plantilla</th><th>ID Artículo</th><th>Stock</th></tr>";
            break;
        case 'manual':
            wrapExcel.style.display = 'none';
            wrapManual.style.display = 'block';
            wrapStores.style.display = 'block';
            break;
    }

    if (modo.includes('excel')) procesarExcel('p_add');
    guardarEstadoGlobal();
}

function toggleModoPDel() {
    let modo = document.querySelector('input[name="modo_p_del"]:checked')?.value || 'excel_cod';
    let wrapExcel = document.getElementById('wrap-excel-del');
    let wrapManual = document.getElementById('wrap-manual-del');
    let wrapManualNoProv = document.getElementById('wrap-manual-noprov-del');
    let wrapStores = document.getElementById('wrap-stores-del');

    let label = document.getElementById('label-paste-del');
    let textarea = document.getElementById('paste-del');
    let thead = document.getElementById('thead-p_del');

    if (modo === 'excel_tienda') {
        wrapExcel.style.display = 'block'; wrapManual.style.display = 'none'; wrapManualNoProv.style.display = 'none'; wrapStores.style.display = 'none';
        label.innerText = "Pegar celdas de Excel (nº tienda, articulo, proveedor):";
        textarea.placeholder = "tienda\tarticulo\tproveedor\n71\t48727\tFrio";
        thead.innerHTML = "<tr><th>Nº Tienda</th><th>ID Artículo</th><th>Proveedor</th></tr>";
        procesarExcel('p_del');
    } else if (modo === 'excel_cod') {
        wrapExcel.style.display = 'block'; wrapManual.style.display = 'none'; wrapManualNoProv.style.display = 'none'; wrapStores.style.display = 'none';
        label.innerText = "Pegar celdas de Excel (codigo plantilla, articulo):";
        textarea.placeholder = "codigo\tarticulo\n1475\t48727";
        thead.innerHTML = "<tr><th>Cód Plantilla</th><th>ID Artículo</th></tr>";
        procesarExcel('p_del');
    } else if (modo === 'manual') {
        wrapExcel.style.display = 'none'; wrapManual.style.display = 'block'; wrapManualNoProv.style.display = 'none'; wrapStores.style.display = 'block';
    } else if (modo === 'manual_noprov') {
        wrapExcel.style.display = 'none'; wrapManual.style.display = 'none'; wrapManualNoProv.style.display = 'block'; wrapStores.style.display = 'block';
    }
    guardarEstadoGlobal();
}

function procesarExcel(tab) {
    let idTextarea = tab === 'mass' ? 'articulos_excel' : (tab === 'del' ? 'articulos_excel_del' : 'articulos_excel_swap');
    let idBadge = tab === 'mass' ? 'art-count-mass' : (tab === 'del' ? 'art-count-del' : 'art-count-swap-badge');
    let idPreviewBox = tab === 'mass' ? 'excel-preview-box-mass' : (tab === 'del' ? 'excel-preview-box-del' : 'excel-preview-box-swap');
    let idCampoBusqueda = tab === 'mass' ? 'campoBusqueda' : 'campoBusqueda_del';

    if (['p_add', 'p_del', 'p_upd'].includes(tab)) {
        idTextarea = tab === 'p_add' ? 'paste-add' : (tab === 'p_del' ? 'paste-del' : 'paste-upd');
        idPreviewBox = tab === 'p_add' ? 'excel-preview-box-p_add' : (tab === 'p_del' ? 'excel-preview-box-p_del' : 'excel-preview-box-p_upd');
        idBadge = '';
    }

    let textarea = document.getElementById(idTextarea);
    let raw = textarea.value;
    let result = Parser.parseExcelData(raw, tab);

    State.state.excel[tab].data = result.data;
    State.state.excel[tab].page = 1;

    let badge = document.getElementById(idBadge);
    let previewBox = document.getElementById(idPreviewBox);

    if (!raw.trim()) {
        if (badge) { badge.textContent = tab === 'swap' ? '0 pares' : '0 artículos'; badge.classList.remove('active'); }
        textarea.style.backgroundColor = "";
        if (previewBox) previewBox.style.display = "none";
        UI.renderPreviewTable(tab); return;
    }

    if (badge) { badge.textContent = result.data.length + (tab === 'swap' ? ' pares (Excel)' : ' artículos (Excel)'); badge.classList.add('active'); }

    if (result.conflictsFound) { textarea.style.backgroundColor = "rgba(241, 196, 15, 0.1)"; if (badge) badge.innerText += " (⚠️ Conflictos)"; }
    else if (result.errors) { textarea.style.backgroundColor = "rgba(231, 76, 60, 0.05)"; if (badge) badge.innerText += " (⚠️ Errores)"; }
    else { textarea.style.backgroundColor = ""; }

    if (result.data.length > 0) {
        if (previewBox) previewBox.style.display = "block";
        UI.renderPreviewTable(tab);
        if (['mass', 'del'].includes(tab)) {
            let validRows = result.data.filter(d => d.valid && !d.duplicate);
            if (validRows.length > 0) {
                let isAllNumeric = validRows.every(d => /^\d+$/.test(d.grp.trim()));
                let selectCampo = document.getElementById(idCampoBusqueda);
                let tipoDetectado = isAllNumeric ? 'id' : 'nombre';
                if (selectCampo.value !== tipoDetectado) {
                    selectCampo.value = tipoDetectado;

                    let idSelectTipo = tab === 'mass' ? 'tipoBusqueda' : 'tipoBusqueda_del';
                    let selectTipo = document.getElementById(idSelectTipo);
                    if (tipoDetectado === 'id' && selectTipo) {
                        selectTipo.value = 'exact';
                        UI.gestionarInputsBusqueda(idSelectTipo, tab === 'mass' ? 'busq2' : 'busq2_del');
                    }

                    selectCampo.style.backgroundColor = "#e8f5e9"; selectCampo.style.borderColor = "#28a745";
                    setTimeout(() => { selectCampo.style.backgroundColor = ""; selectCampo.style.borderColor = ""; }, 1500);
                    UI.showNotification(`🤖 Autodetección: Búsqueda por ${tipoDetectado === 'id' ? 'ID' : 'Nombre'} (Modo Exacto Forzado)`);
                }
            }
        }
    } else {
        if (previewBox) previewBox.style.display = "none";
    }
}

function buscarExcel(tab, query) {
    State.state.excel[tab].search = query.toLowerCase();
    State.state.excel[tab].page = 1;
    UI.renderPreviewTable(tab);
}

function limpiarErroresExcel(tab) {
    State.state.currentTabForModal = tab;
    let data = State.state.excel[tab].data;
    if (tab === 'swap') {
        let validData = data.filter(d => d.valid && !d.duplicate && !d.conflict);
        if (validData.length === data.length) { UI.showNotification("✅ Todo está correcto. No hay filas inválidas."); return; }
        actualizarTextareaExcel(tab, validData);
        return;
    }
    let hasConflicts = data.some(d => d.conflict);
    if (hasConflicts && ['mass', 'del'].includes(tab)) { abrirModalConflictos(tab); }
    else {
        let validData = data.filter(d => d.valid && !d.duplicate);
        if (validData.length === data.length) { UI.showNotification("✅ Todo está correcto. No hay filas inválidas ni duplicados."); return; }
        actualizarTextareaExcel(tab, validData);
    }
}

function abrirModalConflictos(tab) {
    let data = State.state.excel[tab].data;
    let conflictGroups = {};

    data.forEach(d => {
        if (d.conflict && !d.duplicate) {
            if (!conflictGroups[d.art]) conflictGroups[d.art] = new Set();
            conflictGroups[d.art].add(d.grp);
        }
    });

    const conflictList = document.getElementById('conflict-list');
    conflictList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let art in conflictGroups) {
        const div = document.createElement('div');
        div.className = 'conflict-item';
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);';

        const strong = document.createElement('strong');
        strong.style.cssText = 'font-family:monospace; font-size:15px; color:var(--theme-purple);';
        strong.textContent = `#${art}`;

        const select = document.createElement('select');
        select.id = `resolve-${art}`;
        select.style.cssText = 'width:200px; padding:6px; border-color:var(--border);';

        Array.from(conflictGroups[art]).forEach(g => {
            const option = document.createElement('option');
            option.value = g;
            option.textContent = g;
            select.appendChild(option);
        });

        const optionDelete = document.createElement('option');
        optionDelete.value = "DELETE";
        optionDelete.style.cssText = 'color:red; font-weight:bold;';
        optionDelete.textContent = "❌ Eliminar de todos";
        select.appendChild(optionDelete);

        div.appendChild(strong);
        div.appendChild(select);
        fragment.appendChild(div);
    }

    conflictList.appendChild(fragment);
    UI.openModal('conflictModal');
}

function aplicarResolucionConflictos() {
    let tab = State.state.currentTabForModal;
    let data = State.state.excel[tab].data;
    let resolvedData = []; let processedConflicts = new Set();

    data.forEach(d => {
        if (d.duplicate || !d.valid) return;
        if (d.conflict) {
            let chosenGroup = document.getElementById(`resolve-${d.art}`).value;
            if (chosenGroup === "DELETE") return;
            if (d.grp === chosenGroup) {
                let exactKey = d.art + '|||' + d.grp;
                if (!processedConflicts.has(exactKey)) { resolvedData.push(d); processedConflicts.add(exactKey); }
            }
        } else { resolvedData.push(d); }
    });
    actualizarTextareaExcel(tab, resolvedData);
    UI.closeModal('conflictModal');
}

function actualizarTextareaExcel(tab, validData) {
    let newText = Parser.generateCleanExcelText(validData, tab);
    let idTextarea = tab === 'mass' ? 'articulos_excel' : (tab === 'del' ? 'articulos_excel_del' : 'articulos_excel_swap');
    if (['p_add', 'p_del', 'p_upd'].includes(tab)) idTextarea = tab === 'p_add' ? 'paste-add' : (tab === 'p_del' ? 'paste-del' : 'paste-upd');

    document.getElementById(idTextarea).value = newText;
    let borradas = State.state.excel[tab].data.length - validData.length;
    procesarExcel(tab);
    guardarEstadoGlobal();
    UI.showNotification(`🧹 Lista optimizada correctamente (Purgadas ${borradas} filas conflictivas/erróneas)`);
}

function limpiarInputArticulos(id, badgeId) {
    let textarea = document.getElementById(id);
    if (!textarea) return;
    let raw = textarea.value;

    let cleanArray = raw.split(/[\r\n,\t\s]+/)
                        .map(s => s.replace(/\D/g, '')) // Extrae estrictamente solo los números
                        .filter(s => s !== '');         // Filtra los bloques vacíos

    // Si el usuario ha escrito algo pero no se ha podido extraer ningún número válido,
    // NO vaciamos el campo (antes esto borraba todo lo escrito). Simplemente no tocamos nada
    // para que pueda seguir editando sin perder lo que llevaba.
    if (raw.trim() !== '' && cleanArray.length === 0) return;

    let uniqueArray = [...new Set(cleanArray)];

    if (cleanArray.length !== uniqueArray.length) {
        UI.showNotification(`⚠️ Se eliminaron ${cleanArray.length - uniqueArray.length} duplicados.`);
    }

    let cleanText = uniqueArray.join('\n');

    if (raw !== cleanText) {
        textarea.value = cleanText;
        UI.actualizarContadorArticulosGenerico(id, badgeId);
        guardarEstadoGlobal();
    }
}

// --- TIENDAS Y GRUPOS ---
function filtrarTiendas(containerId, inputId) {
    const filter = document.getElementById(inputId).value.toUpperCase();
    const container = document.getElementById(containerId);
    container.querySelectorAll('.store-item').forEach(item => { item.style.display = item.dataset.search.indexOf(filter) > -1 ? "" : "none"; });
    container.querySelectorAll('.store-group-container').forEach(group => {
        const visibleChildren = group.querySelectorAll('.store-item:not([style*="display: none"])');
        if (visibleChildren.length === 0) { group.style.display = 'none'; } else {
            group.style.display = '';
            if (filter.length > 0) {
                group.querySelector('.store-group-items').classList.remove('collapsed');
                group.querySelector('.category-toggle-icon').classList.remove('collapsed');
            }
        }
    });
}

function seleccionarVisibles(containerId, estado) {
    document.querySelectorAll(`#${containerId} .store-item`).forEach(item => { if (item.style.display !== "none") item.querySelector('input').checked = estado; });
    UI.actualizarContador(containerId, containerId.replace('list-', 'store-count-'));
    guardarEstadoGlobal();
    State.state.lastChecked = null;
}

function toggleVerSeleccionados(containerId) {
    const container = document.getElementById(containerId);
    let anyHidden = false;
    container.querySelectorAll('.store-item').forEach(item => { if (item.style.display === 'none' && !item.querySelector('input').checked) anyHidden = true; });
    const filterVal = document.querySelector(`#${containerId.replace('list', 'filter')}`).value.toUpperCase();

    container.querySelectorAll('.store-item').forEach(item => {
        const matchesSearch = item.dataset.search.indexOf(filterVal) > -1;
        if (anyHidden) { item.style.display = matchesSearch ? '' : 'none'; }
        else { item.style.display = (item.querySelector('input').checked && matchesSearch) ? '' : 'none'; }
    });

    container.querySelectorAll('.store-group-container').forEach(group => {
        const visibleChildren = group.querySelectorAll('.store-item:not([style*="display: none"])');
        group.style.display = visibleChildren.length > 0 ? '' : 'none';
        if (visibleChildren.length > 0 && !anyHidden) {
            group.querySelector('.store-group-items').classList.remove('collapsed');
            group.querySelector('.category-toggle-icon').classList.remove('collapsed');
        }
    });
}

function presetSeleccion(containerId, typeFilter) {
    let changes = 0;
    document.getElementById(containerId).querySelectorAll('.store-item').forEach(item => {
        if (UI.obtenerCategoriaTienda(item.querySelector('input').value).type === typeFilter) {
            const cb = item.querySelector('input'); if (!cb.checked) { cb.checked = true; changes++; }
        }
    });
    if (changes > 0) { UI.actualizarContador(containerId, containerId.replace('list-', 'store-count-')); guardarEstadoGlobal(); }
    else { UI.showNotification("No hay coincidencias nuevas."); }
}

function guardarGrupo(containerId) {
    const selected = document.querySelectorAll(`#${containerId} .store-item input:checked`);
    if (selected.length === 0) { UI.showNotification("¡Marca tiendas primero!"); return; }
    const name = prompt("Nombre para este grupo de tiendas:");
    if (!name) return;
    State.guardarGrupoCustom(name, Array.from(selected).map(cb => cb.value));
    UI.renderCustomGroupButtons(aplicarGrupoPersonalizado);
    UI.showNotification(`✅ Grupo "${name}" guardado.`);
}

function openGroupManager() {
    const list = document.getElementById('groupManagerList'); list.innerHTML = '';
    if (Object.keys(State.state.customGroups).length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No hay grupos guardados.</div>';
    } else {
        for (const [name, ids] of Object.entries(State.state.customGroups)) {
            const item = document.createElement('div'); item.className = 'group-manager-item';
            item.innerHTML = `<div><span class="group-name">${name}</span> <span class="group-count">(${ids.length} tiendas)</span></div>
                <button class="btn-remove-row" style="margin:0;" data-action="deleteGroup" data-groupname="${name}">🗑️</button>`;
            list.appendChild(item);
        }
    }
    UI.openModal('groupsModal');
}

function aplicarGrupoPersonalizado(containerId, idsToSelect) {
    let count = 0;
    document.getElementById(containerId).querySelectorAll('.store-item input').forEach(cb => {
        if (idsToSelect.includes(cb.value) && !cb.checked) { cb.checked = true; count++; }
    });
    if (count > 0) {
        UI.actualizarContador(containerId, containerId.replace('list-', 'store-count-'));
        guardarEstadoGlobal();
        UI.showNotification(`✅ Seleccionadas ${count} tiendas del grupo.`);
    }
    else { UI.showNotification("⚠️ Las tiendas ya estaban seleccionadas."); }
}

function procesarPegado() {
    const containerId = document.getElementById('pasteModal').dataset.target;
    const rawText = document.getElementById('pasteInput').value;

    const numbers = rawText.match(/\d+/g) || [];

    if (numbers.length === 0) {
        UI.showNotification("⚠️ No se encontraron números válidos en el texto.");
        return;
    }

    const uniqueNumbers = [...new Set(numbers)];
    const container = document.getElementById(containerId);
    let count = 0;
    let notFound = [];

    uniqueNumbers.forEach(num => {
        const cleanNum = num.trim();
        let targetId = excepcionesTiendas[cleanNum] || null;

        if (!targetId) {
            const regexTienda = new RegExp(`^${cleanNum}(\\D|$)`, 'i');
            const match = State.state.tiendasData.find(t => regexTienda.test(t.name) || t.id === cleanNum);
            if (match) targetId = match.id;
        }

        if (targetId) {
            const cb = container.querySelector(`input[value="${targetId}"]`);
            if (cb && !cb.checked) {
                cb.checked = true;
                count++;
            }
        } else {
            notFound.push(cleanNum);
        }
    });

    UI.actualizarContador(containerId, containerId.replace('list-', 'store-count-'));
    guardarEstadoGlobal();
    UI.closeModal('pasteModal');

    if (count > 0) {
        UI.showNotification(`✅ Seleccionadas ${count} tiendas.` + (notFound.length > 0 ? ` (⚠️ No halladas: ${notFound.join(', ')})` : ''));
    } else {
        UI.showNotification("⚠️ No se encontraron coincidencias.");
    }
}

function copiarSoloIDs(containerId, btn) {
    const checkedBoxes = document.querySelectorAll(`#${containerId} .store-item input:checked`);
    if (checkedBoxes.length === 0) { UI.showNotification("⚠️ No hay tiendas seleccionadas para copiar."); return; }
    UI.copyToClipboard(Array.from(checkedBoxes).map(cb => cb.value).join(', '), btn);
}

// --- CONVERSOR & EDITOR ---
function convertirNumerosAIds() {
    const numbers = document.getElementById('inputNumsTienda').value.split(/[\s,]+/).filter(n => n.trim() !== '');
    if (numbers.length === 0) { UI.showNotification("¡Introduce números de tienda!"); return; }

    let foundIds = []; let notFound = [];

    numbers.forEach(num => {
        const cleanNum = num.trim(); let targetId = excepcionesTiendas[cleanNum] || null;
        if (!targetId) {
            const store = State.state.tiendasData.find(t => t.id === cleanNum || new RegExp(`^${cleanNum}(\\D|$)`).test(t.name) || new RegExp(`\\D${cleanNum}(\\D|$)`).test(t.name));
            if (store) targetId = store.id;
        }
        if (targetId) { if (!foundIds.includes(targetId)) foundIds.push(targetId); } else { notFound.push(cleanNum); }
    });

    document.getElementById('resultadoConversor').style.display = 'block';
    document.getElementById('outputIdsDb').textContent = foundIds.join(',');
    const logDiv = document.getElementById('logConversor');
    if (notFound.length > 0) { logDiv.style.color = "#c0392b"; logDiv.style.background = "rgba(192, 57, 43, 0.1)"; logDiv.innerHTML = `✅ Encontrados: ${foundIds.length} | ⚠️ No encontrados: ${notFound.join(', ')}`; }
    else { logDiv.style.color = "#28a745"; logDiv.style.background = "rgba(40, 167, 69, 0.1)"; logDiv.innerHTML = `✅ Encontrados: ${foundIds.length}`; }
}

function abrirEditorTiendas() {
    document.getElementById('storeEditorRows').innerHTML = '';
    State.state.tiendasData.forEach(t => addStoreEditorRow(t.id, t.name));
    document.getElementById('pasteNewStores').value = '';
    UI.openModal('tiendasModal');
}

function addStoreEditorRow(id = '', name = '') {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" value="${UI.escapeHTML(id)}" placeholder="Ej: 6603" class="editor-input"></td>
        <td><input type="text" value="${UI.escapeHTML(name)}" placeholder="Ej: 71 - CALLE DEL MAR"></td>
        <td><button class="btn-remove-row" data-action="removeClosestTr" style="margin:0 auto;">X</button></td>`;
    document.getElementById('storeEditorRows').appendChild(tr);
}

function procesarPegadoTiendas() {
    const text = document.getElementById('pasteNewStores').value.trim();
    if (!text) { UI.showNotification("⚠️ Pega los datos del Excel primero."); return; }
    let count = 0;
    text.split(/[\r\n]+/).filter(l => l.trim() !== '').forEach(line => {
        let parts = line.split('\t'); let id = '', name = '';
        if (parts.length >= 2) { id = parts[0].trim(); name = parts[1].trim(); }
        else { const pc = line.split(/[,;]/); if (pc.length >= 2) { id = pc[0].trim(); name = pc.slice(1).join(' ').trim(); } else { id = line.trim(); } }
        id = id.replace(/\D/g, '');
        if (id) { addStoreEditorRow(id, name); count++; }
    });
    document.getElementById('pasteNewStores').value = '';
    UI.showNotification(`✅ Se han añadido ${count} tiendas. No olvides Guardar Cambios.`);
    const container = document.querySelector('.editor-table-container'); container.scrollTop = container.scrollHeight;
}

function guardarTiendasEditadas() {
    const newStores = []; let hasError = false; let seenIds = new Set();
    document.querySelectorAll('#storeEditorRows tr').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const id = inputs[0].value.trim(); const name = inputs[1].value.trim();
        inputs[0].style.borderColor = ""; inputs[0].style.backgroundColor = "";
        if (id || name) {
            if (!id || seenIds.has(id)) {
                UI.showNotification(!id ? "⚠️ Error: Hay una tienda sin ID." : `⚠️ Error: El ID ${id} está repetido.`);
                hasError = true; inputs[0].style.borderColor = "#e74c3c"; inputs[0].style.backgroundColor = "rgba(231, 76, 60, 0.05)";
            } else { seenIds.add(id); newStores.push({ id: id, name: name || `Tienda ${id}` }); }
        }
    });
    if (hasError) return;
    if (newStores.length > 0) {
        State.guardarTiendas(newStores);
        repintarTodasLasListasDeTiendas();
        UI.closeModal('tiendasModal');
        UI.showNotification("✅ Tiendas actualizadas correctamente.");
    } else {
        UI.showNotification("⚠️ La lista está vacía.");
    }
}

function addSwapRow(oldVal = '', newVal = '') {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" placeholder="ID Viejo" value="${UI.escapeHTML(oldVal)}" class="swap-input"></td>
        <td><input type="text" placeholder="ID Nuevo" value="${UI.escapeHTML(newVal)}" class="swap-input"></td>
        <td><button class="btn-remove-row" data-action="removeSwapRow">X</button></td>`;
    document.getElementById('swap-rows').appendChild(tr);
    actualizarBadgeSwap();
}

function actualizarBadgeSwap() {
    if (document.querySelector('input[name="modo_swap"]:checked').value === 'simple') {
        const textarea = document.getElementById('articulos_swap');
        if (textarea) {
            const lineas = textarea.value.split(/[\r\n]+/).filter(l => l.trim() !== '');
            document.getElementById('art-count-swap-badge').textContent = lineas.length + ' pares';
        }
    }
}

function exportarConfig() {
    const config = { tiendas: State.state.tiendasData, grupos: State.state.customGroups, historial: State.state.groupHistory, fecha: new Date().toISOString() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config));
    const a = document.createElement('a'); a.setAttribute("href", dataStr); a.setAttribute("download", "config_et_sql.json");
    document.body.appendChild(a); a.click(); a.remove();
}

// --- FUNCIÓN PARA REPINTAR LISTAS SIN RECARGAR LA PÁGINA ---
function repintarTodasLasListasDeTiendas() {
    const triggerChange = () => guardarEstadoGlobal();
    UI.crearListaTiendas('list-mass', 'store-count-mass', triggerChange);
    UI.crearListaTiendas('list-delete', 'store-count-delete', triggerChange);
    UI.crearListaTiendas('list-swap', 'store-count-swap', triggerChange);
    UI.crearListaTiendas('list-repair', 'store-count-repair', triggerChange);
    UI.crearListaTiendas('list-api', 'store-count-api', triggerChange);
    UI.crearListaTiendas('list-add', 'store-count-add', triggerChange);
    UI.crearListaTiendas('list-del', 'store-count-del', triggerChange);
    UI.crearListaTiendas('list-grupos', 'store-count-grupos', triggerChange);
    UI.crearListaTiendas('list-traspaso', 'store-count-traspaso', triggerChange);
}

// ==========================================
// 4. INICIALIZACIÓN Y EVENT DELEGATOR
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (State.getTheme() === 'dark') document.body.classList.add('dark');
    else document.body.classList.remove('dark');

    State.cargarTiendas(defaultTiendasData);
    State.cargarGruposPersonalizados();
    State.cargarGruposColapsados();
    State.cargarHistorial();

    const triggerChange = () => guardarEstadoGlobal();
    UI.crearListaTiendas('list-mass', 'store-count-mass', triggerChange);
    UI.crearListaTiendas('list-delete', 'store-count-delete', triggerChange);
    UI.crearListaTiendas('list-swap', 'store-count-swap', triggerChange);
    UI.crearListaTiendas('list-repair', 'store-count-repair', triggerChange);
    UI.crearListaTiendas('list-api', 'store-count-api', triggerChange);
    UI.crearListaTiendas('list-grupos', 'store-count-grupos', triggerChange)
    UI.crearListaTiendas('list-traspaso', 'store-count-traspaso', triggerChange);

    // Plantillas (Add y Delete manual)
    UI.crearListaTiendas('list-add', 'store-count-add', triggerChange);
    UI.crearListaTiendas('list-del', 'store-count-del', triggerChange);

    UI.renderCustomGroupButtons(aplicarGrupoPersonalizado);
    cargarEstadoFormulario();
    UI.cargarHistorialUI();

    if (document.querySelector('input[name="modo_masivo"]:checked')) toggleModoMasivo();
    if (document.querySelector('input[name="modo_borrar"]:checked')) toggleModoBorrar();
    if (document.querySelector('input[name="modo_swap"]:checked')) toggleModoSwap();

    if (document.querySelector('input[name="modo_p_add"]:checked')) toggleModoPAdd();
    if (document.querySelector('input[name="modo_p_del"]:checked')) toggleModoPDel();

    UI.actualizarContadorArticulosGenerico('articulos_borrar', 'art-count-del');
    UI.actualizarContadorArticulosGenerico('prov-articulos', 'art-count-p-add');
    UI.actualizarContadorArticulosGenerico('prov-articulos-del', 'art-count-p-del');
    UI.actualizarContadorArticulosGenerico('noprov-articulos-del', 'art-count-p-noprov-del');
    UI.actualizarContadorArticulosGenerico('tras-articulos', 'art-count-traspaso');
    UI.actualizarContadorArticulosGenerico('api_articulos', 'art-count-api-arts');

    window.addEventListener('scroll', UI.handleFloatingScrollButton);
    UI.handleFloatingScrollButton();

    // Sincronización cruzada entre pestañas del navegador.
    // OJO: si el usuario está escribiendo en un campo de ESTA pestaña justo cuando
    // OTRA pestaña autoguarda, no debemos pisar lo que está tecleando ahora mismo.
    window.addEventListener('storage', (e) => {
        if (e.key === 'sqlGenState') {
            const activo = document.activeElement ? document.activeElement.tagName : '';
            if (activo === 'TEXTAREA' || activo === 'INPUT') {
                return; // Hay foco en un campo de texto: no recargamos el formulario encima
            }
            cargarEstadoFormulario();
        }
    });

    const savedTabTpvs = localStorage.getItem('sqlGenActiveTabTpvs');
    if (savedTabTpvs) switchTab(savedTabTpvs);

    const savedTabPlantillas = localStorage.getItem('sqlGenActiveTabPlantillas');
    if (savedTabPlantillas) switchTab(savedTabPlantillas);
});

// --- DELEGACIÓN GLOBAL DE EVENTOS ---
document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target.closest) return;

    const queryBox = target.closest('pre.query-box');
    if (queryBox) { UI.copyToClipboard(queryBox.querySelector('code').textContent, queryBox.closest('.accordion-item').querySelector('.copy-btn')); return; }

    if (target.closest('#btn-theme-toggle')) { State.setTheme(UI.toggleTheme()); return; }

    const accHeader = target.closest('.accordion-header');
    if (accHeader) { UI.toggleAccordion(accHeader); return; }

    if (target.classList && target.classList.contains('copy-btn') && target.closest('.action-bar')) {
        if (!target.hasAttribute('onclick')) {
            UI.copyToClipboard(target.closest('.accordion-item').querySelector('code').textContent, target);
        }
        return;
    }

    if (target.classList && target.classList.contains('close-modal')) { UI.closeModal(target.dataset.modal || target.closest('.modal').id); return; }
    if (target.classList && target.classList.contains('modal')) { UI.closeModal(target.id); return; }

    const btn = target.closest('[data-action]');
    if (!btn) return;

    switch (btn.dataset.action) {
        case 'triggerOCR':
            abrirOcrModal(btn.dataset.target);
            break;
        case 'ocrDropZoneClick':
            document.getElementById('ocr-upload-input').click();
            break;
        case 'procesarOcrModal': procesarOcrModal(); break;
        case 'insertarOcrModal': insertarOcrModal(); break;
        case 'abrirConversorTiendas': document.getElementById('inputNumsTienda').value = ''; UI.openModal('conversorModal'); document.getElementById('inputNumsTienda').focus(); break;
        case 'abrirEditorTiendas': abrirEditorTiendas(); break;
        case 'borrarHistorial': if (confirm("¿Borrar historial?")) { State.borrarHistorialLocal(); UI.cargarHistorialUI(); UI.showNotification("Historial borrado."); } break;
        case 'resetearFormulario': if (confirm("¿Resetear todos los campos?")) { State.limpiarEstadoCompleto(); location.reload(); } break;
        case 'exportarConfig': exportarConfig(); break;
        case 'clickImport': document.getElementById('importFile').click(); break;
        case 'procesarPegadoTiendas': procesarPegadoTiendas(); break;
        case 'addNewStoreRow': addStoreEditorRow(); document.querySelector('.editor-table-container').scrollTop = 9999; break;
        case 'restaurarTiendasOriginales':
            if (confirm("¿Volver a original?")) {
                State.restaurarTiendasOriginales();
                State.cargarTiendas(defaultTiendasData);
                repintarTodasLasListasDeTiendas();
                UI.showNotification("✅ Tiendas restauradas al estado original.");
            }
            break;
        case 'guardarTiendasEditadas': guardarTiendasEditadas(); break;
        case 'convertirNumerosAIds': convertirNumerosAIds(); break;
        case 'openGroupManager': openGroupManager(); break;
        case 'deleteGroup': if (confirm(`¿Borrar grupo "${btn.dataset.groupname}"?`)) { State.borrarGrupoCustom(btn.dataset.groupname); UI.renderCustomGroupButtons(aplicarGrupoPersonalizado); openGroupManager(); UI.showNotification("Grupo eliminado."); } break;
        case 'openPasteModal': document.getElementById('pasteModal').dataset.target = btn.dataset.target; document.getElementById('pasteInput').value = ''; UI.openModal('pasteModal'); document.getElementById('pasteInput').focus(); break;
        case 'procesarPegado': procesarPegado(); break;
        case 'aplicarResolucionConflictos': aplicarResolucionConflictos(); break;
        case 'removeClosestTr': btn.closest('tr').remove(); break;
        case 'closeModal': UI.closeModal(btn.dataset.modal || btn.closest('.modal').id); break;
        case 'copyTarget': UI.copyToClipboard(document.getElementById(btn.dataset.copytarget).textContent, btn); break;
        case 'hideElement': document.getElementById(btn.dataset.target).style.display = 'none'; break;
        case 'switchTab': switchTab(btn.dataset.tab); break;
        case 'clearInput': UI.clearInput(btn.dataset.target); document.getElementById(btn.dataset.target).dispatchEvent(new Event('input')); break;
        case 'limpiarErroresExcel': limpiarErroresExcel(btn.dataset.tab); break;
        case 'cambiarPaginaExcel': State.state.excel[btn.dataset.tab].page += parseInt(btn.dataset.dir); UI.renderPreviewTable(btn.dataset.tab); break;
        case 'guardarGrupo': guardarGrupo(btn.dataset.target); break;
        case 'seleccionarVisibles': seleccionarVisibles(btn.dataset.target, btn.dataset.state === 'true'); break;
        case 'toggleVerSeleccionados': toggleVerSeleccionados(btn.dataset.target); break;
        case 'presetSeleccion': presetSeleccion(btn.dataset.target, btn.dataset.type); break;
        case 'copiarSoloIDs': copiarSoloIDs(btn.dataset.target, btn); break;
        case 'descargarSQL': SQL.descargarSQL(btn.dataset.tab); break;
        case 'copiarMasivo': SQL.copiarMasivo(btn); break;
        case 'toggleAllAccordions': UI.toggleAllAccordions(btn); break;
        case 'addSwapRow': addSwapRow(); break;
        case 'removeSwapRow': btn.closest('tr').remove(); guardarEstadoGlobal(); actualizarBadgeSwap(); break;
        case 'abrirApiExcel': document.getElementById('apiExcelModal').style.display = 'flex'; break;
            UI.crearListaTiendas('list-api', 'store-count-api', () => guardarEstadoGlobal());
            break;
        case 'generarApiExcel': ejecutarGeneracionAsincrona(btn, () => SQL.generarApiExcel()); break;

        // --- GENERADORES ASÍNCRONOS ---
        case 'generarSQLMasivo': ejecutarGeneracionAsincrona(btn, () => SQL.generarSQLMasivo()); break;
        case 'generarSQLBorrar': ejecutarGeneracionAsincrona(btn, () => SQL.generarSQLBorrar()); break;
        case 'generarSQLSwap': ejecutarGeneracionAsincrona(btn, () => SQL.generarSQLSwap()); break;
        case 'generarSQLReparar': ejecutarGeneracionAsincrona(btn, () => SQL.generarSQLReparar()); break;
        case 'generarGruposTPV': ejecutarGeneracionAsincrona(btn, () => SQL.generarGruposTPV()); break;

        case 'generarAddPlantillas': ejecutarGeneracionAsincrona(btn, () => SQL.generarAddPlantillas()); break;
        case 'generarDelExcelPlantillas': ejecutarGeneracionAsincrona(btn, () => SQL.generarDelExcelPlantillas()); break;
        case 'generarVaciarPlantillas':
            ejecutarGeneracionAsincrona(btn, () => {
                let codigosRaw = document.getElementById('input-empty').value.match(/\d+/g) || [];
                let resultado = SQL.generarVaciarPlantillas(codigosRaw);

                if (resultado.error) {
                    UI.showNotification(resultado.error);
                } else {
                    SQL.inyectarSQLPlantillas('res-vaciar', 'out-vaciar', resultado.sql);
                    SQL.inyectarSQLPlantillas('res-vaciar', 'out-vaciar-audit', resultado.auditSql);
                    UI.showNotification("✅ Consulta de vaciado generada.");
                }
            });
            break;
        case 'generarUpdateNombrePlantillas': ejecutarGeneracionAsincrona(btn, () => SQL.generarUpdateNombrePlantillas()); break;
        case 'generarConsultaPlantillas': ejecutarGeneracionAsincrona(btn, () => SQL.generarConsultaPlantillas()); break;
        case 'generarTraspasoPlantillas': ejecutarGeneracionAsincrona(btn, () => SQL.generarTraspasoPlantillas()); break;
        case 'swapProveedores':
            let origen = document.getElementById('tras-prov-origen');
            let destino = document.getElementById('tras-prov-destino');
            let temp = origen.value; origen.value = destino.value; destino.value = temp;
            guardarEstadoGlobal();
            break;
    }
});

document.addEventListener('input', (e) => {
    // Redimensionamiento de textareas
    if (e.target.tagName && e.target.tagName.toLowerCase() === 'textarea') {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    }

    // Autoguardado reactivo con Debounce para inputs de texto
    if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number'))) {
        guardadoReactivo();
    }

    const id = e.target.id;
    if (id === 'articulos') { UI.actualizarContadorArticulosGenerico('articulos', 'art-count-mass'); }
    if (id === 'articulos_borrar') { UI.actualizarContadorArticulosGenerico('articulos_borrar', 'art-count-del'); }
    if (id === 'tras-articulos') { UI.actualizarContadorArticulosGenerico('tras-articulos', 'art-count-traspaso'); }
    if (id === 'prov-articulos') { UI.actualizarContadorArticulosGenerico('prov-articulos', 'art-count-p-add'); }
    if (id === 'prov-articulos-del') { UI.actualizarContadorArticulosGenerico('prov-articulos-del', 'art-count-p-del'); }
    if (id === 'noprov-articulos-del') { UI.actualizarContadorArticulosGenerico('noprov-articulos-del', 'art-count-p-noprov-del'); }
    if (id === 'api_articulos') { UI.actualizarContadorArticulosGenerico('api_articulos', 'art-count-api-arts'); }

    if (id === 'articulos_excel') { procesarExcel('mass'); guardarEstadoGlobal(); }
    if (id === 'articulos_excel_del') { procesarExcel('del'); guardarEstadoGlobal(); }
    if (id === 'articulos_excel_swap') { procesarExcel('swap'); guardarEstadoGlobal(); }

    if (id === 'paste-add') { procesarExcel('p_add'); guardarEstadoGlobal(); }
    if (id === 'paste-del') { procesarExcel('p_del'); guardarEstadoGlobal(); }
    if (id === 'paste-upd') { procesarExcel('p_upd'); guardarEstadoGlobal(); }

    if (id === 'articulos_swap') { actualizarBadgeSwap(); }
    if (e.target.classList && e.target.classList.contains('editor-input')) { e.target.style.borderColor = ''; e.target.style.backgroundColor = ''; }
});

document.addEventListener('change', (e) => {
    // === LÓGICA INTELIGENTE PARA LA PESTAÑA DE GRUPOS ===
    if (e.target.id === 'tpv-accion' || e.target.id === 'tpv-nivel') {
        const accion = document.getElementById('tpv-accion').value;
        const nivel = document.getElementById('tpv-nivel').value;

        // Ocultar los campos de "Grupo Padre" si estamos en Macrogrupo o si estamos Eliminando
        const wrapCampos = document.getElementById('wrap-campos-grupo');
        if (nivel === 'GRUPO' && accion !== 'DELETE') {
            wrapCampos.style.display = 'flex';
        } else {
            wrapCampos.style.display = 'none';
        }

        // Bloquear Nombre y Descripción si la acción es Eliminar
        const isDelete = (accion === 'DELETE');
        document.getElementById('tpv-nombre').disabled = isDelete;
        document.getElementById('tpv-desc').disabled = isDelete;

        if (isDelete) {
            document.getElementById('tpv-nombre').value = '';
            document.getElementById('tpv-desc').value = '';
            document.getElementById('tpv-nombre').placeholder = 'No se necesita para borrar';
            document.getElementById('tpv-desc').placeholder = 'No se necesita para borrar';
        } else {
            document.getElementById('tpv-nombre').placeholder = 'Ej: Helados Artesanos';
            document.getElementById('tpv-desc').placeholder = 'Vacío = Usa Front Office';
        }
        guardarEstadoGlobal();
    }

    if (e.target.name === 'modo_p_add') toggleModoPAdd();
    if (e.target.name === 'modo_p_del') toggleModoPDel();

    if (e.target.name === 'modo_masivo') toggleModoMasivo();
    if (e.target.name === 'modo_borrar') toggleModoBorrar();
    if (e.target.name === 'modo_swap') toggleModoSwap();
    if (e.target.name === 'posicion_insercion') guardarEstadoGlobal();

    if (e.target.id === 'tipoBusqueda') { UI.gestionarInputsBusqueda('tipoBusqueda', 'busq2'); guardarEstadoGlobal(); }
    if (e.target.id === 'tipoBusqueda_del') { UI.gestionarInputsBusqueda('tipoBusqueda_del', 'busq2_del'); guardarEstadoGlobal(); }
    if (e.target.id === 'tipoBusqueda_swap') { UI.gestionarInputsBusqueda('tipoBusqueda_swap', 'busq2_swap'); guardarEstadoGlobal(); }
    if (e.target.id === 'tipoBusqueda_repair') { UI.gestionarInputsBusqueda('tipoBusqueda_repair', 'busq2_repair'); guardarEstadoGlobal(); }

    if (['auditGrupoEspecifico', 'auditGrupoEspecificoSwap', 'safeMode', 'safeModePlant', 'campoBusqueda', 'campoBusqueda_del', 'campoBusqueda_swap', 'campoBusqueda_repair'].includes(e.target.id)) guardarEstadoGlobal();
});

let debounceTimer;
document.addEventListener('keyup', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (e.target.id === 'search-excel-mass') buscarExcel('mass', e.target.value);
        if (e.target.id === 'search-excel-del') buscarExcel('del', e.target.value);
        if (e.target.id === 'search-excel-swap') buscarExcel('swap', e.target.value);
        if (e.target.id === 'filter-mass') filtrarTiendas('list-mass', 'filter-mass');
        if (e.target.id === 'filter-delete') filtrarTiendas('list-delete', 'filter-delete');
        if (e.target.id === 'filter-swap') filtrarTiendas('list-swap', 'filter-swap');
        if (e.target.id === 'filter-repair') filtrarTiendas('list-repair', 'filter-repair');
        if (e.target.id === 'filter-grupos') filtrarTiendas('list-grupos', 'filter-grupos');

        if (e.target.id === 'filter-add') filtrarTiendas('list-add', 'filter-add');
        if (e.target.id === 'filter-del') filtrarTiendas('list-del', 'filter-del');
        if (e.target.id === 'filter-api') filtrarTiendas('list-api', 'filter-api');

        if (e.target.id === 'search-excel-p_add') buscarExcel('p_add', e.target.value);
        if (e.target.id === 'search-excel-p_del') buscarExcel('p_del', e.target.value);
        if (e.target.id === 'search-excel-p_upd') buscarExcel('p_upd', e.target.value);
        if (e.target.id === 'filter-traspaso') filtrarTiendas('list-traspaso', 'filter-traspaso');

    }, 250);
});
document.addEventListener('focusout', (e) => {
    if (e.target.id === 'articulos') limpiarInputArticulos('articulos', 'art-count-mass');
    if (e.target.id === 'articulos_borrar') limpiarInputArticulos('articulos_borrar', 'art-count-del');
    if (e.target.id === 'tras-articulos') limpiarInputArticulos('tras-articulos', 'art-count-traspaso');
    if (e.target.id === 'prov-articulos') limpiarInputArticulos('prov-articulos', 'art-count-p-add');
    if (e.target.id === 'prov-articulos-del') limpiarInputArticulos('prov-articulos-del', 'art-count-p-del');
    if (e.target.id === 'noprov-articulos-del') limpiarInputArticulos('noprov-articulos-del', 'art-count-p-noprov-del');
    if (e.target.id === 'api_articulos') limpiarInputArticulos('api_articulos', 'art-count-api-arts');
});

document.getElementById('importFile').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const config = JSON.parse(e.target.result);

            if (config.tiendas && !Array.isArray(config.tiendas)) throw new Error("Formato de tiendas inválido");
            if (config.grupos && typeof config.grupos !== 'object') throw new Error("Formato de grupos inválido");
            if (config.historial && !Array.isArray(config.historial)) throw new Error("Formato de historial inválido");

            if (config.tiendas) localStorage.setItem('sqlGenStores', JSON.stringify(config.tiendas));
            if (config.grupos) localStorage.setItem('sqlGenCustomGroups', JSON.stringify(config.grupos));
            if (config.historial) localStorage.setItem('sqlGroupHistory', JSON.stringify(config.historial));

            State.cargarTiendas(defaultTiendasData);
            State.cargarGruposPersonalizados();
            State.cargarHistorial();
            repintarTodasLasListasDeTiendas();
            UI.renderCustomGroupButtons(aplicarGrupoPersonalizado);
            UI.cargarHistorialUI();

            UI.showNotification("✅ Configuración cargada con éxito.");
        } catch (err) {
            console.error("Fallo de integridad en importación:", err);
            UI.showNotification("❌ Error: El archivo está corrupto o manipulado.");
        }
    };
    reader.readAsText(file);
    this.value = '';
});

// EVENTOS DE VENTANA GLOBALES
window.addEventListener('beforeunload', function (e) {
    const hayResultados = Array.from(document.querySelectorAll('.output-section')).some(el => el.style.display === 'block');
    if (hayResultados) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('error', (event) => {
    console.error("System Error:", event.error);
    if (window.UI && window.UI.showNotification) {
        window.UI.showNotification(`⚠️ Error crítico interceptado. Revisa la consola.`);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error("Unhandled Promise:", event.reason);
    if (window.UI && window.UI.showNotification) {
        window.UI.showNotification(`⚠️ Error asíncrono detectado. Revisa la consola.`);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        // El click dispara ahora la ejecución asíncrona configurada en el delegador
        const btn = document.querySelector('.app-section.active .tab-content.active .btn-generate:not(.btn-secondary)');
        if (btn) btn.click();
        return;
    }
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const btnDescargar = document.querySelector('.app-section.active .tab-content.active .btn-download');
        if (btnDescargar) btnDescargar.click();
        return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        const btnCopiar = Array.from(document.querySelectorAll('.app-section.active .tab-content.active .btn-secondary')).find(b => b.innerText.includes('Copiar Todo'));
        if (btnCopiar) btnCopiar.click();
        return;
    }

    if (e.key === 'Escape') { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }
    if (e.key === 'Enter') {
        const nextMap = { 'busq1': 'busq2', 'busq2': 'filter-mass', 'busq1_del': 'busq2_del', 'busq2_del': 'filter-delete', 'busq1_swap': 'busq2_swap', 'busq2_swap': 'filter-swap', 'busq1_repair': 'busq2_repair', 'busq2_repair': 'filter-repair' };
        if (nextMap[e.target.id]) { e.preventDefault(); document.getElementById(nextMap[e.target.id]).focus(); }
    }
});
// ==========================================
// 5. MOTOR OCR (TESSERACT.JS)
// ==========================================

// Determina cuántas columnas (Tienda/Artículo/Grupo...) espera el campo destino,
// para que el OCR no mezcle tienda y artículo en una sola lista plana.
function getExpectedColumnsForTarget(targetId) {
    const modoMasivo = document.querySelector('input[name="modo_masivo"]:checked')?.value;
    const modoPAdd = document.querySelector('input[name="modo_p_add"]:checked')?.value;
    const modoPDel = document.querySelector('input[name="modo_p_del"]:checked')?.value;

    switch (targetId) {
        case 'articulos_excel':      return modoMasivo === 'excel_tienda' ? 3 : 2; // Tienda/Art/Grupo o Art/Grupo
        case 'articulos_excel_del':  return 2; // Artículo, Grupo
        case 'articulos_excel_swap': return 2; // ID Viejo, ID Nuevo
        case 'articulos_swap':       return 2; // ID Viejo, ID Nuevo (modo manual)
        case 'paste-add':            return modoPAdd === 'excel_tienda' ? 4 : 3; // Tienda/Art/Stock/Prov o Cod/Art/Stock
        case 'paste-del':            return modoPDel === 'excel_tienda' ? 3 : 2; // Tienda/Art/Prov o Cod/Art
        default:                     return 1; // Listas simples: articulos, prov-articulos, etc.
    }
}

// ==========================================
// MOTOR OCR PERSISTENTE (evita crear/destruir el worker en cada análisis)
// ==========================================
let ocrWorkerPromise = null;

function getOcrWorker() {
    if (!ocrWorkerPromise) {
        ocrWorkerPromise = (async () => {
            const worker = await Tesseract.createWorker();
            await worker.loadLanguage('spa+eng');
            await worker.initialize('spa+eng');
            return worker;
        })().catch(err => {
            ocrWorkerPromise = null; 
            throw err;
        });
    }
    return ocrWorkerPromise;
}

// Si el worker se queda en un estado roto tras un error de reconocimiento,
// lo descartamos para que el siguiente intento cree uno nuevo desde cero.
async function resetOcrWorkerSiCorrupto() {
    try {
        const worker = await ocrWorkerPromise;
        await worker.terminate();
    } catch (e) { /* noop */ }
    ocrWorkerPromise = null;
}

// ==========================================
// PREPROCESADO DE IMAGEN (mejora capturas borrosas o de baja resolución)
// Aplica: escala de grises, estiramiento de contraste y upscale si la imagen es pequeña.
// ==========================================
async function preprocessImageForOCR(file) {
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
    });

    // Si la imagen es pequeña (típico de capturas de WhatsApp comprimidas), la ampliamos
    // para dar más detalle al OCR. Si ya es grande, no la tocamos (máx. x3).
    const MIN_DIMENSION = 1200;
    const scale = Math.min(3, Math.max(1, MIN_DIMENSION / Math.max(img.width, img.height)));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const grays = new Float32Array(w * h);
    let min = 255, max = 0;

    // 1) Escala de grises (luminancia)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grays[p] = gray;
        if (gray < min) min = gray;
        if (gray > max) max = gray;
    }

    // 2) Estiramiento de contraste (normaliza el rango real de grises a 0-255)
    //    más un refuerzo adicional para que el texto quede más nítido frente al fondo.
    const range = Math.max(1, max - min);
    const contrastBoost = 1.35;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        let v = ((grays[p] - min) / range) * 255;
        v = ((v - 128) * contrastBoost) + 128;
        v = v < 0 ? 0 : (v > 255 ? 255 : v);
        data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

// Extrae el número "correcto" de una línea cuando hay varios candidatos, en vez de
// asumir siempre que el código es el primer número que aparece. Usa el contexto
// disponible (tiendas conocidas, longitud típica de artículo) para decidir.
function extraerNumeroDeLinea(line, modo, idsTiendasConocidas) {
    const nums = line.match(/\d+/g) || [];
    if (nums.length === 0) return null;
    if (nums.length === 1) return { valor: nums[0], seguro: true };

    if (modo === 'tiendas') {
        const conocidos = nums.filter(n => idsTiendasConocidas.has(n));
        if (conocidos.length === 1) return { valor: conocidos[0], seguro: true };
    } else {
        // Artículos: en el resto de la app un código válido tiene entre 3 y 6 dígitos.
        const validos = nums.filter(n => n.length >= 3 && n.length <= 6);
        if (validos.length === 1) return { valor: validos[0], seguro: true };
    }

    // Ambiguo (p. ej. "35  ART 12345"): no asumimos posición, cogemos el primero
    // pero lo marcamos para que el usuario lo revise antes de insertar.
    return { valor: nums[0], seguro: false };
}

// ==========================================
// ESTADO DEL MODAL OCR
// ==========================================
let ocrModal = { targetId: null, imageFile: null, rows: [], cols: 1 };

// Determina si el campo destino es una TABLA EXCEL de Tienda+Artículo (2-4 columnas)
// o una lista plana de artículos con selector de tiendas aparte (checkboxes).
function targetEsTablaExcelTienda(targetId) {
    if (!['articulos_excel', 'paste-add', 'paste-del'].includes(targetId)) return false;
    const radioName = targetId === 'articulos_excel' ? 'modo_masivo' : (targetId === 'paste-add' ? 'modo_p_add' : 'modo_p_del');
    return document.querySelector(`input[name="${radioName}"]:checked`)?.value === 'excel_tienda';
}

// Abre el popup de escaneo para un campo concreto, preseleccionando el modo más lógico
function abrirOcrModal(targetId) {
    ocrModal = { targetId, imageFile: null, rows: [], cols: getExpectedColumnsForTarget(targetId) };

    document.getElementById('ocr-preview-img').style.display = 'none';
    document.getElementById('ocr-preview-img').src = '';
    document.getElementById('ocr-drop-placeholder').style.display = 'block';
    document.getElementById('ocr-result-preview').style.display = 'none';
    document.getElementById('ocr-result-note').style.display = 'none';
    document.getElementById('btn-ocr-insertar').style.display = 'none';
    document.getElementById('btn-ocr-procesar').style.display = 'inline-block';
    document.getElementById('btn-ocr-procesar').disabled = false;
    document.getElementById('btn-ocr-procesar').innerText = '🔎 Analizar Imagen';

    // Preselecciona el radio más lógico según el campo de destino, pero el usuario puede cambiarlo
    let modoSugerido = 'articulos';
    if (targetId === 'pasteInput') modoSugerido = 'tiendas';
    else if (ocrModal.cols >= 2) {
        modoSugerido = targetEsTablaExcelTienda(targetId) ? 'ambos' : 'articulos';
    }
    const radio = document.querySelector(`input[name="ocr_modo"][value="${modoSugerido}"]`);
    if (radio) radio.checked = true;

    UI.openModal('ocrModal');
    document.getElementById('ocr-drop-zone').focus();
}

// Guarda la imagen (subida o pegada) en el estado del modal y la previsualiza, sin tocar aún el campo real
function setOcrModalImage(file) {
    if (!file) return;
    ocrModal.imageFile = file;
    const img = document.getElementById('ocr-preview-img');
    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
    document.getElementById('ocr-drop-placeholder').style.display = 'none';
    document.getElementById('ocr-result-preview').style.display = 'none';
    document.getElementById('btn-ocr-insertar').style.display = 'none';
}

// Analiza la imagen guardada: extrae números por línea y, en modo "ambos", detecta
// automáticamente cuál de los dos números es una tienda conocida y cuál un artículo.
async function procesarOcrModal() {
    if (!ocrModal.imageFile) {
        UI.showNotification("⚠️ Primero pega o sube una captura.");
        return;
    }
    const modo = document.querySelector('input[name="ocr_modo"]:checked')?.value || 'articulos';
    const btn = document.getElementById('btn-ocr-procesar');
    btn.disabled = true;
    btn.innerText = '🖼️ Mejorando imagen...';

    try {
        // 1) Preprocesado: escala de grises + contraste + upscale (ayuda con fotos borrosas o de baja resolución)
        const preprocessedImage = await preprocessImageForOCR(ocrModal.imageFile);

        btn.innerText = '⏳ Analizando con IA...';

        // 2) Motor OCR reutilizable: no se crea un worker nuevo en cada análisis
        const worker = await getOcrWorker();
        const result = await worker.recognize(preprocessedImage);
        const text = result.data.text;
        const idsTiendasConocidas = new Set((State.state.tiendasData || []).map(t => String(t.id)));

        let rows = [];
        let note = '';

        if (modo === 'ambos') {
            // Cada línea debe aportar (al menos) 2 números: uno es tienda, otro artículo
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            let dudosas = 0;
            lines.forEach(line => {
                const nums = line.match(/\d+/g) || [];
                if (nums.length < 2) return;
                const [a, b] = nums;
                let tienda, articulo, seguro = true;
                if (idsTiendasConocidas.has(a) && !idsTiendasConocidas.has(b)) { tienda = a; articulo = b; }
                else if (idsTiendasConocidas.has(b) && !idsTiendasConocidas.has(a)) { tienda = b; articulo = a; }
                else { tienda = a; articulo = b; seguro = false; dudosas++; } // sin coincidencia clara: orden por defecto
                rows.push({ tienda, articulo, seguro });
            });
            if (dudosas > 0) note = `⚠️ ${dudosas} fila(s) no coincidían con ninguna tienda conocida: se han dejado en el orden leído (Tienda, Artículo). Revísalas antes de insertar.`;
        } else {
            // Solo artículos o solo tiendas: un número por línea, sin asumir que el código
            // es siempre el primer número que aparece en ella.
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            let dudosas = 0;
            lines.forEach(line => {
                const r = extraerNumeroDeLinea(line, modo, idsTiendasConocidas);
                if (!r) return;
                if (!r.seguro) dudosas++;
                rows.push(r);
            });
            if (dudosas > 0) note = `⚠️ ${dudosas} fila(s) tenían varios números y no se pudo identificar el código con total seguridad: se ha cogido el primero. Revísalas antes de insertar.`;
        }

        ocrModal.rows = rows;
        pintarPreviewOcrModal(modo, note);

        if (rows.length === 0) {
            UI.showNotification("⚠️ OCR: No se detectaron números claros en la imagen.");
        }
    } catch (error) {
        console.error("Error en motor OCR:", error);
        UI.showNotification("❌ Error crítico procesando la imagen.");
        // Si el worker ha quedado en un estado inconsistente, lo descartamos para
        // que el próximo intento arranque uno limpio en vez de repetir el mismo fallo.
        await resetOcrWorkerSiCorrupto();
    } finally {
        btn.disabled = false;
        btn.innerText = '🔎 Analizar Imagen';
    }
}

function pintarPreviewOcrModal(modo, note) {
    const box = document.getElementById('ocr-result-preview');
    const table = document.getElementById('ocr-result-table');
    const noteEl = document.getElementById('ocr-result-note');
    const btnInsertar = document.getElementById('btn-ocr-insertar');

    if (ocrModal.rows.length === 0) { box.style.display = 'none'; btnInsertar.style.display = 'none'; return; }

    if (modo === 'ambos') {
        table.innerHTML = '<thead><tr><th>Tienda</th><th>Artículo</th><th></th></tr></thead><tbody>' +
            ocrModal.rows.map(r => `<tr>
                <td>${r.tienda}</td>
                <td>${r.articulo}</td>
                <td>${r.seguro ? '✅' : '⚠️ revisar'}</td>
            </tr>`).join('') + '</tbody>';
    } else {
        table.innerHTML = `<thead><tr><th>${modo === 'tiendas' ? 'Tienda' : 'Artículo'}</th><th></th></tr></thead><tbody>` +
            ocrModal.rows.map(r => `<tr><td>${r.valor}</td><td>${r.seguro === false ? '⚠️ revisar' : '✅'}</td></tr>`).join('') + '</tbody>';
    }

    box.style.display = 'block';
    if (note) { noteEl.textContent = note; noteEl.style.display = 'block'; } else { noteEl.style.display = 'none'; }
    btnInsertar.style.display = 'inline-block';
}

// Inserta lo revisado en el campo real (append, nunca borra lo que ya había).
// En modo "ambos": si el destino es una tabla Excel real, se escriben los pares
// tienda+articulo; si es una lista plana de artículos, se marcan las tiendas en
// su selector (si se encuentra uno en la misma pestaña) y solo se insertan los
// códigos de artículo, sin duplicados.
function insertarOcrModal() {
    const targetEl = document.getElementById(ocrModal.targetId);
    if (!targetEl || ocrModal.rows.length === 0) return;

    const modo = document.querySelector('input[name="ocr_modo"]:checked')?.value || 'articulos';
    let lines = [];

    if (modo === 'ambos') {
        if (targetEsTablaExcelTienda(ocrModal.targetId)) {
            lines = ocrModal.rows.map(r => `${r.tienda}\t${r.articulo}`);
        } else {
            const storeList = targetEl.closest('.tab-content')?.querySelector('.store-list');
            if (storeList) {
                const tiendasUnicas = [...new Set(ocrModal.rows.map(r => r.tienda))];
                aplicarGrupoPersonalizado(storeList.id, tiendasUnicas);
            } else {
                UI.showNotification("⚠️ No se ha encontrado un selector de tiendas en esta pestaña: revisa las tiendas manualmente.");
            }
            lines = [...new Set(ocrModal.rows.map(r => r.articulo))];
        }
    } else {
        lines = ocrModal.rows.map(r => r.valor);
    }

    const originalValue = targetEl.value;
    targetEl.value = (originalValue ? originalValue + '\n' : '') + lines.join('\n');
    targetEl.dispatchEvent(new Event('input'));
    targetEl.dispatchEvent(new Event('focusout'));

    UI.showNotification(`✅ Insertadas ${lines.length} fila(s) en el campo.`);
    UI.closeModal('ocrModal');
}

// Disparador por botón (subir archivo manual / cámara en móvil) — SIEMPRE alimenta el modal, nunca el campo directo
document.getElementById('ocr-upload-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    setOcrModalImage(file);
    this.value = ''; // Resetear input para permitir subir la misma foto otra vez
});

// Disparador por portapapeles (Ctrl+V) — solo actúa si el modal OCR está abierto,
// para no interferir nunca con lo que el usuario esté escribiendo a mano en los campos.
document.addEventListener('paste', function(e) {
    const modalEl = document.getElementById('ocrModal');
    if (!modalEl || modalEl.style.display !== 'flex') return;

    const items = (e.clipboardData || window.clipboardData).items;
    let imageFile = null;
    for (let item of items) {
        if (item.type.indexOf('image') === 0) { imageFile = item.getAsFile(); break; }
    }
    if (imageFile) {
        e.preventDefault();
        setOcrModalImage(imageFile);
    }
});