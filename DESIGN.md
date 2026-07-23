# PWRLFTNG — sistema de diseño móvil

Este documento define el lenguaje visual y de interacción de PWRLFTNG. Es una
especificación operativa para diseñadores, desarrolladores y agentes de IA. Su
objetivo es que cada pantalla nueva se sienta parte de la misma aplicación sin
redescubrir el estilo en cada tarea.

## 1. Fuentes de verdad y prioridad

Cuando existan diferencias entre referencias, usar este orden:

1. Una captura o frame que el usuario indique explícitamente como aprobado para
   la tarea actual.
2. Este `DESIGN.md`.
3. Los tokens de `src/theme.ts` y los componentes de `src/components/ui.tsx`.
4. Los patrones ya presentes en las pantallas móviles.
5. El prototipo web, únicamente como referencia visual; nunca copiar HTML, CSS,
   Tailwind ni componentes web directamente a React Native.

Una referencia visual no autoriza a eliminar funcionalidad existente. Si una
captura no muestra un estado necesario —error, carga, teclado, contenido largo,
etc.— se debe diseñar ese estado respetando este documento.

## 2. Carácter del producto

PWRLFTNG es una herramienta de entrenamiento seria, técnica y enfocada. Debe
sentirse:

- negra, premium y sobria;
- fuerte, precisa y directa;
- densa en información, pero fácil de escanear durante un entrenamiento;
- deportiva sin parecer un videojuego;
- especializada en powerlifting, no una aplicación fitness genérica.

La interfaz privilegia contraste, jerarquía tipográfica y superficies planas.
El naranja representa energía, selección y acción. No es decoración.

Evitar una estética SaaS genérica, neón, futurista, excesivamente amigable o
llena de ilustraciones. No usar gradientes, glassmorphism, brillos ni sombras
grandes salvo que una referencia aprobada lo exija.

### 2.1 Tesis de producto: Hevy × Data Based Training

PWRLFTNG busca fusionar dos fortalezas complementarias:

- **Hevy como referencia de experiencia cotidiana:** registrar un entrenamiento
  debe ser rápido, evidente y agradable. Crear o iniciar una rutina, comenzar un
  entrenamiento libre, agregar ejercicios o series, revisar valores anteriores,
  usar el descanso y detectar un PR no debe exigir aprendizaje innecesario.
- **Data Based Training como referencia de profundidad técnica:** la aplicación
  debe soportar planificación detallada, bloques y semanas, prescripción por
  entrenador, RPE/RIR, seguimiento del atleta, análisis, bienestar y decisiones
  basadas en datos reales.

La meta no es copiar ambas aplicaciones ni sumar todas sus funciones. La fórmula
de PWRLFTNG es:

> **La velocidad de un diario de entrenamiento moderno con la profundidad de una
> plataforma profesional de programación y análisis.**

Esto crea dos ritmos de uso dentro del mismo producto:

1. **Atleta durante el entrenamiento:** baja fricción, una mano, pocos toques,
   números grandes, contexto inmediato y ninguna distracción innecesaria.
2. **Entrenador al planificar o analizar:** mayor densidad de información,
   estructura por bloque/semana/día, controles potentes y trazabilidad, sin caer
   en una experiencia de planilla Excel trasladada al teléfono.

Ambos ritmos comparten datos, componentes y lenguaje visual, pero no necesitan la
misma densidad en cada pantalla. La complejidad profesional debe aparecer de
manera progresiva y solo donde aporta valor.

### 2.2 Filtro para adoptar, mejorar o descartar funciones

Cada función inspirada en otro producto debe evaluarse antes de implementarse:

**Reutilizar** cuando:

- resuelve una necesidad frecuente y comprobable;
- reduce tiempo, toques o carga mental;
- ayuda al atleta a registrar mejor o al entrenador a decidir mejor;
- se integra con el modelo de datos y el flujo actual sin duplicación.

**Mejorar** cuando:

- el concepto es valioso pero su flujo es confuso, lento o demasiado técnico;
- presenta datos sin convertirlos en una conclusión o siguiente acción;
- funciona bien para atleta o entrenador, pero no para ambos;
- necesita mejor jerarquía, accesibilidad, personalización o contexto.

**Descartar** cuando:

- existe principalmente por moda, engagement artificial o presión social;
- añade pantallas, métricas o configuración sin mejorar una decisión;
- distrae durante una sesión activa;
- replica información ya disponible sin aportar una lectura nueva;
- obliga a exponer complejidad profesional a quien solo necesita entrenar;
- perjudica velocidad, claridad, confiabilidad o privacidad.

