# ritmica-chile-sur

Web mobile-first para orden de paso de Ritmica Chile con puntajes y notas en tiempo real.

## Funcionalidades

- Vista por defecto en Sabado
- Pestana para Domingo
- Orden intercalado por banca (`A1, B1, A2, B2...`)
- Filtro por club y por dia
- Puntaje con formato de dos decimales
- Notas por gimnasta en acordeon (cerrado por defecto)
- Sincronizacion en vivo con Firebase Firestore
- Vista "Lugares" agrupada por categoria y ordenada por puntaje desc

## Archivos

- `index.html`: estructura de la app
- `styles.css`: estilos responsive
- `data.js`: datos de Sabado y Domingo
- `app.js`: logica de UI y Firebase
- `firestore.rules`: reglas recomendadas para Firestore

## Publicacion en GitHub Pages

1. Subir repositorio a GitHub
2. Activar Pages en `main` y carpeta `/` (root)
3. Abrir URL publica

## Firebase

El proyecto ya usa la configuracion de Firebase compartida por el usuario.

Recuerda publicar reglas de `firestore.rules` en consola Firebase.
