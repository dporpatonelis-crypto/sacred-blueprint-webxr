import * as THREE from 'three';
export function panelTexture(text, { dark = false, selected = false, solved = false, small = false, square = false, paragraph = false, aspect = 3 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = square ? 768 : Math.round(768 / aspect);
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.fillStyle = dark ? '#244d41' : solved ? '#d8debd' : '#f7e8c9';
  ctx.beginPath();
  if (square) ctx.arc(w / 2, h / 2, w / 2 - 12, 0, Math.PI * 2); else ctx.roundRect(6, 6, w - 12, h - 12, 32);
  ctx.fill();
  ctx.strokeStyle = selected ? '#ffdf8c' : dark ? '#ccaf70' : '#c6a265'; ctx.lineWidth = selected ? 13 : 5; ctx.stroke();
  ctx.fillStyle = dark ? '#f7edcf' : '#274237';
  let fontSize = paragraph ? 34 : square ? 280 : Math.round(h * (small ? 0.30 : 0.27));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = text.split(' '); let lines;
  do {
    ctx.font = `${selected ? 650 : 550} ${fontSize}px system-ui, sans-serif`;
    lines=[];let line='';
    for(const word of words){const next=line?`${line} ${word}`:word;if(line&&ctx.measureText(next).width>w-74){lines.push(line);line=word;}else line=next;}
    lines.push(line);
    if(lines.length*fontSize*1.25<=h-28 || fontSize<=15)break;
    fontSize-=2;
  } while(true);
  lines.forEach((value,i)=>ctx.fillText(value,w/2,h/2+(i-(lines.length-1)/2)*fontSize*1.25));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4; return texture;
}
export function setText(mesh, text, options) {
  mesh.material.map?.dispose(); mesh.material.map = panelTexture(text, { ...options, aspect: mesh.userData.panelAspect }); mesh.material.needsUpdate = true;
}
export function panel(text, width, height, action, options = {}) {
  const result = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: panelTexture(text, { ...options, aspect: width / height }), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  result.userData.panelAspect = width / height;
  if (action) result.userData.action = action;
  return result;
}
