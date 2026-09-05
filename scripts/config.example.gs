/**
 * TRANSPORTES SSI S.A.C. - config.example.gs
  * Este archivo SI se sube a GitHub. Es una plantilla publica.
   * Para usar el sistema: copialo como 00_Config.gs y rellena
    * los valores reales (00_Config.gs esta en .gitignore).
     */

     const CONFIG = {
       SPREADSHEET_ID:       'REEMPLAZAR_CON_ID_DEL_SPREADSHEET',
         EMAIL_ALERTAS:        'correo@tuempresa.com',
           EMAIL_CC:             '',
             DIAS_ALERTA_ROJA:     10,
               DIAS_ALERTA_AMARILLA: 30,
                 KM_ALERTA_ROJA:       500,
                   KM_ALERTA_AMARILLA:   2000,
                     KM_INTERVALO_MANT:    5000,
                       STOCK_MINIMO_GLOBAL:  3,
                         HOJAS: {
                             PERSONAL:        'PERSONAL',
                                 TECNICOS:        'TECNICOS',
                                     TRACTO:          'TRACTO',
                                         CARRETAS:        'CARRETAS',
                                             PRODUCTOS:       'PRODUCTOS',
                                                 INGRESOS:        'INGRESOS',
                                                     SALIDAS:         'SALIDAS',
                                                         KARDEX:          'KARDEX',
                                                             BD_COMP_FALLA:   'BD_COMPONENTE-FALLA',
                                                                 MANTENIMIENTO:   'MANTENIMIENTO',
                                                                     REPORTE_FALLA:   'REPORTE_FALLA',
                                                                         DOCUMENTOS:      'DOCUMENTOS',
                                                                             LOG:             'LOG_SISTEMA',
                                                                                 DASHBOARD:       'DASHBOARD',
                                                                                     ALERTAS:         'ALERTAS',
                                                                                       },
                                                                                         ZONA_HORARIA: 'America/Lima',
                                                                                           MONEDA:       'S/',
                                                                                             ENVIAR_EMAIL: true,
                                                                                             };
