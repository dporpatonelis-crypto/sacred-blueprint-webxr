import * as THREE from 'three';

export function panorama(texture, rotation = .16) {
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.ShaderMaterial({
    uniforms: { painting: { value: texture } },
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 paintingDirection;
      void main() {
        paintingDirection = position;
        vec3 viewDirection = mat3(viewMatrix) * mat3(modelMatrix) * position;
        gl_Position = projectionMatrix * vec4(viewDirection, 1.);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D painting;
      varying vec3 paintingDirection;
      void main() {
        vec3 d = normalize(paintingDirection);
        float u = .5 + atan(d.z, d.x) * .1591549431;
        float v = .5 + asin(clamp(d.y, -1., 1.)) * .3183098862;
        float seam = min(u, 1. - u);
        float blend = .5 * (1. - smoothstep(0., .025, seam));
        vec3 nearEdge = texture2D(painting, vec2(u, v)).rgb;
        vec3 oppositeEdge = texture2D(painting, vec2(1. - u, v)).rgb;
        gl_FragColor = vec4(mix(nearEdge, oppositeEdge, blend), 1.);
        #include <colorspace_fragment>
      }
    `
  });
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(65, 48, 32), material);
  backdrop.rotation.y = rotation;
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1000;
  return backdrop;
}
