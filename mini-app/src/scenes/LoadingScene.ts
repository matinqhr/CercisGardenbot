import Phaser from 'phaser';

export class LoadingScene extends Phaser.Scene {
  constructor() {
    super('LoadingScene');
  }

  preload(): void {
    const meadowSheetUrl = new URL(
      '../../assets/sheets/MeadowSpriteSheet.png',
      import.meta.url
    ).href;

    this.load.spritesheet('meadow', meadowSheetUrl, {
      frameWidth: 32,
      frameHeight: 32,
      spacing: 0,
      margin: 0
    });

    this.load.image('cercis-logo', '/images/cercis-logo.png');
    this.load.image('cercis-head', '/images/cercis-head.png');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#7b315f');
    this.add.rectangle(width / 2, height / 2, width, height, 0x7b315f);

    const logo = this.add.image(width / 2, height / 2 - 18, 'cercis-logo')
      .setOrigin(0.5)
      .setDisplaySize(Math.min(width * 0.72, 330), Math.min(width * 0.72, 330) * 0.28);

    this.add.text(width / 2, height / 2 + 70, 'آرشیو — امن', {
      fontFamily: 'Samim',
      fontSize: '13px',
      fontStyle: '500',
      color: '#f2dce8'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: logo,
      alpha: 0.35,
      duration: 650,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.scene.start('QuizIntroScene')
    });
  }
}