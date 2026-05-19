// js/sql.js
import { state, agregarHistorial } from './state.js';
import { showNotification, obtenerCampoSQL, copyToClipboard } from './ui.js';
import { excepcionesTiendas } from './data.js';

function sqlEscape(str) {
    if (str === null || str === undefined) return '';
    
    return String(str)
        .replace(/[\0\x08\x09\x1a\n\r]/g, " ")
        .replace(/\\/g, "\\\\")                
        .replace(/'/g, "''")                  
        .trim();                               
}

/**
 * Valida y castea estrictamente a entero numérico, pero devuelve String
 * para mantener la compatibilidad con las búsquedas internas del DOM (===).
 */
function safeInt(val) {
    if (val === null || val === undefined || val === '') return '0';
    const num = parseInt(val, 10);
    if (isNaN(num)) {
        showNotification(`⚠️ Inyección bloqueada: ID inválido '${val}'`);
        throw new Error(`Se esperaba un entero, se recibió '${val}'`);
    }
    return String(num);
}

function wrapTransaction(sql, checkboxId) {
    const cb = document.getElementById(checkboxId);
    if (cb && cb.checked) {
        return `START TRANSACTION;\n\n${sql}\n\nCOMMIT;`;
    }
    return sql;
}

// ==========================================
// UTILIDADES DE RENDERIZADO (PLANTILLAS)
// ==========================================

function inyectarSQLPlantillas(containerId, codeId, sql) {
    const container = document.getElementById(containerId);
    const codeEl = document.getElementById(codeId);
    if (!container || !codeEl) return;
    
    container.style.display = 'block';
    
    window.fullSqlCache = window.fullSqlCache || {};
    window.fullSqlCache[codeId] = sql;
    
    codeEl.textContent = sql;
    
    codeEl.dataset.fullSql = "MEM_CACHE"; 
    if(window.Prism) window.Prism.highlightElement(codeEl);
    container.scrollIntoView({behavior: "smooth", block: "start"});
}

function wrapTransactionPlantillas(sql) {
    const cb = document.getElementById('safeModePlant');
    if (cb && cb.checked) { return `START TRANSACTION;\n\n${sql}\n\nCOMMIT;`; }
    return sql;
}

// ==========================================
// LOGICA TPVs
// ==========================================

export function generarSQLMasivo() {
    try {
        let modoMasivo = document.querySelector('input[name="modo_masivo"]:checked').value;
        let isExcel = modoMasivo === 'excel' || modoMasivo === 'excel_tienda';
        let isExcelTienda = modoMasivo === 'excel_tienda';
        
        let listaArticulos = [];
        let datosExcel = [];
        let listaTiendas = [];

        if (isExcel) {
            let validData = state.excel.mass.data.filter(d => d.valid && !d.conflict);
            if(validData.length === 0) { showNotification("¡Faltan artículos válidos o hay conflictos sin resolver!"); return; }
            
            if (isExcelTienda) {
                let mappedTiendas = new Set();
                validData.forEach(d => {
                    let cleanNum = d.tienda.toString().trim();
                    let dbId = excepcionesTiendas[cleanNum] || null;
                    if (!dbId) {
                        const regexTienda = new RegExp(`^${cleanNum}(\\D|$)`, 'i');
                        const match = state.tiendasData.find(t => regexTienda.test(t.name) || t.id === cleanNum);
                        if (match) dbId = match.id;
                        else dbId = safeInt(cleanNum);
                    }
                    mappedTiendas.add(dbId);
                    datosExcel.push({ idTienda: dbId, idArticulo: safeInt(d.art), grupo: d.grp });
                });
                listaTiendas = Array.from(mappedTiendas);
                listaArticulos = [...new Set(datosExcel.map(d => d.idArticulo))];
            } else {
                datosExcel = validData.map(d => ({ idArticulo: safeInt(d.art), grupo: d.grp }));
                listaArticulos = [...new Set(datosExcel.map(d => d.idArticulo))];
            }
        } else {
            let textArticulos = document.getElementById('articulos').value;
            listaArticulos = textArticulos.split(/[\r\n,]+/).map(s => s.replace(/\D/g,'')).filter(s => s !== '').map(a => safeInt(a));
            if (listaArticulos.length === 0) { showNotification("¡Faltan los artículos!"); return; }
        }

        if (!isExcelTienda) {
            const checkedBoxes = document.querySelectorAll('#list-mass .store-item input:checked');
            listaTiendas = Array.from(checkedBoxes).map(cb => safeInt(cb.value));
            if (listaTiendas.length === 0) { showNotification("¡Selecciona tiendas!"); return; }
        }

        if (listaArticulos.length > 500) {
            showNotification("⚠️ Límite excedido: Procesa un máximo de 500 artículos por lote para evitar bloqueos en la base de datos.");
            return;
        }

        let busq1 = document.getElementById('busq1').value.trim();
        if(!isExcel && !busq1) {
            document.getElementById('busq1').classList.add('input-error');
            showNotification("¡Falta el filtro principal!");
            document.getElementById('busq1').focus();
            return;
        }
        if(!isExcel && busq1) agregarHistorial(busq1);
        
        let busq2 = document.getElementById('busq2').value.trim();
        let tipo = document.getElementById('tipoBusqueda').value;
        let campoSQL = obtenerCampoSQL('campoBusqueda');

        const processTxt = (v) => (v && tipo === 'contains') ? `%${v}%` : (v || '%');
        let b1 = isExcel ? '%' : sqlEscape(processTxt(busq1));
        let b2 = isExcel ? '%' : ((tipo === 'exact') ? '%' : sqlEscape(processTxt(busq2)));
        let strTiendas = listaTiendas.join(','); 
        
        let unionAll = ""; let unionSimple = ""; let unionGroups = "";

        if (isExcel) {
            let uniqueGroups = [...new Set(datosExcel.map(d => d.grupo))];
            uniqueGroups.forEach((g, idx) => {
                let gEsc = sqlEscape(processTxt(g));
                if (idx === 0) unionGroups += `SELECT CAST('${gEsc}' AS CHAR(100)) as Busq1`;
                else unionGroups += ` UNION ALL SELECT '${gEsc}'`;
            });

            datosExcel.forEach((d, index) => {
                let gEsc = sqlEscape(processTxt(d.grupo));
                if (isExcelTienda) {
                    if (index === 0) {
                        unionAll += `    SELECT CAST('${d.idTienda}' AS CHAR(50)) as idRestaurante, CAST('${d.idArticulo}' AS CHAR(50)) as idArticulo, CAST('${gEsc}' AS CHAR(100)) as Busq1, CAST('%' AS CHAR(100)) as Busq2`;
                        unionSimple += `    SELECT CAST('${d.idTienda}' AS CHAR(50)) as idRestaurante, CAST('${d.idArticulo}' AS CHAR(50)) as idArticulo`;
                    } else {
                        unionAll += `\n    UNION ALL SELECT '${d.idTienda}', '${d.idArticulo}', '${gEsc}', '%'`;
                        unionSimple += `\n    UNION ALL SELECT '${d.idTienda}', '${d.idArticulo}'`;
                    }
                } else {
                    if (index === 0) {
                        unionAll += `    SELECT CAST('${d.idArticulo}' AS CHAR(50)) as idArticulo, CAST('${gEsc}' AS CHAR(100)) as Busq1, CAST('%' AS CHAR(100)) as Busq2`;
                        unionSimple += `    SELECT CAST('${d.idArticulo}' AS CHAR(50)) as idArticulo`;
                    } else {
                        unionAll += `\n    UNION ALL SELECT '${d.idArticulo}', '${gEsc}', '%'`;
                        unionSimple += `\n    UNION ALL SELECT '${d.idArticulo}'`;
                    }
                }
            });
        } else {
            listaArticulos.forEach((art, index) => {
                if (index === 0) {
                    unionAll += `    SELECT CAST('${art}' AS CHAR(50)) as idArticulo, CAST('${b1}' AS CHAR(100)) as Busq1, CAST('${b2}' AS CHAR(100)) as Busq2`;
                    unionSimple += `    SELECT CAST('${art}' AS CHAR(50)) as idArticulo`;
                } else {
                    unionAll += `\n    UNION ALL SELECT '${art}', '${b1}', '${b2}'`;
                    unionSimple += `\n    UNION ALL SELECT '${art}'`;
                }
            });
        }

        const caseUpdate = listaArticulos
        .map((art, index) => `                WHEN '${art}' THEN ${index + 1}`)
        .join('\n') + `\n                ELSE ${listaArticulos.length + 1}`;
        let listaIn = listaArticulos.map(a => `'${a}'`).join(', ');

        let compareOp = (tipo === 'exact') ? '=' : 'LIKE';
        let reorderWhere = `AND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''}`;
        let deleteWhere = `AND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''}`;
        let undoWhere = `AND ${campoSQL} ${compareOp} '${b1}' ${b2 !== '%' ? `AND ${campoSQL} ${compareOp} '${b2}'` : ''}`;

        if (isExcel) {
            reorderWhere = `AND EXISTS (SELECT 1 FROM (${unionGroups}) ListadoGrupos WHERE ${campoSQL} LIKE ListadoGrupos.Busq1)`;
            deleteWhere = `AND EXISTS (SELECT 1 FROM (${unionGroups}) ListadoGrupos WHERE ${campoSQL} LIKE ListadoGrupos.Busq1)`;
            undoWhere = `AND EXISTS (SELECT 1 FROM (${unionGroups}) ListadoGrupos WHERE ${campoSQL} ${compareOp} ListadoGrupos.Busq1)`;
        }

        let posicionInsercion = document.querySelector('input[name="posicion_insercion"]:checked')?.value || 'top';
        let sortPositionSql = posicionInsercion === 'bottom'
            ? `CASE WHEN D.idArticulo IN (${listaIn}) THEN 1 ELSE 0 END ASC,`
            : `CASE WHEN D.idArticulo IN (${listaIn}) THEN 0 ELSE 1 END ASC,`;

        // Variaciones de JOIN si usamos matriz cruzada o lista exacta (Excel Tienda)
        let fromJoin1 = isExcelTienda ? `FROM maeres R \nINNER JOIN (${unionAll}) ListadoMasivo ON R.codigo = ListadoMasivo.idRestaurante` : `FROM maeres R \nCROSS JOIN (${unionAll}) ListadoMasivo`;
        let fromJoin2 = isExcelTienda ? `FROM maeres R \nINNER JOIN (${unionAll}) Listado ON R.codigo = Listado.idRestaurante` : `FROM maeres R \nCROSS JOIN (${unionAll}) Listado`;
        let fromJoin5 = isExcelTienda ? `FROM maeres R \nINNER JOIN (${unionSimple}) ListaIdeal ON R.codigo = ListaIdeal.idRestaurante` : `FROM maeres R \nCROSS JOIN (${unionSimple}) ListaIdeal`;

        state.generatedQueries.mq0 = `DELETE D FROM fo_desglose D \nINNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nINNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = R.empresa \nWHERE R.codigo IN (${strTiendas}) \n${deleteWhere} \nAND MA.situacion = 'B';`;
        
        state.generatedQueries.mq1 = `SELECT R.codigo, R.nombre, ListadoMasivo.idArticulo, G.nombre, G.idGrupo, MA.situacion \n${fromJoin1} \nINNER JOIN fo_grupos G ON G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nINNER JOIN maeart MA ON MA.codigo = ListadoMasivo.idArticulo AND MA.empresa = R.empresa \nWHERE ${campoSQL} LIKE ListadoMasivo.Busq1 AND ${campoSQL} LIKE ListadoMasivo.Busq2 \nAND R.codigo IN (${strTiendas}) \nAND MA.situacion <> 'B' \nAND NOT EXISTS (SELECT 1 FROM fo_desglose D WHERE D.idRestaurante = R.codigo AND D.idArticulo = ListadoMasivo.idArticulo AND D.idGrupo = G.idGrupo) \nORDER BY R.codigo, ListadoMasivo.idArticulo;`;
        
        state.generatedQueries.mq2 = `INSERT INTO fo_desglose (idRestaurante, idEmpresa, idGrupo, idArticulo) \nSELECT R.codigo, R.empresa, G.idGrupo, Listado.idArticulo \n${fromJoin2} \nINNER JOIN fo_grupos G ON G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nINNER JOIN maeart MA ON MA.codigo = Listado.idArticulo AND MA.empresa = R.empresa \nWHERE ${campoSQL} LIKE Listado.Busq1 AND ${campoSQL} LIKE Listado.Busq2 \nAND R.codigo IN (${strTiendas}) \nAND MA.situacion <> 'B' \nAND NOT EXISTS (SELECT 1 FROM fo_desglose D WHERE D.idRestaurante = R.codigo AND D.idArticulo = Listado.idArticulo AND D.idGrupo = G.idGrupo);`;
        
        state.generatedQueries.mq3 = `UPDATE fo_desglose Destino \nINNER JOIN ( \n    SELECT \n        idRestaurante, idEmpresa, idGrupo, idArticulo, \n        @num_orden := IF(@grupo_actual = CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo), @num_orden + 1, 0) as nuevo_orden, \n        @grupo_actual := CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo) \n    FROM ( \n        SELECT D.idRestaurante, D.idEmpresa, D.idGrupo, D.idArticulo, D.orden \n        FROM fo_desglose D \n        INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = D.idRestaurante AND G.idEmpresa = D.idEmpresa \n        INNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = D.idEmpresa \n        WHERE D.idRestaurante IN (${strTiendas}) \n        ${reorderWhere} \n        AND MA.situacion <> 'B' \n        ORDER BY \n            D.idRestaurante, D.idEmpresa, D.idGrupo, \n            ${sortPositionSql} \n            CASE D.idArticulo \n${caseUpdate} \n            END ASC, \n            COALESCE(D.orden, 999999) ASC, \n            D.idArticulo ASC \n        LIMIT 18446744073709551615 \n    ) TablaOrdenada, \n    (SELECT @num_orden := 0, @grupo_actual := '') Vars \n) Calculado ON Destino.idRestaurante = Calculado.idRestaurante \n   AND Destino.idEmpresa = Calculado.idEmpresa \n   AND Destino.idGrupo = Calculado.idGrupo \n   AND Destino.idArticulo = Calculado.idArticulo \nSET Destino.orden = Calculado.nuevo_orden;`;
        
        state.generatedQueries.mq4 = `SELECT R.codigo, R.nombre, G.nombre, G.idGrupo, D.idArticulo, D.orden, MA.situacion \nFROM maeres R \nINNER JOIN fo_desglose D ON D.idRestaurante = R.codigo AND D.idEmpresa = R.empresa \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nLEFT JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = R.empresa \nWHERE D.idArticulo IN (${listaIn}) \nAND R.codigo IN (${strTiendas}) \nORDER BY R.codigo, G.nombre, D.orden;`;
        
        let auditEspecifico = document.getElementById('auditGrupoEspecifico') && document.getElementById('auditGrupoEspecifico').checked;
        let opAuditoria = (tipo === 'exact') ? '=' : 'LIKE';
        let campoSub = campoSQL.replace('G.', 'G2.');

        let auditWhere = `WHERE ${campoSub} ${opAuditoria} '${b1}' ${b2 !== '%' ? `AND ${campoSub} ${opAuditoria} '${b2}'` : ''}`;
        if (isExcel) { auditWhere = `WHERE EXISTS (SELECT 1 FROM (${unionGroups}) ListadoGrupos WHERE ${campoSub} ${opAuditoria} ListadoGrupos.Busq1)`; }

        if (auditEspecifico) {
            state.generatedQueries.mq5 = `SELECT R.codigo as 'Nº Tienda', R.nombre as Tienda, ListaIdeal.idArticulo as Código, MA.descripcion_principal as Descripción, F.nombre as Familia, S.nombre as Subfamilia, COALESCE(D.nombre_grupo, '---') as Grupo, D.idGrupo, D.orden as Orden, CASE WHEN D.idArticulo IS NOT NULL THEN 'OK' ELSE 'FALTA' END as Estado, MA.situacion \n${fromJoin5} \nLEFT JOIN ( \n    SELECT D2.idRestaurante, D2.idEmpresa, D2.idArticulo, D2.idGrupo, D2.orden, G2.nombre as nombre_grupo \n    FROM fo_desglose D2 \n    INNER JOIN fo_grupos G2 ON G2.idGrupo = D2.idGrupo AND G2.idRestaurante = D2.idRestaurante AND G2.idEmpresa = D2.idEmpresa \n    ${auditWhere} \n) D ON D.idRestaurante = R.codigo AND D.idEmpresa = R.empresa AND D.idArticulo = ListaIdeal.idArticulo \nLEFT JOIN maeart MA ON MA.codigo = ListaIdeal.idArticulo AND MA.empresa = R.empresa \nLEFT JOIN desfam F ON F.codigo = MA.familia AND F.empresa = MA.empresa AND F.idioma = 1 \nLEFT JOIN dessub S ON S.codigo = MA.subfamilia AND S.empresa = MA.empresa AND S.idioma = 1 \nWHERE R.codigo IN (${strTiendas}) \nORDER BY Estado ASC, R.codigo, ListaIdeal.idArticulo;`;
        } else {
            state.generatedQueries.mq5 = `SELECT R.codigo as 'Nº Tienda', R.nombre as Tienda, ListaIdeal.idArticulo as Código, MA.descripcion_principal as Descripción, F.nombre as Familia, S.nombre as Subfamilia, COALESCE(G.nombre, '---') as Grupo, G.idGrupo, D.orden as Orden, CASE WHEN D.idArticulo IS NOT NULL THEN 'OK' ELSE 'FALTA' END as Estado, MA.situacion \n${fromJoin5} \nLEFT JOIN fo_desglose D ON D.idRestaurante = R.codigo AND D.idEmpresa = R.empresa AND D.idArticulo = ListaIdeal.idArticulo \nLEFT JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nLEFT JOIN maeart MA ON MA.codigo = ListaIdeal.idArticulo AND MA.empresa = R.empresa \nLEFT JOIN desfam F ON F.codigo = MA.familia AND F.empresa = MA.empresa AND F.idioma = 1 \nLEFT JOIN dessub S ON S.codigo = MA.subfamilia AND S.empresa = MA.empresa AND S.idioma = 1 \nWHERE R.codigo IN (${strTiendas}) \nORDER BY Estado ASC, R.codigo, ListaIdeal.idArticulo;`;
        }
        
        state.generatedQueries.mq6 = `DELETE D FROM fo_desglose D \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = D.idRestaurante AND G.idEmpresa = D.idEmpresa \nWHERE D.idRestaurante IN (${strTiendas}) \nAND D.idArticulo IN (${listaIn}) \n${undoWhere};`;
        
        let combined = state.generatedQueries.mq0 + "\n\n" + state.generatedQueries.mq2 + "\n\n" + state.generatedQueries.mq3;
        state.generatedQueries.mq7 = wrapTransaction(combined, 'safeMode');

        document.getElementById('mq0').textContent = state.generatedQueries.mq0;
        document.getElementById('mq1').textContent = state.generatedQueries.mq1;
        document.getElementById('mq2').textContent = state.generatedQueries.mq2;
        document.getElementById('mq3').textContent = state.generatedQueries.mq3;
        document.getElementById('mq4').textContent = state.generatedQueries.mq4;
        document.getElementById('mq5').textContent = state.generatedQueries.mq5;
        document.getElementById('mq6').textContent = state.generatedQueries.mq6;
        document.getElementById('mq7').textContent = state.generatedQueries.mq7;
        
        if(window.Prism) ['mq0','mq1','mq2','mq3','mq4','mq5','mq6','mq7'].forEach(id => Prism.highlightElement(document.getElementById(id)));

        document.getElementById('time-mass').innerText = `(Generado: ${new Date().toLocaleTimeString()})`;
        document.getElementById('res-mass').style.display = 'block';
        document.getElementById('res-mass').scrollIntoView({behavior: "smooth"});
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function generarSQLBorrar() {
    try {
        let isExcel = document.querySelector('input[name="modo_borrar"]:checked').value === 'excel';
        let listaArticulos = [];
        let datosExcel = [];

        if (isExcel) {
            let validData = state.excel.del.data.filter(d => d.valid && !d.conflict);
            if(validData.length === 0) { showNotification("¡Faltan artículos válidos o hay conflictos sin resolver!"); return; }
            // Estandarización: Limpieza extra del Excel
            datosExcel = validData.map(d => ({ idArticulo: safeInt(d.art.toString().replace(/\D/g, '')), grupo: d.grp }));
            listaArticulos = [...new Set(datosExcel.map(d => d.idArticulo))];
        } else {
            let textArticulos = document.getElementById('articulos_borrar').value;
            // Estandarización: Separador universal y limpieza de letras
            listaArticulos = textArticulos.split(/[\r\n, \t]+/).map(s => s.replace(/\D/g,'')).filter(s => s !== '').map(a => safeInt(a));
            if (listaArticulos.length === 0) { showNotification("¡Indica qué artículos borrar!"); return; }
        }

        const checkedBoxes = document.querySelectorAll('#list-delete .store-item input:checked');
        let listaTiendas = Array.from(checkedBoxes).map(cb => safeInt(cb.value));
        if (listaTiendas.length === 0) { showNotification("¡Selecciona tiendas!"); return; }

        // Estandarización: Límite de seguridad de lotes
        if (listaArticulos.length > 500) {
            showNotification("⚠️ Límite excedido: Procesa un máximo de 500 artículos por lote para evitar bloqueos.");
            return;
        }

        let busq1 = document.getElementById('busq1_del').value.trim();
        
        // Estandarización: Control estricto de filtro vacío
        let inputBusq1 = document.getElementById('busq1_del');
        if (!isExcel && !busq1) {
            if (!confirm("⚠️ ATENCIÓN: No has puesto Filtro de Grupo.\nSe borrarán estos artículos de TODOS los grupos en las tiendas seleccionadas.\n¿Estás seguro?")) {
                if(inputBusq1) { inputBusq1.classList.add('input-error'); inputBusq1.focus(); }
                return;
            }
        } 
        if (inputBusq1) inputBusq1.classList.remove('input-error');
        if (!isExcel && busq1) agregarHistorial(busq1);
        
        let busq2 = document.getElementById('busq2_del').value.trim();
        let tipo = document.getElementById('tipoBusqueda_del').value;
        let campoSQL = obtenerCampoSQL('campoBusqueda_del');

        const processTxt = (v) => (v && tipo === 'contains') ? `%${v}%` : (v || '%');
        let b1 = isExcel ? '%' : sqlEscape(processTxt(busq1));
        let b2 = isExcel ? '%' : ((tipo === 'exact') ? '%' : sqlEscape(processTxt(busq2)));
        let strTiendas = listaTiendas.join(',');
        
        let unionAll = ""; let unionGroups = "";

        if (isExcel) {
            let uniqueGroups = [...new Set(datosExcel.map(d => d.grupo))];
            uniqueGroups.forEach((g, idx) => {
                let gEsc = sqlEscape(processTxt(g));
                if (idx === 0) unionGroups += `SELECT CAST('${gEsc}' AS CHAR(100)) as Busq1`;
                else unionGroups += ` UNION ALL SELECT '${gEsc}'`;
            });

            datosExcel.forEach((d, index) => {
                let gEsc = sqlEscape(processTxt(d.grupo));
                if (index === 0) unionAll += `    SELECT CAST('${d.idArticulo}' AS CHAR(50)) as idArticulo, CAST('${gEsc}' AS CHAR(100)) as Busq1`;
                else unionAll += `\n    UNION ALL SELECT '${d.idArticulo}', '${gEsc}'`;
            });
        } else {
            listaArticulos.forEach((art, index) => {
                if (index === 0) unionAll += `    SELECT CAST('${art}' AS CHAR(50)) as idArticulo, CAST('${b1}' AS CHAR(100)) as Busq1, CAST('${b2}' AS CHAR(100)) as Busq2`;
                else unionAll += `\n    UNION ALL SELECT '${art}', '${b1}', '${b2}'`;
            });
        }

        let listaIn = listaArticulos.map(a => `'${a}'`).join(', ');
        let sqlAudit, sqlReorder, sqlDelete;

        if (isExcel) {
            sqlAudit = `SELECT 'SE BORRARÁ' as Accion, G.nombre as Grupo, G.idGrupo, D.idRestaurante, D.idEmpresa, D.idArticulo, D.orden, MA.descripcion_principal as Nombre_Articulo \nFROM fo_desglose D \nINNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nINNER JOIN (${unionAll}) Listado ON D.idArticulo = Listado.idArticulo AND ${campoSQL} LIKE Listado.Busq1 \nLEFT JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = R.empresa \nWHERE R.codigo IN (${strTiendas});`;
            sqlReorder = `UPDATE fo_desglose Destino \nINNER JOIN ( \n    SELECT \n        idRestaurante, idEmpresa, idGrupo, idArticulo, \n        @num_orden := IF(@grupo_actual = CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo), @num_orden + 1, 0) as nuevo_orden, \n        @grupo_actual := CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo) \n    FROM ( \n        SELECT D.idRestaurante, D.idEmpresa, D.idGrupo, D.idArticulo, D.orden \n        FROM fo_desglose D \n        INNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \n        INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \n        INNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = D.idEmpresa \n        WHERE R.codigo IN (${strTiendas}) \n        AND EXISTS (SELECT 1 FROM (${unionGroups}) ListadoGrupos WHERE ${campoSQL} LIKE ListadoGrupos.Busq1) \n        AND MA.situacion <> 'B' \n        AND D.idArticulo NOT IN (${listaIn}) \n        ORDER BY D.idRestaurante, D.idEmpresa, D.idGrupo, COALESCE(D.orden, 999999) ASC, D.idArticulo ASC \n        LIMIT 18446744073709551615 \n    ) Ordered, \n    (SELECT @num_orden := 0, @grupo_actual := '') Vars \n) Calculado ON Destino.idRestaurante = Calculado.idRestaurante \n   AND Destino.idEmpresa = Calculado.idEmpresa \n   AND Destino.idGrupo = Calculado.idGrupo \n   AND Destino.idArticulo = Calculado.idArticulo \nINNER JOIN ( \n    SELECT DISTINCT D2.idRestaurante, D2.idEmpresa, D2.idGrupo \n    FROM fo_desglose D2 \n    INNER JOIN fo_grupos G2 ON G2.idGrupo = D2.idGrupo AND G2.idRestaurante = D2.idRestaurante AND G2.idEmpresa = D2.idEmpresa \n    INNER JOIN (${unionAll}) L2 ON D2.idArticulo = L2.idArticulo AND ${campoSQL.replace('G.','G2.')} LIKE L2.Busq1 \n    WHERE D2.idRestaurante IN (${strTiendas}) \n) Afectados ON Destino.idRestaurante = Afectados.idRestaurante AND Destino.idEmpresa = Afectados.idEmpresa AND Destino.idGrupo = Afectados.idGrupo \nSET Destino.orden = Calculado.nuevo_orden;`;
            sqlDelete = `DELETE D FROM fo_desglose D \nINNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nINNER JOIN (${unionAll}) Listado ON D.idArticulo = Listado.idArticulo AND ${campoSQL} LIKE Listado.Busq1 \nWHERE R.codigo IN (${strTiendas});`;
        } else {
            sqlAudit = `SELECT 'SE BORRARA' as Accion, G.nombre as Grupo, G.idGrupo, D.idRestaurante, D.idEmpresa, D.idArticulo, D.orden, MA.descripcion_principal as Nombre_Articulo \nFROM fo_desglose D \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = D.idRestaurante AND G.idEmpresa = D.idEmpresa \nLEFT JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = D.idEmpresa \nWHERE D.idArticulo IN (${listaIn}) \nAND D.idRestaurante IN (${strTiendas}) \nAND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''};`;
            sqlReorder = `UPDATE fo_desglose Destino \nINNER JOIN ( \n    SELECT \n        idRestaurante, idEmpresa, idGrupo, idArticulo, \n        @num_orden := IF(@grupo_actual = CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo), @num_orden + 1, 0) as nuevo_orden, \n        @grupo_actual := CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo) \n    FROM ( \n        SELECT D.idRestaurante, D.idEmpresa, D.idGrupo, D.idArticulo, D.orden \n        FROM fo_desglose D \n        INNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \n        INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \n        INNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = D.idEmpresa \n        WHERE R.codigo IN (${strTiendas}) \n        AND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''} \n        AND MA.situacion <> 'B' \n        AND D.idArticulo NOT IN (${listaIn}) \n        ORDER BY D.idRestaurante, D.idEmpresa, D.idGrupo, COALESCE(D.orden, 999999) ASC, D.idArticulo ASC \n        LIMIT 18446744073709551615 \n    ) Ordered, \n    (SELECT @num_orden := 0, @grupo_actual := '') Vars \n) Calculado ON Destino.idRestaurante = Calculado.idRestaurante \n   AND Destino.idEmpresa = Calculado.idEmpresa \n   AND Destino.idGrupo = Calculado.idGrupo \n   AND Destino.idArticulo = Calculado.idArticulo \nINNER JOIN ( \n    SELECT DISTINCT idRestaurante, idEmpresa, idGrupo \n    FROM fo_desglose \n    WHERE idRestaurante IN (${strTiendas}) AND idArticulo IN (${listaIn}) \n) Afectados ON Destino.idRestaurante = Afectados.idRestaurante AND Destino.idEmpresa = Afectados.idEmpresa AND Destino.idGrupo = Afectados.idGrupo \nSET Destino.orden = Calculado.nuevo_orden;`;
            sqlDelete = `DELETE D FROM fo_desglose D \nINNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nWHERE R.codigo IN (${strTiendas}) \nAND D.idArticulo IN (${listaIn}) \nAND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''};`;
        }

        let textBackup = isExcel ? document.getElementById('articulos_excel_del').value.replace(/\r?\n|\r/g, " ") : document.getElementById('articulos_borrar').value.replace(/\r?\n|\r/g, " ");
        const sqlRollback = `SELECT 'Debes insertar de nuevo los articulos borrados: ${textBackup}' AS Info_Rollback;`;

        let deleteScript = wrapTransaction(sqlReorder + "\n\n" + sqlDelete, 'safeModeDel');

        document.getElementById('dq_audit').textContent = sqlAudit;
        document.getElementById('dq_reorder').textContent = sqlReorder;
        document.getElementById('dq_delete').textContent = deleteScript;
        document.getElementById('dq_rollback').textContent = sqlRollback;
        
        if(window.Prism) ['dq_audit','dq_reorder','dq_delete','dq_rollback'].forEach(id => Prism.highlightElement(document.getElementById(id)));

        document.getElementById('res-delete').style.display = 'block';
        document.getElementById('res-delete').scrollIntoView({behavior: "smooth"});
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function generarSQLSwap() {
    try {
        let isExcel = document.querySelector('input[name="modo_swap"]:checked').value === 'excel';
        let pairs = [];
        let allNewIds = []; 
        
        if (isExcel) {
            let validData = state.excel.swap.data.filter(d => d.valid && !d.duplicate && !d.conflict);
            if (validData.length === 0) { showNotification("¡Faltan pares válidos!"); return; }
            validData.forEach(d => {
                // Estandarización: Limpieza extra de los datos del Excel
                let sOld = safeInt(d.oldId.toString().replace(/\D/g, ''));
                let sNew = safeInt(d.newId.toString().replace(/\D/g, ''));
                pairs.push({ old: sOld, new: sNew });
                if (!allNewIds.includes(sNew)) allNewIds.push(sNew);
            });
        } else {
            const rows = document.querySelectorAll('#swap-rows tr');
            rows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                // Estandarización: Eliminar letras, símbolos o espacios accidentalmente tecleados
                const oldId = inputs[0].value.trim().replace(/\D/g, '');
                const newId = inputs[1].value.trim().replace(/\D/g, '');
                if (oldId && newId) {
                    let sOld = safeInt(oldId);
                    let sNew = safeInt(newId);
                    pairs.push({ old: sOld, new: sNew });
                    if (!allNewIds.includes(sNew)) allNewIds.push(sNew);
                }
            });
        }

        if (pairs.length === 0) { showNotification("Introduce al menos un par de artículos."); return; }
        
        // Estandarización: Límite de seguridad de lotes
        if (pairs.length > 500) {
            showNotification("⚠️ Límite excedido: Procesa un máximo de 500 pares de intercambio por lote.");
            return;
        }

        const checkedBoxes = document.querySelectorAll('#list-swap .store-item input:checked');
        let listaTiendas = Array.from(checkedBoxes).map(cb => safeInt(cb.value));
        if (listaTiendas.length === 0) { showNotification("Selecciona tiendas."); return; }

        let busq1 = document.getElementById('busq1_swap').value.trim();
        let inputBusq1 = document.getElementById('busq1_swap');

        // Estandarización: Control estricto de filtro vacío
        if(!busq1) { 
            if(!confirm("⚠️ ATENCIÓN: No has puesto Filtro de Grupo.\nSe intercambiarán en TODOS los grupos de las tiendas seleccionadas.\n¿Seguro?")) {
                if(inputBusq1) { inputBusq1.classList.add('input-error'); inputBusq1.focus(); }
                return;
            }
        } 
        if (inputBusq1) inputBusq1.classList.remove('input-error');
        if (busq1) agregarHistorial(busq1);

        let busq2 = document.getElementById('busq2_swap').value.trim();
        let tipo = document.getElementById('tipoBusqueda_swap').value;
        let campoSQL = obtenerCampoSQL('campoBusqueda_swap');

        const processTxt = (v) => (v && tipo === 'contains') ? `%${v}%` : (v || '%');
        let b1 = sqlEscape(processTxt(busq1));
        let b2 = (tipo === 'exact') ? '%' : sqlEscape(processTxt(busq2));
        let strTiendas = listaTiendas.join(',');

        let unionPairs = "";
        pairs.forEach((pair, index) => {
            if (index === 0) unionPairs += `SELECT '${pair.old}' as idViejo, '${pair.new}' as idNuevo`;
            else unionPairs += `\n    UNION ALL SELECT '${pair.old}', '${pair.new}'`;
        });
        
        let unionNewIds = "";
        allNewIds.forEach((id, index) => {
            if (index === 0) unionNewIds += `SELECT '${id}' as idArticulo`;
            else unionNewIds += `\n    UNION ALL SELECT '${id}'`;
        });
        
        let newIdsIn = allNewIds.map(a => `'${a}'`).join(',');

        let auditEspecifico = document.getElementById('auditGrupoEspecificoSwap') && document.getElementById('auditGrupoEspecificoSwap').checked;
        let opAuditoria = (tipo === 'exact') ? '=' : 'LIKE';
        let campoSub = campoSQL.replace('G.', 'G2.');

        let auditFilter = `AND ${campoSQL} ${opAuditoria} '${b1}' ${b2 !== '%' ? `AND ${campoSQL} ${opAuditoria} '${b2}'` : ''}`;
        let auditFilterSub = `WHERE ${campoSub} ${opAuditoria} '${b1}' ${b2 !== '%' ? `AND ${campoSub} ${opAuditoria} '${b2}'` : ''}`;

        let sqlAudit = `SELECT 'AUDITORIA' as Tipo, 
       CASE WHEN Destino.idArticulo IS NOT NULL THEN 'SE FUSIONARA (Borrar Viejo)' 
            ELSE 'SE CAMBIARA (Update)' END as Accion, 
       G.nombre as Grupo, R.codigo as Tienda, 
       Cambios.idViejo, Cambios.idNuevo
    FROM maeres R
    CROSS JOIN (${unionPairs}) Cambios
    INNER JOIN fo_desglose D ON D.idRestaurante = R.codigo AND D.idEmpresa = R.empresa AND D.idArticulo = Cambios.idViejo
    INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa
    LEFT JOIN fo_desglose Destino ON Destino.idRestaurante = R.codigo AND Destino.idEmpresa = R.empresa AND Destino.idGrupo = G.idGrupo AND Destino.idArticulo = Cambios.idNuevo
    WHERE R.codigo IN (${strTiendas})
    ${auditEspecifico ? auditFilter : ''}
    ORDER BY R.codigo, G.nombre;`;

        let sqlScript = `UPDATE fo_desglose D
    INNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa
    INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa
    INNER JOIN (${unionPairs}) Cambios ON D.idArticulo = Cambios.idViejo
    LEFT JOIN fo_desglose CheckDest ON CheckDest.idRestaurante = D.idRestaurante AND CheckDest.idEmpresa = D.idEmpresa AND CheckDest.idGrupo = D.idGrupo AND CheckDest.idArticulo = Cambios.idNuevo
    SET D.idArticulo = Cambios.idNuevo
    WHERE R.codigo IN (${strTiendas})
    AND ${campoSQL} LIKE '${b1}' ${busq2 ? `AND ${campoSQL} LIKE '${b2}'` : ''}
    AND CheckDest.idArticulo IS NULL;

    DELETE D 
    FROM fo_desglose D
    INNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa
    INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa
    INNER JOIN (${unionPairs}) Cambios ON D.idArticulo = Cambios.idViejo
    INNER JOIN fo_desglose ExisteNuevo ON ExisteNuevo.idRestaurante = D.idRestaurante AND ExisteNuevo.idEmpresa = D.idGrupo AND ExisteNuevo.idGrupo = D.idGrupo AND ExisteNuevo.idArticulo = Cambios.idNuevo
    WHERE R.codigo IN (${strTiendas})
    AND ${campoSQL} LIKE '${b1}' ${busq2 ? `AND ${campoSQL} LIKE '${b2}'` : ''};

    UPDATE fo_desglose Destino
    INNER JOIN (
    SELECT DISTINCT D.idRestaurante, D.idEmpresa, D.idGrupo
    FROM fo_desglose D
    INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = D.idRestaurante AND G.idEmpresa = D.idEmpresa
    WHERE D.idArticulo IN (${newIdsIn}) 
    AND D.idRestaurante IN (${strTiendas}) 
    AND ${campoSQL} LIKE '${b1}' ${busq2 ? `AND ${campoSQL} LIKE '${b2}'` : ''}
    ) GruposAfectados ON Destino.idRestaurante = GruposAfectados.idRestaurante AND Destino.idEmpresa = GruposAfectados.idEmpresa AND Destino.idGrupo = GruposAfectados.idGrupo
    INNER JOIN (
    SELECT idRestaurante, idEmpresa, idGrupo, idArticulo, 
           @num_orden := IF(@grupo_actual = CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo), @num_orden + 1, 0) as nuevo_orden,
           @grupo_actual := CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo)
    FROM (
        SELECT D.idRestaurante, D.idEmpresa, D.idGrupo, D.idArticulo, D.orden
        FROM fo_desglose D
        INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = D.idRestaurante AND G.idEmpresa = D.idEmpresa
        INNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = D.idEmpresa
        WHERE D.idRestaurante IN (${strTiendas}) 
        AND ${campoSQL} LIKE '${b1}' ${busq2 ? `AND ${campoSQL} LIKE '${b2}'` : ''}
        AND MA.situacion <> 'B'
        ORDER BY D.idRestaurante, D.idEmpresa, D.idGrupo, COALESCE(D.orden, 999999) ASC, D.idArticulo ASC
        LIMIT 18446744073709551615
    ) Ordered, (SELECT @num_orden := 0, @grupo_actual := '') Vars
    ) Calculado ON Destino.idRestaurante = Calculado.idRestaurante AND Destino.idEmpresa = Calculado.idEmpresa AND Destino.idGrupo = Calculado.idGrupo AND Destino.idArticulo = Calculado.idArticulo
    SET Destino.orden = Calculado.nuevo_orden;`;

        let sqlCheck;
        if (auditEspecifico) {
            sqlCheck = `SELECT R.codigo, R.nombre as Tienda, 
           COALESCE(D.nombre_grupo, '---') as Grupo, 
           Lista.idArticulo, 
           CASE WHEN D.idArticulo IS NOT NULL THEN 'OK' ELSE 'FALTA' END as Estado,
           D.orden
    FROM maeres R
    CROSS JOIN (${unionNewIds}) Lista
    LEFT JOIN (
        SELECT D2.idRestaurante, D2.idEmpresa, D2.idArticulo, D2.idGrupo, G2.nombre as nombre_grupo, D2.orden
        FROM fo_desglose D2
        INNER JOIN fo_grupos G2 ON G2.idGrupo = D2.idGrupo AND G2.idRestaurante = D2.idRestaurante AND G2.idEmpresa = D2.idEmpresa
        ${auditFilterSub}
    ) D ON D.idRestaurante = R.codigo AND D.idEmpresa = R.empresa AND D.idArticulo = Lista.idArticulo
    WHERE R.codigo IN (${strTiendas})
    ORDER BY Estado ASC, R.codigo, D.nombre_grupo;`;
        } else {
            sqlCheck = `SELECT R.codigo, R.nombre as Tienda, 
           COALESCE(G.nombre, '---') as Grupo, 
           Lista.idArticulo, 
           CASE WHEN D.idArticulo IS NOT NULL THEN 'OK' ELSE 'FALTA' END as Estado,
           D.orden
    FROM maeres R
    CROSS JOIN (${unionNewIds}) Lista
    LEFT JOIN fo_desglose D ON D.idRestaurante = R.codigo AND D.idEmpresa = R.empresa AND D.idArticulo = Lista.idArticulo
    LEFT JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa
    WHERE R.codigo IN (${strTiendas})
    ORDER BY Estado ASC, R.codigo, G.nombre;`;
        }

        let unionRollback = "";
        pairs.forEach((pair, index) => {
            if (index === 0) unionRollback += `SELECT '${pair.new}' as idActual, '${pair.old}' as idAnterior`;
            else unionRollback += `\n    UNION ALL SELECT '${pair.new}', '${pair.old}'`;
        });

        let sqlRollback = `UPDATE fo_desglose D
    INNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa
    INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa
    INNER JOIN (${unionRollback}) Reverso ON D.idArticulo = Reverso.idActual
    LEFT JOIN fo_desglose CheckOld ON CheckOld.idRestaurante = D.idRestaurante AND CheckOld.idEmpresa = D.idEmpresa AND CheckOld.idGrupo = D.idGrupo AND CheckOld.idArticulo = Reverso.idAnterior
    SET D.idArticulo = Reverso.idAnterior
    WHERE R.codigo IN (${strTiendas})
    AND ${campoSQL} LIKE '${b1}' ${busq2 ? `AND ${campoSQL} LIKE '${b2}'` : ''}
    AND CheckOld.idArticulo IS NULL;`;

        document.getElementById('sq_audit').textContent = sqlAudit;
        document.getElementById('sq_full').textContent = wrapTransaction(sqlScript, 'safeModeSwap');
        document.getElementById('sq_check').textContent = sqlCheck;
        document.getElementById('sq_rollback').textContent = sqlRollback;
        
        if(window.Prism) ['sq_audit','sq_full','sq_check','sq_rollback'].forEach(id => Prism.highlightElement(document.getElementById(id)));

        document.getElementById('time-swap').innerText = `(Generado: ${new Date().toLocaleTimeString()})`;
        document.getElementById('res-swap').style.display = 'block';
        document.getElementById('res-swap').scrollIntoView({behavior: "smooth"});
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function generarSQLReparar() {
    try {
        const checkedBoxes = document.querySelectorAll('#list-repair .store-item input:checked');
        let listaTiendas = Array.from(checkedBoxes).map(cb => safeInt(cb.value));
        let busq1 = document.getElementById('busq1_repair').value.trim();
        let busq2 = document.getElementById('busq2_repair').value.trim();
        let tipo = document.getElementById('tipoBusqueda_repair').value;

        let campoSQL = obtenerCampoSQL('campoBusqueda_repair');

        if (listaTiendas.length === 0) { showNotification("Selecciona al menos una tienda."); return; }
        if (busq1) agregarHistorial(busq1);
        if (busq1 === "" && !confirm("Has dejado el filtro vacío. ¡Esto afectará a TODOS los grupos!\n¿Estás seguro?")) return;

        const processTxt = (v) => (v && tipo === 'contains') ? `%${v}%` : (v || '%');
        let b1 = sqlEscape(processTxt(busq1));
        let b2 = (tipo === 'exact') ? '%' : sqlEscape(processTxt(busq2));
        let strTiendas = listaTiendas.join(',');

        let sqlBackup = `SELECT D.* FROM fo_desglose D \nINNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nINNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = R.empresa \nWHERE R.codigo IN (${strTiendas}) \nAND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''} \nAND MA.situacion = 'B';`;

        const sqlDelete = `DELETE D FROM fo_desglose D \nINNER JOIN maeres R ON R.codigo = D.idRestaurante AND R.empresa = D.idEmpresa \nINNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nINNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = R.empresa \nWHERE R.codigo IN (${strTiendas}) \nAND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''} \nAND MA.situacion = 'B';`;
        
        const sqlUpdate = `UPDATE fo_desglose Destino \nINNER JOIN ( \n    SELECT \n        idRestaurante, idEmpresa, idGrupo, idArticulo, \n        @num_orden := IF(@grupo_actual = CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo), @num_orden + 1, 0) as nuevo_orden, \n        @grupo_actual := CONCAT(idRestaurante, '_', idEmpresa, '_', idGrupo) \n    FROM ( \n        SELECT D.idRestaurante, D.idEmpresa, D.idGrupo, D.idArticulo, D.orden \n        FROM fo_desglose D \n        INNER JOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = D.idRestaurante AND G.idEmpresa = D.idEmpresa \n        INNER JOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = D.idEmpresa \n        WHERE D.idRestaurante IN (${strTiendas}) \n        AND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''} \n        AND MA.situacion <> 'B' \n        ORDER BY \n            D.idRestaurante, D.idEmpresa, D.idGrupo, \n            COALESCE(D.orden, 999999) ASC, \n            D.idArticulo ASC \n        LIMIT 18446744073709551615 \n    ) Ordered, \n    (SELECT @num_orden := 0, @grupo_actual := '') Vars \n) Calculado ON Destino.idRestaurante = Calculado.idRestaurante \n   AND Destino.idEmpresa = Calculado.idEmpresa \n   AND Destino.idGrupo = Calculado.idGrupo \n   AND Destino.idArticulo = Calculado.idArticulo \nSET Destino.orden = Calculado.nuevo_orden;`;
        
        const sqlCheck = `SELECT R.nombre as Tienda, G.nombre as Grupo, G.idGrupo, D.idArticulo, D.orden, MA.situacion \nFROM maeres R \nJOIN fo_desglose D ON D.idRestaurante = R.codigo AND D.idEmpresa = R.empresa \nJOIN fo_grupos G ON G.idGrupo = D.idGrupo AND G.idRestaurante = R.codigo AND G.idEmpresa = R.empresa \nJOIN maeart MA ON MA.codigo = D.idArticulo AND MA.empresa = R.empresa \nWHERE R.codigo IN (${strTiendas}) \nAND ${campoSQL} LIKE '${b1}' ${b2 !== '%' ? `AND ${campoSQL} LIKE '${b2}'` : ''} \nORDER BY R.codigo, G.nombre, D.orden;`;

        let fullScript = wrapTransaction(sqlBackup + "\n\n" + sqlDelete + "\n\n" + sqlUpdate, 'safeModeRepair');

        document.getElementById('rq_delete').textContent = fullScript; 
        document.getElementById('rq_update').textContent = sqlUpdate; 
        document.getElementById('rq_check').textContent = sqlCheck;
        
        if(window.Prism) ['rq_delete','rq_update','rq_check'].forEach(id => Prism.highlightElement(document.getElementById(id)));

        document.getElementById('time-repair').innerText = `(Generado: ${new Date().toLocaleTimeString()})`;
        document.getElementById('res-repair').style.display = 'block';
        document.getElementById('res-repair').scrollIntoView({behavior: "smooth"});
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function generarAddPlantillas() {
    try {
        let modo = document.querySelector('input[name="modo_p_add"]:checked')?.value;
        let sql = ""; let auditSql = ""; let othersSql = "";

        const extraCols = "subfamilia, cajas, unidades, unidades_horario1, unidades_horario2, unidades_horario3, unidades_horario4, unidades_horario5, precio, orden, contacto, unidades_dia_1, unidades_dia_2, unidades_dia_3, unidades_dia_4, unidades_dia_5, unidades_dia_6, unidades_dia_7, tipo_stock_ideal, unidades_caja";
        const extraZeros = "0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0";
        
        const caseEstado = `CASE \n        WHEN c.codigo IS NULL THEN 'ERROR: NO HAY PLANTILLA'\n        WHEN MA.codigo IS NULL THEN 'ERROR: NO COPIADO'\n        WHEN MA.situacion = 'B' THEN 'FALTA (BAJA)'\n        WHEN d.articulo IS NOT NULL THEN 'OK' \n        ELSE 'FALTA' \n    END AS Estado`;
        const caseEstadoCod = `CASE \n        WHEN c.codigo IS NULL THEN 'ERROR: PLANTILLA INVÁLIDA'\n        WHEN MA.codigo IS NULL THEN 'ERROR: NO COPIADO'\n        WHEN MA.situacion = 'B' THEN 'FALTA (BAJA)'\n        WHEN d.articulo IS NOT NULL THEN 'OK' \n        ELSE 'FALTA' \n    END AS Estado`;

        if (modo === 'manual') {
            let listaArticulos = document.getElementById('prov-articulos').value.split(/[\r\n,]+/).map(s => s.trim()).filter(s => s !== '').map(a => safeInt(a));
            let proveedor = document.getElementById('prov-nombre').value.trim();
            let safeProv = sqlEscape(proveedor).replace(/\s+/g, '%');
            let stock = safeInt(document.getElementById('prov-stock').value || 0);
            let listaTiendas = Array.from(document.querySelectorAll('#list-add .store-item input:checked')).map(cb => safeInt(cb.value));

            if (listaArticulos.length === 0) return showNotification("⚠️ ¡Añade artículos!");
            if (!proveedor) return showNotification("⚠️ ¡Escribe el nombre del proveedor!");
            if (listaTiendas.length === 0) return showNotification("⚠️ ¡Selecciona al menos una tienda!");

            let orConds = listaTiendas.map(dbId => {
                const sObj = state.tiendasData.find(t => t.id === dbId);
                let tNum = sObj.name.split(' - ')[0].trim();
                return `c.nombre LIKE '%(T${tNum})%${safeProv}%'`;
            }).join('\n        OR ');

            sql = listaArticulos.map(art => `INSERT IGNORE INTO detplantilla (codigo, articulo, stock_ideal, ${extraCols})\nSELECT c.codigo, ${art}, ${stock}, ${extraZeros}, COALESCE(MA1.tipo_venta_central, ''), COALESCE(MA1.unid_caja, 0)\nFROM cabplantilla c\nLEFT JOIN maeart MA1 ON MA1.codigo = ${art} AND MA1.empresa = 1\nWHERE c.situacion = 'A'\n    AND (\n        ${orConds}\n    )\n    AND NOT EXISTS (SELECT 1 FROM detplantilla d WHERE d.codigo = c.codigo AND d.articulo = ${art});\n`).join('\n');
            
            let unionTiendas = listaTiendas.map((dbId, idx) => {
                const sObj = state.tiendasData.find(t => t.id === dbId);
                let tNum = sObj.name.split(' - ')[0].trim();
                let c_nom = `%(T${tNum})%${safeProv}%`;
                return idx === 0 ? `SELECT '${dbId}' AS e_cod, '${tNum}' AS t_num, '${c_nom}' AS c_nom` : ` UNION ALL SELECT '${dbId}', '${tNum}', '${c_nom}'`;
            }).join('');

            let unionArticulos = listaArticulos.map((art, idx) => idx === 0 ? `SELECT '${sqlEscape(art)}' AS idArticulo` : ` UNION ALL SELECT '${sqlEscape(art)}'`).join('');

            auditSql = `SELECT \n    ListaTiendas.t_num AS 'Nº Tienda', \n    COALESCE(c.codigo, '---') AS Codigo_Plantilla, \n    COALESCE(c.nombre, 'NO HAY PLANTILLA ACTIVA') AS Nombre_Plantilla, \n    ListaArticulos.idArticulo AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO EN EMPRESA') AS Descripcion, \n    '${stock}' AS Stock_A_Añadir, \n    ${caseEstado}, \n    MA.situacion \nFROM (\n    ${unionTiendas}\n) ListaTiendas\nCROSS JOIN (\n    ${unionArticulos}\n) ListaArticulos\nLEFT JOIN cabplantilla c ON c.nombre LIKE ListaTiendas.c_nom AND c.situacion = 'A'\nLEFT JOIN detplantilla d ON c.codigo = d.codigo AND d.articulo = ListaArticulos.idArticulo\nLEFT JOIN maeart MA ON MA.codigo = ListaArticulos.idArticulo AND MA.empresa = ListaTiendas.e_cod\nORDER BY Estado ASC, ListaTiendas.t_num, c.nombre, ListaArticulos.idArticulo;`;

            let uniqueArts = [...new Set(listaArticulos)];
            let unionArticulosOthers = uniqueArts.map((art, idx) => idx === 0 ? `SELECT '${sqlEscape(art)}' AS idArt` : ` UNION ALL SELECT '${sqlEscape(art)}'`).join('');
            let unionTiendasOthers = listaTiendas.map((dbId, idx) => {
                const sObj = state.tiendasData.find(t => t.id === dbId);
                let tNum = sObj.name.split(' - ')[0].trim();
                return idx === 0 ? `SELECT '${dbId}' AS e_cod, '${tNum}' AS t_num` : ` UNION ALL SELECT '${dbId}', '${tNum}'`;
            }).join('');

            othersSql = `SELECT DISTINCT \n    ListaTiendas.t_num AS 'Nº Tienda', \n    COALESCE(Existentes.codigo, '---') AS Codigo_Plantilla, \n    CASE \n        WHEN HayPlantilla.t_num IS NULL THEN '---' \n        WHEN Existentes.codigo IS NULL THEN 'NO INCLUIDA EN NINGUNA' \n        ELSE Existentes.nombre \n    END AS Nombre_Plantilla, \n    ListaArt.idArt AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO') AS Descripcion, \n    COALESCE(Existentes.stock_ideal, 0) AS Stock, \n    CASE \n        WHEN HayPlantilla.t_num IS NULL THEN 'ERROR: NO TIENE PLANTILLAS'\n        WHEN MA.codigo IS NULL THEN 'ERROR: NO COPIADO EN EMPRESA'\n        WHEN MA.situacion = 'B' THEN 'FALTA (BAJA)'\n        WHEN Existentes.codigo IS NOT NULL THEN 'OK'\n        ELSE 'FALTA'\n    END AS Estado\nFROM (\n    ${unionTiendasOthers}\n) ListaTiendas\nCROSS JOIN (\n    ${unionArticulosOthers}\n) ListaArt\nLEFT JOIN (\n    SELECT DISTINCT SUBSTRING_INDEX(SUBSTRING_INDEX(nombre, '(T', -1), ')', 1) AS t_num \n    FROM cabplantilla WHERE situacion = 'A'\n) HayPlantilla ON HayPlantilla.t_num = ListaTiendas.t_num\nLEFT JOIN maeart MA ON MA.codigo = ListaArt.idArt AND MA.empresa = ListaTiendas.e_cod\nLEFT JOIN (\n    SELECT d2.articulo, d2.stock_ideal, c2.codigo, c2.nombre\n    FROM detplantilla d2\n    INNER JOIN cabplantilla c2 ON c2.codigo = d2.codigo\n    WHERE c2.situacion = 'A'\n) AS Existentes ON Existentes.articulo = ListaArt.idArt AND Existentes.nombre LIKE CONCAT('%(T', ListaTiendas.t_num, ')%')\nORDER BY Estado ASC, ListaTiendas.t_num, Existentes.nombre, ListaArt.idArt;`;

        } else if (modo === 'excel_tienda') {
            let data = state.excel.p_add.data.filter(d => d.valid && !d.duplicate);
            if(data.length === 0) return showNotification("⚠️ Faltan datos en el Excel.");
            
            data.forEach(d => {
                let cleanNum = d.tienda.toString().trim();
                let dbId = excepcionesTiendas[cleanNum] || null;
                if (!dbId) {
                    const regexTienda = new RegExp(`^${cleanNum}(\\D|$)`, 'i');
                    const match = state.tiendasData.find(t => regexTienda.test(t.name) || t.id === cleanNum);
                    if (match) dbId = match.id;
                    else dbId = safeInt(cleanNum); 
                }
                
                let art = safeInt(d.art);
                let stock = safeInt(d.stock);
                let safeProv = sqlEscape(d.prov).replace(/\s+/g, '%');
                
                sql += `INSERT IGNORE INTO detplantilla (codigo, articulo, stock_ideal, ${extraCols})\nSELECT c.codigo, ${art}, ${stock}, ${extraZeros}, COALESCE(MA1.tipo_venta_central, ''), COALESCE(MA1.unid_caja, 0)\nFROM cabplantilla c\nLEFT JOIN maeart MA1 ON MA1.codigo = ${art} AND MA1.empresa = 1\nWHERE c.situacion = 'A'\nAND c.nombre LIKE '%(T${cleanNum})%${safeProv}%'\nAND NOT EXISTS (SELECT 1 FROM detplantilla d WHERE d.codigo = c.codigo AND d.articulo = ${art});\n\n`;
            });

            let unionIdeal = data.map((d, idx) => {
                let cleanNum = d.tienda.toString().trim();
                let dbId = excepcionesTiendas[cleanNum] || null;
                if (!dbId) {
                    const regexTienda = new RegExp(`^${cleanNum}(\\D|$)`, 'i');
                    const match = state.tiendasData.find(t => regexTienda.test(t.name) || t.id === cleanNum);
                    if (match) dbId = match.id;
                    else dbId = safeInt(cleanNum);
                }
                let art = safeInt(d.art);
                let stock = safeInt(d.stock);
                let safeProv = sqlEscape(d.prov).replace(/\s+/g, '%');
                let c_nom = `%(T${cleanNum})%${safeProv}%`;

                if (idx === 0) return `SELECT '${dbId}' AS e_cod, '${cleanNum}' AS t_num, '${c_nom}' AS c_nom, '${art}' AS idArticulo, '${stock}' AS stock`;
                return ` UNION ALL SELECT '${dbId}', '${cleanNum}', '${c_nom}', '${art}', '${stock}'`;
            }).join('\n    ');

            auditSql = `SELECT \n    ListaIdeal.t_num AS 'Nº Tienda', \n    COALESCE(c.codigo, '---') AS Codigo_Plantilla, \n    COALESCE(c.nombre, 'NO HAY PLANTILLA ACTIVA') AS Nombre_Plantilla, \n    ListaIdeal.idArticulo AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO EN EMPRESA') AS Descripcion, \n    ListaIdeal.stock AS Stock_A_Añadir, \n    ${caseEstado}, \n    MA.situacion \nFROM (\n    ${unionIdeal}\n) ListaIdeal\nLEFT JOIN cabplantilla c ON c.nombre LIKE ListaIdeal.c_nom AND c.situacion = 'A'\nLEFT JOIN detplantilla d ON c.codigo = d.codigo AND d.articulo = ListaIdeal.idArticulo\nLEFT JOIN maeart MA ON MA.codigo = ListaIdeal.idArticulo AND MA.empresa = ListaIdeal.e_cod\nORDER BY Estado ASC, ListaIdeal.t_num, c.nombre, ListaIdeal.idArticulo;`;

            let uniqueArts = [...new Set(data.map(d => safeInt(d.art)))];
            let unionArticulosOthers = uniqueArts.map((art, idx) => idx === 0 ? `SELECT '${sqlEscape(art)}' AS idArt` : ` UNION ALL SELECT '${sqlEscape(art)}'`).join('');
            
            let storeDataOthers = data.map(d => {
                let cleanNum = d.tienda.toString().trim();
                let dbId = excepcionesTiendas[cleanNum] || null;
                if (!dbId) {
                    const match = state.tiendasData.find(t => new RegExp(`^${cleanNum}(\\D|$)`, 'i').test(t.name) || t.id === cleanNum);
                    dbId = match ? match.id : safeInt(cleanNum); 
                }
                return { e_cod: dbId, t_num: cleanNum };
            });
            
            let uniqueStoresMap = new Map();
            storeDataOthers.forEach(s => uniqueStoresMap.set(s.e_cod, s.t_num));
            
            let unionTiendasOthers = Array.from(uniqueStoresMap.entries()).map(([e_cod, t_num], idx) => {
                return idx === 0 ? `SELECT '${e_cod}' AS e_cod, '${t_num}' AS t_num` : ` UNION ALL SELECT '${e_cod}', '${t_num}'`;
            }).join('');

            othersSql = `SELECT DISTINCT \n    ListaTiendas.t_num AS 'Nº Tienda', \n    COALESCE(Existentes.codigo, '---') AS Codigo_Plantilla, \n    CASE \n        WHEN HayPlantilla.t_num IS NULL THEN '---' \n        WHEN Existentes.codigo IS NULL THEN 'NO INCLUIDA EN NINGUNA' \n        ELSE Existentes.nombre \n    END AS Nombre_Plantilla, \n    ListaArt.idArt AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO') AS Descripcion, \n    COALESCE(Existentes.stock_ideal, 0) AS Stock, \n    CASE \n        WHEN HayPlantilla.t_num IS NULL THEN 'ERROR: NO TIENE PLANTILLAS'\n        WHEN MA.codigo IS NULL THEN 'ERROR: NO COPIADO EN EMPRESA'\n        WHEN MA.situacion = 'B' THEN 'FALTA (BAJA)'\n        WHEN Existentes.codigo IS NOT NULL THEN 'OK'\n        ELSE 'FALTA'\n    END AS Estado\nFROM (\n    ${unionTiendasOthers}\n) ListaTiendas\nCROSS JOIN (\n    ${unionArticulosOthers}\n) ListaArt\nLEFT JOIN (\n    SELECT DISTINCT SUBSTRING_INDEX(SUBSTRING_INDEX(nombre, '(T', -1), ')', 1) AS t_num \n    FROM cabplantilla WHERE situacion = 'A'\n) HayPlantilla ON HayPlantilla.t_num = ListaTiendas.t_num\nLEFT JOIN maeart MA ON MA.codigo = ListaArt.idArt AND MA.empresa = ListaTiendas.e_cod\nLEFT JOIN (\n    SELECT d2.articulo, d2.stock_ideal, c2.codigo, c2.nombre\n    FROM detplantilla d2\n    INNER JOIN cabplantilla c2 ON c2.codigo = d2.codigo\n    WHERE c2.situacion = 'A'\n) AS Existentes ON Existentes.articulo = ListaArt.idArt AND Existentes.nombre LIKE CONCAT('%(T', ListaTiendas.t_num, ')%')\nORDER BY Estado ASC, ListaTiendas.t_num, Existentes.nombre, ListaArt.idArt;`;

        } else {
            let data = state.excel.p_add.data.filter(d => d.valid && !d.duplicate);
            if(data.length === 0) return showNotification("⚠️ Faltan datos en el Excel.");

            let batchSize = 500; 
            for (let i = 0; i < data.length; i += batchSize) {
                let chunk = data.slice(i, i + batchSize);
                let unionTemp = chunk.map((d, idx) => {
                    return idx === 0 ? `SELECT '${safeInt(d.cod)}' AS cod, '${safeInt(d.art)}' AS art, '${safeInt(d.stock)}' AS stock` : ` UNION ALL SELECT '${safeInt(d.cod)}', '${safeInt(d.art)}', '${safeInt(d.stock)}'`;
                }).join('');
                
                sql += `INSERT IGNORE INTO detplantilla (codigo, articulo, stock_ideal, ${extraCols})\nSELECT Temp.cod, Temp.art, Temp.stock, ${extraZeros}, COALESCE(MA1.tipo_venta_central, ''), COALESCE(MA1.unid_caja, 0)\nFROM (\n    ${unionTemp}\n) Temp\nLEFT JOIN maeart MA1 ON MA1.codigo = Temp.art AND MA1.empresa = 1\nWHERE NOT EXISTS (SELECT 1 FROM detplantilla d WHERE d.codigo = Temp.cod AND d.articulo = Temp.art);\n\n`;
            }
            
            let unionIdealCod = data.map((d, idx) => {
                if (idx === 0) return `SELECT '${safeInt(d.cod)}' AS cod, '${safeInt(d.art)}' AS idArticulo, '${safeInt(d.stock)}' AS stock`;
                return ` UNION ALL SELECT '${safeInt(d.cod)}', '${safeInt(d.art)}', '${safeInt(d.stock)}'`;
            }).join('\n    ');

            auditSql = `SELECT \n    COALESCE(SUBSTRING_INDEX(SUBSTRING_INDEX(c.nombre, '(T', -1), ')', 1), '---') AS 'Nº Tienda',\n    ListaIdeal.cod AS Codigo_Plantilla, \n    COALESCE(c.nombre, 'PLANTILLA INVÁLIDA') AS Nombre_Plantilla, \n    ListaIdeal.idArticulo AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO') AS Descripcion, \n    ListaIdeal.stock AS Stock_A_Añadir, \n    ${caseEstadoCod}, \n    MA.situacion \nFROM (\n    ${unionIdealCod}\n) ListaIdeal\nLEFT JOIN cabplantilla c ON c.codigo = ListaIdeal.cod AND c.situacion = 'A'\nLEFT JOIN maecli m ON m.codigo = c.cliente\nLEFT JOIN maeemp e ON e.codigo = m.empresa\nLEFT JOIN detplantilla d ON c.codigo = d.codigo AND d.articulo = ListaIdeal.idArticulo\nLEFT JOIN maeart MA ON MA.codigo = ListaIdeal.idArticulo AND MA.empresa = e.codigo\nORDER BY Estado ASC, \`Nº Tienda\`, c.nombre, ListaIdeal.idArticulo;`;

            let uniqueArts = [...new Set(data.map(d => safeInt(d.art)))];
            let unionArticulosOthers = uniqueArts.map((art, idx) => idx === 0 ? `SELECT '${sqlEscape(art)}' AS idArt` : ` UNION ALL SELECT '${sqlEscape(art)}'`).join('');
            
            let uniqueCods = [...new Set(data.map(d => safeInt(d.cod)))];
            let codsIn = uniqueCods.join(', ');
            
            let unionTiendasOthers = `SELECT DISTINCT m.empresa AS e_cod, SUBSTRING_INDEX(SUBSTRING_INDEX(c.nombre, '(T', -1), ')', 1) AS t_num FROM cabplantilla c INNER JOIN maecli m ON m.codigo = c.cliente WHERE c.codigo IN (${codsIn})`;

            othersSql = `SELECT DISTINCT \n    ListaTiendas.t_num AS 'Nº Tienda', \n    COALESCE(Existentes.codigo, '---') AS Codigo_Plantilla, \n    CASE \n        WHEN HayPlantilla.t_num IS NULL THEN '---' \n        WHEN Existentes.codigo IS NULL THEN 'NO INCLUIDA EN NINGUNA' \n        ELSE Existentes.nombre \n    END AS Nombre_Plantilla, \n    ListaArt.idArt AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO') AS Descripcion, \n    COALESCE(Existentes.stock_ideal, 0) AS Stock, \n    CASE \n        WHEN HayPlantilla.t_num IS NULL THEN 'ERROR: NO TIENE PLANTILLAS'\n        WHEN MA.codigo IS NULL THEN 'ERROR: NO COPIADO EN EMPRESA'\n        WHEN MA.situacion = 'B' THEN 'FALTA (BAJA)'\n        WHEN Existentes.codigo IS NOT NULL THEN 'OK'\n        ELSE 'FALTA'\n    END AS Estado\nFROM (\n    ${unionTiendasOthers}\n) ListaTiendas\nCROSS JOIN (\n    ${unionArticulosOthers}\n) ListaArt\nLEFT JOIN (\n    SELECT DISTINCT SUBSTRING_INDEX(SUBSTRING_INDEX(nombre, '(T', -1), ')', 1) AS t_num \n    FROM cabplantilla WHERE situacion = 'A'\n) HayPlantilla ON HayPlantilla.t_num = ListaTiendas.t_num\nLEFT JOIN maeart MA ON MA.codigo = ListaArt.idArt AND MA.empresa = ListaTiendas.e_cod\nLEFT JOIN (\n    SELECT d2.articulo, d2.stock_ideal, c2.codigo, c2.nombre\n    FROM detplantilla d2\n    INNER JOIN cabplantilla c2 ON c2.codigo = d2.codigo\n    WHERE c2.situacion = 'A'\n) AS Existentes ON Existentes.articulo = ListaArt.idArt AND Existentes.nombre LIKE CONCAT('%(T', ListaTiendas.t_num, ')%')\nORDER BY Estado ASC, ListaTiendas.t_num, Existentes.nombre, ListaArt.idArt;`;
        }

        inyectarSQLPlantillas('res-add', 'out-add', wrapTransactionPlantillas(sql.trim()));
        inyectarSQLPlantillas('res-add', 'out-add-audit', auditSql);
        inyectarSQLPlantillas('res-add', 'out-add-others', othersSql);
        
        showNotification(`✅ Consultas generadas.`);
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function generarDelExcelPlantillas() {
    try {
        let modo = document.querySelector('input[name="modo_p_del"]:checked')?.value;
        let sql = ""; let auditSql = "";

        const caseEstadoDel = `CASE \n        WHEN c.codigo IS NULL THEN 'ERROR: NO HAY PLANTILLA'\n        WHEN d.articulo IS NOT NULL THEN 'SE BORRARÁ'\n        ELSE 'YA NO ESTÁ (OK)' \n    END AS Estado`;
        const caseEstadoDelCod = `CASE \n        WHEN c.codigo IS NULL THEN 'ERROR: PLANTILLA INVÁLIDA'\n        WHEN d.articulo IS NOT NULL THEN 'SE BORRARÁ'\n        ELSE 'YA NO ESTÁ (OK)' \n    END AS Estado`;

        if (modo === 'manual') {
            let listaArticulos = document.getElementById('prov-articulos-del').value.split(/[\r\n,]+/).map(s => s.trim()).filter(s => s !== '').map(a => safeInt(a));
            let proveedor = document.getElementById('prov-nombre-del').value.trim();
            let safeProv = sqlEscape(proveedor).replace(/\s+/g, '%');
            let listaTiendas = Array.from(document.querySelectorAll('#list-del .store-item input:checked')).map(cb => safeInt(cb.value));

            if (listaArticulos.length === 0) return showNotification("⚠️ ¡Añade artículos a eliminar!");
            if (!proveedor) return showNotification("⚠️ ¡Escribe el nombre del proveedor!");
            if (listaTiendas.length === 0) return showNotification("⚠️ ¡Selecciona al menos una tienda!");

            let orConds = listaTiendas.map(dbId => {
                const sObj = state.tiendasData.find(t => t.id === dbId);
                let tNum = sObj.name.split(' - ')[0].trim();
                return `c.nombre LIKE '%(T${tNum})%${safeProv}%'`;
            }).join('\n        OR ');

            let artsJoined = listaArticulos.map(a => `'${a}'`).join(', ');

            sql = `DELETE d FROM detplantilla d\nINNER JOIN cabplantilla c ON d.codigo = c.codigo\nWHERE d.articulo IN (${artsJoined})\nAND c.situacion = 'A'\nAND (\n        ${orConds}\n);`;

            let unionTiendas = listaTiendas.map((dbId, idx) => {
                const sObj = state.tiendasData.find(t => t.id === dbId);
                let tNum = sObj.name.split(' - ')[0].trim();
                let c_nom = `%(T${tNum})%${safeProv}%`;
                return idx === 0 ? `SELECT '${dbId}' AS e_cod, '${tNum}' AS t_num, '${c_nom}' AS c_nom` : ` UNION ALL SELECT '${dbId}', '${tNum}', '${c_nom}'`;
            }).join('');

            let unionArticulos = listaArticulos.map((art, idx) => idx === 0 ? `SELECT '${sqlEscape(art)}' AS idArticulo` : ` UNION ALL SELECT '${sqlEscape(art)}'`).join('');

            auditSql = `SELECT \n    ListaTiendas.t_num AS 'Nº Tienda', \n    COALESCE(c.codigo, '---') AS Codigo_Plantilla, \n    COALESCE(c.nombre, 'NO HAY PLANTILLA ACTIVA') AS Nombre_Plantilla, \n    ListaArticulos.idArticulo AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO EN EMPRESA') AS Descripcion, \n    ${caseEstadoDel}\nFROM (\n    ${unionTiendas}\n) ListaTiendas\nCROSS JOIN (\n    ${unionArticulos}\n) ListaArticulos\nLEFT JOIN cabplantilla c ON c.nombre LIKE ListaTiendas.c_nom AND c.situacion = 'A'\nLEFT JOIN detplantilla d ON c.codigo = d.codigo AND d.articulo = ListaArticulos.idArticulo\nLEFT JOIN maeart MA ON MA.codigo = ListaArticulos.idArticulo AND MA.empresa = ListaTiendas.e_cod\nORDER BY Estado ASC, ListaTiendas.t_num, c.nombre, ListaArticulos.idArticulo;`;

        } else if (modo === 'excel_tienda') {
            let data = state.excel.p_del.data.filter(d => d.valid && !d.duplicate);
            if(data.length === 0) return showNotification("⚠️ Faltan datos en el Excel.");
            
            data.forEach(d => {
                let cleanNum = d.tienda.toString().trim();
                let dbId = excepcionesTiendas[cleanNum] || null;
                if (!dbId) {
                    const regexTienda = new RegExp(`^${cleanNum}(\\D|$)`, 'i');
                    const match = state.tiendasData.find(t => regexTienda.test(t.name) || t.id === cleanNum);
                    if (match) dbId = match.id;
                    else dbId = safeInt(cleanNum); 
                }
                
                let art = safeInt(d.art);
                let safeProv = sqlEscape(d.prov).replace(/\s+/g, '%');
                
                sql += `DELETE d FROM detplantilla d\nINNER JOIN cabplantilla c ON d.codigo = c.codigo\nWHERE d.articulo = ${art}\nAND c.situacion = 'A'\nAND c.nombre LIKE '%(T${cleanNum})%${safeProv}%';\n\n`;
            });

            let unionIdeal = data.map((d, idx) => {
                let cleanNum = d.tienda.toString().trim();
                let dbId = excepcionesTiendas[cleanNum] || null;
                if (!dbId) {
                    const regexTienda = new RegExp(`^${cleanNum}(\\D|$)`, 'i');
                    const match = state.tiendasData.find(t => regexTienda.test(t.name) || t.id === cleanNum);
                    if (match) dbId = match.id;
                    else dbId = safeInt(cleanNum);
                }
                let art = safeInt(d.art);
                let safeProv = sqlEscape(d.prov).replace(/\s+/g, '%');
                let c_nom = `%(T${cleanNum})%${safeProv}%`;

                if (idx === 0) return `SELECT '${dbId}' AS e_cod, '${cleanNum}' AS t_num, '${c_nom}' AS c_nom, '${art}' AS idArticulo`;
                return ` UNION ALL SELECT '${dbId}', '${cleanNum}', '${c_nom}', '${art}'`;
            }).join('\n    ');

            auditSql = `SELECT \n    ListaIdeal.t_num AS 'Nº Tienda', \n    COALESCE(c.codigo, '---') AS Codigo_Plantilla, \n    COALESCE(c.nombre, 'NO HAY PLANTILLA ACTIVA') AS Nombre_Plantilla, \n    ListaIdeal.idArticulo AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO EN EMPRESA') AS Descripcion, \n    ${caseEstadoDel}\nFROM (\n    ${unionIdeal}\n) ListaIdeal\nLEFT JOIN cabplantilla c ON c.nombre LIKE ListaIdeal.c_nom AND c.situacion = 'A'\nLEFT JOIN detplantilla d ON c.codigo = d.codigo AND d.articulo = ListaIdeal.idArticulo\nLEFT JOIN maeart MA ON MA.codigo = ListaIdeal.idArticulo AND MA.empresa = ListaIdeal.e_cod\nORDER BY Estado ASC, ListaIdeal.t_num, c.nombre, ListaIdeal.idArticulo;`;

        } else {
            let data = state.excel.p_del.data.filter(d => d.valid && !d.duplicate);
            if(data.length === 0) return showNotification("⚠️ Faltan datos en el Excel.");

            let batchSize = 1000; 
            let values = data.map(d => `(d.codigo = ${safeInt(d.cod)} AND d.articulo = ${safeInt(d.art)})`);
            
            for (let i = 0; i < values.length; i += batchSize) {
                sql += `DELETE d FROM detplantilla d WHERE ` + values.slice(i, i + batchSize).join(" OR ") + `;\n\n`;
            }
            
            let unionIdealCod = data.map((d, idx) => {
                if (idx === 0) return `SELECT '${safeInt(d.cod)}' AS cod, '${safeInt(d.art)}' AS idArticulo`;
                return ` UNION ALL SELECT '${safeInt(d.cod)}', '${safeInt(d.art)}'`;
            }).join('\n    ');

            auditSql = `SELECT \n    COALESCE(SUBSTRING_INDEX(SUBSTRING_INDEX(c.nombre, '(T', -1), ')', 1), '---') AS 'Nº Tienda',\n    ListaIdeal.cod AS Codigo_Plantilla, \n    COALESCE(c.nombre, 'PLANTILLA INVÁLIDA') AS Nombre_Plantilla, \n    ListaIdeal.idArticulo AS Articulo, \n    COALESCE(MA.descripcion_principal, 'NO COPIADO') AS Descripcion, \n    ${caseEstadoDelCod}\nFROM (\n    ${unionIdealCod}\n) ListaIdeal\nLEFT JOIN cabplantilla c ON c.codigo = ListaIdeal.cod AND c.situacion = 'A'\nLEFT JOIN maecli m ON m.codigo = c.cliente\nLEFT JOIN maeemp e ON e.codigo = m.empresa\nLEFT JOIN detplantilla d ON c.codigo = d.codigo AND d.articulo = ListaIdeal.idArticulo\nLEFT JOIN maeart MA ON MA.codigo = ListaIdeal.idArticulo AND MA.empresa = e.codigo\nORDER BY Estado ASC, c.nombre, ListaIdeal.idArticulo;`;
        }

        inyectarSQLPlantillas('res-excel-del', 'out-excel-del', wrapTransactionPlantillas(sql.trim()));
        inyectarSQLPlantillas('res-excel-del', 'out-excel-del-audit', auditSql);

        showNotification(`✅ Consultas de borrado generadas.`);
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function generarVaciarPlantillas(codigosRaw) {
    try {
        let codigos = [...new Set(codigosRaw)].map(c => safeInt(c));
        if (codigos.length === 0) return { error: "⚠️ Introduce códigos válidos." };
        
        let sql = `DELETE FROM detplantilla WHERE codigo IN (${codigos.join(', ')});`;
        let auditSql = `SELECT * FROM detplantilla WHERE codigo IN (${codigos.join(', ')});`;

        return {
            sql: wrapTransactionPlantillas(sql),
            auditSql: auditSql
        };
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
        return { error: "⚠️ Error en los datos proporcionados." };
    }
}

export function generarUpdateNombrePlantillas() {
    try {
        let data = state.excel.p_upd.data.filter(d => d.valid && !d.duplicate);
        if(data.length === 0) return showNotification("⚠️ Faltan datos o cabeceras válidas.");
        
        let sql = data.map(d => `UPDATE cabplantilla SET nombre = '${sqlEscape(d.nombre)}' WHERE codigo = ${safeInt(d.cod)};`).join('\n');
        inyectarSQLPlantillas('res-update', 'out-update', wrapTransactionPlantillas(sql));
        showNotification("✅ Consultas UPDATE masivas generadas.");
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function generarConsultaPlantillas() {
    try {
        let provRaw = document.getElementById('cons-prov').value.trim();
        let clientesRaw = document.getElementById('cons-clientes').value.split(/[\r\n,]+/).map(s => s.trim()).filter(s => s !== '');
        
        if (!provRaw || clientesRaw.length === 0) return showNotification("⚠️ Debes indicar el ID del Proveedor y Clientes.");

        let prov = safeInt(provRaw);
        let clientes = clientesRaw.map(c => safeInt(c));

        let sql = `SELECT \n    c.codigo, \n    c.nombre, \n    d.articulo, \n    d.stock_ideal,\n    c.cliente\nFROM \n    cabplantilla c\nINNER JOIN \n    detplantilla d ON c.codigo = d.codigo\nWHERE \n    c.situacion = 'A'\n    AND c.proveedor = ${prov}\n    AND c.cliente IN (\n        ${clientes.join(', ')}\n    );`;
        inyectarSQLPlantillas('res-consulta', 'out-consulta', sql);
        
        document.getElementById('out-consulta').dataset.fullSql = "MEM_CACHE";
        window.fullSqlCache = window.fullSqlCache || {};
        window.fullSqlCache['out-consulta'] = sql;

        showNotification("✅ Consulta SELECT generada.");
    } catch (error) {
        console.error("Ejecución SQL detenida por seguridad:", error);
    }
}

export function copiarMasivo(btn) {
    const activeTab = document.querySelector('.app-section.active .tab-content.active');
    if (!activeTab) { showNotification("No hay pestaña activa."); return; }
    
    const outputSections = activeTab.querySelectorAll('.output-section');
    let hasVisibleContent = false;
    let fullText = "";
    
    let tabId = activeTab.id;
    let cleanCheckboxId = '';
    
    // TPVs
    if (tabId === 'tab-masivo') cleanCheckboxId = 'cleanCopyMass';
    else if (tabId === 'tab-borrar') cleanCheckboxId = 'cleanCopyDel';
    else if (tabId === 'tab-swap') cleanCheckboxId = 'cleanCopySwap';
    // Plantillas
    else if (tabId === 'tab-add') cleanCheckboxId = 'cleanCopyAddPlantillas';
    else if (tabId === 'tab-excel-del') cleanCheckboxId = 'cleanCopyDelPlantillas';
    else if (tabId === 'tab-vaciar') cleanCheckboxId = 'cleanCopyVaciarPlantillas';
    else if (tabId === 'tab-consulta') cleanCheckboxId = 'cleanCopyConsultaPlantillas';
    
    let isCleanCopy = document.getElementById(cleanCheckboxId) && document.getElementById(cleanCheckboxId).checked;

    outputSections.forEach(outputSection => {
        if (outputSection.style.display !== 'none' && outputSection.style.display !== '') {
            hasVisibleContent = true;
            const codeBlocks = outputSection.querySelectorAll('code[class*="language-sql"]');
            
            codeBlocks.forEach((block, index) => {
                if (!isCleanCopy) {
                    const header = block.closest('.accordion-item')?.querySelector('.accordion-header');
                    const title = header ? header.innerText : 'CONSULTA';
                    fullText += `-- [ ${title} ] --\n`;
                }
                
                let blockSql = (window.fullSqlCache && window.fullSqlCache[block.id]) ? window.fullSqlCache[block.id] : (block.dataset.fullSql || block.textContent);
                fullText += blockSql + "\n\n";
            });
        }
    });

    if (!hasVisibleContent) { showNotification("⚠️ Genera las consultas primero."); return; }
    copyToClipboard(fullText, btn);
}

export function descargarSQL(type) {
    let content = "";
    let groupName = document.getElementById('busq1')?.value || document.getElementById('busq1_del')?.value || document.getElementById('busq1_swap')?.value || document.getElementById('busq1_repair')?.value || "Global";
    groupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
    
    let filename = `${type}_${groupName}_${new Date().toISOString().slice(0,10)}.sql`;
    
    // TPVs
    if (type === 'mass') {
        if (!document.getElementById('mq1').textContent) { showNotification("Genera primero"); return; }
        content = document.getElementById('mq0').textContent + "\n\n" + document.getElementById('mq2').textContent + "\n\n" + document.getElementById('mq3').textContent;
    } else if (type === 'delete') {
        if (!document.getElementById('dq_delete').textContent) { showNotification("Genera primero"); return; }
        content = document.getElementById('dq_reorder').textContent + "\n\n" + document.getElementById('dq_delete').textContent;
    } else if (type === 'swap') {
        if (!document.getElementById('sq_full').textContent) { showNotification("Genera primero"); return; }
        content = document.getElementById('sq_full').textContent;
    } else if (type === 'repair') {
        if (!document.getElementById('rq_delete').textContent) { showNotification("Genera primero"); return; }
        content = document.getElementById('rq_delete').textContent + "\n\n" + document.getElementById('rq_update').textContent;
    }
    // Plantillas
    else if (type === 'p_add') {
        let ins = (window.fullSqlCache && window.fullSqlCache['out-add']) || document.getElementById('out-add').textContent;
        let aud = (window.fullSqlCache && window.fullSqlCache['out-add-audit']) || document.getElementById('out-add-audit').textContent;
        let oth = (window.fullSqlCache && window.fullSqlCache['out-add-others']) || document.getElementById('out-add-others').textContent;
        content = ins + "\n\n" + aud + "\n\n" + oth;
    } else if (type === 'p_del') {
        let del = (window.fullSqlCache && window.fullSqlCache['out-excel-del']) || document.getElementById('out-excel-del').textContent;
        let aud = (window.fullSqlCache && window.fullSqlCache['out-excel-del-audit']) || document.getElementById('out-excel-del-audit').textContent;
        content = del + "\n\n" + aud;
    } else if (type === 'p_vaciar') {
        let vac = (window.fullSqlCache && window.fullSqlCache['out-vaciar']) || document.getElementById('out-vaciar').textContent;
        let aud = (window.fullSqlCache && window.fullSqlCache['out-vaciar-audit']) || document.getElementById('out-vaciar-audit').textContent;
        content = vac + "\n\n" + aud;
    } else if (type === 'p_cons') {
        let sel = (window.fullSqlCache && window.fullSqlCache['out-consulta']) || document.getElementById('out-consulta').textContent;
        let upd = (window.fullSqlCache && window.fullSqlCache['out-update']) || document.getElementById('out-update').textContent;
        content = sel + "\n\n" + upd;
    }
    
    if (!content || content.trim() === "") { showNotification("⚠️ Genera las consultas primero."); return; }

    const blob = new Blob([content], { type: 'text/sql' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}