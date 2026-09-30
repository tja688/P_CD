const VERTEX=`attribute vec2 aPosition; varying vec2 vUV; void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const HISTORY=`precision mediump float;varying vec2 vUV;uniform sampler2D uSource,uHistory;uniform float uDecay;void main(){float now=texture2D(uSource,vUV).r;float old=texture2D(uHistory,vUV).r*uDecay;gl_FragColor=vec4(vec3(max(now,old)),1.);}`;
const DISPLAY=`precision highp float;
varying vec2 vUV;uniform sampler2D uSignal;uniform vec2 uResolution;uniform float uTime,uCurve,uBloom,uBrightness,uNoise,uMotion,uPower;
float signal(vec2 uv){if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return 0.;return max(0.,(texture2D(uSignal,uv).r-.03137)/.91);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 q=vUV*2.-1.;vec2 uv=(q*(1.+uCurve*.06*dot(q,q)))*.5+.5;
 float episode=step(.986,sin(uTime*.37+1.7));float band=exp(-pow((uv.y-fract(uTime*.071))/.009,2.));
 uv.x+=episode*band*sin(uv.y*750.+uTime*25.)*.0015*uNoise*uMotion;
 float core=signal(uv);vec2 texel=vec2(1./640.,1./360.);
 float glow=signal(uv+vec2(texel.x,0.))+signal(uv-vec2(texel.x,0.))+signal(uv+vec2(0.,texel.y))+signal(uv-vec2(0.,texel.y));
 glow+=.55*(signal(uv+vec2(texel.x*2.,texel.y*2.))+signal(uv-vec2(texel.x*2.,texel.y*2.))+signal(uv+vec2(texel.x*2.,-texel.y*2.))+signal(uv+vec2(-texel.x*2.,texel.y*2.)));
 glow+=.2*(signal(uv+vec2(texel.x*4.,0.))+signal(uv-vec2(texel.x*4.,0.))+signal(uv+vec2(0.,texel.y*4.))+signal(uv-vec2(0.,texel.y*4.)));
 float scan=.90+.10*cos(uv.y*360.*6.2831853);float raster=.97+.03*cos(vUV.x*uResolution.x*3.1415926);
 float vignette=1.-.16*pow(abs(q.x),3.)-.18*pow(abs(q.y),3.);
 float intensity=(core*scan*raster+glow*.034*uBloom)*vignette*(.72+uBrightness*.36);
 vec3 amber=vec3(1.,.665,.237);vec3 glass=vec3(.018,.011,.006)+vec3(.012,.007,.003)*(1.-dot(q,q)*.32);
 float grain=(hash(gl_FragCoord.xy+floor(uTime*8.)*uMotion)-.5)*.009*uNoise;
 vec3 colour=glass+amber*intensity+vec3(grain,grain*.65,grain*.22);
 float edge=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
 gl_FragColor=vec4(colour*edge*uPower,1.);
}`;
export class CRT {
 constructor(canvas,source){this.canvas=canvas;this.source=source;this.curve=.25;this.last=0;this.front=0;this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});this.supported=!!this.gl;if(!this.gl){this.fallback=canvas.getContext('2d');this.tinted=document.createElement('canvas');this.tinted.width=640;this.tinted.height=360;return;}const gl=this.gl;
  this.historyProgram=this.program(HISTORY);this.displayProgram=this.program(DISPLAY);
  const buffer=gl.createBuffer();this.buffer=buffer;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  this.sourceTexture=this.texture();this.histories=[this.texture(),this.texture()];this.frames=this.histories.map(tex=>{const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);gl.viewport(0,0,640,360);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('磷光帧缓冲初始化失败');return f});gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});canvas.addEventListener('webglcontextrestored',()=>location.reload());
 }
 program(fragment){const gl=this.gl;const compile=(type,code)=>{const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader};const vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,locations:new Map()};}
 texture(){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,640,360,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t;}
 use(program){const gl=this.gl;gl.useProgram(program.p);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const a=gl.getAttribLocation(program.p,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);this.current=program;}
 location(name){let loc=this.current.locations.get(name);if(loc===undefined){loc=this.gl.getUniformLocation(this.current.p,name);this.current.locations.set(name,loc)}return loc;}
 float(name,value){this.gl.uniform1f(this.location(name),value);}
 sampler(name,texture,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(this.location(name),unit);}
 render(time,settings={}){this.curve=settings.curvature??.25;if(this.lost)return;const dt=Math.min(.1,Math.max(.001,time-this.last));this.last=time;
  if(!this.gl){if(time-(this.fallbackTime??-1)<1/20)return;this.fallbackTime=time;const c=this.tinted.getContext('2d');c.drawImage(this.source,0,0);const im=c.getImageData(0,0,640,360);for(let i=0;i<im.data.length;i+=4){let v=Math.max(0,(im.data[i]-8)/232);im.data[i]=7+v*248;im.data[i+1]=4+v*164;im.data[i+2]=2+v*59;}c.putImageData(im,0,0);this.fallback.imageSmoothingEnabled=false;this.fallback.drawImage(this.tinted,0,0,this.canvas.width,this.canvas.height);return;}
  const gl=this.gl,back=1-this.front;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.sourceTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,this.source);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.frames[back]);gl.viewport(0,0,640,360);this.use(this.historyProgram);this.sampler('uSource',this.sourceTexture,0);this.sampler('uHistory',this.histories[this.front],1);this.float('uDecay',settings.reducedMotion?0:Math.exp(-dt/(.018+(settings.persistence??.25)*.13)));gl.drawArrays(gl.TRIANGLE_STRIP,0,4);this.front=back;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);this.use(this.displayProgram);this.sampler('uSignal',this.histories[this.front],0);gl.uniform2f(this.location('uResolution'),this.canvas.width,this.canvas.height);this.float('uTime',time);this.float('uCurve',this.curve);this.float('uBloom',settings.bloom??.35);this.float('uBrightness',settings.brightness??.8);this.float('uNoise',settings.noise??.2);this.float('uMotion',settings.reducedMotion?0:1);this.float('uPower',settings.power??1);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 mapPoint(clientX,clientY){const r=this.canvas.getBoundingClientRect();let qx=(clientX-r.left)/r.width*2-1,qy=(clientY-r.top)/r.height*2-1,k=this.gl?1+this.curve*.06*(qx*qx+qy*qy):1;return {x:Math.floor((qx*k*.5+.5)*640),y:Math.floor((qy*k*.5+.5)*360)};}
 dispose(){if(!this.gl)return;for(const t of [this.sourceTexture,...this.histories])this.gl.deleteTexture(t);for(const f of this.frames)this.gl.deleteFramebuffer(f);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.historyProgram.p);this.gl.deleteProgram(this.displayProgram.p);}
}
