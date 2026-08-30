import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.log("FALTAN LAS VARIABLES DE ENTORNO");
  process.exit(1);
}

console.log("URL host:", new URL(url).host);

const supabase = createClient(url, key);

for (const table of ["words", "progress"]) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (error) {
    console.log(`tabla ${table}: ERROR (${error.code}) ${error.message}`);
  } else {
    console.log(`tabla ${table}: OK (existe y responde)`);
  }
}