No asumir que las funciones sociales de Hevy, toda la densidad de Data Based
Training o cualquier decisión comercial de esas aplicaciones debe heredarse.
Cada incorporación necesita una razón propia dentro de PWRLFTNG.

## 3. Color

Los valores canónicos viven en `src/theme.ts`. No duplicar estos hexadecimales
en las pantallas.

| Token | Valor actual | Uso |
| --- | --- | --- |
| `colors.canvas` | `#050505` | Fondo más profundo o áreas especiales |
| `colors.background` | `#080808` | Fondo principal de la aplicación |
| `colors.surface` | `#111111` | Tarjetas, inputs y superficies interactivas |
| `colors.elevated` | `#171717` | Contenedores internos, iconos y segundo nivel |
| `colors.border` | `#1e1e1e` | Bordes y divisores |
| `colors.text` | `#ffffff` | Texto principal y valores importantes |
| `colors.muted` | `#777777` | Texto secundario legible |
| `colors.dim` | `#4b4b4b` | Metadatos y ayudas de menor prioridad |
| `colors.subtle` | `#333333` | Estados inactivos y texto de mínima prioridad |
| `colors.orange` | `#e85500` | Acción principal, selección y marca |
| `colors.success` | `#22c55e` | Éxito, sincronización y serie completada |
| `colors.warning` | `#b7791f` | Advertencias y series de calentamiento |
| `colors.danger` | `#ef4444` | Error y acciones destructivas |

### Reglas de color

- El fondo predeterminado siempre es negro; no existe tema claro por ahora.
- Usar naranja para una acción primaria, un estado seleccionado, una etiqueta
  de marca o un dato que realmente necesite énfasis.
- Como regla visual, no competir con más de una acción naranja dominante dentro
  de una misma sección.
- El blanco puede usarse como CTA alternativo de máxima jerarquía cuando el
  naranja ya identifica otra acción o estado.
- Rojo se reserva para error o destrucción. Verde se reserva para éxito.
- Los estados seleccionados pueden combinar borde naranja con fondo marrón muy
  oscuro (`#21130d`). Si se repite, convertirlo en token.
- Los tratamientos cálidos especiales existentes —descanso, entrenamiento
  libre— deben permanecer oscuros y discretos, nunca convertirse en bloques
  naranja saturados.
- No introducir colores de marca nuevos sin una decisión explícita.

## 4. Tipografía

La aplicación usa tipografía del sistema. `condensed` en `src/theme.ts` se
reserva para marca, títulos grandes y números destacados. Los datos tabulares
usan `monospace` para mantener alineación.

| Nivel | Tamaño orientativo | Peso | Uso |
| --- | ---: | ---: | --- |
| Marca principal | 48 | 900 | `PWRLFTNG` en acceso o bienvenida |
| Marca compacta | 28 | 900 | Encabezado de pestaña principal |
| Título de pantalla | 25 | 900 | Barra superior |
| Título de tarjeta destacado | 22–23 | 900 | Acción o resultado principal |
| Subtítulo | 18 | 800 | Bloques importantes |
| Texto principal | 14–15 | 600–700 | Nombres y contenido |
| Texto secundario | 12–13 | 400–700 | Descripción y metadatos |
| Etiqueta de sección | 9–10 | 700–800 | Mayúsculas, tracking 1–1.5 |
| Microetiqueta | 8–9 | 700–800 | Encabezados de series o métricas |
| Métrica | 13–30 | 700–900 | Números; usar mono o condensed |

### Reglas tipográficas

- Usar mayúsculas y `letterSpacing` solo en marca, etiquetas cortas y encabezados
  de datos. No escribir párrafos completos en mayúsculas.
- Los títulos deben ser breves, fuertes y alineados a la izquierda.
- Los valores que el atleta necesita leer durante una serie tienen prioridad
  sobre explicaciones o metadatos.
- Mantener interlineado aproximado de 1.35–1.45 en textos de ayuda y error.
- No añadir una fuente externa hasta que exista una decisión de marca y se haya
  comprobado su legibilidad en Android e iOS.
- No usar más de tres niveles tipográficos claramente dominantes en una vista.

## 5. Espaciado, forma y bordes

La cuadrícula base es de 4 px. Valores preferidos:

