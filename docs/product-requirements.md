# Product Requirements Document — PWRLFTNG MVP

## Objetivo
Construir una app móvil de tracking para powerlifting, rápida, minimalista y offline-first.

## Usuario principal del MVP
Atleta.

## Usuario futuro
Coach con múltiples atletas.

## Flujo MVP
1. Login demo.
2. Home.
3. Crear rutina.
4. Seleccionar ejercicios.
5. Configurar estructura básica.
6. Iniciar entrenamiento.
7. Marcar series completadas.
8. Activar descanso automático.
9. Finalizar entrenamiento.
10. Ver resumen.

## Requisitos funcionales Sprint 01
- El login permite entrar con cualquier credencial.
- La app tiene navegación inferior: Inicio, Entrenar, Perfil.
- La app muestra rutinas guardadas.
- La app permite crear rutina con nombre, día, modo RPE/RIR y ejercicios.
- La app permite iniciar entrenamiento desde una rutina.
- La app muestra cronómetro global.
- La app inicia descanso de 3 minutos al completar una serie.
- La app calcula volumen efectivo básico sin calentamientos.
- La app muestra resumen al terminar.

## Requisitos no funcionales
- Diseño oscuro.
- Interfaz rápida.
- Código modular.
- Preparado para SQLite en Sprint 02.
- Preparado para Supabase en fase futura.
