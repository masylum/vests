const variant=new URLSearchParams(location.search).get('variant');
// Retired dice URLs now open the current edition. Historical reports remain archived.
if(variant?.startsWith('dice'))await import('./dice-app.js');
else await import('./app.js');
