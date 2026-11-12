// Shared component browser for classic and current dice.
export function componentCatalogue({dialog,title,items,renderItem,className,name,inspectCard}) {
 const d=dialog(title,`<div class="catalogue-page"></div>`);d.classList.add(className,'paged-catalogue');
 const rows=4,columns=8,gap=10;
 const cardWidth=Math.floor(Math.min((innerWidth*.94-60-gap*(columns-1))/columns,(innerHeight*.94-92-gap*(rows-1))/rows/1.4));
 d.style.setProperty('--catalogue-card-width',`${cardWidth}px`);
 d.querySelector('.catalogue-page').innerHTML=items.map((item,i)=>`<button class="catalogue-item" data-inspect="${i}" aria-label="Inspect ${escapeHTML(name(item))}">${renderItem(item)}</button>`).join('');
 d.querySelectorAll('[data-inspect]').forEach(el=>el.onclick=()=>inspectCard(renderItem(items[Number(el.dataset.inspect)])));

}
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
