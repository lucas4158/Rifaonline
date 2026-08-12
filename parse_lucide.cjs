const fs = require('fs');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');
const imports = new Set();

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g);
    if (match) {
        match.forEach(m => {
            const m2 = m.match(/\{([^}]+)\}/);
            if (m2 && m2[1]) {
                const parts = m2[1].split(',').map(p => p.trim().split(/\s+as\s+/)[0].replace(/\n/g, '').trim()).filter(p => p);
                parts.forEach(p => imports.add(p));
            }
        });
    }
});

let out = "import React from 'react';\nconst DummyIcon = (props) => React.createElement('div', { className: props.className }, '*');\n\n";
imports.forEach(i => {
    out += `export const ${i} = DummyIcon;\n`;
});

fs.writeFileSync('dummy-lucide.js', out);
console.log('Generated dummy-lucide.js with ' + imports.size + ' exports');
