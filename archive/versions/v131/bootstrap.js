const variant=new URLSearchParams(location.search).get('variant');
if(variant==='dice')await import('./dice-app.js');
else if(variant==='dice-old')await import('./dice-legacy-app.js');
else await import('./app.js');
