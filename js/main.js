// js/main.js
import { defaultTiendasData, excepcionesTiendas } from './data.js';
import * as State from './state.js';
import * as UI from './ui.js';
import * as SQL from './sql.js';
import * as Parser from './excelParser.js';

// ==========================================
// 1. GESTIÓN DE ESTADO LOCAL (Formulario)
// ==========================================
function buildStateObj() {
    return {
        modo_masivo: document.querySelector('input[name="modo_masivo"]:checked')?.value || 'simple',
        modo_borrar: document.querySelector('input[name="modo_borrar"]:checked')?.value || 'simple',
        modo_swap: document.querySelector('input[name="modo_swap"]:checked')?.value || 'simple',
        
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
        pasteUpd: document.getElementById('paste-upd')?.value || ''
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
    setVal('articulos', s.articulos); setVal('articulos_excel', s.articulos_excel);
    setVal('articulos_borrar', s.articulos_borrar); setVal('articulos_excel_del', s.articulos_excel_del);
    setVal('articulos_excel_swap', s.articulos_excel_swap);

    if(s.modo_masivo) { const r = document.querySelector(`input[name="modo_masivo"][value="${s.modo_masivo}"]`); if(r) { r.checked = true; toggleModoMasivo(); } }
    if(s.modo_borrar) { const r = document.querySelector(`input[name="modo_borrar"][value="${s.modo_borrar}"]`); if(r) { r.checked = true; toggleModoBorrar(); } }
    if(s.modo_swap) { const r = document.querySelector(`input[name="modo_swap"][value="${s.modo_swap}"]`); if(r) { r.checked = true; toggleModoSwap(); } }

    setVal('busq1', s.busq1); setVal('busq2', s.busq2); setVal('filter-mass', s.filter_mass); if(s.filter_mass) filtrarTiendas('list-mass', 'filter-mass');
    setVal('busq1_del', s.busq1_del); setVal('busq2_del', s.busq2_del); setVal('filter-delete', s.filter_delete); if(s.filter_delete) filtrarTiendas('list-delete', 'filter-delete');
    setVal('busq1_swap', s.busq1_swap); setVal('busq2_swap', s.busq2_swap); setVal('filter-swap', s.filter_swap); if(s.filter_swap) filtrarTiendas('list-swap', 'filter-swap');
    setVal('busq1_repair', s.busq1_repair); setVal('busq2_repair', s.busq2_repair); setVal('filter-repair', s.filter_repair); if(s.filter_repair) filtrarTiendas('list-repair', 'filter-repair');

    setCheck('auditGrupoEspecifico', s.auditGrupoEspecifico); setCheck('auditGrupoEspecificoSwap', s.auditGrupoEspecificoSwap);
    setCheck('safeMode', s.safeMode); setCheck('safeModePlant', s.safeModePlant);
    
    if(s.tipoBusqueda) { setVal('tipoBusqueda', s.tipoBusqueda); UI.gestionarInputsBusqueda('tipoBusqueda', 'busq2'); } setVal('campoBusqueda', s.campoBusqueda);
    if(s.tipoBusqueda_del) { setVal('tipoBusqueda_del', s.tipoBusqueda_del); UI.gestionarInputsBusqueda('tipoBusqueda_del', 'busq2_del'); } setVal('campoBusqueda_del', s.campoBusqueda_del);
    if(s.tipoBusqueda_swap) { setVal('tipoBusqueda_swap', s.tipoBusqueda_swap); UI.gestionarInputsBusqueda('tipoBusqueda_swap', 'busq2_swap'); } setVal('campoBusqueda_swap', s.campoBusqueda_swap);
    if(s.tipoBusqueda_repair) { setVal('tipoBusqueda_repair', s.tipoBusqueda_repair); UI.gestionarInputsBusqueda('tipoBusqueda_repair', 'busq2_repair'); } setVal('campoBusqueda_repair', s.campoBusqueda_repair);

    // Plantillas
    setVal('paste-add', s.pasteAdd); setVal('prov-nombre', s.provNombre); setVal('prov-stock', s.provStock); setVal('prov-articulos', s.provArts);
    if(s.modo_p_add) { const r = document.querySelector(`input[name="modo_p_add"][value="${s.modo_p_add}"]`); if(r) { r.checked = true; toggleModoPAdd(); } }
    
    setVal('paste-del', s.pasteDel); setVal('prov-nombre-del', s.provNombreDel); setVal('prov-articulos-del', s.provArtsDel);
    if(s.modo_p_del) { const r = document.querySelector(`input[name="modo_p_del"][value="${s.modo_p_del}"]`); if(r) { r.checked = true; toggleModoPDel(); } }

    setVal('input-empty', s.inputEmpty); setVal('cons-prov', s.consProv); setVal('cons-clientes', s.consClientes); setVal('paste-upd', s.pasteUpd);
}

// ==========================================
// 2. LÓGICA DE UI Y EXCEL (Unificada)
// ==========================================
function switchTab(tabId) {
    const targetTab = document.getElementById(tabId);
    if(!targetTab) return;
    const parentApp = targetTab.closest('.app-section');
    
    parentApp.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    parentApp.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    targetTab.classList.add('active');
    const btn = parentApp.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if(btn) btn.classList.add('active');

    if(parentApp.id === 'app-tpvs') {
        localStorage.setItem('sqlGenActiveTabTpvs', tabId);
    } else {
        localStorage.setItem('sqlGenActiveTabPlantillas', tabId);
    }
}

function toggleModoMasivo() {
    let isExcel = document.querySelector('input[name="modo_masivo"]:checked').value === 'excel';
    document.getElementById('wrap-modo-simple-mass').style.display = isExcel ? 'none' : 'block';
    document.getElementById('wrap-modo-excel-mass').style.display = isExcel ? 'block' : 'none';
    let secConfigGrupo = document.getElementById('sec-config-grupo-mass');
    if (isExcel) { secConfigGrupo.classList.add('disabled-section'); procesarExcel('mass'); } 
    else { secConfigGrupo.classList.remove('disabled-section'); UI.actualizarContadorArticulosGenerico('articulos', 'art-count-mass'); }
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

    switch(modo) {
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
            wrapStores.style.display = 'block'; // Activar selector de tiendas
            break;
    }
    
    if(modo.includes('excel')) procesarExcel('p_add');
    guardarEstadoGlobal();
}
function toggleModoPDel() {
    let modo = document.querySelector('input[name="modo_p_del"]:checked')?.value || 'excel_cod';
    let wrapExcel = document.getElementById('wrap-excel-del');
    let wrapManual = document.getElementById('wrap-manual-del');
    let wrapStores = document.getElementById('wrap-stores-del');

    let label = document.getElementById('label-paste-del');
    let textarea = document.getElementById('paste-del');
    let thead = document.getElementById('thead-p_del');

    if (modo === 'excel_tienda') {
        wrapExcel.style.display = 'block'; wrapManual.style.display = 'none'; wrapStores.style.display = 'none';
        label.innerText = "Pegar celdas de Excel (nº tienda, articulo, proveedor):";
        textarea.placeholder = "tienda\tarticulo\tproveedor\n71\t48727\tFrio";
        thead.innerHTML = "<tr><th>Nº Tienda</th><th>ID Artículo</th><th>Proveedor</th></tr>";
        procesarExcel('p_del');
    } else if (modo === 'excel_cod') {
        wrapExcel.style.display = 'block'; wrapManual.style.display = 'none'; wrapStores.style.display = 'none';
        label.innerText = "Pegar celdas de Excel (codigo plantilla, articulo):";
        textarea.placeholder = "codigo\tarticulo\n1475\t48727";
        thead.innerHTML = "<tr><th>Cód Plantilla</th><th>ID Artículo</th></tr>";
        procesarExcel('p_del');
    } else if (modo === 'manual') {
        wrapExcel.style.display = 'none'; wrapManual.style.display = 'block'; wrapStores.style.display = 'block';
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

    if(!raw.trim()) {
        if(badge) { badge.textContent = tab === 'swap' ? '0 pares' : '0 artículos'; badge.classList.remove('active'); }
        textarea.style.backgroundColor = "";
        if(previewBox) previewBox.style.display = "none";
        UI.renderPreviewTable(tab); return;
    }

    if(badge) { badge.textContent = result.data.length + (tab === 'swap' ? ' pares (Excel)' : ' artículos (Excel)'); badge.classList.add('active'); }

    if(result.conflictsFound) { textarea.style.backgroundColor = "rgba(241, 196, 15, 0.1)"; if(badge) badge.innerText += " (⚠️ Conflictos)"; } 
    else if(result.errors) { textarea.style.backgroundColor = "rgba(231, 76, 60, 0.05)"; if(badge) badge.innerText += " (⚠️ Errores)"; } 
    else { textarea.style.backgroundColor = ""; }

    if(result.data.length > 0) {
        if(previewBox) previewBox.style.display = "block";
        UI.renderPreviewTable(tab);
        if (['mass','del'].includes(tab)) {
            let validRows = result.data.filter(d => d.valid && !d.duplicate);
            if(validRows.length > 0) {
                let isAllNumeric = validRows.every(d => /^\d+$/.test(d.grp.trim()));
                let selectCampo = document.getElementById(idCampoBusqueda);
                let tipoDetectado = isAllNumeric ? 'id' : 'nombre';
                if (selectCampo.value !== tipoDetectado) {
                    selectCampo.value = tipoDetectado;
                    selectCampo.style.backgroundColor = "#e8f5e9"; selectCampo.style.borderColor = "#28a745";
                    setTimeout(() => { selectCampo.style.backgroundColor = ""; selectCampo.style.borderColor = ""; }, 1500);
                    UI.showNotification(`🤖 Autodetección: Búsqueda por ${tipoDetectado === 'id' ? 'ID' : 'Nombre'} de Grupo`);
                }
            }
        }
    } else {
        if(previewBox) previewBox.style.display = "none";
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
    if (hasConflicts && ['mass','del'].includes(tab)) { abrirModalConflictos(tab); } 
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

function limpiarInputArticulos(id) {
    let textarea = document.getElementById(id);
    let raw = textarea.value;
    let cleanArray = raw.split(/[\r\n]+/).map(line => { let match = line.match(/^\s*(\d+)/); return match ? match[1] : ''; }).filter(s => s !== '');
    let uniqueArray = [...new Set(cleanArray)];
    if (cleanArray.length !== uniqueArray.length) UI.showNotification(`⚠️ Se eliminaron ${cleanArray.length - uniqueArray.length} duplicados.`);
    let cleanText = uniqueArray.join('\n');
    if (raw !== cleanText) {
        textarea.value = cleanText;
        UI.actualizarContadorArticulosGenerico(id, (id === 'articulos') ? 'art-count-mass' : 'art-count-del');
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
    const filterVal = document.querySelector(`#${containerId.replace('list','filter')}`).value.toUpperCase();
    
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
    if(selected.length === 0) { UI.showNotification("¡Marca tiendas primero!"); return; }
    const name = prompt("Nombre para este grupo de tiendas:");
    if(!name) return;
    State.guardarGrupoCustom(name, Array.from(selected).map(cb => cb.value));
    UI.renderCustomGroupButtons(aplicarGrupoPersonalizado);
    UI.showNotification(`✅ Grupo "${name}" guardado.`);
}

function openGroupManager() {
    const list = document.getElementById('groupManagerList'); list.innerHTML = '';
    if(Object.keys(State.state.customGroups).length === 0) {
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
        if(idsToSelect.includes(cb.value) && !cb.checked) { cb.checked = true; count++; }
    });
    if(count > 0) { 
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
    if(numbers.length === 0) { UI.showNotification("¡Introduce números de tienda!"); return; }
    
    let foundIds = []; let notFound = [];

    numbers.forEach(num => {
        const cleanNum = num.trim(); let targetId = excepcionesTiendas[cleanNum] || null; 
        if (!targetId) {
            const store = State.state.tiendasData.find(t => t.id === cleanNum || new RegExp(`^${cleanNum}(\\D|$)`).test(t.name) || new RegExp(`\\D${cleanNum}(\\D|$)`).test(t.name));
            if (store) targetId = store.id;
        }
        if(targetId) { if(!foundIds.includes(targetId)) foundIds.push(targetId); } else { notFound.push(cleanNum); }
    });

    document.getElementById('resultadoConversor').style.display = 'block';
    document.getElementById('outputIdsDb').textContent = foundIds.join(',');
    const logDiv = document.getElementById('logConversor');
    if(notFound.length > 0) { logDiv.style.color = "#c0392b"; logDiv.style.background = "rgba(192, 57, 43, 0.1)"; logDiv.innerHTML = `✅ Encontrados: ${foundIds.length} | ⚠️ No encontrados: ${notFound.join(', ')}`; } 
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
    tr.innerHTML = `<td><input type="text" value="${id}" placeholder="Ej: 6603" class="editor-input"></td>
        <td><input type="text" value="${name}" placeholder="Ej: 71 - CALLE DEL MAR"></td>
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
        if(id || name) {
            if (!id || seenIds.has(id)) {
                UI.showNotification(!id ? "⚠️ Error: Hay una tienda sin ID." : `⚠️ Error: El ID ${id} está repetido.`);
                hasError = true; inputs[0].style.borderColor = "#e74c3c"; inputs[0].style.backgroundColor = "rgba(231, 76, 60, 0.05)";
            } else { seenIds.add(id); newStores.push({ id: id, name: name || `Tienda ${id}` }); }
        }
    });
    if (hasError) return;
    if(newStores.length > 0) { 
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
    tr.innerHTML = `<td><input type="text" placeholder="ID Viejo" value="${oldVal}" class="swap-input"></td>
        <td><input type="text" placeholder="ID Nuevo" value="${newVal}" class="swap-input"></td>
        <td><button class="btn-remove-row" data-action="removeSwapRow">X</button></td>`;
    document.getElementById('swap-rows').appendChild(tr);
    actualizarBadgeSwap();
}

function actualizarBadgeSwap() {
    if (document.querySelector('input[name="modo_swap"]:checked').value === 'simple') {
        document.getElementById('art-count-swap-badge').textContent = document.querySelectorAll('#swap-rows tr').length + ' pares';
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
    UI.crearListaTiendas('list-add', 'store-count-add', triggerChange);
    UI.crearListaTiendas('list-del', 'store-count-del', triggerChange);
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
    if (document.getElementById('swap-rows').children.length === 0) addSwapRow();
    
    window.addEventListener('scroll', UI.handleFloatingScrollButton);
    UI.handleFloatingScrollButton();

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
        case 'abrirConversorTiendas': document.getElementById('inputNumsTienda').value = ''; UI.openModal('conversorModal'); document.getElementById('inputNumsTienda').focus(); break;
        case 'abrirEditorTiendas': abrirEditorTiendas(); break;
        case 'borrarHistorial': if(confirm("¿Borrar historial?")) { State.borrarHistorialLocal(); UI.cargarHistorialUI(); UI.showNotification("Historial borrado."); } break;
        case 'resetearFormulario': if(confirm("¿Resetear todos los campos?")) { State.limpiarEstadoCompleto(); location.reload(); } break;
        case 'exportarConfig': exportarConfig(); break;
        case 'clickImport': document.getElementById('importFile').click(); break;
        case 'procesarPegadoTiendas': procesarPegadoTiendas(); break;
        case 'addNewStoreRow': addStoreEditorRow(); document.querySelector('.editor-table-container').scrollTop = 9999; break;
        case 'restaurarTiendasOriginales': 
            if(confirm("¿Volver a original?")) { 
        State.restaurarTiendasOriginales(); 
        State.cargarTiendas(defaultTiendasData); 
        repintarTodasLasListasDeTiendas();       
        UI.showNotification("✅ Tiendas restauradas al estado original.");
        } 
        break;
        case 'guardarTiendasEditadas': guardarTiendasEditadas(); break;
        case 'convertirNumerosAIds': convertirNumerosAIds(); break;
        case 'openGroupManager': openGroupManager(); break;
        case 'deleteGroup': if(confirm(`¿Borrar grupo "${btn.dataset.groupname}"?`)) { State.borrarGrupoCustom(btn.dataset.groupname); UI.renderCustomGroupButtons(aplicarGrupoPersonalizado); openGroupManager(); UI.showNotification("Grupo eliminado."); } break;
        case 'openPasteModal': document.getElementById('pasteModal').dataset.target = btn.dataset.target; document.getElementById('pasteInput').value=''; UI.openModal('pasteModal'); document.getElementById('pasteInput').focus(); break;
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

        // Generadores
        case 'generarSQLMasivo': SQL.generarSQLMasivo(); break;
        case 'generarSQLBorrar': SQL.generarSQLBorrar(); break;
        case 'generarSQLSwap': SQL.generarSQLSwap(); break;
        case 'generarSQLReparar': SQL.generarSQLReparar(); break;
        
        case 'generarAddPlantillas': SQL.generarAddPlantillas(); break;
        case 'generarDelExcelPlantillas': SQL.generarDelExcelPlantillas(); break;
        case 'generarVaciarPlantillas': 
            let codigosRaw = document.getElementById('input-empty').value.match(/\d+/g) || [];
            let resultado = SQL.generarVaciarPlantillas(codigosRaw);
            
            if (resultado.error) {
                UI.showNotification(resultado.error);
            } else {
                SQL.inyectarSQLPlantillas('res-vaciar', 'out-vaciar', resultado.sql);
                SQL.inyectarSQLPlantillas('res-vaciar', 'out-vaciar-audit', resultado.auditSql);
                UI.showNotification("✅ Consulta de vaciado generada.");
            }
            break;
        case 'generarUpdateNombrePlantillas': SQL.generarUpdateNombrePlantillas(); break;
        case 'generarConsultaPlantillas': SQL.generarConsultaPlantillas(); break;
    }
});

document.addEventListener('input', (e) => {
    if (e.target.tagName && e.target.tagName.toLowerCase() === 'textarea') {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    }

    const id = e.target.id;
    if (id === 'articulos') { UI.actualizarContadorArticulosGenerico('articulos', 'art-count-mass'); guardarEstadoGlobal(); }
    if (id === 'articulos_borrar') { UI.actualizarContadorArticulosGenerico('articulos_borrar', 'art-count-del'); guardarEstadoGlobal(); }
    
    if (id === 'articulos_excel') { procesarExcel('mass'); guardarEstadoGlobal(); }
    if (id === 'articulos_excel_del') { procesarExcel('del'); guardarEstadoGlobal(); }
    if (id === 'articulos_excel_swap') { procesarExcel('swap'); guardarEstadoGlobal(); }
    
    if (id === 'paste-add') { procesarExcel('p_add'); guardarEstadoGlobal(); }
    if (id === 'paste-del') { procesarExcel('p_del'); guardarEstadoGlobal(); }
    if (id === 'paste-upd') { procesarExcel('p_upd'); guardarEstadoGlobal(); }

    if (id && (id.startsWith('busq') || id.startsWith('prov-nombre'))) guardarEstadoGlobal();
    if (e.target.classList && e.target.classList.contains('swap-input')) { guardarEstadoGlobal(); actualizarBadgeSwap(); }
    if (e.target.classList && e.target.classList.contains('editor-input')) { e.target.style.borderColor=''; e.target.style.backgroundColor=''; }
});

document.addEventListener('change', (e) => {
    if (e.target.name === 'modo_p_add') toggleModoPAdd();
    if (e.target.name === 'modo_p_del') toggleModoPDel();
    
    if (e.target.name === 'modo_masivo') toggleModoMasivo();
    if (e.target.name === 'modo_borrar') toggleModoBorrar();
    if (e.target.name === 'modo_swap') toggleModoSwap();
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
        
        if (e.target.id === 'filter-add') filtrarTiendas('list-add', 'filter-add');
        if (e.target.id === 'filter-del') filtrarTiendas('list-del', 'filter-del');
        
        if (e.target.id === 'search-excel-p_add') buscarExcel('p_add', e.target.value);
        if (e.target.id === 'search-excel-p_del') buscarExcel('p_del', e.target.value);
        if (e.target.id === 'search-excel-p_upd') buscarExcel('p_upd', e.target.value);
    }, 250);
});

document.addEventListener('focusout', (e) => {
    if (e.target.id === 'articulos') limpiarInputArticulos('articulos');
    if (e.target.id === 'articulos_borrar') limpiarInputArticulos('articulos_borrar');
});

document.getElementById('importFile').addEventListener('change', function() {
    const file = this.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            if(config.tiendas) localStorage.setItem('sqlGenStores', JSON.stringify(config.tiendas));
            if(config.grupos) localStorage.setItem('sqlGenCustomGroups', JSON.stringify(config.grupos));
            if(config.historial) localStorage.setItem('sqlGroupHistory', JSON.stringify(config.historial));
            
            State.cargarTiendas(defaultTiendasData);
            State.cargarGruposPersonalizados();
            State.cargarHistorial();
            repintarTodasLasListasDeTiendas();
            UI.renderCustomGroupButtons(aplicarGrupoPersonalizado);
            UI.cargarHistorialUI();
            
            UI.showNotification("✅ Configuración cargada con éxito.");
        } catch(err) { UI.showNotification("❌ Error al leer el archivo."); }
    };
    reader.readAsText(file);
});

// EVENTOS DE VENTANA GLOBALES
window.addEventListener('beforeunload', function (e) {
    const hayResultados = Array.from(document.querySelectorAll('.output-section')).some(el => el.style.display === 'block');
    if (hayResultados) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('error', (event) => {
    console.error("System Error:", event.error);
    if(window.UI && window.UI.showNotification) {
        window.UI.showNotification(`⚠️ Error crítico interceptado. Revisa la consola.`);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error("Unhandled Promise:", event.reason);
    if(window.UI && window.UI.showNotification) {
        window.UI.showNotification(`⚠️ Error asíncrono detectado. Revisa la consola.`);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') { 
        const btn = document.querySelector('.app-section.active .tab-content.active .btn-generate:not(.btn-secondary)'); 
        if(btn) btn.click(); 
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