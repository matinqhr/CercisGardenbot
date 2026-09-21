import Phaser from 'phaser';

export class QuizScene extends Phaser.Scene {
  constructor() {
    super('QuizScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#f4efe8');

    this.add.text(width / 2, height * 0.12, 'QUESTION 01/01', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#7b315f'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.25, 'Which part of a plant usually absorbs\nwater and minerals from the soil?', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#211f1d',
      align: 'center',
      wordWrap: { width: width * 0.84 }
    }).setOrigin(0.5);

    const options = ['Leaf', 'Root', 'Flower'];

    options.forEach((option, index) => {
      const y = height * (0.48 + index * 0.12);
      const button = this.add.text(width / 2, y, option, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#211f1d',
        backgroundColor: '#ffffff',
        padding: { left: 34, right: 34, top: 14, bottom: 14 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => {
        const correct = option === 'Root';
        button.setStyle({ backgroundColor: correct ? '#d8ead0' : '#ead4d4' });
        this.add.text(width / 2, height * 0.9, correct ? 'CORRECT ✓' : 'TRY AGAIN', {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#7b315f'
        }).setOrigin(0.5);
      });
    });
  }
}
