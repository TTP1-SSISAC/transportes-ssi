/**
 * TRANSPORTES SSI S.A.C.
 * Archivo: 01_Utils.gs — Funciones utilitarias compartidas
 */

// ─── Obtener hoja por nombre ──────────────────────────────────────────────
function getHoja(nombre) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = ss.getSheetByName(nombre);
  if (!hoja) throw new Error(`Hoja no encontrada: "${nombre}"`);
  return hoja;
}

// ─── Obtener todos los datos de una hoja como array de objetos ────────────
// Usa la primera fila como cabeceras → [{COLUMNA: valor}, ...]
function getFilas(nombreHoja) {
  const hoja  = getHoja(nombreHoja);
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];
  const cabeceras = datos[0].map(c => c.toString().trim().toUpperCase());
  return datos.slice(1).map(fila => {
    const obj = {};
    cabeceras.forEach((cab, i) => { obj[cab] = fila[i]; });
    return obj;
  });
}

// ─── Agregar una fila al final de una hoja ────────────────────────────────
function appendFila(nombreHoja, valores) {
  getHoja(nombreHoja).appendRow(valores);
}

// ─── Fecha de hoy formateada ──────────────────────────────────────────────
function hoy() {
  return Utilities.formatDate(new Date(), CONFIG.ZONA_HORARIA, 'dd/MM/yyyy');
}

// ─── Diferencia en días entre hoy y una fecha futura ─────────────────────
function diasHasta(fecha) {
  if (!fecha || fecha === '') return 9999;
  const f = fecha instanceof Date ? fecha : new Date(fecha);
  return Math.round((f - new Date()) / (1000 * 60 * 60 * 24));
}

// ─── Generar ID correlativo (RF-001, MN-045, etc.) ───────────────────────
function generarId(prefijo, nombreHoja) {
  const filas = getFilas(nombreHoja);
  const num   = filas.length + 1;
  return `${prefijo}-${String(num).padStart(3, '0')}`;
}

// ─── Colorear una celda según semáforo ───────────────────────────────────
function semaforo(hoja, fila, col, valor, umbralRojo, umbralAmarillo, invert) {
  const rng = hoja.getRange(fila, col);
  let color;
  if (invert) {
    // Para stock: valor alto = verde, valor bajo = rojo
    color = valor <= 0 ? '#FECACA'
          : valor <= umbralRojo ? '#FEE2E2'
          : valor <= umbralAmarillo ? '#FEF3C7'
          : '#D1FAE5';
  } else {
    // Para días/km restantes: valor alto = verde, valor bajo = rojo
    color = valor <= 0 ? '#FECACA'
          : valor <= umbralRojo ? '#FEE2E2'
          : valor <= umbralAmarillo ? '#FEF3C7'
          : '#D1FAE5';
  }
  rng.setBackground(color);
}

// ─── Log interno (escribe en Logger y opcionalmente en hoja LOGS) ─────────
function logSSI(mensaje, nivel) {
  nivel = nivel || 'INFO';
  Logger.log(`[SSI][${nivel}] ${mensaje}`);
}

// ─── Todas las placas (tractos + carretas) ────────────────────────────────
function getTodasLasPlacas() {
  const leer = (hoja) => {
    try {
      return getFilas(hoja)
        .map(f => ({ placa: f['PLACA'] || '', tipo: hoja }))
        .filter(f => f.placa);
    } catch(e) { return []; }
  };
  return [...leer(CONFIG.HOJAS.TRACTO), ...leer(CONFIG.HOJAS.CARRETAS)];
}

// ─── Solo conductores — hoja PERSONAL, columna CONDUCTOR ─────────────────
function getConductores() {
  try {
    return getFilas(CONFIG.HOJAS.PERSONAL)
      .map(f => f['CONDUCTOR'] || '')
      .filter(Boolean);
  } catch(e) { return []; }
}

// ─── Solo técnicos — hoja TECNICOS, columna NOMBRE ───────────────────────
function getTecnicos() {
  try {
    return getFilas(CONFIG.HOJAS.TECNICOS)
      .map(f => f['NOMBRE'] || '')
      .filter(Boolean);
  } catch(e) { return []; }
}

// ─── Todo el personal (conductores + técnicos combinados) ─────────────────
function getTodoElPersonal() {
  const conductores = getConductores().map(n => ({ nombre: n, tipo: 'CONDUCTOR' }));
  const tecnicos    = getTecnicos().map(n => ({ nombre: n, tipo: 'TECNICO' }));
  return [...conductores, ...tecnicos];
}
