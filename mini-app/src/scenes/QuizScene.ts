import Phaser from 'phaser';
import { QUESTION_BANK, Question } from '../data/questionBank';
import { addXP, getXP } from '../state/gameState';

const ROUND_SIZE = 10;

export class QuizScene extends Phaser.Scene {
  private questions: Question[] = [];
  private currentIndex = 0;
  private selected: number | null = null;
  private answered = false;
  private xp = 0;

  private questionNumberText?: Phaser.GameObjects.Text;
  private xpText?: Phaser.GameObjects.Text;
  private questionText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private submitButton?: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Text[] = [];
  private optionCards: Phaser.GameObjects.Graphics[] = [];
  private progressObjects: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('QuizScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#f4efe8');
    this.cameras.main.fadeIn(260, 0, 0, 0);

    this.xp = getXP();
    this.questions = this.pickRound();

    this.createHeader();
    this.renderQuestion();
  }

  private pickRound(): Question[] {
    return Phaser.Utils.Array.Shuffle([...QUESTION_BANK]).slice(
      0,
      Math.min(ROUND_SIZE, QUESTION_BANK.length)
    );
  }

  private createHeader(): void {
    const { width } = this.scale;

    this.questionNumberText = this.add.text(18, 18, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#7b315f',
      fontStyle: 'bold'
    });

    this.xpText = this.add.text(width - 18, 18, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#7b315f',
      fontStyle: 'bold'
    }).setOrigin(1, 0);

    this.scale.on('resize', () => {
      this.xpText?.setPosition(this.scale.width - 18, 18);
    });
  }

  private renderQuestion(): void {
    this.clearQuestionUI();

    this.selected = null;
    this.answered = false;

    const question = this.questions[this.currentIndex];
    const { width, height } = this.scale;

    this.questionNumberText?.setText(
      `QUESTION ${String(this.currentIndex + 1).padStart(2, '0')}/${String(this.questions.length).padStart(2, '0')}`
    );
    this.xpText?.setText(`XP ${this.xp}`);

    const progressWidth = Math.min(width * 0.32, 150);
    const progressBg = this.add.rectangle(
      width / 2,
      25,
      progressWidth,
      3,
      0xdcced5
    ).setOrigin(0.5);

    const progress = this.add.rectangle(
      width / 2 - progressWidth / 2,
      25,
      progressWidth * ((this.currentIndex + 1) / this.questions.length),
      3,
      0x7b315f
    ).setOrigin(0, 0.5);

    this.progressObjects.push(progressBg, progress);

    this.questionText = this.add.text(width / 2, height * 0.22, question.text, {
      fontFamily: 'sans-serif',
      fontSize: '21px',
      color: '#211f1d',
      align: 'center',
      wordWrap: { width: width * 0.84 },
      lineSpacing: 7
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.questionText,
      alpha: 1,
      y: height * 0.235,
      duration: 360,
      ease: 'Cubic.easeOut'
    });

    question.options.forEach((option, index) => {
      const y = height * (0.43 + index * 0.13);
      const card = this.add.graphics();
      card.fillStyle(0xffffff, 1);
      card.lineStyle(1, 0xe2d8d0, 1);
      card.fillRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 10);
      card.strokeRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 10);
      card.setAlpha(0);
      this.optionCards.push(card);

      const button = this.add.text(width / 2, y, option, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#211f1d',
        align: 'center',
        wordWrap: { width: width * 0.72 }
      }).setOrigin(0.5).setInteractive(
        new Phaser.Geom.Rectangle(-width * 0.42, -31, width * 0.84, 62),
        Phaser.Geom.Rectangle.Contains
      ).setAlpha(0);

      button.on('pointerover', () => {
        if (!this.answered && this.selected !== index) {
          this.tweens.add({ targets: button, scale: 1.015, duration: 90 });
        }
      });

      button.on('pointerout', () => {
        if (!this.answered && this.selected !== index) {
          this.tweens.add({ targets: button, scale: 1, duration: 90 });
        }
      });

      button.on('pointerdown', () => this.toggleOption(index));
      this.optionButtons.push(button);

      this.tweens.add({
        targets: [card, button],
        alpha: 1,
        y: '-=10',
        duration: 280,
        delay: 100 + index * 70,
        ease: 'Cubic.easeOut'
      });
    });

    this.submitButton = this.add.text(width / 2, height * 0.82, 'CHECK', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#fff8e8',
      backgroundColor: '#7b315f',
      padding: { left: 30, right: 30, top: 11, bottom: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    this.submitButton.on('pointerover', () => {
      if (!this.answered) this.tweens.add({ targets: this.submitButton, scale: 1.04, duration: 100 });
    });
    this.submitButton.on('pointerout', () => {
      if (!this.answered) this.tweens.add({ targets: this.submitButton, scale: 1, duration: 100 });
    });
    this.submitButton.on('pointerdown', () => this.checkAnswer());

    this.tweens.add({
      targets: this.submitButton,
      alpha: 1,
      y: height * 0.80,
      duration: 300,
      delay: 300,
      ease: 'Cubic.easeOut'
    });

    this.feedbackText = this.add.text(width / 2, height * 0.91, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#7b315f',
      align: 'center',
      wordWrap: { width: width * 0.86 }
    }).setOrigin(0.5).setAlpha(0);
  }

  private toggleOption(index: number): void {
    if (this.answered) return;

    this.selected = index;

    this.optionButtons.forEach((button, i) => {
      const active = this.selected === i;
      button.setStyle({ color: active ? '#7b315f' : '#211f1d' });

      this.tweens.add({
        targets: button,
        scale: active ? 1.025 : 1,
        duration: 120,
        ease: 'Back.easeOut'
      });
    });

    this.optionCards.forEach((card, i) => {
      if (!(card instanceof Phaser.GameObjects.Graphics)) return;
      if (i >= this.optionButtons.length) return;

      const active = i === index;
      card.clear();
      card.fillStyle(active ? 0xead8e2 : 0xffffff, 1);
      card.lineStyle(1, active ? 0x7b315f : 0xe2d8d0, 1);
      const { width, height } = this.scale;
      const y = height * (0.43 + i * 0.13);
      card.fillRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 10);
      card.strokeRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 10);
    });
  }

  private checkAnswer(): void {
    if (this.answered || !this.submitButton) return;

    const question = this.questions[this.currentIndex];
    const isCorrect =
      this.selected !== null && question.correctAnswers.includes(this.selected);

    this.answered = true;

    if (isCorrect) {
      this.xp = addXP(question.xp);
      this.feedbackText?.setText(`CORRECT  +${question.xp} XP`).setColor('#4f7651');
      this.animateXPGain(question.xp);
    } else {
      this.feedbackText
        ?.setText(
          `NOT QUITE  •  +0 XP\\nCorrect: ${question.correctAnswers
            .map((i) => question.options[i])
            .join(' + ')}`
        )
        .setColor('#9b4a4a');
    }

    this.tweens.add({
      targets: this.feedbackText,
      alpha: 1,
      y: this.scale.height * 0.895,
      duration: 240,
      ease: 'Cubic.easeOut'
    });

    this.optionButtons.forEach((button, i) => {
      const correct = question.correctAnswers.includes(i);
      const selected = this.selected === i;
      button.setStyle({
        color: correct ? '#355b39' : selected ? '#8b3d3d' : '#211f1d'
      });
    });

    this.submitButton.setText(
      this.currentIndex + 1 < this.questions.length ? 'NEXT' : 'ROUND COMPLETE'
    );
    this.submitButton.removeAllListeners('pointerdown');
    this.submitButton.setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: this.submitButton,
      scale: { from: 0.94, to: 1 },
      duration: 220,
      ease: 'Back.easeOut'
    });

    this.submitButton.on('pointerdown', () => {
      if (this.currentIndex + 1 < this.questions.length) {
        this.transitionToNextQuestion();
      } else {
        this.showRoundComplete();
      }
    });
  }

  private transitionToNextQuestion(): void {
    if (!this.submitButton) return;

    this.submitButton.disableInteractive();

    const movingObjects: Phaser.GameObjects.GameObject[] = [
      ...this.optionButtons,
      ...this.optionCards,
      ...this.progressObjects,
      ...(this.questionText ? [this.questionText] : []),
      ...(this.feedbackText ? [this.feedbackText] : [])
    ];

    this.tweens.add({
      targets: movingObjects,
      x: '-=45',
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeIn'
    });

    this.time.delayedCall(190, () => {
      this.currentIndex += 1;
      this.renderQuestion();
    });
  }

  private animateXPGain(amount: number): void {
    const { width } = this.scale;

    const floating = this.add.text(width * 0.72, 48, `+${amount} XP`, {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#7b315f',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: floating,
      y: 18,
      x: width - 35,
      scale: { from: 1.2, to: 0.8 },
      alpha: { from: 1, to: 0 },
      duration: 650,
      ease: 'Cubic.easeIn',
      onComplete: () => floating.destroy()
    });

    if (this.xpText) {
      this.tweens.add({
        targets: this.xpText,
        scale: { from: 1.35, to: 1 },
        duration: 380,
        ease: 'Back.easeOut'
      });
    }
  }

  private showRoundComplete(): void {
    this.clearQuestionUI();

    const { width, height } = this.scale;
    this.questionNumberText?.setText('ROUND COMPLETE');
    this.xpText?.setText(`XP ${this.xp}`);

    const title = this.add.text(width / 2, height * 0.35, 'ROUND COMPLETE', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#211f1d'
    }).setOrigin(0.5).setAlpha(0);

    const total = this.add.text(width / 2, height * 0.47, `TOTAL XP  ${this.xp}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#7b315f'
    }).setOrigin(0.5).setAlpha(0);

    const next = this.add.text(width / 2, height * 0.65, 'NEW ROUND', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#fff8e8',
      backgroundColor: '#7b315f',
      padding: { left: 30, right: 30, top: 11, bottom: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    this.tweens.add({ targets: [title, total], alpha: 1, y: '-=10', duration: 350, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: next, alpha: 1, y: '-=10', duration: 300, delay: 220, ease: 'Back.easeOut' });

    next.on('pointerover', () => this.tweens.add({ targets: next, scale: 1.04, duration: 100 }));
    next.on('pointerout', () => this.tweens.add({ targets: next, scale: 1, duration: 100 }));
    next.on('pointerdown', () => this.scene.restart());
  }

  private clearQuestionUI(): void {
    this.questionText?.destroy();
    this.questionText = undefined;

    this.feedbackText?.destroy();
    this.feedbackText = undefined;

    this.submitButton?.destroy();
    this.submitButton = undefined;

    this.optionButtons.forEach((button) => button.destroy());
    this.optionButtons = [];

    this.optionCards.forEach((card) => card.destroy());
    this.optionCards = [];
    this.progressObjects.forEach((bar) => bar.destroy());
    this.progressObjects = [];
  }
}