| Escala | Valor | Uso habitual |
| --- | ---: | --- |
| `xs` | 4 | Separación icono/etiqueta |
| `sm` | 8 | Controles relacionados, chips |
| `md` | 12 | Contenido interno compacto |
| `lg` | 14–16 | Tarjetas y controles |
| `xl` | 20 | Margen horizontal de pantalla |
| `2xl` | 24 | Acceso, bloques amplios |
| `3xl` | 30–42 | Cierre de scroll y separación de zonas |

Reglas:

- Margen horizontal estándar de pantalla: **20 px**.
- Acceso o pantallas muy simples pueden usar **24 px**.
- Separación habitual entre secciones: **14–20 px**.
- Padding habitual de tarjeta: **14–16 px**.
- El contenido desplazable necesita padding inferior de **30–42 px**, además de
  cualquier safe area o CTA persistente.
- Evitar valores arbitrarios nuevos si 8, 12, 14, 16, 20 o 24 resuelven el caso.

Radios preferidos:

- inputs y controles compactos: 9–12 px;
- botones: 11–12 px;
- filas y tarjetas pequeñas: 12–14 px;
- tarjetas principales: 16 px;
- diálogos y sheets: 18 px;
- contenedores de iconos: 10–14 px.

Los elementos no deben parecer píldoras salvo chips, filtros o estados breves.
La profundidad se expresa con cambio de superficie y borde de 1 px, no con
sombras. Usar `StyleSheet.hairlineWidth` en divisores internos delicados.

## 6. Estructura de pantalla

- Diseñar primero para teléfonos de 360–430 px de ancho.
- La composición es vertical, alineada a la izquierda y desplazable cuando sea
  necesario.
- Respetar siempre la safe area. No posicionar contenido importante bajo notch,
  barra de estado o indicador inferior.
- `TopBar` es el encabezado estándar de pantallas internas. Debe contener título,
  regreso opcional, eyebrow opcional y como máximo una acción principal visible.
- Las tres áreas principales son Entreno, Historial y Perfil. La navegación
  inferior debe conservar esos destinos y su orden.
- Ocultar la navegación inferior en flujos concentrados: sesión activa, creación,
  edición, detalle profundo, resumen o autenticación.
- No fijar anchos absolutos para la pantalla completa. Usar `flex`, `flexGrow`,
  `minWidth` y wrapping. Un grid de dos opciones puede usar aproximadamente 48%.
- Las pantallas con inputs deben seguir siendo utilizables con teclado abierto.
  Usar scroll, `keyboardShouldPersistTaps="handled"` y `KeyboardAvoidingView`
  cuando corresponda.
- Un CTA persistente nunca debe cubrir la última fila ni ignorar la safe area.

## 7. Componentes y patrones

### Marca

- `POWERLIFTING TRACKER` es un kicker pequeño, naranja y espaciado.
- `PWRLFTNG` es blanco, pesado y condensado.
- No repetir la marca completa en todas las pantallas internas.

### Botones

1. **Primario:** fondo naranja, texto blanco, peso 800. Una acción dominante por
   sección.
2. **Primario claro:** fondo blanco, texto negro. Usar con moderación para una
   acción de gran jerarquía.
3. **Secundario:** superficie oscura o transparente, borde visible, texto blanco
   o naranja según jerarquía.
4. **Terciario:** texto o icono sin contenedor dominante; requiere área táctil
   suficiente.
5. **Destructivo:** rojo en texto o fondo solo en confirmación final.

Altura táctil objetivo: 44–48 px. El estado presionado puede bajar opacidad a
aproximadamente 0.75. El estado deshabilitado debe verse claramente inactivo y
mantener legibilidad.

Las etiquetas deben describir la acción: “Guardar bloque”, “Iniciar rutina”,
“Agregar serie”. Evitar “OK”, “Sí” o “Continuar” cuando exista un verbo más claro.

### Tarjetas y filas

- `Card` es una superficie agrupadora, no un recurso decorativo.
- Una tarjeta principal usa `surface`, borde `border`, radio 16 y padding 16.
- Una fila navegable combina: icono o indicador, bloque de texto flexible y
  chevron final.
- Mantener iconos entre 16 y 24 px; contenedores habituales de 38–48 px.
- Evitar tarjetas dentro de tarjetas. Para segundo nivel usar `elevated`, un
  divisor o una fila interna.
- Toda fila presionable debe comunicar su interacción con chevron, icono, borde,
  estado presionado u otro affordance visible.

