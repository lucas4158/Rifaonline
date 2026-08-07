const fs = require('fs');
let c = fs.readFileSync('api/_supabaseSync.ts', 'utf-8');
c = c.replace(/from "\.\.\/src\/services\/supabase\/([^"]+)"/g, 'from "../src/services/supabase/$1.js"');
fs.writeFileSync('api/_supabaseSync.ts', c);

const files = fs.readdirSync('src/services/supabase');
for (const f of files) {
  if (f.endsWith('.ts')) {
    let fc = fs.readFileSync(`src/services/supabase/${f}`, 'utf-8');
    fc = fc.replace(/from "\.\/supabaseClient"/g, 'from "./supabaseClient.js"');
    fs.writeFileSync(`src/services/supabase/${f}`, fc);
  }
}
