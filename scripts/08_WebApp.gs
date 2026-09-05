/**
 * TRANSPORTES SSI S.A.C.
 * 08_WebApp.gs — Backend del sistema web
 *
 * Expone las siguientes funciones al cliente (google.script.run):
 *   getInitialData()          → datos de referencia (placas, personal, productos, fallas)
 *   grabarIngreso(datos)      → escribe en INGRESOS + KARDEX
 *   grabarSalida(datos)       → escribe en SALIDAS + KARDEX (valida stock)
 *   grabarMantenimiento(datos)→ escribe en MANTENIMIENTO + KARDEX
 *   grabarReporte(datos)      → escribe en REPORTE_FALLA
 *   getMantenimientos()       → lee MANTENIMIENTO agrupado por NDOC
 *   updateEstadoManto(n,e)    → actualiza ESTADO de todas las filas de un NDOC
 *   updateManto(datos)        → actualiza campos de cabecera de un NDOC
 *   getReportes()             → lee REPORTE_FALLA
 *   getIngresos()             → lee INGRESOS
 *   getSalidas()              → lee SALIDAS
 *   getKardex()               → lee KARDEX
 *
 * doGet() sirve ssi_app.html como Web App.
 *
 * Nota: 00_Config.gs debe estar presente con el SPREADSHEET_ID real.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PUNTO DE ENTRADA — sirve el HTML
// ═══════════════════════════════════════════════════════════════════════════════
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('ssi_app')
    .setTitle('SSI — Control de Mantenimiento')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATOS INICIALES (se llama una vez al cargar la página)
// ═══════════════════════════════════════════════════════════════════════════════
function getInitialData() {
  try {
    return {
      ok: true,
      data: {
        placas:      _getPlacas(),
        conductores: _getConductores(),
        tecnicos:    _getTecnicos(),
        productos:   _getProductos(),
        fallas:      _getFallas(),
      }
    };
  } catch (e) {
    logSSI('ERROR getInitialData: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

function _getPlacas() {
  const todos = [];
  [CONFIG.HOJAS.TRACTO, CONFIG.HOJAS.CARRETAS].forEach(hoja => {
    try {
      getFilas(hoja).forEach(f => {
        // La columna se llama "Placa" (mixto) o "PLACA"
        const placa = (f['PLACA'] || f['Placa'] || '').toString().trim();
        if (placa) todos.push({ placa, tipo: hoja });
      });
    } catch (e) { /* hoja no existe → ignorar */ }
  });
  return todos;
}

function _getConductores() {
  try {
    return getFilas(CONFIG.HOJAS.PERSONAL)
      .map(f => (f['CONDUCTOR'] || '').toString().trim())
      .filter(Boolean);
  } catch (e) { return []; }
}

function _getTecnicos() {
  try {
    return getFilas(CONFIG.HOJAS.TECNICOS)
      .map(f => (f['NOMBRE'] || '').toString().trim())
      .filter(Boolean);
  } catch (e) { return []; }
}

function _getProductos() {
  try {
    return getFilas(CONFIG.HOJAS.PRODUCTOS).map(f => ({
      id:    (f['COD']    || '').toString().trim(),
      n:     (f['NOMBRE'] || '').toString().trim(),
      u:     (f['UNIDAD'] || 'und').toString().trim(),
      stock: parseFloat(f['STOCK_ACTUAL'])    || 0,
      min:   parseFloat(f['STOCK_MINIMO'])    || 0,
      pu:    parseFloat(f['PRECIO_UNITARIO']) || 0,
    })).filter(p => p.id);
  } catch (e) { return []; }
}

