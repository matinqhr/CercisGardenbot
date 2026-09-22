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
  private roundXP = 0;

  private questionNumberText?: Phaser.GameObjects.Text;
  private xpText?: Phaser.GameObjects.Text;
  private questionText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private questionFrame?: Phaser.GameObjects.Graphics;
  private submitButton?: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Text[] = [];
  private optionCards: Phaser.GameObjects.Graphics[] = [];
  private optionNumbers: Phaser.GameObjects.Text[] = [];
  private progressObjects: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('QuizScene');
  }

  preload(): void {
    this.load.audio('correct-answer', '/audio/correct.mp3');
    this.load.audio('wrong-answer', '/audio/wrong.mp3');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#f4efe8');
    this.cameras.main.fadeIn(260, 0, 0, 0);

    this.xp = getXP();
    this.roundXP = 0;
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

    // Cercis archive-style question card.
    this.questionFrame = this.add.graphics().setAlpha(0);
    this.drawQuestionFrame(this.questionFrame, width, height);

    const archiveLabel = this.add.text(width * 0.11, height * 0.145, 'ARCHIVE // FIELD TEST', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#9b8490',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setAlpha(0);

    const mark = this.add.text(width * 0.89, height * 0.145, 'CERCIS', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#9b8490',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setAlpha(0);

    this.questionMetaTexts = [archiveLabel, mark];

    this.questionText = this.add.text(width / 2, height * 0.235, question.text, {
      fontFamily: 'sans-serif',
      fontSize: '21px',
      color: '#211f1d',
      align: 'center',
      wordWrap: { width: width * 0.76 },
      lineSpacing: 7
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: [this.questionFrame, archiveLabel, mark, this.questionText],
      alpha: 1,
      y: '-=8',
      duration: 360,
      ease: 'Cubic.easeOut'
    });

    question.options.forEach((option, index) => {
      const y = height * (0.43 + index * 0.13);
      const card = this.add.graphics();
      this.drawOptionCard(card, width, height, index, false, false);
      card.setAlpha(0);
      this.optionCards.push(card);

      const number = this.add.text(width * 0.12, y, String(index + 1).padStart(2, '0'), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9b8490',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5).setAlpha(0);
      this.optionNumbers.push(number);

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
          this.drawOptionCard(card, width, height, index, false, true);
        }
      });

      button.on('pointerout', () => {
        if (!this.answered && this.selected !== index) {
          this.tweens.add({ targets: button, scale: 1, duration: 90 });
          this.drawOptionCard(card, width, height, index, false, false);
        }
      });

      button.on('pointerdown', () => this.toggleOption(index));
      this.optionButtons.push(button);

      this.tweens.add({
        targets: [card, number, button],
        alpha: 1,
        duration: 280,
        delay: 100 + index * 70,
        ease: 'Cubic.easeOut'
      });
    });

    this.submitButton = this.add.text(width / 2, height * 0.82, 'CHECK', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#fff8e8',
      backgroundColor: '#b9aeb4',
      padding: { left: 30, right: 30, top: 11, bottom: 11 }
    }).setOrigin(0.5).setAlpha(0);

    this.submitButton.setInteractive({ useHandCursor: true });

    this.submitButton.on('pointerdown', () => {
      if (this.selected !== null && !this.answered) {
        this.checkAnswer();
      }
    });

    this.feedbackText = this.add.text(width / 2, height * 0.91, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#7b315f',
      align: 'center',
      wordWrap: { width: width * 0.86 }
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.submitButton,
      alpha: 1,
      y: height * 0.80,
      duration: 300,
      delay: 300,
      ease: 'Cubic.easeOut'
    });
  }

  private drawQuestionFrame(
    frame: Phaser.GameObjects.Graphics,
    width: number,
    height: number
  ): void {
    const left = width * 0.07;
    const top = height * 0.15;
    const boxWidth = width * 0.86;
    const boxHeight = height * 0.20;

    frame.clear();
    frame.fillStyle(0xfaf7f2, 1);
    frame.lineStyle(1, 0xd9cbd2, 1);
    frame.fillRoundedRect(left, top, boxWidth, boxHeight, 14);
    frame.strokeRoundedRect(left, top, boxWidth, boxHeight, 14);

    frame.lineStyle(2, 0x7b315f, 0.7);
    frame.beginPath();
    frame.moveTo(left + 14, top + 14);
    frame.lineTo(left + 30, top + 14);
    frame.moveTo(left + 14, top + 14);
    frame.lineTo(left + 14, top + 30);
    frame.moveTo(left + boxWidth - 14, top + boxHeight - 14);
    frame.lineTo(left + boxWidth - 30, top + boxHeight - 14);
    frame.moveTo(left + boxWidth - 14, top + boxHeight - 14);
    frame.lineTo(left + boxWidth - 14, top + boxHeight - 30);
    frame.strokePath();
  }

  private drawOptionCard(
    card: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    index: number,
    selected: boolean,
    hovered: boolean
  ): void {
    const y = height * (0.43 + index * 0.13);
    const left = width * 0.08;
    const boxWidth = width * 0.84;
    const fill = selected ? 0xead8e2 : hovered ? 0xfaf7f2 : 0xffffff;
    const stroke = selected ? 0x7b315f : hovered ? 0xc7b2bd : 0xe2d8d0;

    card.clear();
    card.fillStyle(fill, 1);
    card.lineStyle(selected ? 2 : 1, stroke, 1);
    card.fillRoundedRect(left, y - 31, boxWidth, 62, 11);
    card.strokeRoundedRect(left, y - 31, boxWidth, 62, 11);

    card.fillStyle(selected ? 0x7b315f : 0xcdbec6, 1);
    card.fillRect(left + 12, y - 9, 3, 18);
  }

  private toggleOption(index: number): void {
    if (this.answered) return;

    this.selected = index;

    if (this.submitButton) {
      this.submitButton.setStyle({ backgroundColor: '#7b315f' });
    }

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
      this.drawOptionCard(
        card,
        this.scale.width,
        this.scale.height,
        i,
        i === index,
        false
      );
    });

    this.optionNumbers.forEach((number, i) => {
      number.setStyle({ color: i === index ? '#7b315f' : '#9b8490' });
    });
  }

  private checkAnswer(): void {
    if (this.answered || this.selected === null || !this.submitButton) return;

    const question = this.questions[this.currentIndex];
    const isCorrect = question.correctAnswers.includes(this.selected);

    this.answered = true;

    if (isCorrect) {
      this.xp = addXP(question.xp);
      this.roundXP += question.xp;
      this.xpText?.setText(`XP ${this.xp}`);
      this.feedbackText?.setText(`CORRECT  +${question.xp} XP`).setColor('#4f7651');
      this.playAnswerSound('correct-answer');
      this.animateCorrectFeedback(this.selected);
      this.animateXPGain(question.xp, this.selected);
    } else {
      this.feedbackText
        ?.setText(
          `NOT QUITE  •  +0 XP\\nCorrect: ${question.correctAnswers
            .map((i) => question.options[i])
            .join(' + ')}`
        )
        .setColor('#9b4a4a');
      this.playAnswerSound('wrong-answer');
      this.animateWrongFeedback(this.selected);
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
    this.submitButton.setStyle({ backgroundColor: '#7b315f' });
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

  private playAnswerSound(key: 'correct-answer' | 'wrong-answer'): void {
    if (!this.cache.audio.exists(key)) return;

    const sound = this.sound.get(key);
    if (sound) {
      sound.stop();
      sound.play();
    } else {
      this.sound.play(key, { volume: 0.85 });
    }
  }

  private animateCorrectFeedback(index: number): void {
    const card = this.optionCards[index];
    const button = this.optionButtons[index];
    const number = this.optionNumbers[index];

    if (card) {
      const { width, height } = this.scale;
      const y = height * (0.43 + index * 0.13);
      card.clear();
      card.fillStyle(0xddebdc, 1);
      card.lineStyle(2, 0x4f7651, 1);
      card.fillRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 11);
      card.strokeRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 11);
    }

    if (number) {
      number.setText('✓');
      number.setStyle({ color: '#4f7651', fontSize: '15px' });
    }

    if (button) {
      this.tweens.add({
        targets: button,
        scale: { from: 1.025, to: 1.07 },
        duration: 130,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut'
      });
    }

    this.cameras.main.flash(90, 245, 255, 235, false);
  }

  private animateWrongFeedback(index: number | null): void {
    const button = index === null ? undefined : this.optionButtons[index];
    const card = index === null ? undefined : this.optionCards[index];
    const number = index === null ? undefined : this.optionNumbers[index];

    if (button) {
      this.tweens.add({
        targets: button,
        x: '+=7',
        duration: 45,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut'
      });
    }

    if (card && index !== null) {
      const { width, height } = this.scale;
      const y = height * (0.43 + index * 0.13);
      card.clear();
      card.fillStyle(0xf2dfdf, 1);
      card.lineStyle(2, 0x9b4a4a, 1);
      card.fillRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 11);
      card.strokeRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 11);
    }

    if (number) {
      number.setText('×');
      number.setStyle({ color: '#9b4a4a', fontSize: '15px' });
    }

    this.cameras.main.shake(100, 0.0025);

    this.time.delayedCall(110, () => {
      const question = this.questions[this.currentIndex];

      question.correctAnswers.forEach((correctIndex) => {
        const card = this.optionCards[correctIndex];
        if (!card) return;

        const { width, height } = this.scale;
        const y = height * (0.43 + correctIndex * 0.13);
        card.clear();
        card.fillStyle(0xe4eee3, 1);
        card.lineStyle(2, 0x6b8f6d, 1);
        card.fillRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 11);
        card.strokeRoundedRect(width * 0.08, y - 31, width * 0.84, 62, 11);

        const correctNumber = this.optionNumbers[correctIndex];
        if (correctNumber) {
          correctNumber.setText('✓');
          correctNumber.setStyle({ color: '#4f7651', fontSize: '15px' });
        }
      });
    });
  }

  private transitionToNextQuestion(): void {
    if (!this.submitButton) return;

    this.submitButton.disableInteractive();

    const movingObjects: Phaser.GameObjects.GameObject[] = [
      ...this.optionButtons,
      ...this.optionCards,
      ...this.optionNumbers,
      ...this.progressObjects,
      ...(this.questionFrame ? [this.questionFrame] : []),
      ...this.questionMetaTexts,
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

  private animateXPGain(amount: number, optionIndex: number): void {
    const { width, height } = this.scale;

    const floating = this.add.text(
      width * 0.50,
      height * (0.43 + optionIndex * 0.13),
      `+${amount} XP`,
      {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#4f7651',
      fontStyle: 'bold'
      }
    ).setOrigin(0.5);

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

    const gained = this.add.text(width / 2, height * 0.44, `+${this.roundXP} XP THIS ROUND`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#4f7651'
    }).setOrigin(0.5).setAlpha(0);

    const total = this.add.text(width / 2, height * 0.50, `TOTAL XP  ${this.xp}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#7b315f'
    }).setOrigin(0.5).setAlpha(0);

    const next = this.add.text(width / 2, height * 0.65, 'NEW ROUND', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#fff8e8',
      backgroundColor: '#7b315f',
      padding: { left: 30, right: 30, top: 11, bottom: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    this.tweens.add({
      targets: [title, gained, total],
      alpha: 1,
      y: '-=10',
      duration: 350,
      ease: 'Cubic.easeOut'
    });
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

    this.questionFrame?.destroy();
    this.questionFrame = undefined;

    this.questionMetaTexts.forEach((text) => text.destroy());
    this.questionMetaTexts = [];

    this.optionButtons.forEach((button) => button.destroy());
    this.optionButtons = [];

    this.optionCards.forEach((card) => card.destroy());
    this.optionCards = [];

    this.optionNumbers.forEach((number) => number.destroy());
    this.optionNumbers = [];
    this.progressObjects.forEach((bar) => bar.destroy());
    this.progressObjects = [];
  }
}
