import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { EmoteCharacter } from '../objects/EmoteCharacter';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    trackImage!: Phaser.GameObjects.Image;
    player!: EmoteCharacter;
    parallaxLayers: Phaser.GameObjects.Image[];
    uiRoot!: Phaser.GameObjects.Container;
    uiCamera!: Phaser.Cameras.Scene2D.Camera;
    timerOverlay!: Phaser.GameObjects.Container;

    // UI
    jumpButton: Phaser.GameObjects.Container;
    jumpButtonBg!: Phaser.GameObjects.Rectangle;
    scoreText: Phaser.GameObjects.Text;
    quizModal!: Phaser.GameObjects.Container;
    quizPanelContainer!: Phaser.GameObjects.Container;
    quizPanelShadow!: Phaser.GameObjects.Graphics;
    quizPanelBg!: Phaser.GameObjects.Graphics;
    quizPanelGlow!: Phaser.GameObjects.Graphics;
    quizPanelWidth: number = 0;
    quizPanelHeight: number = 0;
    uiScale: number = 1;
    safeInsetBottom: number = 16;
    quizQuestionText!: Phaser.GameObjects.Text;
    quizIndexText!: Phaser.GameObjects.Text;
    quizOptionButtons: Phaser.GameObjects.Container[] = [];
    quizOpen: boolean = false;
    quizLocked: boolean = false;
    quizCurrentIndex: number = 0;
    startModal!: Phaser.GameObjects.Container;
    startModalOpen: boolean = false;
    endModal!: Phaser.GameObjects.Container;
    endModalScoreText!: Phaser.GameObjects.Text;
    endModalTimeText!: Phaser.GameObjects.Text;
    confettiEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    confettiBurstEvent?: Phaser.Time.TimerEvent;
    gameCompleted: boolean = false;
    timeUpModal!: Phaser.GameObjects.Container;
    gameOver: boolean = false;
    timerText!: Phaser.GameObjects.Text;
    timerFrame!: Phaser.GameObjects.Graphics;
    timerEvent!: Phaser.Time.TimerEvent;
    totalTimeMs: number = 180000;
    jumpDurationMs: number = 900;

    // Game State
    score: number = 0;
    currentLeafIndex: number = 0;

    // Leaf path (detected from track texture)
    private leafPath: Phaser.Math.Vector2[] = [];

    // Fallback zig-zag config
    private readonly leafStartY = 940;
    private readonly leafStepY = 140;
    private readonly leafSideOffset = 180;

    
    constructor ()
    {
        super('Game');
    }

    create ()
    {
        const { width, height } = this.scale;
        this.camera = this.cameras.main;

        // Parallax background
        this.createParallaxBackground();

        // Track (Leaves) - Use bg-main as the scrolling map
        this.trackImage = this.add.image(width / 2, height, 'bg-main').setOrigin(0.5, 1);
        const trackScale = width / this.trackImage.width;
        this.trackImage.setScale(trackScale);

        const mapTop = this.trackImage.y - this.trackImage.displayHeight;
        this.camera.setBounds(0, mapTop, width, this.trackImage.displayHeight);

        // Build leaf path based on the map texture
        this.leafPath = this.buildLeafPath('bg-main');

        // Player Setup - Using EmoteCharacter (idle/correct/incorrect states)
        const startPos = this.getLeafPosition(0);
        this.player = new EmoteCharacter(this, startPos.x, startPos.y);
        this.currentLeafIndex = 0;

        const nextPos = this.getLeafPosition(this.currentLeafIndex + 1);
        this.player.flip(nextPos.x > startPos.x);

        // Start idle animation
        this.player.playIdle();

        // Initial Camera Position
        this.camera.scrollY = startPos.y - 900;

        // UI camera (fixed screen-space)
        this.uiCamera = this.cameras.add(0, 0, width, height);
        this.uiCamera.setScroll(0, 0);
        this.uiCamera.ignore(this.children.list);

        // UI
        this.createUI();

        EventBus.emit('current-scene-ready', this);
    }

    createParallaxBackground() {
        this.cameras.main.setBackgroundColor(0x3fb3e8);
        this.parallaxLayers = [];
    }

    update() {
        if (!this.parallaxLayers?.length) return;
        const scrollY = this.camera.scrollY;

        this.parallaxLayers.forEach((layer) => {
            const factor = layer.getData('scrollFactor') as number;
            const baseY = layer.getData('baseY') as number;
            layer.y = baseY + scrollY * factor;
        });
    }

    createUI() {
        const { width, height } = this.scale;
        
        // Fixed UI Container
        this.uiRoot = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

        // Score
        this.scoreText = this.add.text(20, 40, 'Score: 0', {
            fontFamily: 'Arial Black', fontSize: '32px', color: '#f8fafc',
            stroke: '#000000', strokeThickness: 4
        });
        this.uiRoot.add(this.scoreText);

        // Timer (top center overlay, always above modals)
        this.timerOverlay = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);

        this.timerFrame = this.add.graphics();
        this.timerFrame.fillStyle(0xdc2626, 1);
        this.timerFrame.fillRoundedRect(width / 2 - 110, 12, 220, 56, 14);
        this.timerFrame.lineStyle(3, 0xffffff, 0.95);
        this.timerFrame.strokeRoundedRect(width / 2 - 110, 12, 220, 56, 14);

        this.timerText = this.add.text(width / 2, 40, '03:00', {
            fontFamily: 'Arial Black', fontSize: '26px', color: '#ffffff',
            stroke: '#7f1d1d', strokeThickness: 4
        }).setOrigin(0.5);

        this.timerOverlay.add([this.timerFrame, this.timerText]);
        this.uiRoot.add(this.timerOverlay);

        // Jump Button
        this.jumpButton = this.createJumpButton(width / 2, height - 150);
        this.jumpButton.setScrollFactor(0);
        this.uiRoot.add(this.jumpButton);
        this.jumpButton.setVisible(false);
        this.jumpButton.setActive(false);

        this.setupJumpInput();

        // Quiz Modal (UI overlay)
        this.createQuizModal();

        // Start Modal (first screen)
        this.createStartModal();
        this.openStartModal();

        // Ensure only UI camera renders UI
        this.cameras.main.ignore([this.uiRoot, this.timerOverlay]);

        // End Modal
        this.createEndModal();

        // Time Up Modal
        this.createTimeUpModal();
    }

    createJumpButton(x: number, y: number) {
        const container = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 300, 100, 0xfbbf24)
            .setStrokeStyle(4, 0xffffff)
            .setFillStyle(0x22c55e);
            
        const text = this.add.text(0, 0, 'NEXT JUMP!', {
            fontFamily: 'Arial Black', fontSize: '32px', color: '#ffffff'
        }).setOrigin(0.5);

        container.add([bg, text]);
        container.setSize(300, 100);

        this.jumpButtonBg = bg;

        const onPress = () => {
            if (this.quizOpen || this.startModalOpen) return;
            bg.setFillStyle(0x16a34a);
            this.openQuizModal();
        };

        const onRelease = () => {
            bg.setFillStyle(0x22c55e);
        };

        bg.setInteractive({ useHandCursor: true });
        text.setInteractive({ useHandCursor: true });

        bg.on('pointerdown', onPress);
        text.on('pointerdown', onPress);

        bg.on('pointerup', onRelease);
        text.on('pointerup', onRelease);

        bg.on('pointerout', onRelease);
        text.on('pointerout', onRelease);

        // Add simple pulse tween
        this.tweens.add({
            targets: container,
            scale: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        return container;
    }

    private setupJumpInput(): void {
        this.input.enabled = true;
        if (this.input.mouse) this.input.mouse.enabled = true;

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.quizOpen || this.startModalOpen) return;
            const bounds = this.jumpButton.getBounds();
            if (bounds.contains(pointer.x, pointer.y)) {
                this.jumpButtonBg.setFillStyle(0x16a34a);
                this.openQuizModal();
            }
        });

        this.input.on('pointerup', () => {
            this.jumpButtonBg.setFillStyle(0x22c55e);
        });
    }

    private createQuizModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

        this.uiScale = Phaser.Math.Clamp(width / 900, 0.9, 1.05);
        this.safeInsetBottom = Math.max(24, Math.round(height * 0.03));

        const panelWidth = Math.min(820, width - 40);
        const panelHeight = 240;
        this.quizPanelWidth = panelWidth;
        this.quizPanelHeight = panelHeight;

        const panelContainer = this.add.container(width / 2, height - panelHeight / 2 - 24).setScrollFactor(0);
        panelContainer.setScale(this.uiScale);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.35);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 24);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x111827, 0.95);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(2, 0xffffff, 0.4);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const panelGlow = this.add.graphics();
        panelGlow.fillStyle(0x1f2937, 0.9);
        panelGlow.fillRoundedRect(-panelWidth / 2 + 10, -panelHeight / 2 + 10, panelWidth - 20, panelHeight - 20, 18);

        this.quizIndexText = this.add.text(0, -panelHeight / 2 + 14, 'Câu 1/4', {
            fontFamily: 'Arial Black',
            fontSize: '16px',
            color: '#fcd34d'
        }).setOrigin(0.5);

        this.quizQuestionText = this.add.text(0, -panelHeight / 2 + 36, '...', {
            fontFamily: 'Arial Black',
            fontSize: '30px',
            color: '#f8fafc',
            align: 'center',
            wordWrap: { width: panelWidth - 140, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        panelContainer.add([panelShadow, panelBg, panelGlow, this.quizIndexText, this.quizQuestionText]);

        const optionsStartY = -panelHeight / 2 + 88;
        const optionGapY = 56;
        this.quizOptionButtons = [];

        container.add([panelContainer]);

        for (let i = 0; i < 4; i++) {
            const y = optionsStartY + i * optionGapY;
            const option = this.createQuizOption(0, y, i);
            option.setScale(this.uiScale);
            this.quizOptionButtons.push(option);
            panelContainer.add(option);
        }
        container.setVisible(false);
        panelContainer.setScale(0.96);

        this.quizModal = container;
        this.quizModal.setData('panel', panelContainer);
        this.quizPanelContainer = panelContainer;
        this.quizPanelShadow = panelShadow;
        this.quizPanelBg = panelBg;
        this.quizPanelGlow = panelGlow;
        if (this.uiRoot) this.uiRoot.add(container);

        this.layoutQuizPanel();
    }

    private createStartModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(220);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0, 0);
        
        const title = this.add.text(width / 2, height / 2 - 150, 'Are you ready?', {
            fontFamily: 'Georgia',
            fontSize: '52px',
            color: '#f8fafc',
            stroke: '#0f172a',
            strokeThickness: 6
        }).setOrigin(0.5);

        const glow = this.add.text(width / 2, height / 2 - 150, 'Are you ready?', {
            fontFamily: 'Georgia',
            fontSize: '52px',
            color: '#22c55e',
            alpha: 0.5
        }).setOrigin(0.5);

        const button = this.createStartButton(width / 2, height / 2 + 40);

        container.add([overlay, glow, title, button]);
        container.setVisible(false);

        this.startModal = container;
        if (this.uiRoot) this.uiRoot.add(container);
    }

    private createEndModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(230);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75)
            .setOrigin(0, 0);

        const panelWidth = Math.min(640, width - 120);
        const panelHeight = Math.min(360, height - 220);
        const panelContainer = this.add.container(width / 2, height / 2).setScrollFactor(0);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.35);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 24);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x22c55e, 1);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(3, 0xffffff, 0.6);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const title = this.add.text(0, -panelHeight / 2 + 48, 'Chúc mừng!', {
            fontFamily: 'Arial Black',
            fontSize: '32px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -panelHeight / 2 + 100, 'Bạn đã hoàn thành hành trình', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#cbd5f5',
            align: 'center',
            wordWrap: { width: panelWidth - 80, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        this.endModalScoreText = this.add.text(0, 10, 'Điểm: 0', {
            fontFamily: 'Arial Black',
            fontSize: '26px',
            color: '#fef3c7',
            stroke: '#7c2d12',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.endModalTimeText = this.add.text(0, 50, 'Thời gian: 00:00', {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#fef3c7',
            stroke: '#7c2d12',
            strokeThickness: 3
        }).setOrigin(0.5);

        const restartButton = this.createRestartButton(0, panelHeight / 2 - 70);

        panelContainer.add([panelShadow, panelBg, title, subtitle, this.endModalScoreText, this.endModalTimeText, restartButton]);

        container.add([overlay, panelContainer]);
        container.setVisible(false);

        this.endModal = container;
        this.endModal.setData('panel', panelContainer);
        if (this.uiRoot) this.uiRoot.add(container);
    }

    private createTimeUpModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(240);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.78)
            .setOrigin(0, 0);

        const panelWidth = Math.min(640, width - 120);
        const panelHeight = Math.min(360, height - 220);
        const panelContainer = this.add.container(width / 2, height / 2).setScrollFactor(0);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.35);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 24);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x22c55e, 1);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(3, 0xffffff, 0.6);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const title = this.add.text(0, -panelHeight / 2 + 48, 'Hết giờ', {
            fontFamily: 'Arial Black',
            fontSize: '32px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -panelHeight / 2 + 100, 'Bạn chưa kịp hoàn thành đường đua', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#cbd5f5',
            align: 'center',
            wordWrap: { width: panelWidth - 80, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        const restartButton = this.createRestartButton(0, panelHeight / 2 - 70);

        panelContainer.add([panelShadow, panelBg, title, subtitle, restartButton]);

        container.add([overlay, panelContainer]);
        container.setVisible(false);

        this.timeUpModal = container;
        this.timeUpModal.setData('panel', panelContainer);
        if (this.uiRoot) this.uiRoot.add(container);
    }

    private createRestartButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setScrollFactor(0);
        const width = 260;
        const height = 64;
        const radius = 16;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const redraw = () => {
            bg.clear();
            bg.fillStyle(0x22c55e, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, 0xffffff, 0.9);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        redraw();

        const text = this.add.text(0, 0, 'CHƠI LẠI', {
            fontFamily: 'Arial Black',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        container.add([shadow, bg, text]);
        container.setSize(width, height);
        container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', () => {
            this.restartRun();
        });

        return container;
    }

    private createStartButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setScrollFactor(0);
        
        const bg = this.add.rectangle(0, 0, 240, 80, 0xfbbf24)
            .setStrokeStyle(4, 0xffffff)
            .setFillStyle(0x22c55e);
            
        const text = this.add.text(0, 0, 'START', {
            fontFamily: 'Arial Black', fontSize: '26px', color: '#ffffff'
        }).setOrigin(0.5);

        container.add([bg, text]);
        container.setSize(240, 80);

        const onPress = () => {
            if (!this.startModalOpen) return;
            bg.setFillStyle(0x16a34a);
            this.closeStartModal();
            this.openQuizModal();
        };

        const onRelease = () => {
            bg.setFillStyle(0x22c55e);
        };

        bg.setInteractive({ useHandCursor: true });
        text.setInteractive({ useHandCursor: true });

        bg.on('pointerdown', onPress);
        text.on('pointerdown', onPress);

        bg.on('pointerup', onRelease);
        text.on('pointerup', onRelease);

        bg.on('pointerout', onRelease);
        text.on('pointerout', onRelease);

        this.tweens.add({
            targets: container,
            scale: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        return container;
    }

    private openStartModal(): void {
        this.startModalOpen = true;
        this.jumpButton.setAlpha(0.4);
        this.stopTimer();

        this.startModal.setVisible(true);
        this.startModal.setAlpha(0);

        this.tweens.add({
            targets: this.startModal,
            alpha: 1,
            duration: 180
        });
    }

    private closeStartModal(): void {
        this.startModalOpen = false;
        this.jumpButton.setAlpha(1);
        this.startTimer();
        this.startModal.setVisible(false);
    }

    private createQuizOption(x: number, y: number, index: number): Phaser.GameObjects.Container {
        const label = ['A', 'B', 'C', 'D'][index];
        const container = this.add.container(x, y);

        const width = 660;
        const height = 56;
        const radius = 16;
        const palette = [0xe53935, 0x1e88e5, 0xfbc02d, 0x43a047];
        const hoverPalette = [0xef5350, 0x42a5f5, 0xffd54f, 0x66bb6a];
        const baseColor = palette[index % palette.length];
        const hoverColor = hoverPalette[index % hoverPalette.length];

        const glow = this.add.graphics();
        glow.fillStyle(baseColor, 0.18);
        glow.fillRoundedRect(-width / 2 + 6, -height / 2 + 10, width, height, radius + 4);

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.18);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const badge = this.add.graphics();

        const labelText = this.add.text(-width / 2 + 32, 0, label, {
            fontFamily: 'Arial Black',
            fontSize: '16px',
            color: '#111827'
        }).setOrigin(0.5);

        const text = this.add.text(-width / 2 + 70, 0, `${label}. ...`, {
            fontFamily: 'Arial',
            fontSize: '21px',
            color: '#f8fafc'
        }).setOrigin(0, 0.5);

        const hitPad = 12;
        const zone = this.add.zone(0, 0, width + hitPad * 2, height + hitPad * 2)
            .setInteractive({ useHandCursor: true });

        const redraw = (state: 'normal' | 'hover' | 'correct' | 'wrong') => {
            let fill = baseColor;
            let stroke = 0xffffff;
            let badgeFill = 0xffffff;

            if (state === 'hover') {
                fill = hoverColor;
                stroke = 0xffffff;
                badgeFill = 0xffffff;
            } else if (state === 'correct') {
                fill = 0x16a34a;
                stroke = 0x86efac;
                badgeFill = 0x86efac;
            } else if (state === 'wrong') {
                fill = 0xdc2626;
                stroke = 0xfca5a5;
                badgeFill = 0xfca5a5;
            }

            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, stroke, 0.8);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

            badge.clear();
            badge.fillStyle(badgeFill, 1);
            badge.fillRoundedRect(-width / 2 + 12, -height / 2 + 9, 30, height - 18, 10);
        };

        redraw('normal');
        glow.setVisible(false);

        container.add([glow, shadow, bg, badge, labelText, text, zone]);
        container.setSize(width, height);

        const onPress = () => {
            if (!this.quizOpen) return;
            this.handleQuizAnswer(index);
        };

        zone.on('pointerdown', () => {
            if (!this.quizOpen || this.quizLocked) return;
            redraw('hover');
            glow.setVisible(true);
            this.tweens.add({ targets: container, scale: 0.96, duration: 60, ease: 'Sine.easeOut' });
            onPress();
        });
        zone.on('pointerover', () => {
            if (this.quizOpen && !this.quizLocked) {
                redraw('hover');
                glow.setVisible(true);
                this.tweens.add({ targets: container, scale: 1.02, duration: 120, ease: 'Sine.easeOut' });
            }
        });
        zone.on('pointerout', () => {
            if (this.quizOpen && !this.quizLocked) {
                redraw('normal');
                glow.setVisible(false);
                this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
            }
        });
        zone.on('pointerup', () => {
            if (this.quizOpen && !this.quizLocked) {
                redraw('normal');
                glow.setVisible(false);
                this.tweens.add({ targets: container, scale: 1, duration: 80, ease: 'Sine.easeOut' });
            }
        });

        container.setData('redraw', redraw);
        container.setData('text', text);
        container.setData('glow', glow);

        return container;
    }

    private layoutQuizPanel(): void {
        if (!this.quizPanelContainer) return;

        const panelWidth = this.quizPanelWidth || Math.min(820, this.scale.width - 40);
        const paddingTop = 10;
        const headerHeight = 18;
        const questionGap = 6;
        const optionsTopGap = 16;
        const optionGapY = 16;
        const bottomPad = 16;
        const optionHeight = this.quizOptionButtons[0]?.height ?? 52;

        const questionHeight = this.quizQuestionText.height;
        const panelHeight = paddingTop + headerHeight + questionGap + questionHeight +
            optionsTopGap + (optionHeight * 4) + (optionGapY * 3) + bottomPad;

        this.quizPanelHeight = panelHeight;

        const { width, height } = this.scale;
        this.quizPanelContainer.setScale(this.uiScale);
        this.quizPanelContainer.setPosition(width / 2, height - (panelHeight * this.uiScale) / 2 - this.safeInsetBottom);

        // Redraw panel layers to fit new height
        this.quizPanelShadow.clear();
        this.quizPanelShadow.fillStyle(0x000000, 0.35);
        this.quizPanelShadow.fillRoundedRect(-panelWidth / 2 + 8, -panelHeight / 2 + 14, panelWidth, panelHeight, 28);

        this.quizPanelBg.clear();
        this.quizPanelBg.fillStyle(0x111827, 0.95);
        this.quizPanelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);
        this.quizPanelBg.lineStyle(2, 0xffffff, 0.4);
        this.quizPanelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);

        this.quizPanelGlow.clear();
        this.quizPanelGlow.fillStyle(0x1f2937, 0.9);
        this.quizPanelGlow.fillRoundedRect(-panelWidth / 2 + 10, -panelHeight / 2 + 10, panelWidth - 20, panelHeight - 20, 20);

        this.quizIndexText.setPosition(0, -panelHeight / 2 + paddingTop + headerHeight / 2);

        // Auto-reduce question font for mobile if needed
        const baseSize = 30;
        this.quizQuestionText.setFontSize(baseSize);
        this.quizQuestionText.setPosition(0, this.quizIndexText.y + headerHeight / 2 + questionGap);
        const maxQuestionHeight = 70;
        if (this.quizQuestionText.height > maxQuestionHeight) {
            this.quizQuestionText.setFontSize(26);
        }
        if (this.quizQuestionText.height > maxQuestionHeight) {
            this.quizQuestionText.setFontSize(24);
        }

        const startY = this.quizQuestionText.y + questionHeight + optionsTopGap + optionHeight / 2;
        this.quizOptionButtons.forEach((btn, i) => {
            btn.setPosition(0, startY + i * (optionHeight + optionGapY));
        });
    }

    private openQuizModal(): void {
        if (this.gameOver) return;
        if (this.gameCompleted) return;
        if (this.player.isJumping()) return;
        this.quizOpen = true;
        this.quizLocked = false;
        this.jumpButton.setAlpha(0.6);

        const question = this.getMockQuestions()[this.quizCurrentIndex % this.getMockQuestions().length];
        this.quizQuestionText.setText(question.question);
        if (this.quizIndexText) {
            const total = this.getMockQuestions().length;
            this.quizIndexText.setText(`Câu ${this.quizCurrentIndex + 1}/${total}`);
        }

        this.quizOptionButtons.forEach((btn, i) => {
            const redraw = btn.getData('redraw') as (state: 'normal' | 'hover' | 'correct' | 'wrong') => void;
            const text = btn.getData('text') as Phaser.GameObjects.Text;
            const glow = btn.getData('glow') as Phaser.GameObjects.Graphics | undefined;
            redraw('normal');
            text.setText(`${['A', 'B', 'C', 'D'][i]}. ${question.options[i]}`);
            glow?.setVisible(false);

            // Auto-shrink long answers for mobile
            if (text.width > 520) {
                text.setFontSize(19);
            }
            if (text.width > 560) {
                text.setFontSize(18);
            }
        });

        this.layoutQuizPanel();

        this.quizModal.setVisible(true);
        this.quizModal.setAlpha(0);
        const panel = this.quizModal.getData('panel') as Phaser.GameObjects.Container;
        panel.setScale(0.96);
        panel.y += 18;
        this.tweens.add({
            targets: this.quizModal,
            alpha: 1,
            duration: 180
        });
        this.tweens.add({
            targets: panel,
            scale: 1,
            y: panel.y - 18,
            duration: 220,
            ease: 'Back.easeOut'
        });
    }

    private closeQuizModal(): void {
        this.quizOpen = false;
        this.quizLocked = false;
        this.jumpButton.setAlpha(1);
        this.quizModal.setVisible(false);
    }

    private async handleQuizAnswer(index: number): Promise<void> {
        const question = this.getMockQuestions()[this.quizCurrentIndex % this.getMockQuestions().length];
        const isCorrect = index === question.correctIndex;

        const btn = this.quizOptionButtons[index];
        const redraw = btn.getData('redraw') as (state: 'normal' | 'hover' | 'correct' | 'wrong') => void;

        if (isCorrect) {
            this.quizLocked = true;
            redraw('correct');
            this.tweens.add({ targets: btn, scale: 1.02, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
            this.updateScore(1);
            this.speedUpJump();
            this.closeQuizModal();
            await this.handleJump();
            this.quizCurrentIndex += 1;
            this.time.delayedCall(250, () => {
                this.openQuizModal();
            });
        } else {
            this.quizLocked = true;
            redraw('wrong');
            this.tweens.add({ targets: btn, scale: 1.02, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
            this.updateScore(-1);
            this.showPlayerState('incorrect');
            const panel = this.quizModal.getData('panel') as Phaser.GameObjects.Container;
            const startX = panel.x;
            this.tweens.add({
                targets: panel,
                x: startX + 10,
                duration: 60,
                yoyo: true,
                repeat: 3,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    panel.x = startX;
                    this.quizLocked = false;
                    redraw('normal');
                }
            });
        }
    }

    private getMockQuestions() {
        return [
            {
                question: 'Đâu là thủ đô của Việt Nam?',
                options: ['Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'],
                correctIndex: 0
            },
            {
                question: 'Phaser sử dụng ngôn ngữ nào?',
                options: ['TypeScript/JavaScript', 'C#', 'Python', 'Go'],
                correctIndex: 0
            },
            {
                question: 'Màu của chiếc lá trong game là gì?',
                options: ['Xanh', 'Đỏ', 'Tím', 'Vàng'],
                correctIndex: 0
            }
        ];
    }

    async handleJump() {
        if (this.player.isJumping()) return;
        if (this.gameOver) return;

        const nextIndex = this.currentLeafIndex + 1;
        const maxIndex = this.leafPath.length > 0 ? this.leafPath.length - 1 : Number.POSITIVE_INFINITY;

        if (this.leafPath.length > 0 && nextIndex > maxIndex) {
            return;
        }
        const targetPos = this.getLeafPosition(nextIndex);

        // Stop idle animation during jump
        this.player.stopIdle();

        // Scroll Camera
        this.tweens.add({
            targets: this.camera,
            scrollY: targetPos.y - 800,
            duration: 600,
            ease: 'Sine.easeInOut'
        });

        // Perform jump using EmoteCharacter
        await this.player.jumpTo(targetPos.x, targetPos.y, this.jumpDurationMs);

        // Update state after jump completes
        this.currentLeafIndex = nextIndex;

        const nextPos = this.getLeafPosition(this.currentLeafIndex + 1);
        this.player.flip(nextPos.x > targetPos.x);

        // Show correct state on new leaf, then resume idle
        this.player.showCorrect(800);
        this.time.delayedCall(800, () => {
            this.player.playIdle();
        });

        if (this.leafPath.length > 0 && this.currentLeafIndex >= maxIndex) {
            this.gameCompleted = true;
            this.jumpButton.setAlpha(0.4);
            this.quizOpen = false;
            this.quizLocked = false;
            this.stopTimer();
            this.timerOverlay.setVisible(false);
            if (this.totalTimeMs > 0) {
                this.updateScore(3);
            }
            this.updateEndTimeText();
            this.time.delayedCall(400, () => {
                this.openEndModal();
            });
        }
    }

    private startTimer(): void {
        if (this.timerEvent) {
            this.timerEvent.remove(false);
        }

        this.totalTimeMs = 180000;
        this.updateTimerText(this.totalTimeMs);

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                if (this.gameCompleted || this.gameOver) return;
                this.totalTimeMs -= 1000;
                this.updateTimerText(this.totalTimeMs);
                if (this.totalTimeMs <= 0) {
                    this.totalTimeMs = 0;
                    this.updateTimerText(this.totalTimeMs);
                    this.handleTimeUp();
                }
            }
        });
    }

    private stopTimer(): void {
        if (this.timerEvent) {
            this.timerEvent.remove(false);
        }
    }

    private updateTimerText(ms: number): void {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        const text = `${pad(minutes)}:${pad(seconds)}`;
        this.timerText.setText(text);
    }

    private handleTimeUp(): void {
        if (this.gameOver || this.gameCompleted) return;
        this.gameOver = true;
        this.quizOpen = false;
        this.quizLocked = false;
        this.jumpButton.setAlpha(0.4);
        this.closeQuizModal();
        this.openTimeUpModal();
    }

    private openEndModal(): void {
        if (!this.endModal) return;
        const panel = this.endModal.getData('panel') as Phaser.GameObjects.Container;
        panel.setScale(0.96);
        this.endModal.setVisible(true);
        this.endModal.setAlpha(0);
        this.launchConfetti();
        this.tweens.add({
            targets: this.endModal,
            alpha: 1,
            duration: 200
        });
        this.tweens.add({
            targets: panel,
            scale: 1,
            duration: 240,
            ease: 'Back.easeOut'
        });
    }

    private launchConfetti(): void {
        if (this.confettiEmitter) {
            this.confettiEmitter.destroy();
        }
        if (this.confettiBurstEvent) {
            this.confettiBurstEvent.remove(false);
            this.confettiBurstEvent = undefined;
        }

        const { width, height } = this.scale;
        this.confettiEmitter = this.add.particles(0, 0, 'tile-flower', {
            speed: { min: 90, max: 170 },
            angle: { min: 0, max: 360 },
            rotate: { min: -220, max: 220 },
            scale: { start: 0.45, end: 0.15 },
            lifespan: { min: 1400, max: 2200 },
            quantity: 0,
            frequency: -1,
            gravityY: 120,
            tint: [0xfacc15, 0x22c55e, 0x3b82f6, 0xf97316, 0xef4444, 0xa855f7],
            blendMode: 'ADD'
        });

        this.confettiEmitter.setScrollFactor(0);
        this.confettiEmitter.setDepth(2100);
        this.uiRoot.add(this.confettiEmitter);

        const burstPositions = [
            { x: width * 0.25, y: height * 0.18 },
            { x: width * 0.5, y: height * 0.14 },
            { x: width * 0.75, y: height * 0.18 }
        ];
        let burstIndex = 0;

        this.confettiBurstEvent = this.time.addEvent({
            delay: 950,
            repeat: 2,
            callback: () => {
                if (!this.confettiEmitter) return;
                const pos = burstPositions[burstIndex % burstPositions.length];
                burstIndex += 1;
                this.confettiEmitter.explode(14, pos.x, pos.y);
            }
        });

        this.time.delayedCall(3500, () => {
            this.confettiEmitter?.destroy();
            this.confettiEmitter = undefined;
            this.confettiBurstEvent?.remove(false);
            this.confettiBurstEvent = undefined;
        });
    }

    private openTimeUpModal(): void {
        if (!this.timeUpModal) return;
        const panel = this.timeUpModal.getData('panel') as Phaser.GameObjects.Container;
        panel.setScale(0.96);
        this.timeUpModal.setVisible(true);
        this.timeUpModal.setAlpha(0);
        this.tweens.add({
            targets: this.timeUpModal,
            alpha: 1,
            duration: 200
        });
        this.tweens.add({
            targets: panel,
            scale: 1,
            duration: 240,
            ease: 'Back.easeOut'
        });
    }

    private closeTimeUpModal(): void {
        if (!this.timeUpModal) return;
        this.timeUpModal.setVisible(false);
    }

    private restartRun(): void {
        this.gameOver = false;
        this.gameCompleted = false;
        this.quizOpen = false;
        this.quizLocked = false;
        this.quizCurrentIndex = 0;
        this.score = 0;
        this.scoreText.setText('Score: 0');
        this.jumpDurationMs = 900;

        this.closeTimeUpModal();
        this.closeQuizModal();

        const startPos = this.getLeafPosition(0);
        this.player.setPosition(startPos.x, startPos.y);
        this.player.playIdle();

        this.currentLeafIndex = 0;
        const nextPos = this.getLeafPosition(this.currentLeafIndex + 1);
        this.player.flip(nextPos.x > startPos.x);

        this.camera.scrollY = startPos.y - 900;

        this.stopTimer();
        this.timerOverlay.setVisible(true);
        this.openStartModal();
    }

    private updateScore(delta: number): void {
        this.score += delta;
        this.scoreText.setText(`Score: ${this.score}`);
        if (this.endModalScoreText) {
            this.endModalScoreText.setText(`Điểm: ${this.score}`);
        }
    }

    private updateEndTimeText(): void {
        if (!this.endModalTimeText) return;
        const elapsedMs = 180000 - this.totalTimeMs;
        const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        this.endModalTimeText.setText(`Thời gian: ${pad(minutes)}:${pad(seconds)}`);
    }

    private speedUpJump(): void {
        this.jumpDurationMs = Math.max(450, this.jumpDurationMs - 40);
    }

    getLeafPosition(index: number) {
        if (this.leafPath.length > 0 && this.trackImage) {
            const pathLength = this.leafPath.length;
            const pathIndex = Math.min(index, pathLength - 1);

            const leaf = this.leafPath[pathIndex];
            const scale = this.trackImage.scaleX;
            const mapLeft = this.trackImage.x - this.trackImage.displayWidth / 2;
            const mapTop = this.trackImage.y - this.trackImage.displayHeight;

            const x = mapLeft + (leaf.x * scale);
            const y = mapTop + (leaf.y * scale);

            return { x, y };
        }

        const centerX = this.scale.width / 2;
        const isLeft = index % 2 === 0;
        
        // Adjacent leaf = alternate left/right with a small upward step
        const y = this.leafStartY - (index * this.leafStepY);
        const x = isLeft ? centerX - this.leafSideOffset : centerX + this.leafSideOffset;
        
        return { x, y };
    }

    private buildLeafPath(textureKey: string): Phaser.Math.Vector2[] {
        const texture = this.textures.get(textureKey);
        const source = texture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;

        if (!source || !source.width || !source.height) {
            return [];
        }

        const canvas = this.sys.game.canvas.ownerDocument.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        ctx.drawImage(source, 0, 0);
        const imageData = ctx.getImageData(0, 0, source.width, source.height);
        const data = imageData.data;

        const width = source.width;
        const height = source.height;
        const visited = new Uint8Array(width * height);
        const centers: Phaser.Math.Vector2[] = [];

        const isLeafPixel = (idx: number) => {
            const r = data[idx] / 255;
            const g = data[idx + 1] / 255;
            const b = data[idx + 2] / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;

            if (delta === 0) return false;

            let hue = 0;
            if (max === r) {
                hue = ((g - b) / delta) % 6;
            } else if (max === g) {
                hue = (b - r) / delta + 2;
            } else {
                hue = (r - g) / delta + 4;
            }
            hue = Math.round(hue * 60);
            if (hue < 0) hue += 360;

            const saturation = max === 0 ? 0 : delta / max;

            const isGreenHue = hue >= 70 && hue <= 150;
            const isSaturated = saturation >= 0.35;

            return isGreenHue && isSaturated;
        };

        const minBlobSize = 4500;
        const stack: number[] = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                if (visited[index]) continue;

                const dataIndex = index * 4;
                if (!isLeafPixel(dataIndex)) {
                    visited[index] = 1;
                    continue;
                }

                let sumX = 0;
                let sumY = 0;
                let count = 0;
                let minX = x;
                let maxX = x;
                let minY = y;
                let maxY = y;

                stack.push(index);
                visited[index] = 1;

                while (stack.length) {
                    const current = stack.pop() as number;
                    const cy = Math.floor(current / width);
                    const cx = current - (cy * width);

                    const currentDataIndex = current * 4;
                    if (!isLeafPixel(currentDataIndex)) {
                        continue;
                    }

                    sumX += cx;
                    sumY += cy;
                    count += 1;
                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    if (cx > 0) {
                        const left = current - 1;
                        if (!visited[left]) {
                            const leftIndex = left * 4;
                            if (isLeafPixel(leftIndex)) {
                                visited[left] = 1;
                                stack.push(left);
                            } else {
                                visited[left] = 1;
                            }
                        }
                    }

                    if (cx < width - 1) {
                        const right = current + 1;
                        if (!visited[right]) {
                            const rightIndex = right * 4;
                            if (isLeafPixel(rightIndex)) {
                                visited[right] = 1;
                                stack.push(right);
                            } else {
                                visited[right] = 1;
                            }
                        }
                    }

                    if (cy > 0) {
                        const up = current - width;
                        if (!visited[up]) {
                            const upIndex = up * 4;
                            if (isLeafPixel(upIndex)) {
                                visited[up] = 1;
                                stack.push(up);
                            } else {
                                visited[up] = 1;
                            }
                        }
                    }

                    if (cy < height - 1) {
                        const down = current + width;
                        if (!visited[down]) {
                            const downIndex = down * 4;
                            if (isLeafPixel(downIndex)) {
                                visited[down] = 1;
                                stack.push(down);
                            } else {
                                visited[down] = 1;
                            }
                        }
                    }
                }

                if (count >= minBlobSize) {
                    const blobWidth = maxX - minX;
                    const blobHeight = maxY - minY;
                    const aspect = blobWidth / (blobHeight || 1);

                    if (blobWidth >= 90 && blobHeight >= 90 && aspect > 0.6 && aspect < 1.7) {
                        centers.push(new Phaser.Math.Vector2(sumX / count, sumY / count));
                    }
                }
            }
        }

        centers.sort((a, b) => {
            const dy = b.y - a.y;
            if (Math.abs(dy) > 2) return dy;
            return a.x - b.x;
        });

        return centers;
    }

    /**
     * Show player state - correct or incorrect
     */
    showPlayerState(state: 'correct' | 'incorrect') {
        if (state === 'correct') {
            this.player.showCorrect(800);
        } else {
            this.player.showIncorrect(800);
        }
    }
}
