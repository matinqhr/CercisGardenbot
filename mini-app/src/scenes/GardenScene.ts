import Phaser from 'phaser';

type GardenObject = {
  kind: 'tree' | 'flower' | 'rock' | 'bench' | 'radio';
  col: number;
  row: number;
};

export class GardenScene extends Phaser.Scene {
  private readonly tileWidth = 48;
  private readonly tileHeight = 24;
  private readonly gridSize = 30;
  private readonly landSize = 26;

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

    const world = this.add.container(0, 0);
    this.drawGarden(world);
    this.drawObjects(world);

    const bounds = this.getWorldBounds();
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

    // Start centered on the garden instead of the world origin.
    this.cameras.main.centerOn(bounds.centerX, bounds.centerY);

    this.createCameraControls();
    this.createHud();
  }

  private drawGarden(world: Phaser.GameObjects.Container): void {
    // The garden is a large square tile territory rendered in 3/4 (isometric)
    // perspective. The player can pan across it on mobile or desktop.
    const originX = 0;
    const originY = 0;

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const p = this.isoToWorld(col, row, originX, originY);
        const insideLand =
          col >= 2 &&
          col < 2 + this.landSize &&
          row >= 2 &&
          row < 2 + this.landSize;

        const diamond = this.add.polygon(
          p.x,
          p.y,
          [
            0, -this.tileHeight / 2,
            this.tileWidth / 2, 0,
            0, this.tileHeight / 2,
            -this.tileWidth / 2, 0
          ],
          insideLand ? 0x6f9b55 : 0x4c6d4a
        );

        diamond.setStrokeStyle(1, insideLand ? 0x5f884c : 0x415d40);
        world.add(diamond);
      }
    }

    // A darker border gives the territory a clear readable silhouette.
    const corners = [
      this.isoToWorld(2, 2),
      this.isoToWorld(2 + this.landSize, 2),
      this.isoToWorld(2 + this.landSize, 2 + this.landSize),
      this.isoToWorld(2, 2 + this.landSize)
    ];

    const border = this.add.graphics();
    border.lineStyle(4, 0x344b35, 1);
    border.beginPath();
    border.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      border.lineTo(corners[i].x, corners[i].y);
    }
    border.closePath();
    border.strokePath();
    world.add(border);
  }

  private drawObjects(world: Phaser.GameObjects.Container): void {
    const objects: GardenObject[] = [
      { kind: 'tree', col: 7, row: 7 },
      { kind: 'tree', col: 19, row: 8 },
      { kind: 'tree', col: 22, row: 18 },
      { kind: 'tree', col: 9, row: 21 },
      { kind: 'flower', col: 13, row: 10 },
      { kind: 'flower', col: 16, row: 14 },
      { kind: 'flower', col: 11, row: 17 },
      { kind: 'rock', col: 20, row: 12 },
      { kind: 'bench', col: 14, row: 20 },
      { kind: 'radio', col: 17, row: 20 }
    ];

    objects
      .sort((a, b) => a.col + a.row - (b.col + b.row))
      .forEach((object) => this.addGardenObject(world, object));
  }

  private addGardenObject(world: Phaser.GameObjects.Container, object: GardenObject): void {
    const p = this.isoToWorld(object.col, object.row);

    if (object.kind === 'tree') {
      const tree = this.add.container(p.x, p.y - 28);

      tree.add(this.add.rectangle(0, 22, 8, 28, 0x70452d));
      tree.add(this.add.rectangle(-4, 22, 4, 24, 0x5a3927));

      tree.add(this.add.rectangle(0, -2, 34, 26, 0x2f6139));
      tree.add(this.add.rectangle(-16, 2, 10, 18, 0x3d7642));
      tree.add(this.add.rectangle(16, 4, 10, 16, 0x3d7642));
      tree.add(this.add.rectangle(-10, -12, 20, 10, 0x43814a));
      tree.add(this.add.rectangle(-5, -18, 10, 7, 0x559153));

      tree.setSize(42, 62);
      tree.setInteractive(new Phaser.Geom.Rectangle(-21, -31, 42, 62), Phaser.Geom.Rectangle.Contains);
      tree.on('pointerdown', () => this.showMessage('Tree'));

      world.add(tree);
      return;
    }

    if (object.kind === 'flower') {
      const flower = this.add.container(p.x, p.y - 5);
      flower.add(this.add.rectangle(0, 2, 3, 12, 0x4d783f));
      flower.add(this.add.rectangle(-5, -5, 5, 5, 0xd67a9d));
      flower.add(this.add.rectangle(5, -5, 5, 5, 0xd67a9d));
      flower.add(this.add.rectangle(0, -10, 5, 5, 0xf0b2c8));
      flower.add(this.add.rectangle(0, -5, 4, 4, 0xe0a24d));
      world.add(flower);
      return;
    }

    if (object.kind === 'rock') {
      const rock = this.add.container(p.x, p.y - 6);
      rock.add(this.add.rectangle(0, 0, 18, 10, 0x77716a));
      rock.add(this.add.rectangle(-5, -5, 10, 8, 0x8f887d));
      rock.add(this.add.rectangle(5, 1, 7, 6, 0x625d57));
      world.add(rock);
      return;
    }

    if (object.kind === 'bench') {
      const bench = this.add.container(p.x, p.y - 8);
      bench.add(this.add.rectangle(0, -5, 34, 6, 0x704b32));
      bench.add(this.add.rectangle(0, 4, 34, 5, 0x5d3e2b));
      bench.add(this.add.rectangle(-12, 12, 5, 12, 0x5d3e2b));
      bench.add(this.add.rectangle(12, 12, 5, 12, 0x5d3e2b));
      world.add(bench);
      return;
    }

    const radio = this.add.container(p.x, p.y - 14);
    const body = this.add.rectangle(0, 0, 38, 26, 0x3f3b38)
      .setStrokeStyle(2, 0x211f1d)
      .setInteractive({ useHandCursor: true });

    radio.add(body);
    radio.add(this.add.rectangle(-9, 0, 12, 12, 0xb58c52));
    radio.add(this.add.rectangle(10, -4, 8, 3, 0x7b315f));
    radio.add(this.add.rectangle(10, 3, 8, 3, 0x7b315f));
    radio.add(this.add.rectangle(10, 10, 8, 3, 0x7b315f));

    body.on('pointerdown', () => this.showMessage('Radio: audio will be connected here.'));
    world.add(radio);
  }

  private createCameraControls(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver?.length) {
        return;
      }

      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.cameraStartX = this.cameras.main.scrollX;
      this.cameraStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !pointer.isDown) {
        return;
      }

      this.cameras.main.scrollX = this.cameraStartX - (pointer.x - this.dragStartX);
      this.cameras.main.scrollY = this.cameraStartY - (pointer.y - this.dragStartY);
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

  private isoToWorld(col: number, row: number, originX = 0, originY = 0): { x: number; y: number } {
    return {
      x: originX + (col - row) * (this.tileWidth / 2),
      y: originY + (col + row) * (this.tileHeight / 2)
    };
  }

  private getWorldBounds(): { x: number; y: number; width: number; height: number; centerX: number; centerY: number } {
    const points = [
      this.isoToWorld(0, 0),
      this.isoToWorld(this.gridSize, 0),
      this.isoToWorld(this.gridSize, this.gridSize),
      this.isoToWorld(0, this.gridSize)
    ];

    const minX = Math.min(...points.map((p) => p.x)) - 120;
    const maxX = Math.max(...points.map((p) => p.x)) + 120;
    const minY = Math.min(...points.map((p) => p.y)) - 120;
    const maxY = Math.max(...points.map((p) => p.y)) + 120;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
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