### Inputs

- Fondo `surface` o negro elevado, borde `border`, radio 9–12 y texto blanco.
- Placeholder `subtle`; etiqueta de campo en `dim` o `muted`.
- Inputs generales: 14–15 px. Datos de series: `monospace`, centrados y con tamaño
  suficiente para operar durante el entrenamiento.
- Mostrar unidades cerca del valor: kg, reps, min, RPE o RIR.
- Un error se muestra junto al campo, en rojo o warning, con una instrucción para
  resolverlo. No depender únicamente del color del borde.
- Para valores limitados, preferir teclado numérico y validación inmediata.

### Selectores, chips y filtros

- Estado normal: superficie oscura, borde neutral, texto secundario.
- Estado activo: borde naranja, fondo cálido oscuro y texto principal.
- Usar `accessibilityState={{ selected: true }}` o `checked` según el control.
- No utilizar un dropdown si hay pocas opciones y caben como botones visibles.
- Las selecciones críticas no deben depender solo de una pulsación larga.

### Series, métricas y tablas

- Las columnas numéricas usan `monospace` y alineación constante.
- Encabezados: 8–11 px, mayúsculas y color `dim`.
- Valores: 13 px o más y color blanco.
- Calentamiento se identifica con warning; completado con success; activo o
  editable con naranja.
- Peso, repeticiones y esfuerzo deben poder leerse sin desplazar horizontalmente
  en un teléfono de 360 px.
- Reutilizar el mismo orden de columnas en creación, sesión, resumen e historial
  siempre que el contexto lo permita.
- Agregar y eliminar series debe ser evidente. Una pulsación larga puede ser un
  atajo, pero no la única forma de descubrir una acción destructiva.

### Diálogos y bottom sheets

- Backdrop negro cercano a 76% de opacidad.
- Superficie `surface`, radio 18, borde neutral y padding 20.
- Título fuerte, mensaje breve y acciones al final.
- Cancelar a la izquierda y confirmar a la derecha.
- Toda eliminación de datos significativos necesita confirmación explícita.
- Un bottom sheet debe respetar el inset inferior y ser desplazable si el teclado
  o el contenido lo requieren.

### Estados

Cada pantalla o flujo debe considerar, cuando aplique:

- carga inicial;
- contenido vacío con siguiente acción clara;
- error recuperable y mensaje útil;
- sin conexión o sincronización pendiente;
- guardando/deshabilitado para evitar envíos dobles;
- éxito o confirmación breve;
- contenido largo y texto grande del sistema;
- teclado visible;
- sesión activa que no debe perderse accidentalmente.

No usar un spinner de pantalla completa si puede mostrarse skeleton o contenido
previo. No presentar una pantalla vacía sin explicar qué debe hacer el usuario.

## 8. Contenido y voz

- Toda la interfaz visible usa español claro y natural.
- Mantener términos entendibles por atletas: entrenamiento, rutina, serie,
  repeticiones, peso, calentamiento, RPE, RIR, e1RM, bloque y sesión.
- La primera aparición de un concepto técnico puede incluir una ayuda corta.
- Fechas visibles para el usuario siguen convención chilena, por ejemplo
  `DD-MM-AAAA` o `15 jul`. Internamente se puede conservar ISO.
- Usar “kg” de forma consistente y separar número y unidad cuando corresponda.
- Los errores indican qué ocurrió y cómo resolverlo; no culpan al usuario.
- Evitar tono infantil, frases motivacionales genéricas y exceso de signos de
  exclamación.

## 9. Accesibilidad e interacción

- Área táctil mínima de 44 × 44 px o `hitSlop` equivalente.
- Todo `Pressable` necesita rol y etiqueta accesible adecuados.
- Comunicar selección, checked, disabled y busy mediante propiedades de
  accesibilidad, no solo visualmente.
- Nunca depender únicamente del color para diferenciar estados.
- Preservar contraste alto sobre los fondos negros; `dim` y `subtle` no deben
  usarse para información esencial.
- Los iconos sin texto necesitan `accessibilityLabel` y una función inequívoca.
- Respetar tamaños de texto del sistema sin truncar acciones críticas.
- Probar navegación con teclado abierto y botón Atrás de Android.
- Las animaciones deben ser breves y funcionales, aproximadamente 150–220 ms.
  Evitar movimiento continuo o celebraciones que bloqueen el flujo.
- Haptics puede reforzar completar una serie, un PR o una confirmación importante;
  no debe activarse en cada toque.

