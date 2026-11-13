# ARKEN FOLDER

Un tablero personalizable con accesos directos a sus carpetas, de la familia ARKEN 360. Es solo para Windows.

Usted le da acceso a una o varias carpetas. ARKEN FOLDER las muestra como tarjetas, junto con todas sus subcarpetas y las carpetas que las contienen (las supercarpetas). Desde ahí usted ve lo que hay dentro y abre cada archivo o programa con doble clic.

## Qué hace

- **Tablero totalmente personalizable.** En cada tarjeta puede cambiar el nombre, el icono (50 iconos o una imagen propia), el color, el tamaño (pequeña, mediana, grande o muy grande), el estilo (clásico, color, contorno o vidrio), la etiqueta y una nota. Las tarjetas se agrupan en grupos con nombre, icono y color, y se arrastran para ordenarlas o pasarlas de un grupo a otro. En el tablero puede cambiar el título, el subtítulo, el tema (claro, oscuro o como Windows), el color de acento, la densidad, el fondo (degradado, color o una imagen propia) y qué información se ve.
- **Subcarpetas y supercarpetas.** Al dar acceso a una carpeta, el programa ofrece poner en el tablero la carpeta, sus subcarpetas y sus supercarpetas. En «Explorar», el árbol llega a todas las subcarpetas, a cualquier profundidad. En el menú del acceso, «Supercarpetas visibles…» define hasta dónde se puede subir. De fábrica se puede subir hasta la unidad (por ejemplo `C:`).
- **Ver y abrir.** Lista o miniaturas, filtro, orden por nombre, fecha, tamaño o tipo. Muestra la vista previa de imágenes, PDF, video, audio y texto. Con doble clic abre el archivo en su programa de Windows. Un programa (.exe, .bat, .msi…) solo se ejecuta después de confirmarlo en una ventana de Windows. Un archivo se puede arrastrar desde ARKEN FOLDER a otra aplicación, como el correo o el escritorio.
- **Buscar.** Ctrl+K busca por nombre en todas las carpetas con acceso, sin importar mayúsculas ni tildes.
- **Favoritos y recientes.** Marque tarjetas con estrella. El historial guarda lo último que abrió.
- **Se actualiza solo.** Si alguien agrega o borra un archivo en la carpeta abierta, la lista cambia sola.

## Qué no hace

- **No modifica sus carpetas.** ARKEN FOLDER solo lee: nunca crea, cambia, mueve ni borra archivos o carpetas. Si le cambia el nombre a una tarjeta, la carpeta real conserva el suyo. Si abre un archivo en Excel y lo guarda, ese cambio lo hace Excel.
- **No ve lo que usted no autorizó.** El proceso principal rechaza cualquier ruta fuera de los accesos, aunque la pida la ventana.
- **No usa internet.** La app cancela toda conexión hacia fuera.

El tablero se guarda en `%APPDATA%\ARKEN FOLDER\arken-folder.json`. También queda una copia de la versión anterior. Con «Archivo › Guardar una copia del tablero…» puede pasarlo a otro computador.

## Instalar

En la pestaña **Actions** del repositorio, abra la última ejecución de «Compilar ARKEN FOLDER». En «Artifacts» hay dos archivos:

- `ARKEN-FOLDER-x.y.z-Windows.exe`: el instalador. Crea el acceso en el escritorio y en el menú Inicio.
- `ARKEN-FOLDER-x.y.z-Windows-portable.exe`: se abre sin instalar, por ejemplo desde una memoria USB.

Los instaladores no están firmados. Windows puede mostrar «Windows protegió su PC»: toque «Más información» y luego «Ejecutar de todas formas».

## Para desarrollar

```
cd folder
npm ci
npm run escritorio          # abre la app
npm run prueba:nucleo       # permisos por carpeta y guardado (sin Electron)
npm run prueba:escritorio   # la app real: en Linux, con xvfb-run
npm run dist:windows        # instalador y portátil (en Windows)
```

- `electron/accesos.cjs`: qué rutas se pueden ver.
- `electron/almacen.cjs`: el guardado del tablero.
- `electron/main.cjs`: la ventana, el puente y el protocolo `arkenarchivo://` para las vistas previas.
- `ui/`: el programa (HTML, CSS y JavaScript sin dependencias).
