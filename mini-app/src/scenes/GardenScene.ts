import Phaser from 'phaser';

type GardenObjectKind = 'tree' | 'bush' | 'flower' | 'rock' | 'tuft' | 'log';

type GardenObject = {
  kind: GardenObjectKind;
  col: number;
  row: number;
  frame: number;
};

const GARDEN_OBJECTS: GardenObject[] = [
  { kind: 'tree', col: 7, row: 7, frame: 39 },
  { kind: 'tree', col: 19, row: 8, frame: 48 },
  { kind: 'tree', col: 22, row: 18, frame: 48 },
  { kind: 'bush', col: 16, row: 14, frame: 35 },
  { kind: 'bush', col: 11, row: 17, frame: 36 },
  { kind: 'flower', col: 13, row: 10, frame: 26 },
  { kind: 'flower', col: 15, row: 11, frame: 27 },
  { kind: 'flower', col: 11, row: 15, frame: 28 },
  { kind: 'rock', col: 20, row: 12, frame: 33 },
  { kind: 'rock', col: 21, row: 13, frame: 34 },
  { kind: 'tuft', col: 9, row: 18, frame: 37 },
  { kind: 'tuft', col: 18, row: 20, frame: 38 },
  { kind: 'log', col: 5, row: 23, frame: 29 }
];

export class GardenScene extends Phaser.Scene {
  private readonly tileWidth = 32;
  private readonly tileHeight = 16;
  private readonly gridSize = 30;
  private readonly landSize = 26;
  private readonly landOffset = 2;
  private readonly tileKey = 'meadow';

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  constructor() {
    super('GardenScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#7b315f');
    this.cameras.main.setZoom(1.5);

    const world = this.add.container(0, 0);
    const objectMap = new Map(GARDEN_OBJECTS.map((object) => [this.cellKey(object.col, object.row), object]));

    this.drawGarden(world, objectMap);

    const bounds = this.getWorldBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.centerOn(bounds.centerX, bounds.centerY);

    this.createCameraControls();
    this.createHud();
  }

  private drawGarden(
    world: Phaser.GameObjects.Container,
    objectMap: Map<string, GardenObject>
  ): void {
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const p = this.isoToWorld(col, row);
        const insideLand =
          col >= this.landOffset &&
          col < this.landOffset + this.landSize &&
          row >= this.landOffset &&
          row < this.landOffset + this.landSize;

        const object = objectMap.get(this.cellKey(col, row));
        const frame = object?.frame ?? this.getTerrainFrame(insideLand, col, row);

        const tile = this.add.image(p.x, p.y, this.tileKey, frame)
          .setOrigin(0.5, 1)
          .setDepth(row + col);

        world.add(tile);

        if (object) {
          tile.setInteractive({ useHandCursor: true });
          tile.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            pointer.event.stopPropagation();
            this.showMessage(this.objectLabel(object.kind));
          });
        }
      }
    }
  }

  private getTerrainFrame(insideLand: boolean, col: number, row: number): number {
    if (insideLand) {
      // First row of the supplied sheet: eight compatible grass variants.
      return 8 + ((col * 3 + row * 5) % 8);
    }

    // Lower rows contain the dirt/soil variants used to frame the plot.
    return 49 + ((col + row) % 7);
  }

  private getWorldBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } {
    const points = [
      this.isoToWorld(0, 0),
      this.isoToWorld(this.gridSize, 0),
      this.isoToWorld(this.gridSize, this.gridSize),
      this.isoToWorld(0, this.gridSize)
    ];

    const minX = Math.min(...points.map((p) => p.x)) - 48;
    const maxX = Math.max(...points.map((p) => p.x)) + 48;
    const minY = Math.min(...points.map((p) => p.y)) - 48;
    const maxY = Math.max(...points.map((p) => p.y)) + 16;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  private createCameraControls(): void {
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver?.length) {
          return;
        }

        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = this.cameras.main.scrollX;
        this.cameraStartY = this.cameras.main.scrollY;
      }
    );

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !pointer.isDown) {
        return;
      }

      this.cameras.main.scrollX = this.cameraStartX - (pointer.x - this.dragStartX) / this.cameras.main.zoom;
      this.cameras.main.scrollY = this.cameraStartY - (pointer.y - this.dragStartY) / this.cameras.main.zoom;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  private createHud(): void {
    const { width } = this.scale;

    const title = this.add.text(18, 18, 'CERCIS GARDEN', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#fff8e8',
      backgroundColor: '#211f1d',
      padding: { left: 8, right: 8, top: 6, bottom: 6 }
    }).setScrollFactor(0).setDepth(100);

    title.setData('ui', true);

    const hint = this.add.text(width - 18, 18, 'DRAG TO EXPLORE', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#fff8e8',
      backgroundColor: '#211f1d',
      padding: { left: 6, right: 6, top: 5, bottom: 5 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    hint.setData('ui', true);

    const startButton = this.add.text(width / 2, this.scale.height - 38, 'START', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#fff8e8',
      backgroundColor: '#7b315f',
      padding: { left: 26, right: 26, top: 10, bottom: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });

    startButton.setData('ui', true);
    startButton.on('pointerdown', () => this.scene.start('QuizScene'));

    this.scale.on('resize', () => {
      startButton.setPosition(this.scale.width / 2, this.scale.height - 38);
      hint.setPosition(this.scale.width - 18, 18);
    });
  }

  private isoToWorld(col: number, row: number): { x: number; y: number } {
    return {
      x: (col - row) * (this.tileWidth / 2),
      y: (col + row) * (this.tileHeight / 2)
    };
  }

  private cellKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  private objectLabel(kind: GardenObjectKind): string {
    switch (kind) {
      case 'tree':
        return 'Tree';
      case 'bush':
        return 'Bush';
      case 'flower':
        return 'Flowers';
      case 'rock':
        return 'Rock';
      case 'tuft':
        return 'Grass';
      case 'log':
        return 'Old log';
    }
  }

  private showMessage(message: string): void {
    const { width } = this.scale;

    const box = this.add.rectangle(width / 2, 86, width * 0.78, 42, 0x211f1d, 0.94)
      .setScrollFactor(0)
      .setDepth(110);

    const text = this.add.text(width / 2, 86, message, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: width * 0.68 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(111);

    this.time.delayedCall(1600, () => {
      box.destroy();
      text.destroy();
    });
  }
}
