import Phaser from 'phaser';
import { Question } from '../data/questionBank';
import { addXP, getXP } from '../state/gameState';
import { fetchQuizQuestions, receiveQuizCases, telegramReady } from '../api/quiz';

const ROUND_SIZE = 10;

type TextScroller = {
  text: Phaser.GameObjects.Text;
  maskShape: Phaser.GameObjects.Graphics;
  mask: Phaser.Display.Masks.GeometryMask;
  track: Phaser.GameObjects.Graphics;
  thumb: Phaser.GameObjects.Graphics;
  top: number;
  bottom: number;
  max: number;
  baseY: number;
  dragStartY: number;
  dragStartOffset: number;
};

export class QuizScene extends Phaser.Scene {
  private questions: Question[] = [];
  private currentIndex = 0;
  private selected: number | null = null;
  private answered = false;
  private xp = 0;
  private roundXP = 0;
  private correctCount = 0;
  private casesReceived = 0;
  private receiveCaseButton?: Phaser.GameObjects.Text;
  private receivingCase = false;

  private questionNumberText?: Phaser.GameObjects.Text;
  private xpText?: Phaser.GameObjects.Text;
  private questionText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private questionFrame?: Phaser.GameObjects.Graphics;
  private questionMetaTexts: Phaser.GameObjects.Text[] = [];
  private submitButton?: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Text[] = [];
  private optionCards: Phaser.GameObjects.Graphics[] = [];
  private optionNumbers: Phaser.GameObjects.Text[] = [];
  private optionY: number[] = [];
  private optionHeights: number[] = [];
  private progressObjects: Phaser.GameObjects.Rectangle[] = [];
  private textScrollers: TextScroller[] = [];
  private activeTextScroller?: TextScroller;

  constructor() {
    super('QuizScene');
  }

  preload(): void {
    this.load.audio('correct-answer', '/audio/correct.mp3');
    this.load.audio('wrong-answer', '/audio/wrong.mp3');
    this.load.audio('round-complete', '/audio/round-complete.mp3');
    this.load.audio('score-reveal', '/audio/score-reveal.mp3');
    this.load.audio('correct-count', '/audio/correct-count.mp3');
    this.load.audio('case-count', '/audio/case-count.mp3');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#340a3a');

    const pattern = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'cercis-head')
      .setOrigin(0)
      .setAlpha(0.12)
      .setDepth(-10);
    pattern.setTileScale(0.24, 0.24);

    this.tweens.add({
      targets: pattern,
      tilePositionX: pattern.tilePositionX + 260,
      tilePositionY: pattern.tilePositionY + 130,
      duration: 10000,
      repeat: -1,
      ease: 'Linear'
    });
    this.cameras.main.fadeIn(260, 0, 0, 0);
    telegramReady();

    this.xp = getXP();
    this.roundXP = 0;
    this.correctCount = 0;
    this.casesReceived = 0;

