import Phaser from 'phaser';

export class QuizIntroScene extends Phaser.Scene {
  constructor() {
    super('QuizIntroScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#340a3a');

    const pattern = this.add.tileSprite(0, 0, width, height, 'cercis-head')
      .setOrigin(0)
      .setAlpha(0.12);
    pattern.setTileScale(0.24, 0.24);

    this.tweens.add({
      targets: pattern,
      tilePositionX: pattern.tilePositionX + 260,
      tilePositionY: pattern.tilePositionY + 130,
      duration: 10000,
      repeat: -1,
      ease: 'Linear'
    });

    const logoWidth = Math.min(width * 0.78, 320);
    const logoHeight = logoWidth * (2 / 3);

    const logo = this.add.image(width / 2, height * 0.30, 'cercis-logo')
      .setOrigin(0.5)
      .setDisplaySize(logoWidth, logoHeight);

    const start = this.add.text(width / 2, height * 0.62, 'پَرسه در پُرسه', {
      fontFamily: 'SamimBold',
      fontSize: '18px',
      color: '#7b315f',
      backgroundColor: '#fff8e8',
      padding: { left: 38, right: 38, top: 13, bottom: 13 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

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

    void logo;
  }
}