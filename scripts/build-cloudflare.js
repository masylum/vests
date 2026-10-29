import {mkdir,rm,cp,readdir} from 'node:fs/promises';
// Publish only the game. Reports, tests and local server files stay outside dist.
await rm('dist',{recursive:true,force:true});
await mkdir('dist/src',{recursive:true});
await cp('index.html','dist/index.html');
await cp('assets','dist/assets',{recursive:true});
for(const file of await readdir('src'))if(/\.(js|css)$/.test(file))await cp(`src/${file}`,`dist/src/${file}`);
console.log('Built Cloudflare assets in dist.');