function _getFallas() {
  try {
    return getFilas(CONFIG.HOJAS.BD_COMP_FALLA).map(f => ({
      cod:  (f['COD']        || '').toString().trim(),
      sis:  (f['SISTEMA']    || '').toString().trim(),
      comp: (f['COMPONENTE'] || '').toString().trim(),
    })).filter(f => f.cod);
  } catch (e) { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRABAR INGRESO → INGRESOS + KARDEX + actualiza STOCK_ACTUAL en PRODUCTOS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * datos = {
 *   fecha, ndoc, proveedor, notas,
 *   items: [{ idProd, nombre, unidad, cantidad, pu, total }]
 * }
 */
function grabarIngreso(datos) {
  try {
    const { fecha, ndoc, proveedor, notas, items } = datos;
    if (!items || !items.length) throw new Error('Sin ítems para grabar');

    const hIng  = getHoja(CONFIG.HOJAS.INGRESOS);
    const hKdx  = getHoja(CONFIG.HOJAS.KARDEX);
    const hProd = getHoja(CONFIG.HOJAS.PRODUCTOS);

    // Leer PRODUCTOS para actualizar stock (una sola lectura de la hoja)
    const prodVals = hProd.getDataRange().getValues();
    const cabProd  = prodVals[0].map(c => c.toString().trim().toUpperCase());
    const iCod   = cabProd.indexOf('COD');
    const iStock = cabProd.indexOf('STOCK_ACTUAL');

    items.forEach(({ idProd, nombre, unidad, cantidad, pu, total }) => {
      // INGRESOS: NDOC, FECHA, PROVEEDOR, COD_PRODUCTO, NOMBRE, CANTIDAD, PRECIO_UNIT, TOTAL
      hIng.appendRow([ndoc, fecha, proveedor, idProd, nombre, cantidad, pu, total]);

      // KARDEX: FECHA, TIPO, NDOC, COD_PRODUCTO, NOMBRE, CANTIDAD, COSTO_UNIT, TOTAL, REFERENCIA
      hKdx.appendRow([fecha, 'INGRESO', ndoc, idProd, nombre, cantidad, pu, total,
                      notas || proveedor]);

      // Actualizar STOCK_ACTUAL
      if (iCod >= 0 && iStock >= 0) {
        for (let r = 1; r < prodVals.length; r++) {
          if (prodVals[r][iCod].toString().trim() === idProd.toString().trim()) {
            const celda = hProd.getRange(r + 1, iStock + 1);
            celda.setValue((parseFloat(celda.getValue()) || 0) + cantidad);
            prodVals[r][iStock] += cantidad; // actualizar copia local para ítems siguientes
            break;
          }
        }
      }
    });

    logSSI(`Ingreso ${ndoc} grabado — ${items.length} ítem(s)`);
    return { ok: true, ndoc };

  } catch (e) {
    logSSI('ERROR grabarIngreso: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRABAR SALIDA → SALIDAS + KARDEX + descuenta STOCK_ACTUAL
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * datos = {
 *   fecha, ndoc, destino, notas,
 *   items: [{ idProd, nombre, cantidad }]
 * }
 */
function grabarSalida(datos) {
  try {
    const { fecha, ndoc, destino, notas, items } = datos;
    if (!items || !items.length) throw new Error('Sin ítems para grabar');

    const hSal  = getHoja(CONFIG.HOJAS.SALIDAS);
    const hKdx  = getHoja(CONFIG.HOJAS.KARDEX);
    const hProd = getHoja(CONFIG.HOJAS.PRODUCTOS);

    const prodVals = hProd.getDataRange().getValues();
    const cabProd  = prodVals[0].map(c => c.toString().trim().toUpperCase());
    const iCod   = cabProd.indexOf('COD');
    const iStock = cabProd.indexOf('STOCK_ACTUAL');

    // ── Pre-validar stock de TODOS los ítems ──────────────────────────────────
    const errores = [];
    if (iCod >= 0 && iStock >= 0) {
      items.forEach(({ idProd, nombre, cantidad }) => {
        for (let r = 1; r < prodVals.length; r++) {
          if (prodVals[r][iCod].toString().trim() === idProd.toString().trim()) {
            const stockActual = parseFloat(prodVals[r][iStock]) || 0;
            if (cantidad > stockActual) {
              errores.push(`${nombre}: stock insuficiente (disponible: ${stockActual})`);
            }
            break;
          }
        }
      });
    }
    if (errores.length) return { ok: false, errores };

    items.forEach(({ idProd, nombre, cantidad }) => {
      // SALIDAS: NDOC, FECHA, DESTINO, COD_PRODUCTO, NOMBRE, CANTIDAD, PRECIO_UNIT, TOTAL
      hSal.appendRow([ndoc, fecha, destino, idProd, nombre, cantidad, 0, 0]);

      // KARDEX: FECHA, TIPO, NDOC, COD_PRODUCTO, NOMBRE, CANTIDAD, COSTO_UNIT, TOTAL, REFERENCIA
      hKdx.appendRow([fecha, 'SALIDA', ndoc, idProd, nombre, cantidad, 0, 0,
                      notas || destino]);

      // Descontar STOCK_ACTUAL
      if (iCod >= 0 && iStock >= 0) {
        for (let r = 1; r < prodVals.length; r++) {
          if (prodVals[r][iCod].toString().trim() === idProd.toString().trim()) {
            const celda = hProd.getRange(r + 1, iStock + 1);
            const nuevo = (parseFloat(celda.getValue()) || 0) - cantidad;
            celda.setValue(Math.max(nuevo, 0));
            prodVals[r][iStock] = Math.max(prodVals[r][iStock] - cantidad, 0);
            break;
          }
        }
      }
    });

    logSSI(`Salida ${ndoc} grabada — ${items.length} ítem(s)`);
    return { ok: true, ndoc };

  } catch (e) {
    logSSI('ERROR grabarSalida: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRABAR MANTENIMIENTO → MANTENIMIENTO + KARDEX
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * datos = {
 *   ndoc, nombre, tipo, f1, h1, f2, h2, dur,
 *   placa, km, lugar, tecnico, obs,
 *   repuestos: [{ sistema, repuesto, moneda, cant, pu, total }]
 * }
 * Cada repuesto genera una fila en MANTENIMIENTO y (si tiene cantidad) en KARDEX.
 */
function grabarMantenimiento(datos) {
  try {
    const { ndoc, nombre, tipo, f1, h1, f2, h2, dur,
            placa, km, lugar, tecnico, obs, repuestos } = datos;

    const hMant = getHoja(CONFIG.HOJAS.MANTENIMIENTO);
    const hKdx  = getHoja(CONFIG.HOJAS.KARDEX);

    // MANTENIMIENTO columnas:
    // NDOC, NOMBRE_REPARACION, TIPO, FECHA_INICIAL, HORA_INICIAL,
    // FECHA_FINAL, HORA_FINAL, DURACION, PLACA, KM, LUGAR, TECNICO,
    // SISTEMA, REPUESTO, MONEDA, CANT, PRECIO_UNIT, COSTO_TOTAL, ESTADO, OBS

    const base = [ndoc, nombre, tipo, f1, h1, f2, h2, dur, placa, km, lugar, tecnico];

    if (!repuestos || repuestos.length === 0) {
      hMant.appendRow([...base, '', '', 'S/', 0, 0, 0, 'EN PROCESO', obs]);
    } else {
      repuestos.forEach(r => {
        hMant.appendRow([...base,
          r.sistema, r.repuesto, r.moneda || 'S/',
          r.cant, r.pu, r.total,
          'EN PROCESO', obs
        ]);

        // Registrar en KARDEX si el repuesto tiene nombre y cantidad
        if (r.repuesto && r.repuesto.trim() && r.cant > 0) {
          hKdx.appendRow([f1, 'MANTENIMIENTO', ndoc, '', r.repuesto,
                          r.cant, r.pu, r.total,
                          `${placa} — ${r.sistema || 'Mantenimiento'}`]);
        }
      });
    }

    logSSI(`Mantenimiento ${ndoc} grabado — ${(repuestos || []).length} repuesto(s)`);
    return { ok: true, ndoc };

  } catch (e) {
    logSSI('ERROR grabarMantenimiento: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRABAR REPORTE DE FALLA → REPORTE_FALLA
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * datos = {
 *   ndoc, fecha, placa, km, personal,
 *   fallas: [{ cod, sistema, componente, detalle }]
 * }
 */
function grabarReporte(datos) {
  try {
    const { ndoc, fecha, placa, km, personal, fallas } = datos;
    if (!fallas || !fallas.length) throw new Error('Sin fallas para grabar');

    const hRF = getHoja(CONFIG.HOJAS.REPORTE_FALLA);

    // REPORTE_FALLA: ID, FECHA, PLACA, KM, PERSONAL,
    //   ID_FALLA, SISTEMA, COMPONENTE, DETALLE, ESTADO, FECHA_CIERRE, OBS_CIERRE
    fallas.forEach(f => {
      hRF.appendRow([ndoc, fecha, placa, km, personal,
                     f.cod, f.sistema, f.componente, f.detalle,
                     'ABIERTO', '', '']);
    });

    logSSI(`Reporte ${ndoc} grabado — ${fallas.length} falla(s)`);
    return { ok: true, ndoc };

  } catch (e) {
    logSSI('ERROR grabarReporte: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEER MANTENIMIENTOS — agrupados por NDOC para la tabla de control
// ═══════════════════════════════════════════════════════════════════════════════
function getMantenimientos() {
  try {
    const filas = getFilas(CONFIG.HOJAS.MANTENIMIENTO);
    const mapa  = {};
    const orden = [];

    filas.forEach(f => {
      const ndoc = (f['NDOC'] || '').toString().trim();
      if (!ndoc) return;

      if (!mapa[ndoc]) {
        mapa[ndoc] = {
          ndoc,
          nombre:  (f['NOMBRE_REPARACION'] || '').toString(),
          tipo:    (f['TIPO']              || '').toString(),
          f1:      _fmtFecha(f['FECHA_INICIAL']),
          h1:      (f['HORA_INICIAL']      || '').toString(),
          f2:      _fmtFecha(f['FECHA_FINAL']),
          h2:      (f['HORA_FINAL']        || '').toString(),
          dur:     (f['DURACION']          || '').toString(),
          placa:   (f['PLACA']             || '').toString(),
          km:      (f['KM']               || '').toString(),
          lugar:   (f['LUGAR']             || '').toString(),
          tecnico: (f['TECNICO']           || '').toString(),
          obs:     (f['OBS']              || '').toString(),
          estado:  (f['ESTADO']           || 'EN PROCESO').toString(),
          repuestos: [],
        };
        orden.push(ndoc);
      }

      const repuesto = (f['REPUESTO'] || '').toString().trim();
      if (repuesto) {
        mapa[ndoc].repuestos.push({
          sistema:  (f['SISTEMA']      || '').toString(),
          metodo:   '',
          repuesto,
          tipoCosto:'',
          moneda:   (f['MONEDA']       || 'S/').toString(),
          cant:     parseFloat(f['CANT'])        || 0,
          pu:       parseFloat(f['PRECIO_UNIT']) || 0,
          total:    parseFloat(f['COSTO_TOTAL']) || 0,
        });
      }
      // El último ESTADO leído para este NDOC es el vigente
      if (f['ESTADO']) mapa[ndoc].estado = (f['ESTADO'] || '').toString();
    });

    return { ok: true, data: orden.map(n => mapa[n]) };

  } catch (e) {
    logSSI('ERROR getMantenimientos: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUALIZAR ESTADO DE UN MANTENIMIENTO (todas las filas del NDOC)
// ═══════════════════════════════════════════════════════════════════════════════
function updateEstadoManto(ndoc, estado) {
  try {
    const hoja  = getHoja(CONFIG.HOJAS.MANTENIMIENTO);
    const datos = hoja.getDataRange().getValues();
    const cab   = datos[0].map(c => c.toString().trim().toUpperCase());
    const iNdoc = cab.indexOf('NDOC');
    const iEst  = cab.indexOf('ESTADO');

    if (iNdoc < 0 || iEst < 0)
      throw new Error('Columnas NDOC o ESTADO no encontradas en MANTENIMIENTO');

    let actualizadas = 0;
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][iNdoc].toString().trim() === ndoc.toString().trim()) {
        hoja.getRange(r + 1, iEst + 1).setValue(estado);
        actualizadas++;
      }
    }

    logSSI(`Estado de ${ndoc} → ${estado} (${actualizadas} fila(s))`);
    return { ok: true, actualizadas };

  } catch (e) {
    logSSI('ERROR updateEstadoManto: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUALIZAR DATOS COMPLETOS DE UN MANTENIMIENTO (modal de edición)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * datos = { ndoc, nombre, tipo, f1, h1, f2, h2, dur,
 *           placa, km, lugar, tecnico, estado, obs }
 */
function updateManto(datos) {
  try {
    const hoja  = getHoja(CONFIG.HOJAS.MANTENIMIENTO);
    const vals  = hoja.getDataRange().getValues();
    const cab   = vals[0].map(c => c.toString().trim().toUpperCase());

    const col = name => cab.indexOf(name);

    // Mapa de campo → índice de columna
    const mapa = {
      NOMBRE_REPARACION: datos.nombre,
      TIPO:              datos.tipo,
      FECHA_INICIAL:     datos.f1,
      HORA_INICIAL:      datos.h1,
      FECHA_FINAL:       datos.f2,
      HORA_FINAL:        datos.h2,
      DURACION:          datos.dur,
      PLACA:             datos.placa,
      KM:                datos.km,
      LUGAR:             datos.lugar,
      TECNICO:           datos.tecnico,
      ESTADO:            datos.estado,
      OBS:               datos.obs,
    };

    let actualizadas = 0;
    for (let r = 1; r < vals.length; r++) {
      if (vals[r][col('NDOC')].toString().trim() === datos.ndoc.toString().trim()) {
        Object.entries(mapa).forEach(([campo, valor]) => {
          const i = col(campo);
          if (i >= 0) hoja.getRange(r + 1, i + 1).setValue(valor);
        });
        actualizadas++;
      }
    }

    logSSI(`Mantenimiento ${datos.ndoc} actualizado (${actualizadas} fila(s))`);
    return { ok: true, actualizadas };

  } catch (e) {
    logSSI('ERROR updateManto: ' + e.message, 'ERROR');
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEER REPORTES DE FALLAS
// ═══════════════════════════════════════════════════════════════════════════════
function getReportes() {
  try {
    const filas = getFilas(CONFIG.HOJAS.REPORTE_FALLA);
    return {
      ok: true,
      data: filas.map(f => ({
        ndoc:       (f['ID']         || '').toString(),
        fecha:      _fmtFecha(f['FECHA']),
        placa:      (f['PLACA']      || '').toString(),
        km:         (f['KM']         || '').toString(),
        personal:   (f['PERSONAL']   || '').toString(),
        cod:        (f['ID_FALLA']   || '').toString(),
        sistema:    (f['SISTEMA']    || '').toString(),
        componente: (f['COMPONENTE'] || '').toString(),
        detalle:    (f['DETALLE']    || '').toString(),
        estado:     (f['ESTADO']     || 'ABIERTO').toString(),
      }))
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEER INGRESOS
// ═══════════════════════════════════════════════════════════════════════════════
function getIngresos() {
  try {
    const filas = getFilas(CONFIG.HOJAS.INGRESOS);
    return {
      ok: true,
      data: filas.map((f, i) => ({
        id:        `ING-${String(i+1).padStart(3,'0')}`,
        ndoc:      (f['NDOC']        || '').toString(),
        fecha:     _fmtFecha(f['FECHA']),
        proveedor: (f['PROVEEDOR']   || '').toString(),
        idProd:    (f['COD_PRODUCTO']|| '').toString(),
        nombre:    (f['NOMBRE']      || '').toString(),
        unidad:    '',
        cantidad:  parseFloat(f['CANTIDAD'])   || 0,
        pu:        parseFloat(f['PRECIO_UNIT'])|| 0,
        total:     parseFloat(f['TOTAL'])      || 0,
      }))
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEER SALIDAS
// ═══════════════════════════════════════════════════════════════════════════════
function getSalidas() {
  try {
    const filas = getFilas(CONFIG.HOJAS.SALIDAS);
    return {
      ok: true,
      data: filas.map((f, i) => ({
        id:       `SAL-${String(i+1).padStart(3,'0')}`,
        ndoc:     (f['NDOC']        || '').toString(),
        fecha:    _fmtFecha(f['FECHA']),
        destino:  (f['DESTINO']     || '').toString(),
        idProd:   (f['COD_PRODUCTO']|| '').toString(),
        nombre:   (f['NOMBRE']      || '').toString(),
        cantidad: parseFloat(f['CANTIDAD']) || 0,
      }))
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEER KARDEX
// ═══════════════════════════════════════════════════════════════════════════════
function getKardex() {
  try {
    const filas = getFilas(CONFIG.HOJAS.KARDEX);
    return {
      ok: true,
      data: filas.map((f, i) => ({
        id:       `KX-${String(i+1).padStart(4,'0')}`,
        fecha:    _fmtFecha(f['FECHA']),
        tipo:     (f['TIPO']        || '').toString().toUpperCase(),
        idProd:   (f['COD_PRODUCTO']|| '').toString(),
        nombre:   (f['NOMBRE']      || '').toString(),
        cantidad: parseFloat(f['CANTIDAD']) || 0,
        ref:      (f['NDOC']        || '').toString(),
        notas:    (f['REFERENCIA']  || '').toString(),
      }))
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════════════════════

/** Formatea una fecha (Date o string) en dd/MM/yyyy */
function _fmtFecha(val) {
  if (!val || val === '') return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, CONFIG.ZONA_HORARIA, 'dd/MM/yyyy');
  }
  // Si ya viene como string (yyyy-MM-dd desde HTML), reordenar
  const s = val.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}
