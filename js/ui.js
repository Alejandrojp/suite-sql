// js/ui.js
import { state, EXCEL_ITEMS_PER_PAGE, toggleGrupoColapsado } from './state.js';

// --- NOTIFICACIONES Y PORTAPAPELES ---
export function showNotification(msg) {
    const area = document.getElementById('notification-area');
    const el = document.createElement('div');
    el.className = 'notification-msg';
    
    const iconSpan = document.createElement('span');
    iconSpan.textContent = '🔔';
    
    const textNode = document.createTextNode(' ' + msg);
    
    el.appendChild(iconSpan);
    el.appendChild(textNode);
    
    area.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
}

export function copyToClipboard(text, btn) {
    if (!text) { showNotification("Nada que copiar"); return; }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showCopyFeedback(btn))
            .catch(() => fallbackCopy(text, btn));
    } else {
        fallbackCopy(text, btn);
    }
}

function fallbackCopy(text, btn) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showCopyFeedback(btn);
    } catch (err) {
        showNotification("Error al copiar manual: " + err);
    }
    document.body.removeChild(textArea);
}

function showCopyFeedback(btn) {
    let original = btn.innerText; 
    btn.innerText = "¡Copiado! 👌"; 
    btn.style.backgroundColor = "#28a745";
    setTimeout(() => { 
        btn.innerText = original; 
        btn.style.backgroundColor = ""; 
    }, 1500);
}

// --- UTILIDADES DOM ---
export function clearInput(id) {
    document.getElementById(id).value = '';
    document.getElementById(id).focus();
}

export function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    return isDark ? 'dark' : 'light';
}

export function handleFloatingScrollButton() {
    const btn = document.getElementById('floating-scroll-btn');
    if (!btn) return;
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 150) {
        btn.innerHTML = '⬆️';
        btn.onclick = () => window.scrollTo({top: 0, behavior: 'smooth'});
    } else {
        btn.innerHTML = '⬇️';
        btn.onclick = () => window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
    }
}

export function toggleAccordion(element) {
    element.classList.toggle("active");
    var content = element.nextElementSibling;
    if (content.style.display === "block" || content.classList.contains("show")) {
        content.style.display = "none";
        content.classList.remove("show");
    } else {
        content.style.display = "block";
        content.classList.add("show");
    }
}

export function toggleAllAccordions(btn) {
    const section = btn.closest('.output-section');
    const isExpanded = btn.dataset.expanded === 'true';
    const items = section.querySelectorAll('.accordion-item');
    
    items.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        if (isExpanded) {
            header.classList.remove('active');
            content.classList.remove('show');
            content.style.display = 'none';
        } else {
            header.classList.add('active');
            content.classList.add('show');
            content.style.display = 'block';
        }
    });
    
    if (isExpanded) {
        btn.dataset.expanded = 'false';
        btn.innerHTML = '📂 Abrir todos';
    } else {
        btn.dataset.expanded = 'true';
        btn.innerHTML = '📁 Cerrar todos';
    }
}

export function gestionarInputsBusqueda(selectId, input2Id) {
    const select = document.getElementById(selectId);
    const input2 = document.getElementById(input2Id);
    if(!select || !input2) return;
    
    const tipo = select.value;
    if (tipo === 'exact') {
        input2.value = ''; 
        input2.disabled = true;
        input2.placeholder = "🚫 No aplica en Exacto";
        input2.style.backgroundColor = "#e9ecef"; 
        input2.parentElement.style.opacity = "0.6";
    } else {
        input2.disabled = false;
        input2.placeholder = "Ej: Delivery";
        input2.style.backgroundColor = ""; 
        input2.parentElement.style.opacity = "1";
    }
}

export function obtenerCampoSQL(selectId) {
    const val = document.getElementById(selectId).value;
    return (val === 'id') ? 'G.idGrupo' : 'G.nombre';
}

// --- MODALES ---
export function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

export function openModal(id) {
    document.getElementById(id).style.display = "flex";
}

