// One closed lane, split at equal distances along its rounded centre line.
const W=1600,H=1000,R=160,M=60;
const straightX=W-2*M-2*R,straightY=H-2*M-2*R;
const arc=Math.PI*R/2, perimeter=2*(straightX+straightY)+4*arc;
function point(distance,offset=0){
 let d=(distance%perimeter+perimeter)%perimeter;
 const pieces=[straightX,arc,straightY,arc,straightX,arc,straightY,arc];
 let k=0;while(d>pieces[k]&&k<7)d-=pieces[k++];
 if(k===0)return [M+R+d,M-offset];
 if(k===2)return [W-M+offset,M+R+d];
 if(k===4)return [W-M-R-d,H-M+offset];
 if(k===6)return [M-offset,H-M-R-d];
 const centers={1:[W-M-R,M+R],3:[W-M-R,H-M-R],5:[M+R,H-M-R],7:[M+R,M+R]};
 const angle=(-Math.PI/2+(k-1)*Math.PI/4)+d/R,c=centers[k];
 return [c[0]+(R+offset)*Math.cos(angle),c[1]+(R+offset)*Math.sin(angle)];
}
export const TRACK=Array.from({length:24},(_,i)=>{
 const start=i*perimeter/24,end=(i+1)*perimeter/24;
 const edge=offset=>Array.from({length:25},(_,j)=>point(start+(end-start)*j/24,offset));
 const points=[...edge(55),...edge(-55).reverse()];
 return {path:`M${points.map(p=>p.map(v=>v.toFixed(2)).join(',')).join('L')}Z`,x:point((start+end)/2)[0]/W*100,y:point((start+end)/2)[1]/H*100};
});
