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
 * Instalación (5 minutos):
 *   1. Abra https://script.google.com › «Nuevo proyecto». Póngale de nombre «ARKEN papelera».
 *   2. Borre lo que trae y pegue todo este archivo.
 *   3. A la izquierda, en «Servicios» (+), agregue «Drive API» (versión v3) › «Agregar».
 *   4. Arriba elija la función «instalar» y pulse «Ejecutar». Google pide permiso: acepte
 *      (si dice «Google no verificó esta app»: «Configuración avanzada» › «Ir a ARKEN papelera»).
 *   Listo. Para ver qué ha borrado: función «informe» › Ejecutar, y mire el registro.
 *   Para apagarlo: función «desinstalar» › Ejecutar.
 */

// Qué se borra para siempre al llegar a la papelera:
//   'crswap' → solo las copias temporales de Chrome (*.crswap). Lo recomendado.
//   'arken'  → además, todo archivo cuyo nombre empiece por ARKEN.
//   'todo'   → TODA la papelera, sea lo que sea. Sin red de seguridad.
var MODO = 'crswap';

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

function limpiar() {
  var props = PropertiesService.getScriptProperties();
  var total = Number(props.getProperty('borrados') || 0);
  var bytes = Number(props.getProperty('bytes') || 0);
  var n = 0;
  var token = null;
  do {
    var r = Drive.Files.list({
      q: "trashed = true and 'me' in owners",
      fields: 'nextPageToken, files(id, name, size)',
      pageSize: 1000,
      pageToken: token,
    });
    (r.files || []).forEach(function (f) {
      if (!seBorra_(f.name)) return;
      try {
        Drive.Files.remove(f.id);
        n++;
        bytes += Number(f.size || 0);
      } catch (e) {
        Logger.log('No se pudo borrar ' + f.name + ': ' + e);
      }
    });
    token = r.nextPageToken;
  } while (token);
  if (n) {
    total += n;
    props.setProperty('borrados', String(total));
    props.setProperty('bytes', String(bytes));
    props.setProperty('ultimo', new Date().toISOString());
    Logger.log('Borrados ahora: ' + n);
  }
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
