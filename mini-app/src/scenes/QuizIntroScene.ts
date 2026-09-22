import Phaser from 'phaser';
import { getXP } from '../state/gameState';

export class QuizIntroScene extends Phaser.Scene {
  constructor() {
    super('QuizIntroScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#7b315f');
    this.cameras.main.fadeIn(350, 123, 49, 95);

    const accent = this.add.rectangle(width / 2, height * 0.13, 56, 3, 0xfff8e8).setAlpha(0);
    const title = this.add.text(width / 2, height * 0.25, 'CERCIS', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: '#fff8e8',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = this.add.text(width / 2, height * 0.34, 'A NEW ROUND', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ead8e2'
    }).setOrigin(0.5).setAlpha(0);

    const roundCard = this.add.rectangle(width / 2, height * 0.49, width * 0.78, 155, 0x6e2b54, 0.65)
      .setStrokeStyle(1, 0xb9789a, 0.45)
      .setAlpha(0);

    const count = this.add.text(width / 2, height * 0.455, '10', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);

    const questions = this.add.text(width / 2, height * 0.515, 'QUESTIONS', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ead8e2'
    }).setOrigin(0.5).setAlpha(0);

    const description = this.add.text(width / 2, height * 0.575, 'Answer correctly to collect XP.', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#f2dce8'
    }).setOrigin(0.5).setAlpha(0);

    const xpLabel = this.add.text(width / 2, height * 0.66, 'CURRENT XP', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ead8e2'
    }).setOrigin(0.5).setAlpha(0);

    const xp = this.add.text(width / 2, height * 0.710, String(getXP()), {
      fontFamily: 'monospace',
      fontSize: '25px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);

    const start = this.add.text(width / 2, height * 0.81, 'START ROUND', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#7b315f',
      backgroundColor: '#fff8e8',
      padding: { left: 30, right: 30, top: 13, bottom: 13 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    const introObjects = [accent, title, subtitle, roundCard, count, questions, description, xpLabel, xp, start];

    this.tweens.add({
      targets: [accent, title, subtitle],
      alpha: 1,
      y: '-=8',
      duration: 500,
      stagger: 70,
      ease: 'Cubic.easeOut'
    });

    this.tweens.add({
      targets: [roundCard, count, questions, description, xpLabel, xp],
      alpha: 1,
      y: '-=10',
      duration: 420,
      delay: 260,
      stagger: 45,
      ease: 'Cubic.easeOut'
    });

    this.tweens.add({
      targets: start,
      alpha: 1,
      y: '-=12',
      duration: 400,
      delay: 600,
      ease: 'Back.easeOut'
    });

    start.on('pointerover', () => this.tweens.add({ targets: start, scale: 1.045, duration: 100 }));
    start.on('pointerout', () => this.tweens.add({ targets: start, scale: 1, duration: 100 }));
    start.on('pointerdown', () => {
      start.disableInteractive();
      this.tweens.add({
        targets: start,
        scale: 0.94,
        alpha: 0.75,
        duration: 100,
        onComplete: () => this.scene.start('QuizScene')
      });
    });

    void introObjects;
  }
}
