# Transportes SSI S.A.C. - Sistema de Gestion

Sistema integrado de gestion para flota refrigerada: inventario de almacen, control de mantenimientos, reporte de fallas y alertas automaticas via Google Sheets + Apps Script.

---

## Estructura del proyecto

```
scripts/
- 00_Config.gs          <- PRIVADO - no se sube al repo (ver .gitignore)
- config.example.gs     <- Plantilla publica de configuracion
- 01_Utils.gs           <- Funciones utilitarias compartidas
- 02_Productos.gs       <- Catalogo de productos y stock
- 03_Inventario.gs      <- Ingresos, salidas y KARDEX
- 04_Mantenimiento.gs   <- Ordenes de mantenimiento y reporte de fallas
- 05_Dashboard.gs       <- Agregacion de KPIs para el dashboard
- 06_Alertas.gs         <- Alertas por semaforo y correo electronico
- 07_Menu.gs            <- Menu personalizado en Google Sheets
- 08_WebApp.gs          <- Backend de la aplicacion web
ssi_app.html            <- Frontend SPA (aplicacion web)
```

---

## Configuracion inicial

### 1. Clonar el repositorio

```bash
git clone https://github.com/TTP1-SSISAC/transportes-ssi.git
cd transportes-ssi
```

### 2. Instalar clasp (CLI de Google Apps Script)

```bash
npm install -g @google/clasp
clasp login
```

### 3. Crear el archivo de configuracion privado

Copia la plantilla y completa con tus datos reales:

```bash
cp scripts/config.example.gs scripts/00_Config.gs
```

Edita `scripts/00_Config.gs` y completa con tu SPREADSHEET_ID real.

### 4. Enlazar con el proyecto Apps Script

```bash
# Si el proyecto ya existe en Apps Script:
clasp clone SCRIPT_ID --rootDir scripts
```

### 5. Subir los archivos

```bash
clasp push
```

### 6. Crear las hojas de calculo

En Apps Script, ejecuta la funcion `crearTodasLasHojas()` para crear las 15 hojas requeridas.

### 7. Desplegar como Web App

En Apps Script: Implementar > Nueva implementacion > Aplicacion web
- Ejecutar como: Yo
- Acceso: Cualquier usuario de Google

---

## Hojas de Google Sheets requeridas

| Hoja | Descripcion |
|------|-------------|
| PRODUCTOS | Catalogo con stock actual y minimo |
| KARDEX | Movimientos de inventario |
| INGRESOS | Documentos de ingreso al almacen |
| SALIDAS | Documentos de salida del almacen |
| MANTENIMIENTO | Ordenes de mantenimiento |
| REPORTE_FALLA | Reportes de fallas por vehiculo |
| BD_COMPONENTE-FALLA | Catalogo de codigos y componentes |
| DOCUMENTOS | Vencimientos de documentos vehiculares |
| ALERTAS | Generada automaticamente por 06_Alertas.gs |
| DASHBOARD | Generada automaticamente por 05_Dashboard.gs |
| LOG_SISTEMA | Registro de actividad del sistema |
| PERSONAL | Registro de personal |
| TECNICOS | Registro de tecnicos |
| TRACTO | Registro de tractos |
| CARRETAS | Registro de carretas |

---

## Sistema de alertas

El modulo `06_Alertas.gs` revisa diariamente:

| Categoria | Semaforo ROJO | Semaforo AMARILLO |
|-----------|---------------|-------------------|
| Documentos vencidos | Vencido o vence en <= 10 dias | Vence en 11-30 dias |
| Stock | Sin stock (= 0) | Por debajo del minimo |
| Mantenimientos | Pendiente >= 10 dias sin actualizar | >= 5 dias |
| Fallas | Abierta >= 6 dias | Abierta >= 3 dias |

---

## Aplicacion web (SPA)

La interfaz `ssi_app.html` se sirve desde Apps Script Web App. Incluye:

- Ingresos de Almacen - registro de entradas con KARDEX automatico
- Salidas de Almacen - salidas con validacion de stock
- Mantenimiento - ordenes con repuestos y costos
- Reporte de Fallas - seleccion por codigo con auto-relleno
- Control de Mantenimientos - tabla con estados y edicion completa
- Dashboard - semaforo de stock, documentos y KPIs del mes

---

## Seguridad

- `scripts/00_Config.gs` esta en `.gitignore` y NUNCA se sube al repositorio.
- Usar `config.example.gs` como referencia para colaboradores.
- El SPREADSHEET_ID y el correo de alertas son los unicos datos sensibles.

---

## Contacto

Transportes SSI S.A.C.
grupo.ssi.peru@gmail.com
