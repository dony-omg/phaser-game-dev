import Phaser from 'phaser';

type QuizPanelConfig = {
    optionCount?: number;
    depth?: number;
    parent?: Phaser.GameObjects.Container;
    showIndex?: boolean;
};

export class QuizPanel {
    readonly scene: Phaser.Scene;
    readonly container: Phaser.GameObjects.Container;
    readonly panelContainer: Phaser.GameObjects.Container;
    readonly panelShadow: Phaser.GameObjects.Graphics;
    readonly panelBg: Phaser.GameObjects.Graphics;
    readonly panelGlow: Phaser.GameObjects.Graphics;
    readonly indexText: Phaser.GameObjects.Text;
    readonly feedbackTitleText: Phaser.GameObjects.Text;
    readonly feedbackSubtitleText: Phaser.GameObjects.Text;
    readonly questionText: Phaser.GameObjects.Text;
    readonly optionButtons: Phaser.GameObjects.Container[] = [];

    private readonly optionCount: number;
    private readonly showIndex: boolean;

    constructor(scene: Phaser.Scene, config: QuizPanelConfig = {}) {
        this.scene = scene;
        this.optionCount = config.optionCount ?? 4;
        this.showIndex = config.showIndex ?? true;

        this.container = this.scene.add.container(0, 0).setDepth(config.depth ?? 200);
        this.container.setScrollFactor(0);
        this.container.setVisible(false);

        this.panelContainer = this.scene.add.container(0, 0);
        this.panelShadow = this.scene.add.graphics();
        this.panelBg = this.scene.add.graphics();
        this.panelGlow = this.scene.add.graphics();

        this.indexText = this.scene.add.text(0, 0, 'Question 1/4', {
            fontFamily: 'Arial Black',
            fontSize: '14px',
            color: '#38bdf8'
        }).setOrigin(0.5, 0);

        this.feedbackTitleText = this.scene.add.text(0, 0, 'Correct!', {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#22c55e',
            align: 'center',
            wordWrap: { width: 600, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        this.feedbackSubtitleText = this.scene.add.text(0, 0, 'You earned 1 point!', {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#16a34a',
            align: 'center',
            wordWrap: { width: 600, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        this.questionText = this.scene.add.text(0, 0, '...', {
            fontFamily: 'Arial Black',
            fontSize: '28px',
            color: '#0f172a',
            align: 'center',
            wordWrap: { width: 600, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        this.panelContainer.add([
            this.panelShadow,
            this.panelBg,
            this.panelGlow,
            this.indexText,
            this.feedbackTitleText,
            this.feedbackSubtitleText,
            this.questionText
        ]);

        for (let i = 0; i < this.optionCount; i += 1) {
            const option = this.createOptionButton(0, 0);
            this.optionButtons.push(option);
            this.panelContainer.add(option);
        }

        this.container.add(this.panelContainer);

        if (config.parent) {
            config.parent.add(this.container);
        }
    }

    setVisible(value: boolean): void {
        this.container.setVisible(value);
    }

    setAlpha(value: number): void {
        this.container.setAlpha(value);
    }

    setInteractive(enabled: boolean): void {
        this.optionButtons.forEach((btn) => {
            const hit = btn.getData('hit') as Phaser.GameObjects.Rectangle | undefined;
            if (!hit) return;
            if (enabled) {
                hit.setInteractive();
            } else {
                hit.disableInteractive();
            }
        });
    }

    onOptionSelected(callback: (index: number) => void): void {
        this.optionButtons.forEach((btn, index) => {
            const hit = btn.getData('hit') as Phaser.GameObjects.Rectangle | undefined;
            if (!hit) return;
            hit.removeAllListeners('pointerdown');
            hit.on('pointerdown', () => callback(index));
        });
    }

    setQuestion(data: { index?: number; total?: number; question: string; options: string[] }): void {
        if (this.showIndex && data.index && data.total) {
            this.indexText.setText(`Question ${data.index}/${data.total}`);
            this.indexText.setAlpha(1);
        } else {
            this.indexText.setAlpha(0);
        }

        const maxQuestionChars = 55;
        const question =
            data.question.length > maxQuestionChars
                ? `${data.question.slice(0, maxQuestionChars - 1)}…`
                : data.question;
        this.questionText.setText(question);

        this.optionButtons.forEach((btn, i) => {
            const redraw = btn.getData('redraw') as (state: 'normal' | 'correct' | 'wrong') => void;
            const text = btn.getData('text') as Phaser.GameObjects.Text;

            redraw('normal');
            text.setFontSize(20);
            text.setText(`${data.options[i] ?? ''}`);

            if (text.width > 520) text.setFontSize(18);
            if (text.width > 560) text.setFontSize(17);
        });
    }

    setFeedback(state: 'idle' | 'correct' | 'wrong'): void {
        if (state === 'correct') {
            this.feedbackTitleText.setText('Correct!');
            this.feedbackTitleText.setColor('#22c55e');
            this.feedbackSubtitleText.setText('You earned 1 point!');
            this.feedbackSubtitleText.setColor('#16a34a');
            this.feedbackTitleText.setAlpha(1);
            this.feedbackSubtitleText.setAlpha(1);
        } else if (state === 'wrong') {
            this.feedbackTitleText.setText('Sorry!');
            this.feedbackTitleText.setColor('#ef4444');
            this.feedbackSubtitleText.setText('You have to start over.');
            this.feedbackSubtitleText.setColor('#0f172a');
            this.feedbackTitleText.setAlpha(1);
            this.feedbackSubtitleText.setAlpha(1);
        } else {
            this.feedbackTitleText.setAlpha(0);
            this.feedbackSubtitleText.setAlpha(0);
        }
    }

    setOptionState(index: number, state: 'normal' | 'correct' | 'wrong'): void {
        const btn = this.optionButtons[index];
        if (!btn) return;
        const redraw = btn.getData('redraw') as (value: 'normal' | 'correct' | 'wrong') => void;
        redraw(state);
    }

    layout(width: number, height: number): { uiScale: number; panelHeight: number; panelWidth: number } {
        const uiScale = Phaser.Math.Clamp(width / 900, 0.9, 1.05);
        const panelWidth = Math.floor(width * 0.9);
        const maxPanelHeight = Math.floor(height * 0.62 / uiScale);

        const questionWrap = Math.floor(panelWidth * 0.8);
        this.questionText.setWordWrapWidth(questionWrap, true);
        this.feedbackTitleText.setWordWrapWidth(questionWrap, true);
        this.feedbackSubtitleText.setWordWrapWidth(questionWrap, true);

        let fontSize = 28;
        const minFont = 20;
        let panelHeight = 0;

        while (fontSize >= minFont) {
            this.questionText.setFontSize(fontSize);
            const qBounds = this.questionText.getBounds();
            const headerH = this.indexText.getBounds().height;
            const feedbackTitleH = 22;
            const feedbackSubtitleH = 18;
            const feedbackGap = 4;
            const feedbackTopGap = 8;
            const feedbackBottomGap = 8;
            const paddingTop = 10;
            const paddingBottom = 14;
            const questionGap = 6;
            const optionsTopGap = 14;
            const buttonHeight = 62;
            const buttonGap = 14;

            panelHeight =
                paddingTop +
                headerH +
                feedbackTopGap +
                feedbackTitleH +
                feedbackGap +
                feedbackSubtitleH +
                feedbackBottomGap +
                qBounds.height +
                optionsTopGap +
                (buttonHeight * this.optionCount) +
                (buttonGap * (this.optionCount - 1)) +
                paddingBottom;

            if (panelHeight <= maxPanelHeight) break;
            fontSize -= 2;
        }

        const qBounds = this.questionText.getBounds();
        const headerH = this.indexText.getBounds().height;
        let paddingTop = 12;
        let paddingBottom = 16;
        let optionsTopGap = 14;
        let buttonHeight = 62;
        let buttonGap = 14;
        let feedbackTopGap = 8;
        let feedbackBottomGap = 8;
        const feedbackTitleH = 22;
        const feedbackSubtitleH = 18;
        const feedbackGap = 4;
        if (panelHeight > maxPanelHeight) {
            paddingTop = 10;
            paddingBottom = 12;
            optionsTopGap = 12;
            feedbackTopGap = 6;
            feedbackBottomGap = 6;
        }

        const minButtonHeight = 52;
        const minButtonGap = 8;
        const fixedHeight =
            paddingTop +
            headerH +
            feedbackTopGap +
            feedbackTitleH +
            feedbackGap +
            feedbackSubtitleH +
            feedbackBottomGap +
            qBounds.height +
            optionsTopGap +
            paddingBottom;
        const maxButtonsSpace = Math.max(0, maxPanelHeight - fixedHeight);
        const desiredButtonsSpace = (buttonHeight * this.optionCount) + (buttonGap * (this.optionCount - 1));
        if (desiredButtonsSpace > maxButtonsSpace) {
            const perButton = Math.floor((maxButtonsSpace - (buttonGap * (this.optionCount - 1))) / this.optionCount);
            buttonHeight = Phaser.Math.Clamp(perButton, minButtonHeight, buttonHeight);
            const remaining = maxButtonsSpace - (buttonHeight * this.optionCount);
            const perGap = Math.floor(remaining / (this.optionCount - 1));
            buttonGap = Phaser.Math.Clamp(perGap, minButtonGap, buttonGap);
        }

        panelHeight =
            paddingTop +
            headerH +
            feedbackTopGap +
            feedbackTitleH +
            feedbackGap +
            feedbackSubtitleH +
            feedbackBottomGap +
            qBounds.height +
            optionsTopGap +
            (buttonHeight * this.optionCount) +
            (buttonGap * (this.optionCount - 1)) +
            paddingBottom;

        const panelX = width / 2;
        const panelY = height / 2;
        this.panelContainer.setScale(uiScale);
        this.panelContainer.setPosition(panelX, panelY);

        this.panelShadow.clear();
        this.panelShadow.fillStyle(0x000000, 0.18);
        this.panelShadow.fillRoundedRect(-panelWidth / 2 + 8, -panelHeight / 2 + 14, panelWidth, panelHeight, 28);

        this.panelBg.clear();
        this.panelBg.fillStyle(0xf8fbff, 0.92);
        this.panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);
        this.panelBg.lineStyle(2, 0x93c5fd, 0.6);
        this.panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);

        this.panelGlow.clear();
        this.panelGlow.fillStyle(0xe0f2fe, 0.5);
        this.panelGlow.fillRoundedRect(-panelWidth / 2 + 10, -panelHeight / 2 + 10, panelWidth - 20, panelHeight - 20, 20);

        const headerY = -panelHeight / 2 + paddingTop;
        this.indexText.setPosition(0, headerY);
        const feedbackY = headerY + headerH + feedbackTopGap;
        this.feedbackTitleText.setPosition(0, feedbackY);
        this.feedbackSubtitleText.setPosition(0, feedbackY + feedbackTitleH + feedbackGap);
        const questionY = feedbackY + feedbackTitleH + feedbackGap + feedbackSubtitleH + feedbackBottomGap;
        this.questionText.setPosition(0, questionY);

        const answersStartY = questionY + qBounds.height + optionsTopGap + (buttonHeight / 2);
        this.optionButtons.forEach((btn, i) => {
            const y = answersStartY + i * (buttonHeight + buttonGap);
            btn.setPosition(0, y);
            btn.setData('layout', { x: -panelWidth / 2 + 32, w: panelWidth - 64, h: buttonHeight, radius: 22 });
            const redraw = btn.getData('redraw') as (state: 'normal' | 'correct' | 'wrong') => void;
            redraw('normal');
            const text = btn.getData('text') as Phaser.GameObjects.Text;
            const hit = btn.getData('hit') as Phaser.GameObjects.Rectangle;
            const layout = btn.getData('layout') as { x: number; w: number; h: number; radius: number };
            text.setPosition(layout.x + layout.w / 2, 0);
            hit.setSize(layout.w, layout.h);
            hit.setPosition(layout.x + layout.w / 2, 0);
            btn.setSize(layout.w, layout.h);
        });

        const halfPanel = (panelHeight * uiScale) / 2;
        if (this.panelContainer.y - halfPanel < 60) {
            this.panelContainer.y = 60 + halfPanel;
        }
        if (this.panelContainer.y + halfPanel > height - 40) {
            this.panelContainer.y = height - 40 - halfPanel;
        }

        return { uiScale, panelHeight, panelWidth };
    }

    private createOptionButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.scene.add.container(x, y);

        const width = 640;
        const height = 54;
        const radius = 22;
        const baseColor = 0x38bdf8;

        const shadow = this.scene.add.graphics();
        const bg = this.scene.add.graphics();

        const text = this.scene.add.text(0, 0, '...', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const hit = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
        hit.setInteractive();

        const redraw = (state: 'normal' | 'correct' | 'wrong') => {
            const layout = container.getData('layout') as { x: number; w: number; h: number; radius: number } | undefined;
            const drawX = layout?.x ?? -width / 2;
            const drawW = layout?.w ?? width;
            const drawH = layout?.h ?? height;
            const drawR = layout?.radius ?? radius;

            let fill = baseColor;
            let stroke = 0x7dd3fc;

            if (state === 'correct') {
                fill = 0x22c55e;
                stroke = 0x86efac;
            } else if (state === 'wrong') {
                fill = 0xef4444;
                stroke = 0xfca5a5;
            }

            shadow.clear();
            shadow.fillStyle(0x000000, 0.18);
            shadow.fillRoundedRect(drawX + 2, -drawH / 2 + 4, drawW, drawH, drawR);

            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(drawX, -drawH / 2, drawW, drawH, drawR);
            bg.lineStyle(2, stroke, 0.9);
            bg.strokeRoundedRect(drawX, -drawH / 2, drawW, drawH, drawR);
        };

        redraw('normal');

        container.add([shadow, bg, text, hit]);
        container.setSize(width, height);

        container.setData('redraw', redraw);
        container.setData('text', text);
        container.setData('hit', hit);

        return container;
    }
}
