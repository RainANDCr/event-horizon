export const diskShader = `
uniform float time, inner, outer, brightness, heat, turbulence, spinBias;
uniform int octaves;

float hash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 f = fract(point);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(cell), hash(cell + vec2(1, 0)), f.x),
             mix(hash(cell + vec2(0, 1)), hash(cell + vec2(1, 1)), f.x), f.y);
}

vec4 shadeDisk(vec2 point, vec2 towardObserver) {
  float radius = length(point);
  if (radius <= inner || radius >= outer) return vec4(0.0);
  float across = (radius - inner) / (outer - inner);
  float phase = atan(point.y, point.x) - time * 1.25 * pow(3.2 / radius, 1.5) * (1.0 + 0.5 * spinBias * (1.0 - across));
  vec2 direction = vec2(cos(phase), sin(phase));
  vec2 samplePoint = direction * (4.0 + radius * 0.6);
  float structure = 0.0;
  float weight = 0.55;
  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    structure += weight * noise(samplePoint);
    samplePoint = samplePoint * 2.07 + vec2(9.1, 4.7);
    weight *= 0.52;
  }
  float filaments = 0.5 + 0.5 * sin(radius * 34.0 + 22.0 * structure * turbulence + 2.3 * direction.y);
  float lanes = mix(0.78, 0.24 + 1.05 * structure + 0.23 * filaments, turbulence);
  float falloff = exp(-3.7 * across);
  float temperature = clamp(heat * pow(1.0 - across, 1.8), 0.0, 1.0);
  vec3 ember = vec3(0.93, 0.12, 0.025);
  vec3 gold = vec3(1.0, 0.54, 0.15);
  vec3 whiteHot = vec3(1.0, 0.91, 0.69);
  vec3 color = mix(mix(ember, gold, temperature), whiteHot, temperature * temperature);
  vec2 velocity = vec2(-point.y, point.x) / radius;
  float beaming = pow(1.0 - (0.32 + 0.10 * spinBias) * sqrt(3.2 / radius) * dot(velocity, towardObserver), -2.0);
  float light = brightness * falloff * lanes * beaming;
  float edges = smoothstep(0.0, 0.07, across) * (1.0 - smoothstep(0.72, 1.0, across));
  return vec4(1.32 * (1.0 - exp(-2.1 * color * light)), edges * (0.78 + 0.22 * filaments));
}
`
