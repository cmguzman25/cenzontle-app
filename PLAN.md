# Frase a Frase — plan de trabajo

App para aprender inglés con **input comprensible**: escuchas un video de YouTube,
lees la transcripción frase por frase (inglés + español), repites en bucle lo que
no entiendes, guardas las palabras nuevas y al final mides tu comprensión.

## Cómo se crea una lección

No usamos ninguna API de IA dentro de la app. El flujo es:

1. Copias la transcripción desde YouTube (`...` → **Mostrar transcripción**) y la
   guardas en `content/transcripts/<archivo>.txt`.
2. Me pasas el video y yo escribo `content/lessons/<id>.json` con la traducción,
   las explicaciones, el vocabulario y el quiz.
3. Lo añades a `content/lessons/index.json`, con su `level` y sus
   `categories` (una lección puede estar en varias). Los filtros de la portada
   se construyen solos a partir de lo que haya en ese archivo.

Las partes de un mismo video se agrupan en un **capítulo**: comparten
`seriesId` y `seriesTitle`, y se ordenan por `order`. La portada muestra una
tarjeta por capítulo y `/capitulo/<seriesId>` lista sus partes. Una lección sin
`seriesId` sale suelta en la portada.

**El inglés no se copia al JSON.** La app lee el archivo de transcripción y le
pega encima las anotaciones, enlazándolas por el segundo de inicio:

```jsonc
{
  "transcript": "peppa-tales.txt",
  "startAt": 0,      // segundo donde empieza esta parte
  "endAt": 187,      // segundo donde termina (el video se pausa solo)
  "annotations": [
    {
      "start": 31,                 // debe coincidir con la transcripción
      "es": "Los conejos tenemos túneles secretos por todas partes.",
      "note": "...",
      "vocab": [{ "word": "everywhere", "meaning": "por todas partes" }],
      "en": "..."                  // opcional: corrige errores del subtítulo automático
    }
  ]
}
```

Ventaja: un video largo se parte en varias lecciones cortas (`peppa-01`,
`peppa-02`, …) que apuntan al **mismo** archivo de transcripción con distinto
rango de tiempo.

También existe el formato alternativo con `sentences` escritas a mano dentro del
propio JSON, sin archivo de transcripción. Los dos siguen funcionando.

## Fases

### Fase 0 — Base ✅
- [x] Proyecto Next.js (App Router) + TypeScript + Tailwind
- [x] Tipos en `src/lib/types.ts`
- [x] Carpeta `content/lessons/` + lección demo
- [x] Lector de lecciones en `src/lib/lessons.ts`

### Fase 1 — Reproductor + transcripción sincronizada ✅
- [x] `src/components/YouTubePlayer.tsx` (IFrame API, tiempo cada 200 ms)
- [x] `src/components/Transcript.tsx` (frase activa resaltada + autoscroll)
- [x] Click en una frase → salta a ese momento
- [x] Página `/lesson/[id]` y listado en `/`

### Fase 2 — Bucle y traducción ✅
- [x] Botón 🔁 por frase (vuelve al inicio al llegar al final)
- [x] Contador de repeticiones
- [x] Mostrar/ocultar el español (global)
- [x] Atajos: `S` español, `L` bucle, `←`/`→` frase anterior/siguiente

### Fase 3 — Explicación y palabras ✅
- [x] Explicación y vocabulario dentro de cada frase, con botón "💡 Ver
      explicación" (antes era un panel debajo del video: en el móvil obligaba a
      subir para leerlo)
- [x] Click en cualquier palabra en inglés → la guarda (segundo clic la quita)
- [x] Lista de palabras guardadas (por ahora solo en memoria)

### Fase 4 — Supabase (login + banco de palabras) 🟡
- [x] `.env` con `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (expuestas al navegador desde la clave `env` de `next.config.ts`)
- [x] `src/lib/supabase/client.ts`, `server.ts` y `session.ts` con `@supabase/ssr`
- [x] Registro con correo y contraseña (`/register`)
- [x] Login con contraseña o con enlace por correo (`/login`)
- [x] `src/proxy.ts` que refresca la sesión en cada petición
- [x] Mensajes de error de Supabase traducidos (`src/lib/auth-errors.ts`)
- [x] `/auth/confirm` (acepta `?code=` y `?token_hash=`) y `/auth/signout`
- [x] Server actions en `src/lib/actions.ts`
- [x] Página `/words`: buscar, marcar como conocida, borrar
- [x] Tablas creadas en Supabase (`words`, `progress`, `lesson_position`)
- [ ] **Pendiente tuyo:** en Supabase → Authentication → URL Configuration,
      poner el dominio de Vercel como Site URL y en Redirect URLs
      (`https://<tu-app>.vercel.app/**`). Sin esto el login por correo devuelve
      a `localhost` en producción.

### Fase 5 — Evaluación de comprensión ✅
- [x] Quiz al terminar el video + porcentaje ("80% entendido")
- [x] Guardar el resultado en `progress` y mostrar el historial en la lección
- [x] Marca 📍 de por dónde va el usuario (`lesson_position`), que se restaura
      al volver a la lección

### Fase 6 — Importar transcripción ⬜
- [ ] `src/lib/srt.ts`: parser propio de `.srt` / `.vtt`
- [ ] `/import`: pegar URL de YouTube o subir el archivo
- [ ] `/api/captions`: intenta bajar los captions públicos; si falla, pide el archivo
- [ ] Botón "Copiar JSON" con el esqueleto de la lección sin traducir

### Fase 7 — Pulido 🟡
- [x] Portada con tarjetas + miniatura de YouTube
- [x] Filtros por estado (en progreso / sin empezar / terminadas), nivel,
      tema y buscador
- [x] Reproductor sin los controles de YouTube (`controls: 0`) y pantalla
      propia al pausar, para que el bucle no haga parpadear la barra
- [ ] **Barra de progreso propia**: ahora hace falta de verdad, porque al
      apagar los controles de YouTube no queda forma de ver ni de mover el
      punto del video
- [ ] Velocidad de reproducción (0.75× ayuda mucho al escuchar)
- [ ] Modo oscuro explícito y ajustes de responsive
- [ ] Estados de carga y error

## Comandos

```bash
npm run dev     # http://localhost:3000
npm run build   # comprobar que compila
npm run lint
```

## Nota sobre los videos

Usa videos que puedas estudiar legalmente (canales para estudiantes de inglés,
material con licencia abierta o contenido propio). Las transcripciones se guardan
en tu repo para uso personal de estudio.
