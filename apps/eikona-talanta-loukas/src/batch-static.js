import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake only fixed scenery. Animated objects, instancing and shader surfaces
// retain their own transforms and update paths.
export function batchStatic(scene, exclude = new Set()) {
  scene.updateMatrixWorld(true);
  const batches = new Map(), originals = new Set();
  scene.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || exclude.has(object) || !object.material.isMeshStandardMaterial) return;
    const key = object.material.uuid + ':' + object.castShadow + ':' + object.receiveShadow;
    if (!batches.has(key)) batches.set(key, []);
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    batches.get(key).push({ object, geometry }); originals.add(object.geometry);
  });
  for (const entries of batches.values()) {
    const source = entries[0].object;
    const merged = new THREE.Mesh(mergeGeometries(entries.map(e => e.geometry)), source.material);
    merged.castShadow = source.castShadow; merged.receiveShadow = source.receiveShadow; scene.add(merged);
    for (const { object, geometry } of entries) { object.removeFromParent(); geometry.dispose(); }
  }
  originals.forEach(geometry => geometry.dispose());
}
