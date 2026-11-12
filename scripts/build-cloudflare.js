import {mkdir,rm,cp,readFile} from 'node:fs/promises';
import path from 'node:path';
// Only the two supported applications and their dependencies are published.
const files=new Set(),queue=['src/bootstrap.js','src/style.css','src/dice.css','src/worker.js','src/dice-bot-worker.js'];
while(queue.length){const file=queue.pop();if(files.has(file))continue;files.add(file);const source=await readFile(file,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\(|new URL\s*\()\s*['"](\.\.?\/[^'"]+\.js)['"]/g))queue.push(path.normalize(path.join(path.dirname(file),match[1])));}
await rm('dist',{recursive:true,force:true});await mkdir('dist/src',{recursive:true});await cp('index.html','dist/index.html');await cp('assets','dist/assets',{recursive:true});
for(const file of files){await mkdir(path.dirname('dist/'+file),{recursive:true});await cp(file,'dist/'+file);}
console.log(`Built classic and current dice (${files.size} source files). Historical editions and reports are excluded.`);
