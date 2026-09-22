import Phaser from 'phaser';
import { QUESTION_BANK, Question } from '../data/questionBank';
import { addXP, getXP } from '../state/gameState';

const ROUND_SIZE = 5;

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

  constructor() { super('QuizScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#f4efe8');
    this.xp = getXP();
    this.questions = this.pickRound();
    this.createHeader();
    this.renderQuestion();
  }

  private pickRound(): Question[] {
    return Phaser.Utils.Array.Shuffle([...QUESTION_BANK]).slice(0, Math.min(ROUND_SIZE, QUESTION_BANK.length));
  }

  private createHeader(): void {
    const { width } = this.scale;
    this.questionNumberText = this.add.text(18, 18, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#7b315f'
    });
    this.xpText = this.add.text(width - 18, 18, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#7b315f', fontStyle: 'bold'
    }).setOrigin(1, 0);
    this.scale.on('resize', () => this.xpText?.setPosition(this.scale.width - 18, 18));
  }

  private renderQuestion(): void {
    this.clearQuestionUI();
    this.selected = null;
    this.answered = false;
    const question = this.questions[this.currentIndex];
    const { width, height } = this.scale;

    this.questionNumberText?.setText(`QUESTION ${String(this.currentIndex + 1).padStart(2, '0')}/${String(this.questions.length).padStart(2, '0')}`);
    this.xpText?.setText(`XP ${this.xp}`);

    this.questionText = this.add.text(width / 2, height * 0.23, question.text, {
      fontFamily: 'sans-serif', fontSize: '21px', color: '#211f1d', align: 'center',
      wordWrap: { width: width * 0.84 }, lineSpacing: 7
    }).setOrigin(0.5);

    question.options.forEach((option, index) => {
      const y = height * (0.43 + index * 0.13);
      const button = this.add.text(width / 2, y, option, {
        fontFamily: 'sans-serif', fontSize: '18px', color: '#211f1d',
        backgroundColor: '#ffffff', padding: { left: 30, right: 30, top: 15, bottom: 15 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.toggleOption(index));
      this.optionButtons.push(button);
    });

    this.submitButton = this.add.text(width / 2, height * 0.82, 'CHECK', {
      fontFamily: 'monospace', fontSize: '16px', color: '#fff8e8',
      backgroundColor: '#7b315f', padding: { left: 28, right: 28, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.submitButton.on('pointerdown', () => this.checkAnswer());

    this.feedbackText = this.add.text(width / 2, height * 0.91, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7b315f', align: 'center',
      wordWrap: { width: width * 0.86 }
    }).setOrigin(0.5);
  }

  private toggleOption(index: number): void {
    if (this.answered) return;

    this.selected = index;

    this.optionButtons.forEach((button, i) => button.setStyle({
      backgroundColor: this.selected === i ? '#ead8e2' : '#ffffff'
    }));
  }

  private checkAnswer(): void {
    if (this.answered || !this.submitButton) return;
    const question = this.questions[this.currentIndex];
    const isCorrect = this.selected !== null && question.correctAnswers.includes(this.selected);
    this.answered = true;

    if (isCorrect) {
      this.xp = addXP(question.xp);
      this.feedbackText?.setText(`CORRECT  +${question.xp} XP`).setColor('#4f7651');
      this.xpText?.setText(`XP ${this.xp}`);
    } else {
      this.feedbackText?.setText(`NOT QUITE  •  +0 XP\nCorrect: ${question.correctAnswers.map((i) => question.options[i]).join(' + ')}`).setColor('#9b4a4a');
    }

    this.optionButtons.forEach((button, i) => {
      const correct = question.correctAnswers.includes(i);
      const selected = this.selected === i;
      button.setStyle({ backgroundColor: correct ? '#d8ead0' : selected ? '#ead4d4' : '#ffffff' });
    });

    this.submitButton.setText(this.currentIndex + 1 < this.questions.length ? 'NEXT' : 'ROUND COMPLETE');
    this.submitButton.removeAllListeners('pointerdown');
    this.submitButton.setInteractive({ useHandCursor: true });
    this.submitButton.on('pointerdown', () => {
      if (this.currentIndex + 1 < this.questions.length) {
        this.currentIndex += 1;
        this.renderQuestion();
      } else {
        this.showRoundComplete();
      }
    });
  }

  private showRoundComplete(): void {
    this.clearQuestionUI();
    const { width, height } = this.scale;
    this.questionNumberText?.setText('ROUND COMPLETE');
    this.xpText?.setText(`XP ${this.xp}`);

    this.add.text(width / 2, height * 0.35, 'ROUND COMPLETE', {
      fontFamily: 'monospace', fontSize: '22px', color: '#211f1d'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.47, `TOTAL XP  ${this.xp}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#7b315f'
    }).setOrigin(0.5);

    const next = this.add.text(width / 2, height * 0.65, 'NEW ROUND', {
      fontFamily: 'monospace', fontSize: '16px', color: '#fff8e8',
      backgroundColor: '#7b315f', padding: { left: 30, right: 30, top: 11, bottom: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
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
  }
}
