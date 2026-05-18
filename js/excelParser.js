export function parseExcelData(rawText, tab) {
    let val = rawText.trim();
    
    if (!val) {
        return { data: [], errors: false, conflictsFound: false, duplicateCount: 0 };
    }

    let parsedData = [];
    let errors = false;
    let exactDuplicates = 0;
    let seenExact = new Set();

    try {
        const workbook = window.XLSX.read(val, { type: 'string', raw: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const filas = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

        let hasHeader = false;
        if (filas.length > 0) {
            let firstRowParts = filas[0].map(p => p != null ? String(p).trim() : '');
            if (firstRowParts.length > 0 && !/\d/.test(firstRowParts[0])) {
                hasHeader = true; 
            }
        }

        filas.forEach((rawParts, i) => {
            if (hasHeader && i === 0) return; 

            let parts = rawParts.map(p => p != null ? String(p).trim() : '');
            
            // --- LOGICA TPVs ---
            if (['mass', 'del', 'swap'].includes(tab)) {
                let modoMasivo = tab === 'mass' ? document.querySelector('input[name="modo_masivo"]:checked')?.value : null;

                if (modoMasivo === 'excel_tienda') {
                    if (parts.length >= 3) {
                        let colTienda = parts[0];
                        let colArt = parts[1];
                        let colGrp = parts[2];
                        
                        if (colTienda !== '' && !isNaN(colArt) && colArt !== '') {
                            let exactKey = colTienda + '-' + colArt + '-' + colGrp;
                            let isExactDuplicate = seenExact.has(exactKey);
                            seenExact.add(exactKey);
                            if (isExactDuplicate) exactDuplicates++;

                            let isValid = (colArt.length >= 4 && colArt.length <= 6);
                            parsedData.push({ tienda: colTienda, art: colArt, grp: colGrp, valid: isValid, conflict: false, duplicate: isExactDuplicate });
                            if (!isValid) errors = true;
                        } else { errors = true; }
                    } else { errors = true; }
                } else {
                    if (parts.length >= 2) {
                        let col1 = parts[0];
                        let col2 = parts[1];
                        
                        if (isNaN(col1) || col1 === '') { errors = true; } 
                        else {
                            let exactKey = col1 + '-' + col2;
                            let isExactDuplicate = seenExact.has(exactKey);
                            seenExact.add(exactKey);
                            if (isExactDuplicate) exactDuplicates++;

                            let isValid = (col1.length >= 4 && col1.length <= 6);
                            
                            if (tab === 'swap') {
                                parsedData.push({ oldId: col1, newId: col2, valid: isValid, conflict: false, duplicate: isExactDuplicate });
                            } else {
                                parsedData.push({ art: col1, grp: col2, valid: isValid, conflict: false, duplicate: isExactDuplicate });
                            }
                            if (!isValid) errors = true;
                        }
                    } else { errors = true; }
                }
            } 
            
            // --- LOGICA PLANTILLAS ---
            else if (tab === 'p_add') {
                let isTiendas = document.querySelector('input[name="modo_p_add"]:checked')?.value === 'excel_tienda';
                if (isTiendas) {
                    if (parts.length >= 4) {
                        let colTienda = parts[0];
                        let colArt = parts[1];
                        let colStock = parts[2];
                        let colProv = parts[3];
                        if (colTienda !== '' && !isNaN(colArt) && colArt !== '' && colProv !== '') {
                            let isExactDuplicate = seenExact.has(colTienda + '-' + colArt + '-' + colProv);
                            seenExact.add(colTienda + '-' + colArt + '-' + colProv);
                            if (isExactDuplicate) exactDuplicates++;
                            parsedData.push({ tienda: colTienda, art: colArt, stock: colStock, prov: colProv, valid: true, conflict: false, duplicate: isExactDuplicate });
                        } else { errors = true; }
                    } else { errors = true; }
                } else {
                    if (parts.length >= 3) {
                        let colCod = parts[0];
                        let colArt = parts[1];
                        let colStock = parts[2];
                        if (!isNaN(colCod) && !isNaN(colArt) && colCod !== '') {
                            let isExactDuplicate = seenExact.has(colCod + '-' + colArt);
                            seenExact.add(colCod + '-' + colArt);
                            if (isExactDuplicate) exactDuplicates++;
                            parsedData.push({ cod: colCod, art: colArt, stock: colStock, valid: true, conflict: false, duplicate: isExactDuplicate });
                        } else { errors = true; }
                    } else { errors = true; }
                }
            } 
            // NUEVA LÓGICA ELIMINAR PLANTILLAS
            else if (tab === 'p_del') {
                let isTiendas = document.querySelector('input[name="modo_p_del"]:checked')?.value === 'excel_tienda';
                if (isTiendas) {
                    if (parts.length >= 3) {
                        let colTienda = parts[0];
                        let colArt = parts[1];
                        let colProv = parts[2];
                        if (colTienda !== '' && !isNaN(colArt) && colArt !== '' && colProv !== '') {
                            let isExactDuplicate = seenExact.has(colTienda + '-' + colArt + '-' + colProv);
                            seenExact.add(colTienda + '-' + colArt + '-' + colProv);
                            if (isExactDuplicate) exactDuplicates++;
                            parsedData.push({ tienda: colTienda, art: colArt, prov: colProv, valid: true, conflict: false, duplicate: isExactDuplicate });
                        } else { errors = true; }
                    } else { errors = true; }
                } else {
                    if (parts.length >= 2) {
                        let colCod = parts[0];
                        let colArt = parts[1];
                        if (!isNaN(colCod) && !isNaN(colArt) && colCod !== '') {
                            let isExactDuplicate = seenExact.has(colCod + '-' + colArt);
                            seenExact.add(colCod + '-' + colArt);
                            if (isExactDuplicate) exactDuplicates++;
                            parsedData.push({ cod: colCod, art: colArt, valid: true, conflict: false, duplicate: isExactDuplicate });
                        } else { errors = true; }
                    } else { errors = true; }
                }
            }
            else if (tab === 'p_upd') {
                if (parts.length >= 2) {
                    let colCod = parts[0];
                    let colNombre = parts.slice(1).join(' ');
                    if (!isNaN(colCod) && colCod !== '') {
                        let isExactDuplicate = seenExact.has(colCod);
                        seenExact.add(colCod);
                        if (isExactDuplicate) exactDuplicates++;
                        parsedData.push({ cod: colCod, nombre: colNombre, valid: true, conflict: false, duplicate: isExactDuplicate });
                    } else { errors = true; }
                } else { errors = true; }
            }
        });
    } catch (error) {
        console.error("Error procesando Excel con SheetJS:", error);
        return { data: [], errors: true, conflictsFound: false, duplicateCount: 0 };
    }

    let conflictsFound = false;

    if (['mass', 'del'].includes(tab)) {
        let mapArtGrp = {};
        parsedData.forEach(d => {
            if (!d.duplicate) {
                if (!mapArtGrp[d.art]) mapArtGrp[d.art] = new Set();
                mapArtGrp[d.art].add(d.grp);
                if (mapArtGrp[d.art].size > 1) conflictsFound = true;
            }
        });

        parsedData.forEach(d => {
            if (mapArtGrp[d.art] && mapArtGrp[d.art].size > 1) d.conflict = true;
        });
    } else if (tab === 'swap') {
        conflictsFound = parsedData.some(d => d.conflict);
    }

    return {
        data: parsedData,
        errors: errors,
        conflictsFound: conflictsFound,
        duplicateCount: exactDuplicates
    };
}
/**
 * Filtra los datos y devuelve un texto limpio para repintar en el textarea
 */
export function generateCleanExcelText(data, tab) {
    if (tab === 'mass') {
        let modo = document.querySelector('input[name="modo_masivo"]:checked')?.value;
        if (modo === 'excel_tienda') return data.map(d => `${d.tienda}\t${d.art}\t${d.grp}`).join('\n');
    }
    
    if (tab === 'swap') return data.map(d => `${d.oldId}\t${d.newId}`).join('\n');
    
    if (tab === 'p_add') {
        let isTiendas = document.querySelector('input[name="modo_p_add"]:checked')?.value === 'excel_tienda';
        if (isTiendas) return data.map(d => `${d.tienda}\t${d.art}\t${d.stock}\t${d.prov}`).join('\n');
        return data.map(d => `${d.cod}\t${d.art}\t${d.stock}`).join('\n');
    }

    if (tab === 'p_del') {
        let isTiendas = document.querySelector('input[name="modo_p_del"]:checked')?.value === 'excel_tienda';
        if (isTiendas) return data.map(d => `${d.tienda}\t${d.art}\t${d.prov}`).join('\n');
        return data.map(d => `${d.cod}\t${d.art}`).join('\n');
    }
    
    if (tab === 'p_upd') return data.map(d => `${d.cod}\t${d.nombre}`).join('\n');
    
    return data.map(d => `${d.art}\t${d.grp}`).join('\n');
}