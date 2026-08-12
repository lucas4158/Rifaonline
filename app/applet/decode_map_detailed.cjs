const fs = require('fs');
const { SourceMapConsumer } = require('source-map');

async function run() {
  const mapFile = 'dist/assets/index-7B-CwRi2.js.map';
  if (!fs.existsSync(mapFile)) {
    console.log('Map file not found');
    return;
  }
  const rawMap = fs.readFileSync(mapFile, 'utf8');
  const consumer = await new SourceMapConsumer(JSON.parse(rawMap));
  
  for (const col of [43922, 43649, 43597, 43600, 43700]) {
    const pos = consumer.originalPositionFor({
      line: 7,
      column: col
    });
    console.log(`Col ${col} ->`, pos);
  }
  consumer.destroy();
}

run().catch(console.error);
