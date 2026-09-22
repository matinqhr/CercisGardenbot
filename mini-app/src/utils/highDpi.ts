import Phaser from 'phaser';

const MAX_TEXT_DPR = 2;

export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_TEXT_DPR);
}

export function applyHighDpiText(scene: Phaser.Scene): void {
  const resolution = getDevicePixelRatio();

  scene.children.list.forEach((child) => {
    if (child instanceof Phaser.GameObjects.Text) {
      child.setResolution(resolution);
    }
  });
}
