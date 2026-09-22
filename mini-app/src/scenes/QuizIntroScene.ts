import Phaser from 'phaser';
import { getXP } from '../state/gameState';

export class QuizIntroScene extends Phaser.Scene {
  constructor() { super('QuizIntroScene'); }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#7b315f');

    const title = this.add.text(width / 2, height * 0.25, 'CERCIS', {
      fontFamily: 'monospace', fontSize: '34px', color: '#fff8e8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.34, 'A NEW ROUND', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ead8e2'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.47, '5 questions', {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.55, 'Answer correctly to collect XP.', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#f2dce8'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.61, 'Your XP', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ead8e2'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.66, String(getXP()), {
      fontFamily: 'monospace', fontSize: '25px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const start = this.add.text(width / 2, height * 0.78, 'START ROUND', {
      fontFamily: 'monospace', fontSize: '17px', color: '#7b315f',
      backgroundColor: '#fff8e8', padding: { left: 28, right: 28, top: 13, bottom: 13 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    start.on('pointerover', () => start.setScale(1.04));
    start.on('pointerout', () => start.setScale(1));
    start.on('pointerdown', () => this.scene.start('QuizScene'));

    this.tweens.add({
      targets: title, alpha: { from: 0.45, to: 1 }, duration: 700, ease: 'Sine.easeInOut'
    });
  }
}