    this.createHeader();
    void this.loadRound();
  }

  private async loadRound(): Promise<void> {
    const loading = this.add.text(this.scale.width / 2, this.scale.height / 2, 'در حال بارگذاری سؤال‌ها از آرشیو...', {
      fontFamily: 'SamimBold',
      fontSize: '14px',
      color: '#f7edf3',
      align: 'center',
      wordWrap: { width: this.scale.width * 0.78 }
    }).setOrigin(0.5);

    try {
      const remote = await fetchQuizQuestions();

      if (remote.length < ROUND_SIZE) {
        throw new Error(`فقط ${remote.length} سؤال فعال در بانک سؤال وجود دارد؛ برای یک پرسه کامل ۱۰ سؤال لازم است.`);
      }

      this.questions = Phaser.Utils.Array.Shuffle(remote).slice(0, ROUND_SIZE);
      loading.destroy();
      this.renderQuestion();
    } catch (error) {
      loading.setText(
        error instanceof Error
          ? error.message
          : 'بارگذاری سؤال‌ها انجام نشد.'
      );
      loading.setStyle({ color: '#f7d7df', fontSize: '14px' });
    }
  }

  private createHeader(): void {
    const { width } = this.scale;

    this.questionNumberText = this.add.text(18, 18, '', {
      fontFamily: 'SamimBold',
      fontSize: '13px',
      color: '#7b315f',
      fontStyle: 'bold'
    });

    this.xpText = this.add.text(width - 18, 18, '', {
      fontFamily: 'SamimBold',
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
      `سؤال ${String(this.currentIndex + 1).padStart(2, '0')}/${String(this.questions.length).padStart(2, '0')}`
    );
    this.xpText?.setText(`🌱 جوانه ${this.xp}`);

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

    // Cercis archive-style question card. Layout adapts to long question/option text.
    const questionFontSize = question.text.length > 240 ? 16 : question.text.length > 170 ? 18 : 21;
    const questionTop = height * 0.125;
    const questionTextWidth = width * 0.76;

    this.questionFrame = this.add.graphics().setAlpha(0);

    const archiveLabel = this.add.text(width * 0.11, questionTop + 18, 'آرشیو // آزمون میدانی', {
      fontFamily: 'SamimMedium',
      fontSize: '9px',
      color: '#9b8490',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setAlpha(0);

    const mark = this.add.text(width * 0.89, questionTop + 18, 'سرسیس', {
      fontFamily: 'SamimBold',
      fontSize: '9px',
      color: '#9b8490',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setAlpha(0);

    this.questionMetaTexts = [archiveLabel, mark];

    this.questionText = this.add.text(width / 2, questionTop + 58, question.text, {
      fontFamily: 'Samim',
      fontSize: questionFontSize,
      color: '#211f1d',
      align: 'center',
      wordWrap: { width: questionTextWidth - 16 },
      lineSpacing: 5
    }).setOrigin(0.5).setAlpha(0);

    const questionHeight = Phaser.Math.Clamp(this.questionText.getBounds().height + 86, 145, 220);
    const questionCenterY = questionTop + questionHeight / 2;
    this.questionText.setY(questionCenterY + 10);
    archiveLabel.setY(questionTop + 18);
    mark.setY(questionTop + 18);
    this.drawQuestionFrame(this.questionFrame, width, height, questionTop, questionHeight);

    this.createTextScroller(
      this.questionText,
      questionTop + 43,
      questionTop + questionHeight - 16,
      width * 0.08,
      width * 0.92
    );

    this.tweens.add({
      targets: [this.questionFrame, archiveLabel, mark, this.questionText],
      alpha: 1,
      y: '-=8',
      duration: 360,
      ease: 'Cubic.easeOut'
    });

    this.optionY = [];
    this.optionHeights = [];
    const optionFontSize = (option: string) => option.length > 180 ? 12 : option.length > 120 ? 14 : option.length > 80 ? 16 : 18;
    const optionGap = 10;
    const optionStart = questionTop + questionHeight + 28;
    let optionCursorY = optionStart;

    question.options.forEach((option, index) => {
      const fontSize = optionFontSize(option);
      const text = this.add.text(width / 2, 0, option, {
        fontFamily: 'Samim',
        fontSize,
        color: '#211f1d',
        align: 'center',
        wordWrap: { width: width * 0.68 },
        lineSpacing: 4
      }).setOrigin(0.5).setAlpha(0);

      const measured = text.getBounds().height + 28;
      const cardHeight = Math.max(62, Math.min(104, measured));
      const y = optionCursorY + cardHeight / 2;
      optionCursorY += cardHeight + optionGap;
      this.optionY.push(y);
      this.optionHeights.push(cardHeight);
      const viewportTop = y - cardHeight / 2 + 10;
      const viewportBottom = y + cardHeight / 2 - 10;
      const contentHeight = text.getBounds().height;

      text.setY(contentHeight > viewportBottom - viewportTop
        ? viewportTop + contentHeight / 2
        : y);

      const card = this.add.graphics();
      this.drawOptionCard(card, width, y, cardHeight, index, false, false);
      card.setAlpha(0);
      card.setDepth(1);
      this.optionCards.push(card);

      text.setDepth(2);

      const number = this.add.text(width * 0.12, y, String(index + 1).padStart(2, '0'), {
        fontFamily: 'SamimBold',
        fontSize: '11px',
        color: '#9b8490',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5).setAlpha(0);
      this.optionNumbers.push(number);

      text.setInteractive(
        new Phaser.Geom.Rectangle(-width * 0.42, -cardHeight / 2, width * 0.84, cardHeight),
        Phaser.Geom.Rectangle.Contains
      );

      text.on('pointerover', () => {
        if (!this.answered && this.selected !== index) {
          this.tweens.add({ targets: text, scale: 1.015, duration: 90 });
          this.drawOptionCard(card, width, y, cardHeight, index, false, true);
        }
      });

      text.on('pointerout', () => {
        if (!this.answered && this.selected !== index) {
          this.tweens.add({ targets: text, scale: 1, duration: 90 });
          this.drawOptionCard(card, width, y, cardHeight, index, false, false);
        }
      });

      text.on('pointerdown', () => this.toggleOption(index));
      this.optionButtons.push(text);

      this.createTextScroller(
        text,
        viewportTop,
        viewportBottom,
        width * 0.11,
        width * 0.89
      );

      this.tweens.add({
        targets: [card, number, text],
        alpha: 1,
        duration: 280,
        delay: 100 + index * 70,
        ease: 'Cubic.easeOut'
      });
    });

    const submitY = height - 54;
    this.submitButton = this.add.text(width / 2, submitY, 'ثبت پاسخ', {
      fontFamily: 'SamimBold',
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
      fontFamily: 'SamimBold',
      fontSize: '14px',
      color: '#7b315f',
      align: 'center',
      wordWrap: { width: width * 0.86 }
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.submitButton,
      alpha: 1,
      y: submitY - 6,
      duration: 300,
      delay: 300,
      ease: 'Cubic.easeOut'
    });
  }

  private createTextScroller(
    text: Phaser.GameObjects.Text,
    top: number,
    bottom: number,
    left: number,
    right: number
  ): void {
    const contentHeight = text.getBounds().height;
    const viewportHeight = bottom - top;

    if (contentHeight <= viewportHeight + 2) return;

    const maskShape = this.add.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(left, top, right - left, viewportHeight);
    maskShape.setVisible(false);

    const mask = maskShape.createGeometryMask();
    text.setMask(mask);

    const trackX = right - 6;
    const track = this.add.graphics();
    track.fillStyle(0x7b315f, 0.14);
    track.fillRoundedRect(trackX - 2, top, 4, viewportHeight, 2);

    const thumb = this.add.graphics();
    const scroller: TextScroller = {
      text,
      maskShape,
      mask,
      track,
      thumb,
      top,
      bottom,
      max: Math.max(0, contentHeight - viewportHeight),
      baseY: text.y,
      dragStartY: 0,
      dragStartOffset: 0
    };

    this.textScrollers.push(scroller);
    this.updateTextScroller(scroller);

    // Give the thumb a larger invisible hit area so it is practical on a phone.
    thumb.setInteractive(
      new Phaser.Geom.Rectangle(trackX - 14, top, 28, viewportHeight),
      Phaser.Geom.Rectangle.Contains
    );

    thumb.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      scroller.dragStartY = pointer.y;
      scroller.dragStartOffset = this.getTextScrollOffset(scroller);
      this.activeTextScroller = scroller;
    });

    // All scrollers share these listeners; do not register one pair per card.
    if (this.textScrollers.length === 1) {
      this.input.on('wheel', this.handleTextScrollerWheel, this);
      this.input.on('pointermove', this.handleTextScrollerMove, this);
      this.input.on('pointerup', this.handleTextScrollerUp, this);
      this.input.on('pointerupoutside', this.handleTextScrollerUp, this);
    }
  }

  private getTextScrollOffset(scroller: TextScroller): number {
    return Phaser.Math.Clamp(scroller.baseY - scroller.text.y, 0, scroller.max);
  }

  private setTextScroll(scroller: TextScroller, offset: number): void {
    const next = Phaser.Math.Clamp(offset, 0, scroller.max);
    scroller.text.y = scroller.baseY - next;
    this.updateTextScroller(scroller);
  }

  private updateTextScroller(scroller: TextScroller): void {
    const viewportHeight = scroller.bottom - scroller.top;
    const thumbHeight = Math.max(
      28,
      viewportHeight * (viewportHeight / (viewportHeight + scroller.max))
    );
    const travel = viewportHeight - thumbHeight;
    const offset = this.getTextScrollOffset(scroller);
    const trackX = this.scale.width * 0.92 - 6;
    const thumbY = scroller.top + (scroller.max === 0 ? 0 : (offset / scroller.max) * travel);

    scroller.thumb.clear();
    scroller.thumb.fillStyle(0x7b315f, 0.72);
    scroller.thumb.fillRoundedRect(trackX - 3, thumbY, 6, thumbHeight, 3);
  }

  private handleTextScrollerWheel(
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number
  ): void {
    const scroller = this.textScrollers.find((item) =>
      pointer.y >= item.top && pointer.y <= item.bottom
    );
    if (!scroller) return;

    this.setTextScroll(scroller, this.getTextScrollOffset(scroller) + dy * 0.65);
  }

  private handleTextScrollerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.activeTextScroller || !pointer.isDown) return;

    const scroller = this.activeTextScroller;
    const viewportHeight = scroller.bottom - scroller.top;
    const thumbHeight = Math.max(
      28,
      viewportHeight * (viewportHeight / (viewportHeight + scroller.max))
    );
    const travel = viewportHeight - thumbHeight;

    if (travel <= 0) return;

    const delta = scroller.dragStartY - pointer.y;
    const offset = scroller.dragStartOffset + (delta / travel) * scroller.max;
    this.setTextScroll(scroller, offset);
  }

  private handleTextScrollerUp(): void {
    this.activeTextScroller = undefined;
  }

  private destroyTextScrollers(): void {
    this.input.off('wheel', this.handleTextScrollerWheel, this);
    this.input.off('pointermove', this.handleTextScrollerMove, this);
    this.input.off('pointerup', this.handleTextScrollerUp, this);
    this.input.off('pointerupoutside', this.handleTextScrollerUp, this);

    this.textScrollers.forEach((scroller) => {
      // clearMask(true) already destroys the GeometryMask.
      scroller.text.clearMask(true);
      scroller.maskShape.destroy();
      scroller.track.destroy();
      scroller.thumb.destroy();
    });

    this.textScrollers = [];
    this.activeTextScroller = undefined;
  }

  private drawQuestionFrame(
    frame: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    top: number,
    boxHeight: number
  ): void {
    const left = width * 0.07;
    const boxWidth = width * 0.86;

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
    y: number,
    boxHeight: number,
    index: number,
    selected: boolean,
    hovered: boolean
  ): void {
    const left = width * 0.08;
    const boxWidth = width * 0.84;
    const fill = selected ? 0xead8e2 : hovered ? 0xfaf7f2 : 0xffffff;
    const stroke = selected ? 0x7b315f : hovered ? 0xc7b2bd : 0xe2d8d0;

    card.clear();
    card.fillStyle(fill, 1);
    card.lineStyle(selected ? 2 : 1, stroke, 1);
    card.fillRoundedRect(left, y - boxHeight / 2, boxWidth, boxHeight, 11);
    card.strokeRoundedRect(left, y - boxHeight / 2, boxWidth, boxHeight, 11);

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
        this.optionY[i],
        this.optionHeights[i],
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
      this.correctCount += 1;
      this.xp = addXP(question.xp);
      this.roundXP += question.xp;
      this.xpText?.setText(`🌱 جوانه ${this.xp}`);
      this.feedbackText?.setText(`درست!  +${question.xp} 🌱`).setColor('#4f7651');
      this.playAnswerSound('correct-answer');
      this.animateCorrectFeedback(this.selected);
      this.animateXPGain(question.xp, this.selected);
    } else {
      this.feedbackText
        ?.setText(
          `این پاسخ درست نبود.\\nپاسخ درست: ${question.correctAnswers
            .map((i) => question.options[i])
            .join(' + ')}`
        )
        .setColor('#9b4a4a');
      this.playAnswerSound('wrong-answer');
      this.animateWrongFeedback(this.selected);
      if (question.hasCases) this.showReceiveCaseButton(question.id);
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
      this.currentIndex + 1 < this.questions.length ? 'بعدی' : 'پایان پَرسه در پُرسه'
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
      const y = this.optionY[index];
      const cardHeight = this.optionHeights[index];
      card.clear();
      card.fillStyle(0xddebdc, 1);
      card.lineStyle(2, 0x4f7651, 1);
      card.fillRoundedRect(width * 0.08, y - cardHeight / 2, width * 0.84, cardHeight, 11);
      card.strokeRoundedRect(width * 0.08, y - cardHeight / 2, width * 0.84, cardHeight, 11);
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
      const y = this.optionY[index];
      card.clear();
      card.fillStyle(0xf2dfdf, 1);
      card.lineStyle(2, 0x9b4a4a, 1);
      card.fillRoundedRect(width * 0.08, y - this.optionHeights[index] / 2, width * 0.84, this.optionHeights[index], 11);
      card.strokeRoundedRect(width * 0.08, y - this.optionHeights[index] / 2, width * 0.84, this.optionHeights[index], 11);
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
          const y = this.optionY[correctIndex];
        const cardHeight = this.optionHeights[correctIndex];
        card.clear();
        card.fillStyle(0xe4eee3, 1);
        card.lineStyle(2, 0x6b8f6d, 1);
        card.fillRoundedRect(width * 0.08, y - cardHeight / 2, width * 0.84, cardHeight, 11);
        card.strokeRoundedRect(width * 0.08, y - cardHeight / 2, width * 0.84, cardHeight, 11);

        const correctNumber = this.optionNumbers[correctIndex];
        if (correctNumber) {
          correctNumber.setText('✓');
          correctNumber.setStyle({ color: '#4f7651', fontSize: '15px' });
        }
      });
    });
  }

  private showReceiveCaseButton(questionId: string): void {
    if (this.receiveCaseButton) this.receiveCaseButton.destroy();

    const { width, height } = this.scale;
    this.receiveCaseButton = this.add.text(width / 2, height * 0.965, 'دریافت پرونده', {
      fontFamily: 'SamimBold',
      fontSize: '13px',
      color: '#7b315f',
      backgroundColor: '#ead8e2',
      padding: { left: 18, right: 18, top: 8, bottom: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    this.tweens.add({
      targets: this.receiveCaseButton,
      alpha: 1,
      y: '-=6',
      duration: 240,
      ease: 'Back.easeOut'
    });

    this.receiveCaseButton.on('pointerover', () => {
      if (!this.receivingCase) this.tweens.add({ targets: this.receiveCaseButton, scale: 1.04, duration: 100 });
    });
    this.receiveCaseButton.on('pointerout', () => {
      this.tweens.add({ targets: this.receiveCaseButton, scale: 1, duration: 100 });
    });
    this.receiveCaseButton.on('pointerdown', async () => {
      if (this.receivingCase) return;
      this.receivingCase = true;
      this.receiveCaseButton?.disableInteractive();
      this.receiveCaseButton?.setText('در حال ارسال...');

      try {
        const received = await receiveQuizCases(questionId);
        this.casesReceived += received;
        this.receiveCaseButton?.setText(received > 0 ? 'پرونده ارسال شد ✓' : 'پرونده قبلاً ارسال شده');
        this.receiveCaseButton?.setStyle({ backgroundColor: received > 0 ? '#ddebdc' : '#e8e1d9', color: received > 0 ? '#4f7651' : '#7b315f' });
      } catch {
        this.receiveCaseButton?.setText('تلاش دوباره');
        this.receiveCaseButton?.setStyle({ backgroundColor: '#f2dfdf', color: '#9b4a4a' });
        this.receiveCaseButton?.setInteractive({ useHandCursor: true });
        this.receivingCase = false;
      }
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
      ...(this.feedbackText ? [this.feedbackText] : []),
      ...(this.receiveCaseButton ? [this.receiveCaseButton] : [])
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
      this.optionY[optionIndex],
      `+${amount} 🌱`,
      {
      fontFamily: 'SamimBold',
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
    this.questionNumberText?.setText('پایان دور');
    this.xpText?.setText(`🌱 جوانه ${this.xp}`);

    // End-of-round reveal is deliberately staged:
    // sound → silence → 🌱 → correct count → case count → new round.
    this.playEndRoundSound('round-complete');

    this.time.delayedCall(1500, () => {
      const gained = this.add.text(width / 2, height * 0.36, `+${this.roundXP} 🌱 در این دور`, {
        fontFamily: 'SamimBold',
        fontSize: '21px',
        color: '#4f7651',
        fontStyle: 'bold'
      }).setOrigin(0.5).setAlpha(0).setScale(0.94);

      this.revealEndRoundText(gained);
      this.playEndRoundSound('score-reveal');

      this.time.delayedCall(1200, () => {
        const correct = this.add.text(width / 2, height * 0.47, `${this.correctCount} / ${this.questions.length} پاسخ درست`, {
          fontFamily: 'SamimBold',
          fontSize: '19px',
          color: '#211f1d',
          fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0).setScale(0.94);

        this.revealEndRoundText(correct);
        this.playEndRoundSound('correct-count');

        this.time.delayedCall(1200, () => {
          const cases = this.add.text(width / 2, height * 0.58, `📚 ${this.casesReceived} پرونده دریافت شد`, {
            fontFamily: 'SamimBold',
            fontSize: '18px',
            color: '#7b315f',
            fontStyle: 'bold'
          }).setOrigin(0.5).setAlpha(0).setScale(0.94);

          this.revealEndRoundText(cases);
          this.playEndRoundSound('case-count');

          this.time.delayedCall(900, () => {
            const total = this.add.text(width / 2, height * 0.66, `مجموع جوانه‌ها  🌱 ${this.xp}`, {
              fontFamily: 'SamimBold',
              fontSize: '15px',
              color: '#9b8490'
            }).setOrigin(0.5).setAlpha(0);

            const next = this.add.text(width / 2, height * 0.76, 'پَرسه در پُرسه بعدی', {
              fontFamily: 'SamimBold',
              fontSize: '16px',
              color: '#fff8e8',
              backgroundColor: '#7b315f',
              padding: { left: 30, right: 30, top: 11, bottom: 11 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

            this.revealEndRoundText(total, 260);
            this.tweens.add({
              targets: next,
              alpha: 1,
              y: '-=8',
              duration: 300,
              ease: 'Back.easeOut'
            });

            next.on('pointerover', () => this.tweens.add({ targets: next, scale: 1.04, duration: 100 }));
            next.on('pointerout', () => this.tweens.add({ targets: next, scale: 1, duration: 100 }));
            next.on('pointerdown', () => this.scene.restart());
          });
        });
      });
    });
  }

  private playEndRoundSound(key: 'round-complete' | 'score-reveal' | 'correct-count' | 'case-count'): void {
    if (!this.cache.audio.exists(key)) return;

    const sound = this.sound.get(key);
    if (sound) {
      sound.stop();
      sound.play();
    } else {
      this.sound.play(key, { volume: 0.85 });
    }
  }

  private revealEndRoundText(
    target: Phaser.GameObjects.Text,
    duration = 320
  ): void {
    this.tweens.add({
      targets: target,
      alpha: 1,
      scale: 1,
      y: '-=8',
      duration,
      ease: 'Cubic.easeOut'
    });
  }

  private clearQuestionUI(): void {
    this.destroyTextScrollers();

    this.questionText?.destroy();
    this.questionText = undefined;

    this.feedbackText?.destroy();
    this.feedbackText = undefined;

    this.submitButton?.destroy();
    this.submitButton = undefined;

    this.receiveCaseButton?.destroy();
    this.receiveCaseButton = undefined;
    this.receivingCase = false;

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
    this.optionY = [];
    this.optionHeights = [];
    this.progressObjects.forEach((bar) => bar.destroy());
    this.progressObjects = [];
  }
}
