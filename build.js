const fs = require('fs').promises;

(async () => {
  let src = await fs.readdir('./src');
  src = src.filter((x) => x.endsWith('.js'));
  src.forEach(async (x) => {
    console.log(`Copying ${x} to dist...`);
    await fs.copyFile(`./src/${x}`, `./dist/${x}`);
  });
  await fs.copyFile('./package.json', './dist/package.json');
  fs.mkdir('./dist/node_modules');
  fs.copyFile('./build/icon.ico', './dist/favicon.ico');
})();
