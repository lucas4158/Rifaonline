const fs = require('fs');
const content = fs.readFileSync('src/admin/Dashboard.tsx', 'utf8');

// Replace dynamic import with static import
const updated = content.replace(
  `import("../services/supabase/supabaseClient").then(({ getSupabaseClient }) => {`,
  `{`
);
fs.writeFileSync('src/admin/Dashboard.tsx', updated);
console.log('Replaced dynamic import');
