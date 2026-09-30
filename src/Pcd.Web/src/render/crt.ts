import { Filter, GlProgram, UniformGroup, defaultFilterVert } from 'pixi.js'

const crtFrag = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uCurve;
uniform vec2 uLogical;

vec2 bend(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  p *= 1.0 + uCurve * dot(p, p);
  return p * 0.5 + 0.5;
}

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 0.15) * 43758.5453);
}

void main() {
  vec2 uv = bend(vTextureCoord);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    finalColor = vec4(0.02, 0.008, 0.0, 1.0);
    return;
  }
  vec2 logical = max(uLogical, vec2(1.0));
  vec2 snapped = (floor(uv * logical) + 0.5) / logical;
  float center = texture(uTexture, snapped).r;
  float glow = 0.0;
  glow += texture(uTexture, snapped + vec2(1.0 / logical.x, 0.0)).r;
  glow += texture(uTexture, snapped - vec2(1.0 / logical.x, 0.0)).r;
  glow += texture(uTexture, snapped + vec2(0.0, 1.0 / logical.y)).r;
  glow += texture(uTexture, snapped - vec2(0.0, 1.0 / logical.y)).r;
  float signal = center + glow * 0.03;
  signal *= 0.99 + 0.01 * sin(uTime * 18.0);
  float scan = 0.955 + 0.035 * sin(gl_FragCoord.y * 3.14159);
  float grille = 0.97 + 0.03 * step(0.5, fract(gl_FragCoord.x * 0.5));
  vec2 q = uv * 2.0 - 1.0;
  float vig = smoothstep(1.25, 0.28, length(q));
  float tube = smoothstep(1.05, 0.15, length(q));
  signal = max(signal, 0.085 * tube * tube);
  vig = mix(0.58, 1.0, vig);
  signal += (grain(gl_FragCoord.xy) - 0.5) * 0.008;
  vec3 dim = vec3(0.42, 0.14, 0.02);
  vec3 mid = vec3(1.0, 0.62, 0.12);
  vec3 hot = vec3(1.0, 0.95, 0.78);
  float t = clamp(signal, 0.0, 1.0);
  vec3 color = mix(dim, mid, smoothstep(0.02, 0.82, t));
  color = mix(color, hot, smoothstep(0.7, 1.05, signal));
  color *= scan * grille * vig;
  finalColor = vec4(color, 1.0);
}
`

export function createCrtFilter(): Filter {
  return new Filter({
    glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: crtFrag, name: 'amber-crt' }),
    padding: 0,
    antialias: 'off',
    resolution: 'inherit',
    resources: {
      crtUniforms: new UniformGroup({
        uTime: { value: 0, type: 'f32' },
        uCurve: { value: 0, type: 'f32' },
        uLogical: { value: { x: 640, y: 360 }, type: 'vec2<f32>' },
      }),
    },
  })
}

export function setCrtTime(filter: Filter, time: number): void {
  const group = filter.resources.crtUniforms as UniformGroup
  group.uniforms.uTime = time
  group.update()
}
