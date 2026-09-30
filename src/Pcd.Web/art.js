import {Draw,P} from './draw.js';
import {PLATES,MONSTERS} from './plates.js';

const cache = new Map();
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export const ART = 48;
const LEVELS = P.map(hex => parseInt(hex.slice(1,3),16));

class Engraving extends Draw {
 // Hero is drawn at 1px, then snapped onto the 2px grid.
 line(x1,y1,x2,y2,p=2){let x=Math.round(x1),y=Math.round(y1),bx=Math.round(x2),by=Math.round(y2),dx=Math.abs(bx-x),sx=x<bx?1:-1,dy=-Math.abs(by-y),sy=y<by?1:-1,e=dx+dy;this.c.fillStyle=P[p];for(;;){this.c.fillRect(x,y,1,1);if(x===bx&&y===by)break;let e2=e*2;if(e2>=dy){e+=dy;x+=sx}if(e2<=dx){e+=dx;y+=sy}}}
 box(x,y,w,h,p=2){this.rect(x,y,w,1,p);this.rect(x,y+h-1,w,1,p);this.rect(x,y,1,h,p);this.rect(x+w-1,y,1,h,p);}
 poly(points,p=3){const minY=Math.ceil(Math.min(...points.map(a=>a[1]))),maxY=Math.floor(Math.max(...points.map(a=>a[1])));for(let y=minY;y<=maxY;y++){let hits=[];for(let i=0;i<points.length;i++){let a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))hits.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));}hits.sort((a,b)=>a-b);for(let k=0;k<hits.length;k+=2)this.rect(Math.ceil(hits[k]),y,Math.floor(hits[k+1])-Math.ceil(hits[k])+1,1,p)}}
 ell(cx,cy,rx,ry,p=3){for(let y=-Math.floor(ry);y<=ry;y++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-y*y/(ry*ry))));this.rect(cx-w,cy+y,w*2+1,1,p)}}
 ring(cx,cy,rx,ry,p=3){let lx,ly;for(let i=0;i<=Math.max(rx,ry)*8;i++){const a=i/(Math.max(rx,ry)*8)*Math.PI*2,x=Math.round(cx+Math.cos(a)*rx),y=Math.round(cy+Math.sin(a)*ry);if(i)this.line(lx,ly,x,y,p);lx=x;ly=y}}
 dither(x,y,w,h,level=.5,p=3){for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(BAYER[((j+y)&3)*4+((i+x)&3)]<level*16)this.rect(x+i,y+j,1,1,p)}
 bolt(x,y,r=3){this.ell(x,y,r,r,2);this.ring(x,y,r,r,4);this.line(x-r+1,y,x+r-1,y,1)}
 prism(x,y,w,h,depth=8){this.poly([[x,y],[x+depth,y-depth],[x+w+depth,y-depth],[x+w,y]],4);this.rect(x,y,w,h,2);this.poly([[x+w,y],[x+w+depth,y-depth],[x+w+depth,y+h-depth],[x+w,y+h]],1);this.box(x,y,w,h,3);this.dither(x+1,y+1,w-2,h-2,.22,3)}
 gear(cx,cy,r=18){for(let i=0;i<12;i++){let a=i*Math.PI/6;this.rect(cx+Math.cos(a)*r-3,cy+Math.sin(a)*r-3,6,6,3)}this.ell(cx,cy,r-2,r-2,2);this.ring(cx,cy,r-2,r-2,4);this.ell(cx,cy,r/2,r/2,0);this.ring(cx,cy,r/2,r/2,4);this.bolt(cx,cy,3)}
}
function backdrop(g,w,h){g.rect(0,0,w,h,0)}
function hero(g){
 backdrop(g,288,252);
 g.poly([[0,166],[25,142],[45,154],[74,116],[100,143],[123,121],[156,149],[185,102],[226,145],[254,123],[288,149],[288,252],[0,252]],1);
 for(let i=0;i<5;i++)g.line(144,198,16+i*64,250,2);
 g.ring(142,96,93,85,2);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;g.line(142+Math.cos(a)*94,96+Math.sin(a)*86,142+Math.cos(a)*104,96+Math.sin(a)*94,i%2?3:2)}
 g.poly([[100,172],[108,150],[178,150],[193,172],[193,214],[100,214]],2);g.prism(98,192,98,21,9);g.poly([[128,99],[151,91],[173,170],[125,170]],2);g.line(131,100,132,167,4);g.line(151,100,163,164,3);
 g.poly([[63,49],[93,41],[202,111],[191,132],[172,140],[139,130],[107,110],[76,82]],2);
 g.poly([[63,49],[72,51],[99,82],[141,110],[184,126],[202,111],[194,129],[173,140],[135,132],[101,108],[75,80]],4);
 for(let i=0;i<3;i++)g.line(78+i*18,58+i*14,160+i*10,126-i*4,1);
 g.poly([[71,52],[94,47],[194,112],[185,124],[145,111],[105,84]],1);g.dither(104,76,51,21,.32,3);g.line(75,53,183,121,5);g.line(82,57,189,118,3);
 g.line(100,63,148,38,4);g.line(189,113,148,38,3);g.prism(143,30,9,15,5);g.rect(145,24,3,8,5);g.line(147,24,148,11,3);
 g.prism(45,187,24,26,8);g.rect(48,192,17,10,0);g.line(51,200,51,195,4);g.line(56,200,56,194,3);g.line(61,200,61,196,4);
 g.line(56,181,56,164,4);g.line(42,168,70,168,2);g.line(56,165,43,153,2);g.line(56,165,69,153,2);
 g.prism(215,195,39,22,9);g.rect(222,201,6,9,3);g.rect(234,201,6,9,4);g.line(237,188,237,168,3);g.rect(234,164,7,4,5);
 g.line(148,218,148,239,3);g.line(144,239,152,239,3);g.line(148,227,141,231,3);g.line(148,227,155,231,3);
 g.corners(4,4,280,244,3,8);
}
function snap(canvas){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,im=ctx.getImageData(0,0,w,h),d=im.data;
 for(let y=0;y+1<h;y+=2)for(let x=0;x+1<w;x+=2){
  let best=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const i=((y+dy)*w+x+dx)*4;if(d[i]>best)best=d[i]}
  let lv=0,err=999;
  for(let i=0;i<LEVELS.length;i++){const e=Math.abs(LEVELS[i]-best);if(e<err){err=e;lv=i}}
  const v=LEVELS[lv];
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const i=((y+dy)*w+x+dx)*4;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
 }
 ctx.putImageData(im,0,0);
}
function plate(key){
 const src=PLATES[key];if(!src)return null;
 const c=document.createElement('canvas');c.width=ART;c.height=ART;
 const g=c.getContext('2d'),im=g.createImageData(ART,ART),n=24;
 for(let i=0;i<src.length;i++){
  const v=src.charCodeAt(i)-48;if(v<=0||v>5)continue;
  const col=LEVELS[v],x=(i%n)*2,y=((i/n)|0)*2;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const o=((y+dy)*ART+x+dx)*4;im.data[o]=im.data[o+1]=im.data[o+2]=col;im.data[o+3]=255}
 }
 g.putImageData(im,0,0);
 return c;
}
function seal(paint){
 const c=document.createElement('canvas');c.width=ART;c.height=ART;
 const g=new Draw(c.getContext('2d'));
 g.rect(0,0,ART,ART,0);g.box(2,2,44,44,3);g.corners(6,6,36,36,4,8);
 paint(g);
 return c;
}
const seals=[
 ()=>seal(()=>{}),
 ()=>seal(g=>{g.rect(12,12,24,24,3);g.rect(16,16,16,16,4)}),
 ()=>seal(g=>{g.rect(10,20,28,8,3);g.rect(20,18,8,12,4);g.rect(22,20,4,8,5)}),
 ()=>seal(g=>{g.rect(14,8,20,16,3);g.rect(18,24,12,10,3);g.rect(22,10,4,18,5);g.rect(16,16,16,4,4)}),
 ()=>seal(g=>{g.rect(8,8,32,32,4);g.rect(14,14,20,20,2);g.rect(20,20,8,8,5)}),
 ()=>seal(g=>{g.box(12,12,24,24,4);g.rect(20,8,8,6,5);g.rect(30,14,6,6,4)}),
 ()=>seal(g=>{g.rect(20,8,8,32,4);g.rect(8,18,32,8,4);g.rect(22,10,4,6,5)}),
 ()=>seal(g=>{g.line(10,28,22,14,5);g.line(22,14,34,28,5);g.line(10,20,22,8,4);g.line(22,8,34,20,4)}),
 ()=>seal(g=>{g.box(14,14,20,18,4);g.rect(22,16,4,14,5);g.rect(16,22,16,4,5)}),
 ()=>seal(g=>{g.rect(22,8,4,14,5);g.rect(10,22,28,4,3);g.line(12,22,24,36,4);g.line(36,22,24,36,4)}),
 ()=>seal(g=>{g.rect(18,8,12,4,3);g.rect(14,16,20,4,4);g.rect(8,24,32,8,5)}),
 ()=>seal(g=>{g.rect(22,18,4,16,3);g.rect(12,16,12,4,4);g.rect(24,12,12,4,4);g.rect(20,6,8,6,5)}),
 ()=>seal(g=>{g.rect(22,6,4,36,4);g.rect(6,22,36,4,4);g.rect(18,18,12,12,5)}),
];
function assetFor(id){
 const key=String(id);
 if(key==='hero'){const c=document.createElement('canvas');c.width=288;c.height=252;hero(new Engraving(c.getContext('2d')));snap(c);return c}
 if(key.startsWith('back.')){const n=Number(key.slice(-3));return (seals[n-1]||seals[0])()}
 const plateKey=MONSTERS[key]||key;
 const drawn=plate(plateKey);
 if(drawn)return drawn;
 const c=document.createElement('canvas');c.width=ART;c.height=ART;
 const g=new Draw(c.getContext('2d'));g.rect(0,0,ART,ART,0);g.box(2,2,44,44,2);g.small('?',18,20,4);return c;
}
export function drawArt(ctx,id,x,y,w,h){
 if(!id||!ctx)return;
 let asset=cache.get(id);
 if(!asset){asset=assetFor(id);cache.set(id,asset)}
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(asset,Math.round(x+(w-asset.width)/2),Math.round(y+(h-asset.height)/2));
}
export function drawEmblem(ctx,x,y,size,variant='science'){
 const g=new Draw(ctx),s=size-(size&1),r=s/2,cx=x+r,cy=y+r;
 g.box(x,y,s,s,3);
 if(variant==='science'){g.rect(x+4,cy-1,s-8,2,4);g.rect(cx-1,y+4,2,s-8,4)}
 else if(variant==='mystery'){g.line(cx,y+4,x+s-4,y+s-4,4);g.line(x+s-4,y+s-4,x+4,y+s-4,4);g.line(x+4,y+s-4,cx,y+4,4)}
 else{g.rect(cx-1,y+4,2,s-8,4);g.rect(x+4,cy-1,s-8,2,4)}
}
