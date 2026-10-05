#!/bin/sh
# ARKEN PRECIOS · corre un comando con un llavero de GNOME desbloqueado, para probar la bóveda de
# la app de escritorio en Linux (safeStorage de Electron). Va dentro de una sesión de D-Bus:
#
#   xvfb-run -a dbus-run-session -- sh pruebas/con-llavero.sh npm run prueba:escritorio
#
# El llavero es de prueba: se crea en la carpeta del usuario con la contraseña «prueba».

eval "$(printf 'prueba' | gnome-keyring-daemon --unlock --components=secrets 2>/dev/null)"
export GNOME_KEYRING_CONTROL
# Con GNOME, Electron cifra con el llavero (libsecret) y no con una clave fija
export XDG_CURRENT_DESKTOP=GNOME
exec "$@"
