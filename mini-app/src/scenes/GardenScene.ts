import Phaser from 'phaser';

export class GardenScene extends Phaser.Scene {
  private startButton!: Phaser.GameObjects.Text;

  constructor() {
    super('GardenScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#6f9b55');

    // Simple MVP garden: deliberately generated with shapes so we can
    // replace them with pixel-art assets after the scene flow is validated.
    this.add.rectangle(width / 2, height / 2, width, height, 0x6f9b55);

    this.add.rectangle(width / 2, height * 0.58, width * 0.72, height * 0.18, 0xc5a879);
    this.add.circle(width * 0.18, height * 0.25, 34, 0x385c3d);
    this.add.circle(width * 0.82, height * 0.28, 42, 0x385c3d);

    for (let i = 0; i < 8; i++) {
      const x = width * (0.12 + (i % 4) * 0.23);
      const y = height * (0.43 + Math.floor(i / 4) * 0.14);
      this.add.circle(x, y, 5, 0xc96a91);
      this.add.circle(x + 7, y + 2, 5, 0xe7a2bb);
    }

    // Bench
    this.add.rectangle(width * 0.22, height * 0.72, 74, 10, 0x704b32);
    this.add.rectangle(width * 0.22, height * 0.75, 7, 24, 0x704b32);
    this.add.rectangle(width * 0.38, height * 0.75, 7, 24, 0x704b32);

    // Old radio — intentionally an independent interactive object.
    const radio = this.add.rectangle(width * 0.72, height * 0.70, 76, 52, 0x3f3b38)
      .setStrokeStyle(3, 0x211f1d)
      .setInteractive({ useHandCursor: true });

    this.add.circle(width * 0.70, height * 0.70, 12, 0xb58c52);
    this.add.circle(width * 0.77, height * 0.70, 6, 0x7b315f);

    this.add.text(width * 0.72, height * 0.79, 'RADIO', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5);

    radio.on('pointerdown', () => {
      this.showMessage('Radio: audio will be connected here.');
    });

    this.startButton = this.add.text(width / 2, height * 0.9, 'START', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#7b315f',
      padding: { left: 30, right: 30, top: 14, bottom: 14 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.startButton.on('pointerdown', () => this.scene.start('QuizScene'));
  }

  private showMessage(message: string): void {
    const { width, height } = this.scale;
    const box = this.add.rectangle(width / 2, height * 0.12, width * 0.86, 46, 0x211f1d, 0.9);
    const text = this.add.text(width / 2, height * 0.12, message, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: width * 0.76 }
    }).setOrigin(0.5);

    this.time.delayedCall(1800, () => {
      box.destroy();
      text.destroy();
    });
  }
}
