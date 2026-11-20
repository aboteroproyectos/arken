// ARKEN OBRA · pantalla de inicio: una tarjeta por aplicación.
(async () => {
  const caja = document.getElementById('apps');
  const lista = await window.arkenObra.apps();
  lista.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = 'app';
    b.type = 'button';
    b.dataset.app = a.id;
    b.disabled = !a.disponible;
    const cab = document.createElement('div');
    cab.className = 'cab';
    const h = document.createElement('h2');
    h.textContent = a.nombre;
    const v = document.createElement('span');
    v.className = 'ver';
    v.textContent = a.disponible ? 'v' + a.version : 'Próximamente';
    cab.append(h, v);
    const p = document.createElement('p');
    p.textContent = a.descripcion;
    const acc = document.createElement('span');
    acc.className = 'accion';
    acc.textContent = a.disponible ? 'Abrir ›' : 'Llega con la próxima versión de ARKEN OBRA';
    b.append(cab, p, acc);
    if (a.disponible) {
      const t = document.createElement('span');
      t.className = 'tecla';
      t.textContent = 'Ctrl+' + (i + 1);
      b.append(t);
      b.addEventListener('click', () => window.arkenObra.abrir(a.id));
    }
    caja.append(b);
  });
  const primero = caja.querySelector('.app:not(:disabled)');
  if (primero) primero.focus();
  document.getElementById('pie').textContent = 'ARKEN OBRA · todo funciona sin internet · los datos quedan solo en este equipo';
})();
