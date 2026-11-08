export const nebulaShader = `
  uniform int region, nebulaQuality;
  uniform vec3 nebulaColor, worldOrigin;
  uniform float nebulaDensity, nebulaLight, nebulaSize, nebulaTime;

  float cloudHash(vec3 cell) {
    return fract(sin(dot(cell + vec3(21.77, 4.13, 9.37), vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float cloudNoise(vec3 p) {
    vec3 c = floor(p);
    vec3 f = smoothstep(0.0, 1.0, fract(p));
    float low = mix(mix(cloudHash(c), cloudHash(c + vec3(1,0,0)), f.x),
                    mix(cloudHash(c + vec3(0,1,0)), cloudHash(c + vec3(1,1,0)), f.x), f.y);
    c.z += 1.0;
    float high = mix(mix(cloudHash(c), cloudHash(c + vec3(1,0,0)), f.x),
                     mix(cloudHash(c + vec3(0,1,0)), cloudHash(c + vec3(1,1,0)), f.x), f.y);
    return mix(low, high, f.z);
  }

  vec3 environment(vec3 ray) {
    vec3 stars = textureCube(sky, ray).rgb;
    if (region < 0) return stars;
    if (region == 0) return stars * stars * 0.64;
    if (region == 3) {
      float dustLane = exp(-14.0 * abs(ray.y + 0.19 * ray.x)) * cloudNoise(ray * 7.0 + worldOrigin * 0.003);
      return stars * (1.0 - 0.45 * dustLane) + vec3(0.027, 0.009, 0.003) * dustLane;
    }
    if (region == 4) return stars * smoothstep(0.007, 0.055, max(stars.r, max(stars.g, stars.b))) * vec3(0.83, 0.94, 1.21);
    if (region == 1) {
      float cluster = pow(max(0.0, dot(ray, normalize(vec3(-0.8, 0.34, -0.7)))), 9.0);
      vec3 cell = ray * 170.0;
      float star = step(0.986, cloudHash(floor(cell))) * (1.0 - smoothstep(0.06, 0.29, length(fract(cell) - 0.5)));
      return stars + cluster * star * vec3(0.62, 0.78, 1.0);
    }
    vec3 light = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      if (i >= nebulaQuality) break;
      float layer = float(i);
      vec3 p = ray * (3.0 + layer * 1.2) / nebulaSize + worldOrigin / (240.0 + layer * 170.0);
      p += vec3(nebulaTime * 0.008, layer * 4.4, -layer * 3.2);
      float f = cloudNoise(p) * 0.56 + cloudNoise(p * 2.08) * 0.29 + cloudNoise(p * 4.3) * 0.15;
      float cloud = smoothstep(0.38, 0.77, f) * exp(-1.6 * abs(ray.y + 0.65 * ray.x + 0.16 * layer));
      light += cloud * mix(nebulaColor, vec3(0.66, 0.053, 0.25), smoothstep(0.45, 0.8, f)) / (1.0 + layer);
    }
    return stars * 0.75 + light * nebulaDensity * nebulaLight * 0.18;
  }
`