// --- RENDERIZADO DE TABLAS EXCEL ---
export function renderPreviewTable(tab) {
    let tbodyId = tab === 'mass' ? 'excel-preview-body-mass' : (tab === 'del' ? 'excel-preview-body-del' : 'excel-preview-body-swap');
    let infoId = tab === 'mass' ? 'excel-page-info-mass' : (tab === 'del' ? 'excel-page-info-del' : 'excel-page-info-swap');
    let btnPrevId = tab === 'mass' ? 'btn-prev-excel-mass' : (tab === 'del' ? 'btn-prev-excel-del' : 'btn-prev-excel-swap');
    let btnNextId = tab === 'mass' ? 'btn-next-excel-mass' : (tab === 'del' ? 'btn-next-excel-del' : 'btn-next-excel-swap');

    // Mapeo Plantillas
    if (['p_add', 'p_del', 'p_upd'].includes(tab)) {
        tbodyId = `excel-preview-body-${tab}`;
        infoId = `excel-page-info-${tab}`;
        btnPrevId = `btn-prev-excel-${tab}`;
        btnNextId = `btn-next-excel-${tab}`;
    }

    let tbody = document.getElementById(tbodyId);
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let filteredData = state.excel[tab].data;
    if (state.excel[tab].search) {
        filteredData = filteredData.filter(d => {
            if (tab === 'swap') return d.oldId.toLowerCase().includes(state.excel[tab].search) || d.newId.toLowerCase().includes(state.excel[tab].search);
            if (tab === 'p_add') return (d.cod && d.cod.includes(state.excel[tab].search)) || (d.tienda && d.tienda.includes(state.excel[tab].search)) || d.art.includes(state.excel[tab].search) || d.prov?.toLowerCase().includes(state.excel[tab].search);
            if (tab === 'p_del') return (d.cod && d.cod.includes(state.excel[tab].search)) || (d.tienda && d.tienda.includes(state.excel[tab].search)) || d.art.includes(state.excel[tab].search) || d.prov?.toLowerCase().includes(state.excel[tab].search);
            if (tab === 'p_upd') return d.cod.includes(state.excel[tab].search) || d.nombre.toLowerCase().includes(state.excel[tab].search);
            
            return d.art.toLowerCase().includes(state.excel[tab].search) || d.grp.toLowerCase().includes(state.excel[tab].search);
        });
    }

    let totalPages = Math.ceil(filteredData.length / EXCEL_ITEMS_PER_PAGE) || 1;
    if(state.excel[tab].page > totalPages) state.excel[tab].page = totalPages;
    if(state.excel[tab].page < 1) state.excel[tab].page = 1;

    document.getElementById(infoId).textContent = `Página ${state.excel[tab].page} de ${totalPages} (Total: ${filteredData.length})`;
    document.getElementById(btnPrevId).disabled = state.excel[tab].page === 1;
    document.getElementById(btnNextId).disabled = state.excel[tab].page === totalPages;

    let startIdx = (state.excel[tab].page - 1) * EXCEL_ITEMS_PER_PAGE;
    let endIdx = startIdx + EXCEL_ITEMS_PER_PAGE;
    let pageData = filteredData.slice(startIdx, endIdx);

    const escapeHTML = (str) => {
        if (!str) return '';
        return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    pageData.forEach(row => {
        let tr = document.createElement('tr');
        
        let safeOldId = escapeHTML(row.oldId);
        let safeNewId = escapeHTML(row.newId);
        let safeArt = escapeHTML(row.art);
        let safeGrp = escapeHTML(row.grp);
        
        let styleRow = row.valid ? '' : 'background-color: rgba(231, 76, 60, 0.1);';
        let icons = '';
        if (!row.valid) icons += '❌';
        
        if (row.duplicate) {
            styleRow = 'opacity: 0.5; text-decoration: line-through; color: #999;';
            icons += '<span title="Duplicado idéntico" style="margin-left:5px;">🔁</span>';
        } else if (row.conflict) {
            styleRow = 'background-color: rgba(241, 196, 15, 0.2);';
            icons += '<span title="Conflicto detectado" style="margin-left:5px;">⚠️</span>';
        }
        
        // Render TPV
        if (['mass', 'del'].includes(tab)) {
            let styleArt = row.valid ? '' : 'color:red; font-weight:bold;';
            tr.innerHTML = `<td style="font-family: monospace; ${styleArt} ${styleRow}">${safeArt} ${icons}</td><td style="${styleRow}">${safeGrp}</td>`;
        } else if (tab === 'swap') {
            let styleCol1 = (row.oldId && row.oldId.length >= 4 && row.oldId.length <= 6) ? '' : 'color:red; font-weight:bold;';
            let styleCol2 = (row.newId && row.newId.length >= 4 && row.newId.length <= 6) ? '' : 'color:red; font-weight:bold;';
            tr.innerHTML = `<td style="font-family: monospace; ${styleCol1} ${styleRow}">${safeOldId} ${icons}</td><td style="font-family: monospace; ${styleCol2} ${styleRow}">${safeNewId}</td>`;
        }
        // Render Plantillas
        else if (['p_add', 'p_del', 'p_upd'].includes(tab)) {
            let styleArt = row.valid ? '' : 'color:red; font-weight:bold;';
            if (tab === 'p_add') {
                let isTiendas = document.querySelector('input[name="modo_p_add"]:checked')?.value === 'excel_tienda';
                if (isTiendas) {
                    tr.innerHTML = `<td style="${styleRow}">${escapeHTML(row.tienda)}</td><td style="font-family: monospace; ${styleArt} ${styleRow}">${safeArt} ${icons}</td><td style="${styleRow}">${escapeHTML(row.stock)}</td><td style="${styleRow}">${escapeHTML(row.prov)}</td>`;
                } else {
                    tr.innerHTML = `<td style="${styleRow}">${escapeHTML(row.cod)}</td><td style="font-family: monospace; ${styleArt} ${styleRow}">${safeArt} ${icons}</td><td style="${styleRow}">${escapeHTML(row.stock)}</td>`;
                }
            } else if (tab === 'p_del') {
                let isTiendas = document.querySelector('input[name="modo_p_del"]:checked')?.value === 'excel_tienda';
                if (isTiendas) {
                    tr.innerHTML = `<td style="${styleRow}">${escapeHTML(row.tienda)}</td><td style="font-family: monospace; ${styleArt} ${styleRow}">${safeArt} ${icons}</td><td style="${styleRow}">${escapeHTML(row.prov)}</td>`;
                } else {
                    tr.innerHTML = `<td style="${styleRow}">${escapeHTML(row.cod)}</td><td style="font-family: monospace; ${styleArt} ${styleRow}">${safeArt} ${icons}</td>`;
                }
            } else if (tab === 'p_upd') {
                tr.innerHTML = `<td style="${styleRow}">${escapeHTML(row.cod)}</td><td style="${styleRow}">${escapeHTML(row.nombre)} ${icons}</td>`;
            }
        }
        
        tbody.appendChild(tr);
    });
}

// --- RENDERIZADO AVANZADO DE TIENDAS ---
export function obtenerCategoriaTienda(id) {
    if (['6641', '10299'].includes(id)) return { type: 'AEROPUERTO', icon: '✈️' };
    if (['6642', '6603', '6604'].includes(id)) return { type: 'CALLE', icon: '🏙️' };
    if (id.length === 4) {
        if (id.startsWith('1')) return { type: 'AEROPUERTO', icon: '✈️' };
        if (id.startsWith('3')) return { type: 'ESTACI', icon: '🚆' };
        if (id.startsWith('4')) return { type: 'KIOSKO', icon: '🏪' };
    }
    if (id.length <= 3) return { type: 'CALLE', icon: '🏙️' };
    return { type: 'OTRO', icon: '🏢' };
}

function getCategoryName(type) {
    const names = { 'AEROPUERTO': '✈️ AEROPUERTOS', 'ESTACI': '🚆 ESTACIONES', 'KIOSKO': '🏪 KIOSKOS', 'CALLE': '🏙️ CALLE / C.C.', 'OTRO': '🏢 OTROS' };
    return names[type] || type;
}

export function crearListaTiendas(containerId, counterId, onChangeCallback) {
    const listContainer = document.getElementById(containerId);
    if(!listContainer) return;
    listContainer.innerHTML = ''; 
    
    const enriched = state.tiendasData.map(t => ({
        ...t, ...obtenerCategoriaTienda(t.id), searchStr: (t.id + " " + t.name).toUpperCase() 
    }));
    
    const orderMap = { 'AEROPUERTO': 1, 'ESTACI': 2, 'KIOSKO': 3, 'CALLE': 4, 'OTRO': 5 };
    
    // ORDENACIÓN AVANZADA
    enriched.sort((a, b) => {
        const orderA = orderMap[a.type] || 99; 
        const orderB = orderMap[b.type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    let lastCategory = null; let groupContainer = null; let itemsContainer = null;

    enriched.forEach((tienda, index) => {
        if (tienda.type !== lastCategory) {
            if (groupContainer) listContainer.appendChild(groupContainer);
            groupContainer = document.createElement('div');
            groupContainer.className = 'store-group-container';
            const catName = getCategoryName(tienda.type);
            const groupId = containerId + '-group-' + tienda.type;
            const isCollapsed = state.collapsedGroups[groupId] ? 'collapsed' : '';
            
            const header = document.createElement('div');
            header.className = 'store-category-header';
            
            header.innerHTML = `
                <span id="icon-${groupId}" class="category-toggle-icon ${isCollapsed}">▼</span>
                <span style="flex:1;">${catName}</span>
                <input type="checkbox" class="category-checkbox" title="Seleccionar todo el grupo">
            `;
            
            header.onclick = function(e) { 
                if(e.target.type !== 'checkbox') {
                    const isNowCollapsed = toggleGrupoColapsado(groupId);
                    const icon = document.getElementById('icon-' + groupId);
                    const items = document.getElementById(groupId);
                    if(isNowCollapsed) { icon.classList.add('collapsed'); items.classList.add('collapsed'); }
                    else { icon.classList.remove('collapsed'); items.classList.remove('collapsed'); }
                }
            };
            
            header.querySelector('input').onclick = function(e) {
                e.stopPropagation();
                const currentItemsContainer = document.getElementById(groupId);
                const checkboxes = currentItemsContainer.querySelectorAll('.store-item input');
                checkboxes.forEach(cb => { if(cb.closest('.store-item').style.display !== 'none') cb.checked = e.target.checked; });
                
                actualizarContador(containerId, counterId);
                if(onChangeCallback) onChangeCallback();
            };

            groupContainer.appendChild(header);
            itemsContainer = document.createElement('div');
            itemsContainer.className = 'store-group-items ' + isCollapsed;
            itemsContainer.id = groupId;
            groupContainer.appendChild(itemsContainer);
            lastCategory = tienda.type;
        }
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'store-item';
        itemDiv.dataset.search = tienda.searchStr;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = tienda.id;
        checkbox.id = containerId + '-' + tienda.id; 
        checkbox.dataset.index = index;
        
        checkbox.addEventListener('click', function(e) { 
            if (e.shiftKey && state.lastChecked && state.lastChecked !== this && state.lastChecked.closest('.store-list') === listContainer) {
                const allCheckboxes = Array.from(listContainer.querySelectorAll('.store-item input'));
                const startIdx = allCheckboxes.indexOf(state.lastChecked);
                const endIdx = allCheckboxes.indexOf(this);
                if (startIdx !== -1 && endIdx !== -1) {
                    const min = Math.min(startIdx, endIdx); const max = Math.max(startIdx, endIdx);
                    for (let i = min; i <= max; i++) { 
                        if (allCheckboxes[i].closest('.store-item').style.display !== 'none') allCheckboxes[i].checked = this.checked; 
                    }
                }
            }
            state.lastChecked = this;
            actualizarContador(containerId, counterId);
            if(onChangeCallback) onChangeCallback();
        });
        
        const label = document.createElement('label');
        label.htmlFor = containerId + '-' + tienda.id; 
        let nombreLimpio = tienda.name;
        const patronID = new RegExp("^" + tienda.id + "\\s*(-)?\\s*", "i");
        nombreLimpio = nombreLimpio.replace(patronID, "").replace(patronID, "");
        if(nombreLimpio.trim() === "") nombreLimpio = tienda.name;

        label.innerHTML = `<strong>${tienda.id}</strong> - ${nombreLimpio}`; 
        itemDiv.appendChild(checkbox); itemDiv.appendChild(label); itemsContainer.appendChild(itemDiv);
    });
    if (groupContainer) listContainer.appendChild(groupContainer);
}

export function actualizarContador(containerId, counterId) {
    const count = document.querySelectorAll(`#${containerId} .store-item input:checked`).length;
    const badge = document.getElementById(counterId);
    if(!badge) return;
    badge.textContent = count + ' seleccionadas';
    if(count > 0) badge.classList.add('active'); else badge.classList.remove('active');
    
    // Si necesitas actualizar el botón generar con el número (Opcional)
    let btnId = '';
    if(containerId === 'list-mass') btnId = 'btn-gen-mass';
    else if(containerId === 'list-delete') btnId = 'btn-gen-delete';
    else if(containerId === 'list-swap') btnId = 'btn-gen-swap';
    else if(containerId === 'list-repair') btnId = 'btn-gen-repair';
    else if(containerId === 'list-add') btnId = 'btn-gen-add'; 
    else if(containerId === 'list-del') btnId = 'btn-gen-del'; 
    
    const btn = document.getElementById(btnId);
    if(btn) {
        let baseTxt = btn.innerText.split('(')[0].trim();
        
        if (count > 0) {
            btn.innerText = `${baseTxt} (${count}) (Ctrl+Enter)`;
        } else {
            btn.innerText = `${baseTxt} (Ctrl+Enter)`;
        }
    }
}

// --- RENDERS VARIOS ---
export function renderCustomGroupButtons(onClickCallback) {
    const containers = ['dynamic-groups-mass', 'dynamic-groups-delete', 'dynamic-groups-swap', 'dynamic-groups-repair', 'dynamic-groups-add', 'dynamic-groups-del'];
    containers.forEach(divId => {
        const div = document.getElementById(divId);
        if(!div) return;
        div.innerHTML = '';
        for (const [name, ids] of Object.entries(state.customGroups)) {
            const btn = document.createElement('button');
            btn.className = 'btn-small btn-preset btn-custom-group';
            btn.textContent = `★ ${name}`;
            btn.style.fontSize = "10px";
            btn.onclick = (e) => {
                e.preventDefault();
                let targetList = divId.replace('dynamic-groups-', 'list-');
                if(onClickCallback) onClickCallback(targetList, ids);
            };
            div.appendChild(btn);
        }
    });
}

export function cargarHistorialUI() {
    const datalist = document.getElementById('group-history');
    if(!datalist) return;
    datalist.innerHTML = '';
    state.groupHistory.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        datalist.appendChild(opt);
    });
}

export function actualizarContadorArticulosGenerico(inputId, counterId) {
    let textarea = document.getElementById(inputId);
    let badge = document.getElementById(counterId);
    if(!textarea || !badge) return;
    
    let val = textarea.value;
    let items = val.split(/[\r\n,]+/).filter(s => s.trim() !== '');
    badge.textContent = items.length + ' artículos';
    
    let haySospechosos = items.some(id => id.length < 4 || id.length > 6); 
    if(haySospechosos) {
        textarea.style.borderColor = "#e74c3c"; 
        textarea.style.backgroundColor = "rgba(231, 76, 60, 0.05)";
        badge.innerText += " (⚠️ Revisar)";
    } else {
        textarea.style.borderColor = ""; 
        textarea.style.backgroundColor = "";
    }
}