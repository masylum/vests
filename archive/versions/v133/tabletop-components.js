import {FOUNDER_EMPHASIS,VALUE_EMPHASIS} from './card-copy.js';
import {INTEL_CARDS,INTEL_ART} from './intel.js';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function founderPortrait(f) {
 return `<img src="/assets/founders/${f.id===22?18:f.id}.png" alt="${f.name}" loading="lazy">`;
}
export function founderDescription(text,emphasis="") {
 const cues=(Array.isArray(emphasis)?emphasis:[emphasis]).filter(Boolean);
 const cue=cues.length?new RegExp("(?<![A-Za-z0-9])(?:"+cues.map(s=>[...s].map(c=>"\\^$.*+?()[]{}|".includes(c)?"\\"+c:c).join("")).join("|")+")(?![A-Za-z0-9])","gi"):null;
 return esc(text.replace(/(deploy[^.!]*?)cards?/gi,(part)=>part.replace(/cards?/gi,m=>m.toLowerCase()==='cards'?'tokens':'token')).replace(/growth cards/gi,'growth tokens').replace(/growth card/gi,'growth token').replace(/supply cards/gi,'supply tokens')).replace(cue??/$^/,'<strong>$&</strong>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(?:Before|After) the reveal|Reveal (?:start|end)|During (?:the )?reveal|Once per reveal/gi,'<mark class="reveal-timing">$&</mark>');
}
export function founderCard(f, extra = "") {
 const trigger=founderDescription(f.trigger)+',';
 const copy=`${trigger} ${founderDescription(f.action.replace(/^(\*\*)?([A-Z])(?=[a-z])/,(_,mark,letter)=>(mark??'')+letter.toLowerCase()),FOUNDER_EMPHASIS[f.id])}`;
 return `<article class="founder-card ${extra}" data-read-founder="${f.id}" role="button" tabindex="0" aria-label="Read ${esc(f.name)}" style="--tilt:${((f.id*7)%5-2)*.85}deg"><div class="founder-face">${founderPortrait(f)}</div><div class="founder-copy"><small>${f.name}</small><p>${copy}</p></div></article>`;
}
export function intelCardHTML(card,actions='') {
 const info=INTEL_CARDS[card.kind],art=INTEL_ART[card.kind],html=`<article class="intel-card">${art?`<img class="value-art" src="/assets/value/${art}.png" alt="" loading="lazy">`:`<div class="value-art value-monogram" aria-hidden="true">${info.name.split(' ').map(w=>w[0]).join('')}</div>`}<h3>${info.name}</h3><p>${founderDescription(info.text,VALUE_EMPHASIS[card.kind])}</p></article>`;
 return actions?`<div class="intel-choice">${html}<div class="intel-actions">${actions}</div></div>`:html;
}
