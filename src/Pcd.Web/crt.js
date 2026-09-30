const VERTEX=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const HISTORY=`precision mediump float;varying vec2 vUV;uniform sampler2D uSource,uHistory;uniform float uDecay;void main(){float now=texture2D(uSource,vUV).r;float old=texture2D(uHistory,vUV).r*uDecay;gl_FragColor=vec4(vec3(max(now,old)),1.);}`;
const EXTRACT=`precision highp float;varying vec2 vUV;uniform sampler2D uSignal;uniform vec2 uTexel;
void main(){
 vec2 o=uTexel*.5;
 float r=(texture2D(uSignal,vUV+vec2(-o.x,-o.y)).r+texture2D(uSignal,vUV+vec2(o.x,-o.y)).r+texture2D(uSignal,vUV+vec2(-o.x,o.y)).r+texture2D(uSignal,vUV+vec2(o.x,o.y)).r)*.25;
 float s=max(0.,(r-.03137255)/.90980392);
 float hot=max(0.,(s-.70)/.30);
 gl_FragColor=vec4(vec3(pow(hot,1.65)),1.);
}`;
const BLUR=`precision highp float;varying vec2 vUV;uniform sampler2D uImage;uniform vec2 uDirection;
void main(){
 float sum=0.;vec3 acc=vec3(0.);
 for(int i=0;i<13;i++){float x=float(i)-6.;float w=exp(-.5*x*x/7.84);acc+=texture2D(uImage,vUV+uDirection*x).rgb*w;sum+=w;}
 gl_FragColor=vec4(acc/sum,1.);
}`;
const DISPLAY=`precision highp float;
varying vec2 vUV;uniform sampler2D uSignal,uBloom;uniform float uTime,uCurve,uBloomGain,uBrightness,uNoise,uMotion,uPower;
float raw(vec2 uv){if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return 0.;return max(0.,(texture2D(uSignal,uv).r-.03137255)/.90980392);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 q=vUV*2.-1.;vec2 uv=(q*(1.+uCurve*.06*dot(q,q)))*.5+.5;
 float episode=step(.986,sin(uTime*.37+1.7));float band=exp(-pow((uv.y-fract(uTime*.071))/.009,2.));
 uv.x+=episode*band*sin(uv.y*750.+uTime*25.)*.0015*uNoise*uMotion;
 vec2 texel=vec2(1./640.,1./360.);
 vec2 p=(floor(uv/texel)+.5)*texel;
 float core=raw(p);
 float near=max(max(raw(p+vec2(texel.x,0.)),raw(p-vec2(texel.x,0.))),max(raw(p+vec2(0.,texel.y)),raw(p-vec2(0.,texel.y))));
 float fringe=max(0.,near-core)*.38;
 float flood=texture2D(uBloom,clamp(uv,0.,1.)).r;
 float halo=flood*(1.-smoothstep(.12,.62,core));
 float stripe=step(.5,mod(floor(clamp(p.y,0.,.999)*360.),2.));
 float coreScan=mix(.94,1.,stripe),haloScan=mix(.97,1.,stripe);
 float exposure=(.35+uBrightness*2.15)*uPower,bloom=max(uBloomGain,0.);
 float shaped=pow(max(core,0.),1.28),heat=smoothstep(.66,1.,core);
 vec3 glass=vec3(.036,.015,.005)+vec3(.034,.014,.003)*(1.-dot(q,q)*.55);
 vec3 filament=mix(vec3(1.,.70,.12),vec3(1.,.97,.78),heat);
 float vignette=clamp(1.-.20*pow(abs(q.x),2.2)-.28*pow(abs(q.y),2.4),.5,1.);
 vec3 energy=filament*shaped*coreScan*1.22;
 energy+=vec3(1.,.58,.07)*fringe*haloScan*(.14+.26*bloom);
 energy+=vec3(1.,.50,.05)*halo*haloScan*(.06+.24*bloom);
 energy*=exposure*vignette;
 vec3 colour=glass*vignette+energy;
 float peak=max(colour.r,max(colour.g,colour.b));
 vec3 hue=colour/max(peak,1e-4);
 float warm=smoothstep(.06,.45,peak)*(1.-smoothstep(1.15,2.4,peak));
 hue=mix(hue,vec3(1.,.76,.16),warm*.62);
 colour=hue*(1.-exp(-peak));
 float grain=hash(gl_FragCoord.xy+floor(uTime*3.)*uMotion)-.5;
 float lit=clamp(colour.r,0.,1.);
 colour+=vec3(grain,grain*.65,grain*.12)*uNoise*(.008+lit*.016);
 float edge=smoothstep(-.002,.014,uv.x)*smoothstep(-.002,.014,uv.y)*smoothstep(-.002,.014,1.-uv.x)*smoothstep(-.002,.014,1.-uv.y);
 gl_FragColor=vec4(clamp(colour,0.,1.)*edge,1.);
}`;
export class CRT {
 constructor(canvas,source){
  this.canvas=canvas;this.source=source;this.curve=.3;this.last=0;this.front=0;this.bloomW=320;this.bloomH=180;
  this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
  this.supported=!!this.gl;
  if(!this.gl){this.fallback=canvas.getContext('2d');this.tinted=document.createElement('canvas');this.tinted.width=640;this.tinted.height=360;return;}
  const gl=this.gl;
  this.historyProgram=this.program(HISTORY);this.extractProgram=this.program(EXTRACT);this.blurProgram=this.program(BLUR);this.displayProgram=this.program(DISPLAY);
  const buffer=gl.createBuffer();this.buffer=buffer;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  this.sourceTexture=this.texture(640,360,gl.NEAREST);this.histories=[this.texture(640,360,gl.NEAREST),this.texture(640,360,gl.NEAREST)];
  this.frames=this.histories.map(tex=>this.framebuffer(tex,640,360));
  this.bloom=[this.texture(this.bloomW,this.bloomH,gl.LINEAR),this.texture(this.bloomW,this.bloomH,gl.LINEAR)];
  this.bloomFrames=this.bloom.map(tex=>this.framebuffer(tex,this.bloomW,this.bloomH));
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
 }
 program(fragment){const gl=this.gl;const compile=(type,code)=>{const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader};const vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locations:new Map()};}
 framebuffer(texture,width,height){const gl=this.gl,f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.viewport(0,0,width,height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('磷光帧缓冲初始化失败');return f;}
 texture(width,height,filter){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t;}
 use(program){const gl=this.gl;gl.useProgram(program.p);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const a=gl.getAttribLocation(program.p,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);this.current=program;}
 location(name){let loc=this.current.locations.get(name);if(loc===undefined){loc=this.gl.getUniformLocation(this.current.p,name);this.current.locations.set(name,loc)}return loc;}
 float(name,value){this.gl.uniform1f(this.location(name),value);}
 sampler(name,texture,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(this.location(name),unit);}
 quad(){this.gl.drawArrays(this.gl.TRIANGLE_STRIP,0,4);}
 blur(source,frame,dx,dy){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,frame);gl.viewport(0,0,this.bloomW,this.bloomH);this.use(this.blurProgram);this.sampler('uImage',source,0);gl.uniform2f(this.location('uDirection'),dx,dy);this.quad();}
 render(time,settings={}){
  this.curve=settings.curvature??.3;if(this.lost)return;
  const dt=Math.min(.1,Math.max(.001,time-this.last));this.last=time;
  if(!this.gl)return this.renderFallback(time,settings);
  const gl=this.gl,back=1-this.front,bloom=settings.bloom??1,brightness=settings.brightness??.9,noise=settings.noise??.7,persistence=settings.persistence??.5;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.sourceTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,this.source);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.frames[back]);gl.viewport(0,0,640,360);this.use(this.historyProgram);this.sampler('uSource',this.sourceTexture,0);this.sampler('uHistory',this.histories[this.front],1);
  const tau=.055+(settings.reducedMotion?0:persistence)*.22;this.float('uDecay',settings.reducedMotion?0:Math.exp(-dt/Math.max(.04,tau)));this.quad();this.front=back;
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.bloomFrames[0]);gl.viewport(0,0,this.bloomW,this.bloomH);this.use(this.extractProgram);this.sampler('uSignal',this.histories[this.front],0);gl.uniform2f(this.location('uTexel'),1/640,1/360);this.quad();
  this.blur(this.bloom[0],this.bloomFrames[1],1/this.bloomW,0);this.blur(this.bloom[1],this.bloomFrames[0],0,1/this.bloomH);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);this.use(this.displayProgram);
  this.sampler('uSignal',this.histories[this.front],0);this.sampler('uBloom',this.bloom[0],1);
  this.float('uTime',time);this.float('uCurve',this.curve);this.float('uBloomGain',bloom);this.float('uBrightness',brightness);this.float('uNoise',noise);this.float('uMotion',settings.reducedMotion?0:1);this.float('uPower',settings.power??1);this.quad();
 }
 renderFallback(time,settings){
  if(time-(this.fallbackTime??-1)<1/20)return;this.fallbackTime=time;
  const w=640,h=360,bw=160,bh=90,c=this.tinted.getContext('2d',{willReadFrequently:true});
  c.drawImage(this.source,0,0);const im=c.getImageData(0,0,w,h),sig=this.sig??=new Float32Array(w*h),small=this.small??=new Float32Array(bw*bh),tmp=this.tmp??=new Float32Array(bw*bh),blur=this.blurBuf??=new Float32Array(bw*bh);
  for(let i=0,p=0;i<sig.length;i++,p+=4)sig[i]=Math.max(0,(im.data[p]-8)/232);
  const at=(x,y)=>x<0||y<0||x>=w||y>=h?0:sig[y*w+x];
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){let s=0;for(let oy=0;oy<4;oy++)for(let ox=0;ox<4;ox++)s+=sig[(y*4+oy)*w+(x*4+ox)];const v=s/16,hot=v<=.7?0:Math.pow((v-.7)/.3,1.65);small[y*bw+x]=hot}
  const rad=2;for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){let a=0;for(let k=-rad;k<=rad;k++)a+=small[y*bw+Math.min(bw-1,Math.max(0,x+k))];tmp[y*bw+x]=a/(rad*2+1)}
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){let a=0;for(let k=-rad;k<=rad;k++)a+=tmp[Math.min(bh-1,Math.max(0,y+k))*bw+x];blur[y*bw+x]=a/(rad*2+1)}
  const exposure=(.35+(settings.brightness??.9)*2.15)*(settings.power??1),bloom=settings.bloom??1,smooth=(e0,e1,v)=>{const t=Math.min(1,Math.max(0,(v-e0)/(e1-e0)));return t*t*(3-2*t)};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const s=sig[y*w+x],shaped=Math.pow(Math.max(s,0),1.28),heat=s<=.66?0:Math.min(1,(s-.66)/.34);
   const near=Math.max(at(x+1,y),at(x-1,y),at(x,y+1),at(x,y-1)),fringe=Math.max(0,near-s)*.38;
   const fx=(x+.5)/w*bw-.5,fy=(y+.5)/h*bh-.5,x0=Math.max(0,Math.floor(fx)),y0=Math.max(0,Math.floor(fy)),x1=Math.min(bw-1,x0+1),y1=Math.min(bh-1,y0+1),tx=Math.min(1,Math.max(0,fx-x0)),ty=Math.min(1,Math.max(0,fy-y0));
   const flood=blur[y0*bw+x0]*(1-tx)*(1-ty)+blur[y0*bw+x1]*tx*(1-ty)+blur[y1*bw+x0]*(1-tx)*ty+blur[y1*bw+x1]*tx*ty;
   const halo=flood*(1-smooth(.12,.62,s)),scan=y%2?1:.94,haloScan=y%2?1:.97;
   const coreE=shaped*1.22*scan*exposure,fringeE=fringe*(.14+.26*bloom)*haloScan*exposure,floodE=halo*(.06+.24*bloom)*haloScan*exposure;
   const fg=.70+(.97-.70)*heat,fb=.12+(.78-.12)*heat;
   const er=coreE+fringeE+floodE+.036,eg=fg*coreE+fringeE*.58+floodE*.46+.015,eb=fb*coreE+fringeE*.07+floodE*.04+.005;
   const peak=Math.max(er,eg,eb,1e-4),warm=smooth(.06,.45,peak)*(1-smooth(1.15,2.4,peak))*.62,mapped=1-Math.exp(-peak);
   const tone=(v,target)=>Math.max(0,Math.min(255,Math.round(((v/peak)*(1-warm)+target*warm)*mapped*255)));
   const p=(y*w+x)*4;im.data[p]=tone(er,1);im.data[p+1]=tone(eg,.76);im.data[p+2]=tone(eb,.16);im.data[p+3]=255;
  }
  c.putImageData(im,0,0);this.fallback.imageSmoothingEnabled=false;this.fallback.drawImage(this.tinted,0,0,this.canvas.width,this.canvas.height);
 }
 mapPoint(clientX,clientY){const r=this.canvas.getBoundingClientRect();let qx=(clientX-r.left)/r.width*2-1,qy=(clientY-r.top)/r.height*2-1,k=this.gl?1+this.curve*.06*(qx*qx+qy*qy):1;return {x:Math.floor((qx*k*.5+.5)*640),y:Math.floor((qy*k*.5+.5)*360)};}
 dispose(){if(!this.gl)return;for(const t of [this.sourceTexture,...this.histories,...this.bloom])this.gl.deleteTexture(t);for(const f of [...this.frames,...this.bloomFrames])this.gl.deleteFramebuffer(f);this.gl.deleteBuffer(this.buffer);for(const program of [this.historyProgram,this.extractProgram,this.blurProgram,this.displayProgram])this.gl.deleteProgram(program.p);}
}
