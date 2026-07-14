# Backend PWRLFTNG

Este directorio contiene la primera migración del backend Supabase.

Incluye perfiles, catálogo de ejercicios, rutinas, sesiones, series y políticas RLS para que cada atleta solo pueda leer y modificar sus propios datos.

Para conectarlo:

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/migrations/202607130001_initial_schema.sql` en el SQL Editor.
3. Copiar `.env.example` a `.env` y completar la URL y la clave pública `anon`.
4. Reiniciar Expo.

Las claves privadas o `service_role` nunca deben incluirse en la app móvil.
