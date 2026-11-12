const variant=new URLSearchParams(location.search).get('variant');
// Retired dice URLs now open the current edition. Historical reports remain archived.
if (variant === 'classic') await import('./app.js');
else await import('./dice-app.js');
