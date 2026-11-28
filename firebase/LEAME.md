# ARKEN CONTROL con Firebase (datos entre equipos)

Desde la versión 18.2, el computador y los celulares pueden compartir los datos de la empresa por **Cloud Firestore**.
Es el mismo módulo de **Administración › Datos entre equipos** de la versión 17: cambia sólo dónde se guardan las piezas.

- Cada equipo entra con un **correo y contraseña de Firebase Authentication**. La contraseña no se guarda: queda una sesión.
- Las **reglas de seguridad** ([`firestore.rules`](firestore.rules)) sólo dejan leer o escribir a los correos que el dueño autorizó.
  El dueño (quien activó) es el único que cambia esa lista; nadie puede listar espacios ni crearse acceso.
- Todo viaja y se guarda **cifrado con AES-256**. La llave se crea en el computador principal y viaja sólo dentro del
  código QR de vinculación; nunca llega a Firebase.
- Sin librerías externas: el programa habla con Firebase por su API REST (igual en navegador, escritorio, iPhone y Android).
- En reposo, cada equipo abierto lee **un solo documento cada 45 segundos**: el plan gratuito Spark alcanza.

## Crear el proyecto (una sola vez, con la cuenta de Google de la empresa)

1. Entre a <https://console.firebase.google.com> › **Crear un proyecto** (por ejemplo `arken-control`). Google Analytics no hace falta.
2. **Authentication › Comenzar › Correo electrónico/contraseña › Habilitar › Guardar.**
3. **Authentication › Usuarios › Agregar usuario**: su correo y una contraseña. Repita por cada persona que use un celular.
4. **Authentication › Configuración › Acciones del usuario**: desmarque **Habilitar creación (registro)** para que nadie más pueda crearse una cuenta.
5. **Firestore Database › Crear base de datos** › modo **producción** › ubicación `southamerica-east1` (São Paulo) o `us-east1`.
6. **Firestore Database › Reglas**: borre todo, pegue el contenido de [`firestore.rules`](firestore.rules)
   (o el botón **Copiar reglas de seguridad** del programa) y pulse **Publicar**.
7. **Configuración del proyecto (⚙) › Tus apps › Web (`</>`)**: registre la app «ARKEN CONTROL» (sin Hosting) y copie el bloque `firebaseConfig`.

## En ARKEN CONTROL

1. En el computador principal: **Administración › Datos entre equipos › Conectar con Firebase**, pegue el bloque `firebaseConfig`
   e ingrese con su correo. La primera subida tarda según el tamaño de la biblioteca.
2. **Correos autorizados**: agregue el correo de cada persona que vaya a usar un celular.
3. **Vincular otro equipo** muestra un QR. En el celular, en la pantalla de ingreso, toque **☁ Unir este equipo**, escanee el código
   y escriba el correo y la contraseña de Firebase de esa persona. Después se entra con el usuario de ARKEN de siempre.

Si ya usaba la sincronización por Google Drive (versión 17): en el computador principal pulse **Sincronizar ahora**, luego
**Pasar a Firebase**, y vuelva a unir los celulares con el código nuevo.

## Para sacar a alguien

Quite su correo de **Correos autorizados** y deshabilítelo en **Authentication › Usuarios**. Si se perdió un equipo, además
desvincule y vuelva a conectar el computador principal (crea un espacio nuevo con otra llave) y una de nuevo los demás equipos.
