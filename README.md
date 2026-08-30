# Frase a Frase

App para aprender inglés con la técnica del **input comprensible**: escuchas un
video de YouTube, lees la transcripción frase por frase (inglés y español),
repites en bucle lo que no entiendes, guardas las palabras nuevas y al final
mides cuánto entendiste.

## Empezar

```bash
npm install
cp .env.example .env    # y pon tus credenciales de Supabase
npm run dev
```

Abre http://localhost:3000

## Antes de usar la cuenta

1. En Supabase → **SQL Editor**, ejecuta `supabase/schema.sql` (crea las tablas
   `words` y `progress` con sus permisos).
2. En Supabase → **Authentication → URL Configuration → Redirect URLs**, añade
   `http://localhost:3000/**`.
3. Comprueba que todo responde:

```bash
npm run check:supabase
```

## Cómo se crea una lección

El detalle está en [`PLAN.md`](./PLAN.md). En resumen:

1. Copias la transcripción desde YouTube y la guardas en
   `content/transcripts/`.
2. Escribes `content/lessons/<id>.json` con la traducción, las explicaciones,
   el vocabulario y el quiz.
3. Lo añades a `content/lessons/index.json`.

Un video largo se parte en varias lecciones cortas usando `startAt` y `endAt`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila y comprueba los tipos |
| `npm run lint` | Revisa el estilo del código |
| `npm run check:supabase` | Verifica la conexión y las tablas |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (auth + base de datos)
