import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoadingScene } from './scenes/LoadingScene';
import { GardenScene } from './scenes/GardenScene';
import { QuizScene } from './scenes/QuizScene';
import './styles.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#7b315f',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844
  },
  scene: [BootScene, LoadingScene, GardenScene, QuizScene]
};

new Phaser.Game(config);
