# PWRLFTNG

Aplicación móvil de registro y seguimiento de entrenamientos de powerlifting, construida con React Native y Expo.

## Estado de la beta

- Interfaz negra premium basada en el prototipo aprobado de Figma.
- Rutinas: crear, duplicar, eliminar e iniciar.
- Sesión activa con peso, repeticiones, RPE, series completadas y descanso configurable.
- Resumen, volumen efectivo, historial y e1RM.
- Perfil y recuperación de sesiones persistidos de forma local con SQLite.
- Backend Supabase preparado con autenticación, esquema SQL y seguridad RLS por atleta.

## Ejecutar

```bash
npm install
npx expo start
```

La cuenta demo funciona sin configurar servicios externos.

## Conectar Supabase

1. Copiar `.env.example` a `.env` y completar las dos variables públicas.
2. Ejecutar la migración de `supabase/migrations` en el SQL Editor de Supabase.
3. Reiniciar Expo.

Nunca incluir una clave `service_role` en la aplicación móvil.

## Generar APK de prueba

```bash
npx eas-cli build -p android --profile preview
```

El perfil `preview` genera un APK instalable directamente en un teléfono Android.
