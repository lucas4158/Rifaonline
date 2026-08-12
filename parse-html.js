const fs = require('fs');
const html = fs.readFileSync('test-results/dashboard-html.txt', 'utf8').catch(() => '');
// wait, I didn't save html to a file, I just printed the first 1000 chars. Let's save html to a file.
