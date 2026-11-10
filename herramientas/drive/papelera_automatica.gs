/**
 * ARKEN · Borrado automático de la papelera de Google Drive
 * ---------------------------------------------------------
 * Se instala UNA vez en https://script.google.com con la cuenta de Google dueña del Drive.
 * Cada 5 minutos revisa la papelera y borra PARA SIEMPRE lo que indique MODO.
 * Lo borrado así NO se puede recuperar.
 *
 * Por qué hace falta: al guardar ARKEN_CONTROL.html desde Chrome sobre una carpeta de
 * Google Drive, Chrome crea una copia temporal "ARKEN_CONTROL.html.crswap" (unos 60 MB).
 * Drive la sube, Chrome la borra y Drive la deja 30 días en la papelera ocupando espacio.
 *
 * Instalación (3 minutos):
 *   1. Abra https://script.google.com › «Nuevo proyecto». Póngale de nombre «ARKEN papelera».
 *   2. Borre lo que trae y pegue todo este archivo.
 *   (No hace falta agregar ningún servicio: el script usa solo lo que trae Apps Script.)
 *   3. Arriba elija la función «instalar» y pulse «Ejecutar». Google pide permiso: acepte
 *      (si dice «Google no verificó esta app»: «Configuración avanzada» › «Ir a ARKEN papelera»).
 *   Listo. Para ver qué ha borrado: función «informe» › Ejecutar, y mire el registro.
 *   Para apagarlo: función «desinstalar» › Ejecutar.
 */

// Qué se borra para siempre al llegar a la papelera:
//   'crswap' → solo las copias temporales de Chrome (*.crswap).
//   'arken'  → además, todo archivo cuyo nombre empiece por ARKEN. Elegido por Adolfo (2026-11-10).
//   'todo'   → TODA la papelera, sea lo que sea. Sin red de seguridad.
var MODO = 'arken';

var CADA_MINUTOS = 5; // 1, 5, 10, 15 o 30

function instalar() {
  desinstalar();
  ScriptApp.newTrigger('limpiar').timeBased().everyMinutes(CADA_MINUTOS).create();
  limpiar();
  Logger.log('Instalado: revisa la papelera cada ' + CADA_MINUTOS + ' minutos (modo "' + MODO + '").');
}

function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'limpiar') ScriptApp.deleteTrigger(t);
  });
}

function seBorra_(nombre) {
  if (MODO === 'todo') return true;
  if (/\.crswap$/i.test(nombre)) return true;
  if (MODO === 'arken' && /^ARKEN/i.test(nombre)) return true;
  return false;
}

// Borra un archivo para siempre con la API de Drive (sin activar servicios avanzados).
function borrarParaSiempre_(id) {
  var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id), {
    method: 'delete',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  var c = r.getResponseCode();
  if (c !== 204 && c !== 200 && c !== 404) throw new Error('HTTP ' + c + ' ' + r.getContentText().slice(0, 200));
}

function limpiar() {
  var props = PropertiesService.getScriptProperties();
  var total = Number(props.getProperty('borrados') || 0);
  var bytes = Number(props.getProperty('bytes') || 0);
  var yo = Session.getEffectiveUser().getEmail();
  var n = 0;
  var archivos = DriveApp.getTrashedFiles();
  while (archivos.hasNext()) {
    var f = archivos.next();
    var nombre = f.getName();
    if (!seBorra_(nombre)) continue;
    try {
      if (yo && f.getOwner() && f.getOwner().getEmail() !== yo) continue; // solo lo que es suyo
      var tam = f.getSize();
      borrarParaSiempre_(f.getId());
      n++;
      bytes += Number(tam || 0);
    } catch (e) {
      Logger.log('No se pudo borrar ' + nombre + ': ' + e);
    }
  }
  if (n) {
    total += n;
    props.setProperty('borrados', String(total));
    props.setProperty('bytes', String(bytes));
    props.setProperty('ultimo', new Date().toISOString());
  }
  Logger.log('Borrados ahora: ' + n);
}

function informe() {
  var p = PropertiesService.getScriptProperties();
  Logger.log(
    'Modo "' + MODO + '". Archivos borrados en total: ' + (p.getProperty('borrados') || 0) +
      ' (' + (Number(p.getProperty('bytes') || 0) / 1048576).toFixed(0) + ' MB). Última vez: ' +
      (p.getProperty('ultimo') || 'nunca') + '. Programado: ' +
      (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'limpiar'; }) ? 'sí' : 'no')
  );
}
