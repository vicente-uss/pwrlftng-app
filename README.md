# PWRLFTNG 🏋️‍♂️📊

> **PWRLFTNG** es una aplicación móvil de tracking de entrenamiento diseñada específicamente para atletas de powerlifting y deportes de fuerza. Su propósito principal es permitir el registro preciso de entrenamientos y la revisión de historiales basados en datos objetivos, optimizando la toma de decisiones entre el atleta y su entrenador. La app actúa como un diario de ingeniería de fuerza, eliminando automatizaciones de coaching artificiales y distracciones sociales.

---

## ⚡ Principios del Producto

El desarrollo de la plataforma se rige estrictamente por los siguientes pilares de diseño y rendimiento:
* **Velocidad y Minimalismo:** Interfaz optimizada para un registro rápido *on-the-fly* durante el entrenamiento, priorizando la claridad visual.
* **Mobile-First & Offline-First:** Diseñada nativamente para entornos móviles y capaz de funcionar al 100% sin conexión a internet en sótanos o gimnasios con mala cobertura.
* **Cero Distracciones:** Sin funciones comunitarias, perfiles sociales ni chats de mensajería integrados. El foco está exclusivamente en la barra.
* **Enfoque Profesional:** Estética de modo oscuro premium con un estilo minimalista deportivo adaptado a las necesidades de la alta competencia.

---

## 🛠️ Stack Técnico Recomendado

La arquitectura del proyecto está construida sobre tecnologías modernas, eficientes y preparadas para la escalabilidad:

* **Frontend Móvil:** React Native con Expo y TypeScript.
* **Base de Datos Local (Offline-First):** SQLite como fuente inmediata de datos.
* **Gestión de Estado:** Zustand o Context API.
* **Manejo de Formularios:** React Hook Form.
* **Enrutamiento y Navegación:** Expo Router o React Navigation.
* **Infraestructura Cloud (Fase Futura):** Supabase (PostgreSQL, Supabase Auth y Row Level Security).

---

## 📋 Alcance del MVP (Producto Mínimo Viable)

El MVP incluye todas las herramientas esenciales para completar un ciclo real de entrenamiento de fuerza:

* **Autenticación e Interfaz:** Pantallas de Login/Registro funcional (inicialmente simulado/demo y posteriormente integrado con Supabase Auth y Google).
* **Gestión de Rutinas:** Panel para configurar hasta 7 rutinas principales asociadas a días específicos (Día 1, Día 2, etc.) con opción de duplicación y reordenamiento de ejercicios.
* **Base de Datos de Ejercicios:** Catálogo precargado con los movimientos reina (Squat, Bench Press, Deadlift) junto con accesorios esenciales (Militar, Remo, Hip Thrust, etc.). El usuario no podrá crear ejercicios personalizados en el MVP.
* **Consola de Sesión Activa:** 
    * Entrenamientos basados en rutinas preestablecidas o sesiones libres.
    * Cronómetro de sesión global y temporizador automático de descanso (3 minutos por defecto, editable desde configuración).
    * Campos de captura para Peso, Repeticiones, RPE/RIR y discriminación de Tipo de Serie (Calentamiento vs. Efectiva).
    * Persistencia local en tiempo real para evitar pérdidas accidentales por cierre de la app.
* **Métricas e Historial:** Resumen al finalizar la sesión, desglose histórico por ejercicio, cálculo de volumen efectivo total (excluyendo series de calentamiento) y seguimiento de pesos máximos levantados.

---

## 🚫 Fuera del Alcance del MVP

Para garantizar el cumplimiento de los plazos de entrega, las siguientes características quedan estrictamente excluidas de la primera versión y se delegarán a fases de actualización posteriores:
* Panel de control o cuentas con rol de Coach.
* Importación o exportación de datos a planillas Excel.
* Estadísticas avanzadas, gráficos complejos o integraciones de IA.
* Estructuras complejas de series como Superseries, Circuitos o lógicas nativas de *Drop sets*, *AMRAP* o *Top sets*.
* Conexión con Apple Health, Google Fit o inicio de sesión con Apple.
* Pasarelas de pago, suscripciones in-app o publicación comercial en App Store / Play Store.

---

## 🔀 Flujo de Trabajo en Git & GitFlow

El repositorio se gestiona bajo un entorno privado con asignación de tareas mediante GitHub Issues y revisiones obligatorias por Pull Requests. La arquitectura de ramas se divide en:

* `main`: Versión estable lista para despliegues de versiones internas.
* `develop`: Eje de integración para compilar y probar los avances diarios.
* `feature/` : Ramas de desarrollo técnico aisladas por funcionalidad:
    * `feature/login`: Módulo de acceso y sesiones.
    * `feature/routines`: Estructura y CRUD de rutinas locales.
    * `feature/workout-session`: Temporizadores e interfaz activa del gimnasio.
    * `feature/history`: Pantallas de histórico y lógicas de cálculo de volumen.
    * `feature/local-storage`: Capa de persistencia local con SQLite.
    * `feature/sync`: Preparación para la sincronización en la nube con Supabase.

---

## 🗺️ Plan de Desarrollo (Roadmap de 1 Mes)

| Semana | Objetivo Principal | Entregables y Componentes Clave |
| :--- | :--- | :--- |
| **Semana 1** | **Base de la App e Interfaz** | Inicialización del proyecto, TypeScript, navegación por pestañas inferiores (Home, Entrenamiento, Perfil), tema oscuro e interfaz de Login demo. |
| **Semana 2** | **Arquitectura de Rutinas** | Implementación del listado de rutinas, selector de base de datos de ejercicios, configuración de series objetivo y persistencia local del diseño. |
| **Semana 3** | **Motor de Sesión Activa** | Panel de ejecución de entrenamientos en tiempo real, cronómetro global, lógica de checks de series completadas, disparador de descanso automático y guardado local continuo. |
| **Semana 4** | **Historial y Despliegue Beta** | Pantalla de resumen final, analítica básica de volumen efectivo, listado histórico por patrón de movimiento, documentación técnica completa y generación de la primera compilación interna para Beta Testers. |

---

## 🔍 Criterio de Éxito para el Cierre de Proyecto

El MVP se considerará exitoso y finalizado cuando un atleta sea capaz de iniciar la aplicación, planificar un entrenamiento con ejercicios integrados, ejecutar la sesión en el gimnasio registrando de forma fidedigna sus cargas y RPE mediante los temporizadores, y guardar el registro de volumen en su historial local de manera consistente sin depender de una conexión a internet.