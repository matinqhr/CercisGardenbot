import Phaser from 'phaser';
import { applyHighDpiText } from '../utils/highDpi';

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

    this.load.image('cercis-logo', '/images/Transparent_logo.png');
    this.load.image('cercis-head', '/images/cercis-head.png');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#340a3a');
    this.add.rectangle(width / 2, height / 2, width, height, 0x340a3a);

    const logoWidth = Math.min(width * 0.78, 320);
    const logoHeight = logoWidth * (2 / 3);

    const logo = this.add.image(width / 2, height / 2 - 35, 'cercis-logo')
      .setOrigin(0.5)
      .setDisplaySize(logoWidth, logoHeight);

    this.add.text(width / 2, height / 2 + 105, 'اگر زندگی به شما لیمو داد، با آن شربت آبلیمو درست کنید.', {
      fontFamily: 'SamimMedium',
      fontSize: '12px',
      color: '#f2dce8',
      align: 'center',
      wordWrap: { width: width * 0.82 }
    }).setOrigin(0.5);

    applyHighDpiText(this);

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