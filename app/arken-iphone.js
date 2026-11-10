/* ARKEN CONTROL · capa de la versión para iPhone y iPad (instalada desde Safari).
   · Registra sw.js: el programa queda guardado en el teléfono y abre sin internet.
   · Busca versión nueva al abrir y cada vez que la app vuelve al frente. Si la encuentra,
     la descarga sola. Si la app acaba de abrir, recarga de inmediato; si ya estaba en uso,
     muestra un aviso para no interrumpir un trabajo a medias (lo guardado no se pierde).
   · Pide almacenamiento persistente, para que iOS no borre los datos por falta de espacio.
   · En Safari normal (sin instalar) muestra una vez cómo agregarla a la pantalla de inicio.
   Fuera de un navegador (apps de Android, iOS nativa, Windows, macOS) no hace nada. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return;
  if (window.arkenEscritorio) return;

  const cargada = Date.now();
  const instalada = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const yaHabiaVersion = !!navigator.serviceWorker.controller;

  const banda = (texto, boton, accion) => {
    const pintar = () => {
      if (document.getElementById('arken-iphone-aviso')) return;
      const d = document.createElement('div');
      d.id = 'arken-iphone-aviso';
      d.setAttribute('role', 'status');
      d.style.cssText =
        'position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));z-index:2147483000;' +
        'background:#1F2326;color:#F2EFE8;border:1px solid #B08D57;border-radius:12px;padding:12px 14px;' +
        'font:14px/1.4 -apple-system,system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 6px 24px #0008';
      const t = document.createElement('span');
      t.style.flex = '1';
      t.textContent = texto;
      d.appendChild(t);
      if (boton) {
        const b = document.createElement('button');
        b.textContent = boton;
        b.style.cssText = 'background:#B08D57;color:#16181A;border:0;border-radius:8px;padding:8px 12px;font-weight:600';
        b.onclick = () => { d.remove(); accion && accion(); };
        d.appendChild(b);
      }
      const x = document.createElement('button');
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Cerrar');
      x.style.cssText = 'background:none;color:#F2EFE8;border:0;font-size:16px;padding:4px 6px';
      x.onclick = () => d.remove();
      d.appendChild(x);
      document.body.appendChild(d);
    };
    document.body ? pintar() : addEventListener('DOMContentLoaded', pintar);
  };

  navigator.serviceWorker
    .register('sw.js', { scope: './', updateViaCache: 'none' })
    .then((reg) => {
      const buscar = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && buscar());
      setInterval(buscar, 6 * 3600 * 1000);
    })
    .catch((e) => console.warn('ARKEN · no se pudo activar el modo sin internet', e));

  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!yaHabiaVersion || recargando) return; // primera instalación: no hay nada que cambiar
    if (Date.now() - cargada < 20000) {
      recargando = true;
      location.reload();
    } else {
      banda('Hay una versión nueva de ARKEN CONTROL lista. Sus datos se conservan.', 'Actualizar', () => {
        recargando = true;
        location.reload();
      });
    }
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (esIOS && !instalada) {
    let visto = false;
    try { visto = localStorage.getItem('arken_iphone_guia') === '1'; } catch (e) {}
    if (!visto) {
      setTimeout(() => {
        banda('Para instalarla: toque Compartir (□↑) y luego «Agregar a pantalla de inicio».', 'Entendido', () => {
          try { localStorage.setItem('arken_iphone_guia', '1'); } catch (e) {}
        });
      }, 2500);
    }
  }
})();
