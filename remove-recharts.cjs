const fs = require('fs');
let content = fs.readFileSync('src/admin/Dashboard.tsx', 'utf8');

content = content.replace(/import {[^}]+} from "recharts";/, '');
// find and replace `<ResponsiveContainer` and its children with `<div>Charts removed for build memory</div>`
// we'll just use a simple regex to replace the entire <ResponsiveContainer> blocks
content = content.replace(/<ResponsiveContainer[\s\S]*?<\/ResponsiveContainer>/g, '<div className="flex h-full items-center justify-center text-zinc-500">Gráfico desabilitado temporariamente</div>');

fs.writeFileSync('src/admin/Dashboard.tsx', content);
