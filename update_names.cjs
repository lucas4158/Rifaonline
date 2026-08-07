const fs = require('fs');

function replaceInFile(path, from, to) {
  if (fs.existsSync(path)) {
    let c = fs.readFileSync(path, 'utf-8');
    c = c.replace(from, to);
    fs.writeFileSync(path, c);
  }
}

replaceInFile('metadata.json', /"name": "RifaMaster"/g, '"name": "Rifa Master"');
replaceInFile('metadata.json', /RifaMaster/g, 'Rifa Master');

replaceInFile('index.html', /RifaMaster/g, 'Rifa Master');
replaceInFile('public/manifest.json', /"RifaMaster"/g, '"Rifa Master"');

replaceInFile('src/App.tsx', /RifaMaster/g, 'Rifa Master');
replaceInFile('src/App.tsx', /RIFAMASTER/g, 'RIFA MASTER');
