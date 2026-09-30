import {Draw,P} from './draw.js';
const cache = new Map(),scaleCache = new Map();
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
class Engraving extends Draw {
 poly(points,p=3){const minY=Math.ceil(Math.min(...points.map(a=>a[1]))),maxY=Math.floor(Math.max(...points.map(a=>a[1])));for(let y=minY;y<=maxY;y++){let hits=[];for(let i=0;i<points.length;i++){let a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))hits.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));}hits.sort((a,b)=>a-b);for(let k=0;k<hits.length;k+=2)this.rect(Math.ceil(hits[k]),y,Math.floor(hits[k+1])-Math.ceil(hits[k])+1,1,p)}}
 ell(cx,cy,rx,ry,p=3){for(let y=-Math.floor(ry);y<=ry;y++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-y*y/(ry*ry))));this.rect(cx-w,cy+y,w*2+1,1,p)}}
 ring(cx,cy,rx,ry,p=3){let lx,ly;for(let i=0;i<=Math.max(rx,ry)*8;i++){const a=i/(Math.max(rx,ry)*8)*Math.PI*2,x=Math.round(cx+Math.cos(a)*rx),y=Math.round(cy+Math.sin(a)*ry);if(i)this.line(lx,ly,x,y,p);lx=x;ly=y}}
 dither(x,y,w,h,level=.5,p=3){for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(BAYER[((j+y)&3)*4+((i+x)&3)]<level*16)this.rect(x+i,y+j,1,1,p)}
 bolt(x,y,r=3){this.ell(x,y,r,r,2);this.ring(x,y,r,r,4);this.line(x-r+1,y,x+r-1,y,1)}
 prism(x,y,w,h,depth=8){this.poly([[x,y],[x+depth,y-depth],[x+w+depth,y-depth],[x+w,y]],4);this.rect(x,y,w,h,2);this.poly([[x+w,y],[x+w+depth,y-depth],[x+w+depth,y+h-depth],[x+w,y+h]],1);this.box(x,y,w,h,3);this.dither(x+1,y+1,w-2,h-2,.22,3)}
 gear(cx,cy,r=18){for(let i=0;i<12;i++){let a=i*Math.PI/6;this.rect(cx+Math.cos(a)*r-3,cy+Math.sin(a)*r-3,6,6,3)}this.ell(cx,cy,r-2,r-2,2);this.ring(cx,cy,r-2,r-2,4);this.ell(cx,cy,r/2,r/2,0);this.ring(cx,cy,r/2,r/2,4);this.bolt(cx,cy,3)}
}
function backdrop(g,w,h){g.rect(0,0,w,h,0)}
function robot(g,variant){
 backdrop(g,160,160);
 // Silhouette, ribbed shoulders, hydraulic anatomy, and a machined faceplate.
 g.ring(80,64,58,52,1);for(let i=0;i<4;i++){const a=i*Math.PI/2;g.line(80+Math.cos(a)*58,64+Math.sin(a)*52,80+Math.cos(a)*66,64+Math.sin(a)*58,2)}
 g.poly([[12,158],[19,122],[51,108],[60,100],[102,100],[112,113],[147,125],[158,158]],2);
 g.poly([[14,155],[22,128],[53,116],[64,139],[57,159]],3);g.poly([[107,118],[141,132],[152,157],[104,158],[94,139]],1);
 g.dither(22,135,30,23,.45,4);g.dither(112,137,28,20,.5,2);
 for(let i=0;i<3;i++){g.prism(68+i*10,116,6,32,3);g.line(70+i*10,118,70+i*10,146,4)}
 g.prism(45,28,64,72,8);g.poly([[45,29],[51,18],[93,13],[117,28],[109,40]],3);g.poly([[51,19],[94,14],[110,24],[70,22]],4);g.dither(48,34,57,20,.35,3);
 g.poly([[45,48],[35,43],[32,78],[45,87]],2);g.poly([[110,46],[120,42],[126,71],[112,86]],1);g.line(36,49,34,74,4);
 g.rect(51,53,50,23,0);g.box(50,52,52,25,4);g.rect(54,57,43,13,1);
 if(variant===2){for(let i=0;i<4;i++){g.rect(57+i*10,59,6,8,4);g.rect(58+i*10,60,2,3,5)}g.line(79,27,79,48,5);g.rect(73,32,13,7,1)}
 else if(variant===3){g.line(53,56,66,67,4);g.line(66,67,77,58,4);g.rect(84,59,10,6,5);g.poly([[99,29],[115,12],[124,15],[118,39]],3);g.line(116,14,109,37,5);g.dither(54,59,18,12,.3,4)}
 else{g.ell(63,63,7,6,4);g.ell(63,63,3,3,5);g.rect(84,61,10,3,5);g.line(82,57,98,57,3);}
 g.poly([[51,80],[78,76],[105,81],[100,99],[85,111],[64,102]],2);g.poly([[51,80],[60,87],[64,102],[55,96]],4);g.line(59,86,99,86,4);for(let i=0;i<4;i++)g.rect(62+i*8,90,3,11,2);
 g.bolt(49,36);g.bolt(104,35);g.bolt(51,75,2);g.bolt(103,75,2);g.line(56,109,53,120,4);g.line(105,109,110,120,2);
 g.line(26,130,46,122,2);g.line(26,140,46,132,1);g.line(118,128,138,136,2);g.line(118,138,138,146,1);g.bolt(31,146,5);g.bolt(132,149,5);
 if(variant===2){for(let i=0;i<3;i++){g.rect(9,34+i*18,15,8,1);g.rect(10,35+i*18,10,2,3);g.line(25,38+i*18,36,48+i*10,2)}g.rect(77,8,3,9,4);g.ring(79,5,4,3,3)}
 if(variant===3){g.poly([[42,15],[48,3],[54,19]],4);g.poly([[30,44],[18,24],[28,22],[41,48]],2);g.line(34,28,39,39,4);for(let i=0;i<4;i++)g.rect(14+i*36,154,8,2,3)}
 g.corners(3,3,154,154,3,8);g.small('OPTICAL RECORD',9,9,2);g.small('A-'+String(variant).padStart(2,'0'),116,145,3);
}
function hero(g){
 backdrop(g,288,250);
 // Mountains and receiving station: all shading is ordered raster stipple.
 g.poly([[0,166],[25,142],[45,154],[74,116],[100,143],[123,121],[156,149],[185,102],[226,145],[254,123],[288,149],[288,250],[0,250]],1);
 for(let i=0;i<5;i++)g.line(144,198,16+i*64,250,2);
 g.ring(142,96,93,85,2);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;g.line(142+Math.cos(a)*94,96+Math.sin(a)*86,142+Math.cos(a)*104,96+Math.sin(a)*94,i%2?3:2)}
 g.poly([[100,172],[108,150],[178,150],[193,172],[193,214],[100,214]],2);g.prism(98,192,98,21,9);g.poly([[128,99],[151,91],[173,170],[125,170]],2);g.line(131,100,132,167,4);g.line(151,100,163,164,3);
 // Tilted parabolic reflector, ribs and a feed horn floating over it.
 g.poly([[63,49],[93,41],[202,111],[191,132],[172,140],[139,130],[107,110],[76,82]],2);
 g.poly([[63,49],[72,51],[99,82],[141,110],[184,126],[202,111],[194,129],[173,140],[135,132],[101,108],[75,80]],4);
 for(let i=0;i<3;i++)g.line(78+i*18,58+i*14,160+i*10,126-i*4,1);
 g.poly([[71,52],[94,47],[194,112],[185,124],[145,111],[105,84]],1);g.dither(104,76,51,21,.32,3);g.line(75,53,183,121,5);g.line(82,57,189,118,3);
 g.line(100,63,148,38,4);g.line(189,113,148,38,3);g.prism(143,30,9,15,5);g.rect(145,24,3,8,5);g.line(147,24,148,11,3);
 g.prism(45,187,24,26,8);g.rect(48,192,17,10,0);g.line(51,200,51,195,4);g.line(56,200,56,194,3);g.line(61,200,61,196,4);
 g.line(56,181,56,164,4);g.line(42,168,70,168,2);g.line(56,165,43,153,2);g.line(56,165,69,153,2);
 g.prism(215,195,39,22,9);g.rect(222,201,6,9,3);g.rect(234,201,6,9,4);g.line(237,188,237,168,3);g.rect(234,164,7,4,5);
 g.line(148,218,148,239,3);g.line(144,239,152,239,3);g.line(148,227,141,231,3);g.line(148,227,155,231,3);
 g.corners(4,4,280,239,3,8);g.small('RECEIVING STATION / 09',14,231,3);g.small('49.09 N / 08.61 E',13,16,2);
}
const motifs=['sampler','mech','crosshair','lure','analyzer','projector','ghoul','statue','totem','summon','believer','acolyte','priest','idol','convert','research','turret','capacitor','learning','overflow','titan','scanner','weapon','mark','hourglass','microscope','recover','grave','orb','devour','aid','possess','shadow','messenger','revive','keeper','altar','sigil','blessing','servant','penitent','judge','choir','knight','scroll','shield','erase','bunker','occupier','apprentice','poet'];
function motif(g,name,id){
 backdrop(g,96,80);g.line(7,66,88,66,2);
 const mech=(heavy=false)=>{g.prism(30,23,34,27,8);g.rect(35,29,24,8,0);g.rect(39,31,6,3,5);g.rect(51,31,5,3,4);g.prism(23,44,12,19,5);g.prism(59,43,12,20,5);g.prism(38,51,8,16,3);g.prism(53,51,8,16,3);g.line(37,42,58,42,4);if(heavy){g.prism(8,22,16,31,7);g.prism(70,18,17,31,6);g.rect(12,25,10,4,4);g.line(17,21,21,10,4);g.line(81,17,78,9,3)}};
 const person=(head=0)=>{g.poly([[21,65],[29,43],[36,38],[35,22],[41,14],[54,14],[61,24],[58,38],[68,45],[78,65]],2);g.poly([[29,45],[43,33],[49,43],[47,65],[21,65]],3);g.line(43,20,53,20,4);g.rect(42,24,3,2,5);g.rect(53,24,2,2,4);g.line(43,31,53,31,1);g.line(47,43,57,62,4);g.line(35,46,30,62,1);if(head===1){g.ring(48,23,20,20,4);g.ring(48,23,22,22,2)}if(head===2){g.poly([[34,22],[41,7],[56,7],[63,22]],3);g.line(40,11,57,11,4)}};
 const altar=()=>{g.prism(17,51,59,13,7);g.prism(31,32,30,20,6);g.prism(25,27,43,7,6);g.line(48,11,48,27,5);g.line(39,18,57,18,4)};
 const orb=()=>{g.ell(47,34,23,23,2);g.ring(47,34,23,23,4);g.ring(44,31,15,18,3);g.ell(39,24,6,5,5);g.dither(45,34,16,13,.48,3);g.prism(30,62,33,5,5);g.poly([[38,58],[43,55],[54,55],[59,61]],3)};
 switch(name){
 case 'mech':case 'titan':case 'occupier':mech(name!=='mech');break;
 case 'sampler':g.prism(29,41,33,19,7);g.gear(44,31,15);g.line(56,23,77,15,4);g.line(77,15,80,27,3);g.ell(80,28,5,5,4);g.rect(33,47,19,6,1);break;
 case 'crosshair':case 'mark':case 'scanner':g.ring(48,37,25,25,3);g.ring(48,37,17,17,2);g.line(48,7,48,27,5);g.line(48,47,48,67,4);g.line(17,37,37,37,4);g.line(59,37,79,37,5);g.corners(41,30,15,15,4);if(name==='scanner'){g.prism(6,55,12,11,4);g.line(18,57,66,18,2)}break;
 case 'lure':case 'research':g.prism(28,37,37,23,7);g.rect(34,43,21,12,1);g.line(42,36,42,16,4);g.ring(43,17,8,8,3);g.ring(43,17,16,12,2);g.ring(43,17,23,16,1);for(let i=0;i<4;i++)g.rect(36+i*5,48,2,4+i%2,4);break;
 case 'analyzer':case 'learning':case 'overflow':g.prism(23,20,44,43,8);g.rect(28,25,33,22,0);g.box(29,26,31,20,3);for(let i=0;i<5;i++)g.line(31,30+i*3,49+i%3*3,30+i*3,3);g.rect(29,53,24,5,1);g.rect(57,53,4,5,4);if(name==='overflow')for(let i=0;i<6;i++)g.line(70,19+i*7,83+i%2*5,16+i*7,3);break;
 case 'projector':g.prism(22,34,34,24,7);g.ell(26,25,12,12,2);g.ring(26,25,12,12,4);g.ell(46,25,9,9,2);g.ring(46,25,9,9,4);g.rect(58,39,6,10,4);g.line(65,39,86,25,2);g.line(65,48,86,59,2);g.line(86,25,86,59,4);break;
 case 'ghoul':case 'devour':case 'possess':person();g.rect(38,20,9,6,0);g.rect(52,20,7,6,0);g.rect(41,22,3,2,5);g.rect(54,22,2,2,5);g.line(41,34,55,34,5);for(let i=0;i<4;i++)g.rect(42+i*3,33,1,5,0);if(name==='devour'){g.poly([[29,33],[21,40],[16,62],[34,51]],3);g.poly([[63,33],[78,42],[82,61],[63,51]],3)}break;
 case 'statue':case 'idol':case 'revive':person(1);g.prism(22,63,54,6,5);g.line(34,18,37,55,1);g.line(56,14,53,51,4);break;
 case 'totem':g.prism(34,17,24,45,7);g.poly([[26,21],[48,7],[70,21],[70,29],[26,29]],3);g.rect(38,25,5,4,5);g.rect(51,25,5,4,5);g.poly([[42,33],[53,33],[48,40]],1);g.line(26,48,69,48,4);g.prism(26,62,44,6,6);break;
 case 'summon':case 'aid':case 'shadow':g.ring(48,47,32,17,3);g.ring(48,47,26,12,2);person();for(let i=0;i<5;i++)g.line(15+i*16,51,17+i*16,19+i%3*9,2);break;
 case 'believer':case 'acolyte':case 'priest':case 'servant':case 'penitent':case 'keeper':case 'messenger':case 'apprentice':case 'poet':person(name==='priest'?2:0);if(name==='keeper'){g.line(75,21,75,65,4);g.line(69,23,81,23,4)}if(name==='poet'){g.prism(58,44,24,17,3);g.line(61,48,77,48,4)}if(name==='messenger'){g.poly([[21,38],[10,17],[29,25]],3);g.poly([[66,36],[86,16],[72,46]],4)}break;
 case 'convert':case 'blessing':g.ring(48,36,22,22,3);g.line(48,9,48,65,4);g.line(25,26,70,26,4);g.line(35,11,61,59,2);g.rect(46,32,5,5,5);break;
 case 'turret':case 'capacitor':case 'weapon':g.prism(25,48,45,15,7);g.ring(48,46,16,8,4);g.prism(35,31,27,15,7);g.poly([[48,32],[77,14],[82,17],[58,37]],3);g.line(51,31,78,15,5);if(name==='capacitor')for(let i=0;i<4;i++)g.prism(16+i*8,40,5,10,3);break;
 case 'hourglass':g.prism(24,13,45,5,5);g.prism(24,62,45,5,5);g.poly([[30,19],[63,19],[58,32],[49,40],[60,56],[63,61],[30,61],[35,50],[44,40],[33,29]],2);g.line(31,20,46,39,4);g.line(46,40,32,60,4);g.poly([[39,25],[54,25],[47,36]],4);g.poly([[36,59],[47,49],[57,59]],4);break;
 case 'microscope':g.prism(25,61,47,6,5);g.line(55,56,64,37,4);g.line(64,37,50,20,4);g.prism(32,14,17,23,6);g.line(37,40,55,40,4);g.rect(37,42,20,3,3);g.bolt(60,37,5);break;
 case 'recover':g.ring(48,38,23,23,3);g.poly([[21,30],[34,23],[31,39]],4);g.prism(39,29,18,25,5);g.line(43,35,52,35,4);break;
 case 'grave':g.poly([[27,63],[27,27],[32,17],[42,11],[55,11],[65,19],[68,63]],2);g.ring(47,29,13,13,3);g.line(47,20,47,41,4);g.line(38,27,56,27,4);g.prism(22,64,51,5,5);break;
 case 'orb':orb();break;
 case 'altar':altar();g.ring(48,18,13,13,3);break;
 case 'sigil':g.ring(48,38,26,26,4);g.ring(48,38,22,22,2);g.poly([[48,14],[72,52],[24,52]],2);g.line(48,15,72,52,4);g.line(72,52,24,52,4);g.line(24,52,48,15,4);g.ring(48,39,8,8,5);break;
 case 'judge':case 'knight':person(2);g.poly([[62,36],[83,33],[81,56],[70,63],[62,54]],3);g.box(65,38,13,14,4);g.line(19,22,19,59,5);g.line(13,37,25,37,4);break;
 case 'choir':for(let i=0;i<3;i++){g.ell(24+i*24,27-i%2*5,6,7,3);g.poly([[17+i*24,38],[32+i*24,38],[39+i*24,64],[10+i*24,64]],2);g.line(19+i*24,45,29+i*24,45,4)}g.ring(48,17,34,12,2);break;
 case 'scroll':g.prism(25,20,43,39,5);for(let i=0;i<6;i++)g.line(32,28+i*4,58+i%3*2,28+i*4,4);g.ell(25,19,5,5,3);g.ell(68,59,5,5,3);break;
 case 'shield':g.poly([[48,11],[74,22],[72,45],[63,59],[48,68],[31,59],[23,43],[22,22]],3);g.poly([[48,16],[48,62],[31,52],[27,26]],2);g.line(48,21,48,51,5);g.line(35,33,60,33,4);break;
 case 'erase':g.prism(22,24,49,33,7);g.line(17,65,79,10,5);for(let i=0;i<5;i++)g.line(28,30+i*4,61,30+i*4,2);break;
 case 'bunker':g.poly([[12,64],[12,42],[27,25],[68,25],[84,43],[84,64]],2);g.poly([[13,42],[29,27],[66,27],[83,43]],4);g.rect(30,42,35,22,0);g.hatch(34,46,27,15,2,4);g.line(16,48,26,48,4);g.line(69,48,80,48,3);break;
 default:throw new Error('Missing artwork motif '+name);
 }
 g.small(String(id).padStart(2,'0'),7,7,2);g.corners(3,3,90,72,2,3);
}
function cardBack(g,n){
 backdrop(g,96,80);g.box(8,7,80,66,3);g.box(12,11,72,58,1);g.corners(15,14,66,52,4,5);g.ring(48,40,25,23,2);g.ring(48,40,19,17,3);
 switch(n){
 case 1:g.line(32,40,64,40,3);g.line(48,25,48,55,3);g.ring(48,40,6,6,4);break;
 case 2:g.poly([[48,19],[68,55],[28,55]],3);g.poly([[48,27],[59,50],[37,50]],4);g.line(48,18,48,58,5);break;
 case 3:g.ring(48,40,17,8,4);g.ell(48,40,5,5,5);g.line(25,40,31,40,3);g.line(65,40,71,40,3);break;
 case 4:g.poly([[48,20],[68,29],[65,49],[57,59],[48,64],[39,59],[31,49],[28,29]],3);g.line(48,25,48,57,5);g.line(37,38,59,38,4);break;
 case 5:g.poly([[24,58],[36,32],[46,43],[58,20],[72,58]],3);g.line(26,58,70,58,5);g.line(36,32,46,58,4);break;
 case 6:g.ell(48,42,13,17,3);g.ring(48,42,13,17,4);g.poly([[35,40],[24,29],[34,26],[42,36]],2);g.poly([[61,40],[72,29],[62,26],[54,36]],2);break;
 case 7:g.line(48,20,48,60,5);g.line(31,33,65,33,4);g.ring(48,40,19,19,2);g.ell(48,40,3,3,5);break;
 case 8:g.poly([[25,54],[38,38],[38,22],[51,34],[63,23],[60,43],[73,53],[51,49],[42,62]],4);g.line(26,54,72,53,3);break;
 case 9:g.poly([[29,54],[29,27],[39,20],[57,20],[67,27],[67,54]],2);g.poly([[38,53],[48,39],[58,53]],4);g.line(35,30,61,30,3);break;
 case 10:g.line(27,24,69,57,4);g.line(69,24,27,57,4);g.ring(48,40,13,13,2);g.ell(48,40,4,4,5);break;
 case 11:for(let i=0;i<5;i++){g.poly([[25+i*7,57],[48,20+i*3],[70-i*7,57]],i%2?2:3)}g.line(22,59,74,59,5);break;
 case 12:g.poly([[26,53],[35,31],[45,39],[54,22],[70,53]],3);for(let i=0;i<4;i++)g.line(31+i*9,54,36+i*6,28+i*4,4);g.rect(30,58,36,4,5);break;
 case 13:g.ring(48,40,22,22,4);g.ring(48,40,10,10,3);for(let i=0;i<8;i++){const a=i*Math.PI/4;g.line(48+Math.cos(a)*11,40+Math.sin(a)*11,48+Math.cos(a)*21,40+Math.sin(a)*21,i%2?3:5)}g.ell(48,40,3,3,5);break;
 }
 g.small('B'+String(n).padStart(2,'0'),16,17,2);g.small('A-09',58,58,2);
}
function fitted(asset,id,w,h){w=Math.round(w);h=Math.round(h);if(w===asset.width&&h===asset.height)return asset;const min=w>=64?0:0x28,key=id+'@'+w+'x'+h+':'+min;let frame=scaleCache.get(key);if(frame)return frame;const sw=asset.width,sh=asset.height,src=asset.getContext('2d').getImageData(0,0,sw,sh).data;frame=document.createElement('canvas');frame.width=w;frame.height=h;const g=frame.getContext('2d'),image=g.createImageData(w,h),dst=image.data;for(let y=0;y<h;y++){const y0=Math.floor(y*sh/h),y1=Math.min(sh,Math.max(y0+1,Math.floor((y+1)*sh/h)));for(let x=0;x<w;x++){const x0=Math.floor(x*sw/w),x1=Math.min(sw,Math.max(x0+1,Math.floor((x+1)*sw/w)));let best=0,br=8,bg=8,bb=8;for(let sy=y0;sy<y1;sy++)for(let sx=x0;sx<x1;sx++){const i=(sy*sw+sx)*4,v=src[i];if(v>=best){best=v;br=src[i];bg=src[i+1];bb=src[i+2]}}const o=(y*w+x)*4;if(best<min)dst[o]=dst[o+1]=dst[o+2]=8;else{dst[o]=br;dst[o+1]=bg;dst[o+2]=bb}dst[o+3]=255}}g.putImageData(image,0,0);scaleCache.set(key,frame);return frame}
export function drawArt(ctx,id,x,y,w,h){if(!id||!ctx)return;let asset=cache.get(id);if(!asset){asset=document.createElement('canvas');const key=String(id),monster=key.startsWith('monster.')||key.startsWith('card.m'),back=key.startsWith('back.');asset.width=id==='hero'?288:monster?160:96;asset.height=id==='hero'?250:monster?160:80;const g=new Engraving(asset.getContext('2d'));try{if(id==='hero')hero(g);else if(monster)robot(g,Number(key.slice(-3)));else if(back)cardBack(g,Number(key.slice(-3)));else {const n=Number(key.slice(-3)),motifName=motifs[n-1];if(!motifName)throw new Error('missing');motif(g,motifName,n)}}catch{g.rect(0,0,asset.width,asset.height,0);g.small('NO ART',8,Math.max(8,asset.height/2-4),4)}cache.set(id,asset)}ctx.imageSmoothingEnabled=false;ctx.drawImage(fitted(asset,id,w,h),Math.round(x),Math.round(y));}
export function drawEmblem(ctx,x,y,size,variant='science'){const g=new Engraving(ctx),r=size/2,cx=x+r,cy=y+r;g.ring(cx,cy,r-1,r-1,3);if(variant==='science'){g.ring(cx,cy,r*.72,r*.3,4);g.ring(cx,cy,r*.3,r*.72,4);g.ell(cx,cy,2,2,5)}else if(variant==='mystery'){g.poly([[cx,y+3],[x+size-4,y+size-4],[x+4,y+size-4]],2);g.line(cx,y+3,x+size-4,y+size-4,4);g.line(x+size-4,y+size-4,x+4,y+size-4,4);g.line(x+4,y+size-4,cx,y+3,4);g.ell(cx,cy+2,2,2,5)}else{g.line(cx,y+4,cx,y+size-4,4);g.line(x+5,cy-3,x+size-5,cy-3,4)}}
