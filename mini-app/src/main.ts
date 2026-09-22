import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoadingScene } from './scenes/LoadingScene';
import { GardenScene } from './scenes/GardenScene';
import { QuizScene } from './scenes/QuizScene';
import { QuizIntroScene } from './scenes/QuizIntroScene';
import './styles.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#340a3a',
  antialias: true,
  pixelArt: false,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844
  },
  scene: [BootScene, LoadingScene, QuizIntroScene, QuizScene]
};

async function startGame(): Promise<void> {
  await Promise.all([
    document.fonts.load('400 16px "Samim"'),
    document.fonts.load('500 16px "SamimMedium"'),
    document.fonts.load('700 16px "SamimBold"')
  ]);

  new Phaser.Game(config);
}

void startGame();
