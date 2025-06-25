import * as THREE from 'three';

export const MAX_ORBS = 500;
export let orbMesh = null;
export const orbDataArray = new Array(MAX_ORBS).fill(null);
export const orbVelocities = [];
export const orbColors = new Array(MAX_ORBS).fill().map(() => new THREE.Color());

export function createOrbInstancedMesh(scene) {
  const geometry = new THREE.SphereGeometry(1, 12, 12);
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7 });
  orbMesh = new THREE.InstancedMesh(geometry, material, MAX_ORBS);
  orbMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ORBS * 3), 3);
  scene.add(orbMesh);

  for (let i = 0; i < MAX_ORBS; i++) {
    orbMesh.setMatrixAt(i, new THREE.Matrix4());
    orbVelocities.push(new THREE.Vector3());
  }
}

function getOrbStyle(tags = []) {
  const style = { color: 0x00ffff, scale: 1, bounce: 1.0 };
  if (tags.includes('timeline')) { style.color = 0xffcc00; style.scale = 1.1; style.bounce = 1.5; }
  if (tags.includes('budget')) { style.color = 0x00ff88; style.scale = 0.9; style.bounce = 0.7; }
  if (tags.includes('resource')) { style.color = 0xff00ff; style.scale = 1.2; style.bounce = 1.5; }
  if (tags.includes('ai_generated')) { style.color = 0xaa00ff; }
  return style;
}

export function populateOrbsInstanced(termItems) {
  const count = Math.min(termItems.length, MAX_ORBS);
  for (let i = 0; i < count; i++) {
    const term = termItems[i];
    orbDataArray[i] = term;
    const angle = (i / count) * Math.PI * 2;
    const radius = 8;
    const position = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 5);
    const style = getOrbStyle(term.definitions?.[0]?.tags || []);
    const matrix = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z).scale(new THREE.Vector3(style.scale, style.scale, style.scale));
    orbMesh.setMatrixAt(i, matrix);
    orbColors[i].setHex(style.color);
    orbVelocities[i].set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
  }

  orbMesh.count = count;
  orbMesh.instanceMatrix.needsUpdate = true;
  orbMesh.instanceColor.array.set(orbColors.flatMap(c => [c.r, c.g, c.b]));
  orbMesh.instanceColor.needsUpdate = true;
}

export function updateOrbs(deltaTime, camera, mouse, isMouseDown, lastMouseForce) {
  const tempMatrix = new THREE.Matrix4();
  for (let i = 0; i < orbMesh.count; i++) {
    orbMesh.getMatrixAt(i, tempMatrix);
    const position = new THREE.Vector3().setFromMatrixPosition(tempMatrix);
    position.addScaledVector(orbVelocities[i], deltaTime);

    ['x', 'y', 'z'].forEach(axis => {
      if (Math.abs(position[axis]) > 12) {
        orbVelocities[i][axis] *= -1;
        position[axis] = Math.sign(position[axis]) * 12;
      }
    });

    if (isMouseDown) {
      const screenPos = position.clone().project(camera);
      const dist = Math.hypot(mouse.x - screenPos.x, mouse.y - screenPos.y);
      if (dist < 0.2) {
        orbVelocities[i].addScaledVector(lastMouseForce, 0.05 * (1 - dist));
      }
    }

    const newMatrix = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
    orbMesh.setMatrixAt(i, newMatrix);
  }

  orbMesh.instanceMatrix.needsUpdate = true;
}
