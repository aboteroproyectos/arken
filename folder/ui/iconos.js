// ARKEN FOLDER · iconos de trazo (24×24) para tarjetas, grupos y archivos.
'use strict';

window.ICONOS = {
  carpeta: { n: 'Carpeta', d: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
  'carpeta-abierta': { n: 'Carpeta abierta', d: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1"/><path d="M3 18 5.5 11h16L19 18z"/>' },
  'carpeta-estrella': { n: 'Carpeta importante', d: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m12 9.5 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>' },
  disco: { n: 'Unidad', d: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13 7 5h10l2 8"/><circle cx="17" cy="16.5" r=".8"/>' },
  casa: { n: 'Casa', d: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>' },
  edificio: { n: 'Edificio', d: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/>' },
  grua: { n: 'Obra', d: '<path d="M6 21V4h2v17M4 21h8M8 5h12l-3 3H8M17 8v5"/><rect x="15.5" y="13" width="3" height="3"/>' },
  casco: { n: 'Seguridad', d: '<path d="M4 17h16v2H4z"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M10 10V6h4v4"/>' },
  plano: { n: 'Planos', d: '<path d="M4 4h16v16H4z"/><path d="M4 9h7v11M11 13h9M15 4v9"/>' },
  regla: { n: 'Medidas', d: '<path d="m3 17 14-14 4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>' },
  herramienta: { n: 'Herramientas', d: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>' },
  camion: { n: 'Transporte', d: '<path d="M2 6h12v10H2zM14 10h4l4 4v2h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>' },
  contrato: { n: 'Contratos', d: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h4"/><path d="m14 17 1.5 1.5L19 15"/>' },
  documento: { n: 'Documentos', d: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>' },
  factura: { n: 'Facturas', d: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>' },
  dinero: { n: 'Finanzas', d: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v4M18 10v4"/>' },
  grafica: { n: 'Informes', d: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>' },
  calculadora: { n: 'Presupuestos', d: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>' },
  calendario: { n: 'Calendario', d: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  reloj: { n: 'Pendientes', d: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  foto: { n: 'Fotos', d: '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 9"/>' },
  camara: { n: 'Cámara', d: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>' },
  video: { n: 'Videos', d: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>' },
  musica: { n: 'Audio', d: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  persona: { n: 'Persona', d: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
  equipo: { n: 'Equipo', d: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 5 5"/>' },
  cliente: { n: 'Clientes', d: '<path d="M8 11 4 7l4-4M4 7h9a4 4 0 0 1 0 8h-1"/><path d="M16 13l4 4-4 4M20 17h-9"/>' },
  correo: { n: 'Correo', d: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>' },
  telefono: { n: 'Contactos', d: '<path d="M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>' },
  mapa: { n: 'Lotes y mapas', d: '<path d="m9 4-6 3v13l6-3 6 3 6-3V4l-6 3z"/><path d="M9 4v13M15 7v13"/>' },
  pin: { n: 'Ubicación', d: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>' },
  libro: { n: 'Normas', d: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>' },
  caja: { n: 'Archivo muerto', d: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>' },
  candado: { n: 'Privado', d: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>' },
  nube: { n: 'Nube', d: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>' },
  estrella: { n: 'Estrella', d: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>' },
  corazon: { n: 'Corazón', d: '<path d="M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11z"/>' },
  bandera: { n: 'Bandera', d: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>' },
  check: { n: 'Terminado', d: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>' },
  alerta: { n: 'Urgente', d: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>' },
  rayo: { n: 'Eléctrico', d: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  gota: { n: 'Hidráulico', d: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>' },
  arbol: { n: 'Paisajismo', d: '<path d="M12 22v-6"/><path d="M12 2 6 10h3l-4 6h14l-4-6h3z"/>' },
  ladrillo: { n: 'Materiales', d: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 14.5h18M9 5v5M15 10v4.5M9 14.5V19"/>' },
  cubo: { n: 'Modelos 3D', d: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>' },
  codigo: { n: 'Programas', d: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>' },
  globo: { n: 'Web', d: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
  escudo: { n: 'Legal', d: '<path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6z"/>' },
  balanza: { n: 'Licitaciones', d: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>' },
  llave: { n: 'Accesos', d: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>' },
  rayos: { n: 'Ideas', d: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>' },
};

window.COLORES = [
  ['#A98B54', 'Latón'], ['#41464C', 'Grafito'], ['#3C5A76', 'Azul acero'], ['#3B6E52', 'Verde'],
  ['#96362E', 'Rojo ladrillo'], ['#9A6B1E', 'Ámbar'], ['#B5653F', 'Terracota'], ['#7A2E45', 'Vino'],
  ['#2F6B6E', 'Petróleo'], ['#5B4B8A', 'Violeta'], ['#6B6B2F', 'Oliva'], ['#4F86B8', 'Cielo'],
  ['#B5577D', 'Rosa'], ['#C2A878', 'Arena'], ['#16181A', 'Negro'], ['#8E959C', 'Plata'],
];

/** Tipo de archivo por extensión: etiqueta, color y si se puede ver dentro del programa. */
window.TIPOS_ARCHIVO = (() => {
  const t = {};
  const def = (exts, tipo, color, vista) => exts.split(' ').forEach((e) => { t[e] = { tipo, color, vista }; });
  def('pdf', 'PDF', '#B23A30', 'pdf');
  def('png jpg jpeg gif webp bmp svg ico avif', 'Imagen', '#3B6E52', 'imagen');
  def('heic tif tiff raw cr2 nef psd', 'Imagen', '#3B6E52', null);
  def('mp4 m4v webm ogv mov', 'Video', '#5B4B8A', 'video');
  def('avi mkv wmv flv 3gp', 'Video', '#5B4B8A', null);
  def('mp3 wav ogg m4a flac', 'Audio', '#B5577D', 'audio');
  def('aac wma opus', 'Audio', '#B5577D', null);
  def('xls xlsx xlsm xlsb ods', 'Hoja de cálculo', '#1F7A47', null);
  def('csv tsv', 'Datos', '#1F7A47', 'texto');
  def('doc docx odt rtf', 'Documento', '#2B5797', null);
  def('ppt pptx odp key', 'Presentación', '#C55A11', null);
  def('txt md log ini cfg json xml yml yaml html htm css js mjs cjs ts py bat ps1 sql', 'Texto', '#41464C', 'texto');
  def('dwg dxf dwf dgn', 'Plano CAD', '#9A6B1E', null);
  def('rvt rfa ifc nwd nwc skp 3dm max blend obj fbx stl', 'Modelo 3D', '#2F6B6E', null);
  def('zip rar 7z tar gz bz2 xz', 'Comprimido', '#6B6B2F', null);
  def('exe msi lnk url appx', 'Programa', '#767C83', null);
  def('mpp xer pod', 'Cronograma', '#3C5A76', null);
  def('eml msg pst', 'Correo', '#4F86B8', null);
  return t;
})();