## 10. Contrato de implementación React Native

- La aplicación móvil usa React Native, Expo SDK 54 y `StyleSheet`.
- Consultar la documentación exacta de Expo 54 antes de introducir o cambiar APIs
  de Expo.
- Usar `Ionicons` de `@expo/vector-icons` antes de añadir otra biblioteca.
- Usar `react-native-safe-area-context` para safe areas.
- Consumir colores desde `src/theme.ts`. Si un valor visual aparece en dos o más
  pantallas, promoverlo a token o componente compartido.
- Reutilizar `Brand`, `Card`, `PrimaryButton`, `TopBar`, `Page`, `AppShell` y
  `ConfirmDialog` cuando correspondan.
- Si un patrón interactivo aparece en dos pantallas —input, selector, fila,
  editor de series, empty state— extraer o ampliar un componente compartido.
- No introducir HTML, CSS, Tailwind, DOM ni componentes web en la aplicación
  nativa.
- No añadir dependencias para resolver estilos que React Native ya puede manejar.
- Mantener lógica de dominio y persistencia fuera de los componentes visuales.
- No modificar comportamiento, navegación, datos o contratos de backend como
  efecto secundario de una tarea puramente visual.
- Evitar archivos de pantalla monolíticos. Extraer bloques complejos con una
  responsabilidad clara, sin fragmentar cada `View` trivial.

## 11. Antipatrones

No hacer lo siguiente salvo instrucción explícita:

- pintar grandes áreas de naranja;
- usar gradientes, glow, glassmorphism o sombras fuertes;
- crear una paleta distinta para cada pantalla;
- mezclar radios arbitrarios sin jerarquía;
- centrar todo el contenido como una landing page;
- esconder acciones necesarias exclusivamente detrás de pulsación larga;
- colocar más de una acción primaria compitiendo en la misma sección;
- usar texto gris de bajo contraste para datos importantes;
- abusar de tarjetas anidadas;
- agregar iconos sin propósito o mezclar familias de iconos;
- inventar una navegación diferente por pantalla;
- copiar literalmente una interfaz web sin adaptar safe areas, teclado y targets
  táctiles;
- duplicar hexadecimales o estilos estructurales en varios archivos;
- rediseñar toda la aplicación para resolver una observación localizada.

## 12. Flujo recomendado para agentes de IA

Antes de editar interfaz:

1. Leer este documento completo.
2. Leer `src/theme.ts`, `src/components/ui.tsx` y la pantalla objetivo.
3. Revisar la captura aprobada, si existe, y enumerar las diferencias concretas.
4. Identificar qué se puede resolver con componentes existentes.
5. Limitar la tarea a una pantalla, flujo o familia pequeña de componentes.

Durante la implementación:

- preservar funcionalidad y accesibilidad;
- reutilizar tokens y componentes;
- verificar estados normal, presionado, deshabilitado, vacío y error;
- evitar cambios no relacionados;
- documentar cualquier nueva decisión visual durable en este archivo.

Una tarea visual está terminada cuando:

- coincide en jerarquía, espaciado, tamaño y color con la referencia aprobada;
- funciona en 360–430 px de ancho;
- funciona con safe areas y teclado;
- no introduce desbordes ni contenido inaccesible;
- pasa lint, tipos y pruebas relevantes;
- el diff no cambia lógica ajena a la tarea;
- se revisó visualmente en Expo, preferentemente en un teléfono o emulador.

### Plantilla breve de solicitud

> Ajusta `[pantalla/componente]` para lograr `[resultado]`. Usa la captura adjunta
> como referencia y respeta `DESIGN.md`. Conserva toda la funcionalidad. Trabaja
> solo en `[archivos o flujo]`. Considera `[estados relevantes]`. Termina cuando
> el resultado haya sido revisado visualmente en 390 px, no tenga desbordes y
> pasen las verificaciones relevantes.

## 13. Decisiones todavía no autorizadas

Hasta que el usuario las apruebe, no asumir:

- una nueva tipografía de marca;
- tema claro;
- una paleta secundaria adicional;
- ilustraciones o fotografía como parte permanente de la interfaz;
- animaciones complejas;
- una biblioteca de componentes externa;
- cambios en la navegación principal;
- equivalencia automática entre el prototipo web y el código móvil.

Cuando una de estas decisiones sea aprobada, actualizar este documento y los
tokens antes de aplicarla de manera dispersa.
