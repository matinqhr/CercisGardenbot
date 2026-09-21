import Phaser from 'phaser';

export class LoadingScene extends Phaser.Scene {
  constructor() {
    super('LoadingScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x7b315f);

    const logo = this.add.text(width / 2, height / 2 - 20, 'CERCIS', {
      fontFamily: 'monospace',
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 28, 'ARCHIVE—SAFE', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f2dce8'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: logo,
      alpha: 0.35,
      duration: 650,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.scene.start('GardenScene')
    });
  }
}
