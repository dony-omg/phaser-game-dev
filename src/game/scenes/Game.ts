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

        // Timer (HUD header)
        this.timerOverlay = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);

        this.timerText = this.add.text(width - 20, 40, '03:00', {
            fontFamily: 'Arial Black', fontSize: '28px', color: '#f8fafc',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(1, 0.5);

        this.timerOverlay.add([this.timerText]);
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
        this.scale.on('resize', () => {
            if (this.quizModal) this.layoutQuiz();
        });

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
        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

        const panelContainer = this.add.container(0, 0);
        const panelShadow = this.add.graphics();
        const panelBg = this.add.graphics();
        const panelGlow = this.add.graphics();

        this.quizIndexText = this.add.text(0, 0, 'Câu 1/4', {
            fontFamily: 'Arial Black',
            fontSize: '16px',
            color: '#fcd34d'
        }).setOrigin(0.5, 0);

        this.quizQuestionText = this.add.text(0, 0, '...', {
            fontFamily: 'Arial Black',
            fontSize: '30px',
            color: '#f8fafc',
            align: 'center',
            wordWrap: { width: 600, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        panelContainer.add([panelShadow, panelBg, panelGlow, this.quizIndexText, this.quizQuestionText]);

        this.quizOptionButtons = [];
        for (let i = 0; i < 4; i++) {
            const option = this.createQuizOption(0, 0, i);
            this.quizOptionButtons.push(option);
            panelContainer.add(option);
        }

        container.add(panelContainer);
        container.setVisible(false);

        this.quizModal = container;
        this.quizModal.setData('panel', panelContainer);
        this.quizPanelContainer = panelContainer;
        this.quizPanelShadow = panelShadow;
        this.quizPanelBg = panelBg;
        this.quizPanelGlow = panelGlow;
        if (this.uiRoot) this.uiRoot.add(container);

        this.layoutQuiz();
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

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0, 0);

        const panelWidth = Math.min(640, width - 120);
        const panelHeight = Math.min(360, height - 220);
        const panelContainer = this.add.container(width / 2, height / 2).setScrollFactor(0);
        overlay.setDepth(0);
        panelContainer.setDepth(1);

        const blocker = this.add.zone(0, 0, width, height).setOrigin(0, 0);
        blocker.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), (shape, x, y) => {
            const panelBounds = panelContainer.getBounds();
            if (Phaser.Geom.Rectangle.Contains(panelBounds, x, y)) return false;
            return Phaser.Geom.Rectangle.Contains(shape as Phaser.Geom.Rectangle, x, y);
        });
        blocker.on('pointerdown', () => {});

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.28);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 12, -panelHeight / 2 + 18, panelWidth, panelHeight, 26);
        panelShadow.fillStyle(0x000000, 0.18);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 8, -panelHeight / 2 + 12, panelWidth, panelHeight, 24);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x22c55e, 1);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(3, 0xffffff, 0.6);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const title = this.add.text(0, -panelHeight / 2 + 50, 'Chúc mừng!', {
            fontFamily: 'Arial Black',
            fontSize: '40px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -panelHeight / 2 + 108, 'Bạn đã hoàn thành hành trình', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#d1fae5',
            align: 'center',
            wordWrap: { width: panelWidth - 80, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        const statsGap = 18;
        const cardWidth = Math.min(220, Math.floor((panelWidth - 120) / 2));
        const cardHeight = 52;
        const statsY = 8;

        const scoreCard = this.add.graphics();
        scoreCard.fillStyle(0x0f172a, 0.35);
        scoreCard.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        scoreCard.lineStyle(2, 0xffffff, 0.25);
        scoreCard.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

        const timeCard = this.add.graphics();
        timeCard.fillStyle(0x0f172a, 0.35);
        timeCard.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        timeCard.lineStyle(2, 0xffffff, 0.25);
        timeCard.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

        const scoreCardContainer = this.add.container(-cardWidth / 2 - statsGap / 2, statsY, [scoreCard]);
        const timeCardContainer = this.add.container(cardWidth / 2 + statsGap / 2, statsY, [timeCard]);

        const scoreLabel = this.add.text(scoreCardContainer.x, statsY - 14, 'ĐIỂM', {
            fontFamily: 'Arial Black',
            fontSize: '12px',
            color: '#a7f3d0'
        }).setOrigin(0.5);

        const timeLabel = this.add.text(timeCardContainer.x, statsY - 14, 'THỜI GIAN', {
            fontFamily: 'Arial Black',
            fontSize: '12px',
            color: '#a7f3d0'
        }).setOrigin(0.5);

        this.endModalScoreText = this.add.text(scoreCardContainer.x, statsY + 6, '0', {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        this.endModalTimeText = this.add.text(timeCardContainer.x, statsY + 6, '00:00', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        const restartButton = this.createEndRestartButton(0, panelHeight / 2 - 72);
        restartButton.setDepth(2);

        panelContainer.add([
            panelShadow,
            panelBg,
            title,
            subtitle,
            scoreCardContainer,
            timeCardContainer,
            scoreLabel,
            timeLabel,
            this.endModalScoreText,
            this.endModalTimeText,
            restartButton
        ]);

        container.add([overlay, blocker, panelContainer]);
        container.setVisible(false);

        this.endModal = container;
        this.endModal.setData('panel', panelContainer);
        this.endModal.setData('overlay', overlay);
        if (this.uiRoot) this.uiRoot.add(container);
    }
    
    private createEndRestartButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setScrollFactor(0);
        const width = 300;
        const height = 68;
        const radius = 18;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.35);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 8, width, height, radius);

        const bg = this.add.graphics();
        const draw = (fill: number) => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, 0xffffff, 0.7);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        draw(0x0f172a);

        const text = this.add.text(0, 0, 'CHƠI LẠI', {
            fontFamily: 'Arial Black',
            fontSize: '26px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        container.add([shadow, bg, text]);
        container.setSize(width, height);
        container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

        container.on('pointerover', () => {
            draw(0x1f2937);
            this.tweens.add({ targets: container, scale: 1.02, duration: 120, ease: 'Sine.easeOut' });
        });
        container.on('pointerout', () => {
            draw(0x0f172a);
            this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
        });
        container.on('pointerdown', () => {
            draw(0x0b1220);
            this.tweens.add({ targets: container, scale: 0.98, duration: 80, ease: 'Sine.easeOut' });
            this.restartRun();
        });
        container.on('pointerup', () => {
            draw(0x1f2937);
            this.tweens.add({ targets: container, scale: 1.02, duration: 80, ease: 'Sine.easeOut' });
        });

        return container;
    }

    private createTimeUpModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(240);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.65)
            .setOrigin(0, 0);

        const panelWidth = Math.min(620, width - 120);
        const panelHeight = Math.min(340, height - 220);
        const panelContainer = this.add.container(width / 2, height / 2).setScrollFactor(0);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.45);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 10, -panelHeight / 2 + 14, panelWidth, panelHeight, 26);
        panelShadow.fillStyle(0x000000, 0.2);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 26);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0f172a, 0.98);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(2, 0xffffff, 0.18);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const accent = this.add.graphics();
        accent.fillStyle(0x22c55e, 1);
        accent.fillRoundedRect(-120, -panelHeight / 2 + 24, 240, 46, 22);

        const divider = this.add.graphics();
        divider.lineStyle(2, 0xffffff, 0.12);
        divider.strokeLineShape(new Phaser.Geom.Line(
            -panelWidth / 2 + 40,
            -panelHeight / 2 + 92,
            panelWidth / 2 - 40,
            -panelHeight / 2 + 92
        ));

        const cornerGlow = this.add.graphics();
        cornerGlow.fillStyle(0x22c55e, 0.12);
        cornerGlow.fillCircle(panelWidth / 2 - 40, -panelHeight / 2 + 40, 46);
        cornerGlow.fillStyle(0xffffff, 0.06);
        cornerGlow.fillCircle(-panelWidth / 2 + 50, panelHeight / 2 - 40, 54);

        const title = this.add.text(0, -panelHeight / 2 + 47, 'Hết giờ', {
            fontFamily: 'Arial Black',
            fontSize: '30px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -panelHeight / 2 + 112, 'Bạn chưa kịp hoàn thành đường đua', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#e2e8f0',
            align: 'center',
            wordWrap: { width: panelWidth - 80, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        const restartButton = this.createRestartButton(0, panelHeight / 2 - 70);

        panelContainer.add([panelShadow, panelBg, cornerGlow, accent, divider, title, subtitle, restartButton]);

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
        shadow.fillStyle(0x000000, 0.35);
        shadow.fillRoundedRect(-width / 2 + 5, -height / 2 + 7, width, height, radius);

        const bg = this.add.graphics();
        const draw = (fill: number, stroke: number, glowAlpha: number) => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, stroke, 0.9);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.fillStyle(0xffffff, glowAlpha);
            bg.fillRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, 18, 12);
        };
        draw(0x22c55e, 0xffffff, 0.18);

        const text = this.add.text(0, 0, 'CHƠI LẠI', {
            fontFamily: 'Arial Black',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        container.add([shadow, bg, text]);
        container.setSize(width, height);
        container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
        container.on('pointerover', () => {
            draw(0x16a34a, 0xffffff, 0.2);
            this.tweens.add({ targets: container, scale: 1.02, duration: 120, ease: 'Sine.easeOut' });
        });
        container.on('pointerout', () => {
            draw(0x22c55e, 0xffffff, 0.18);
            this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
        });
        container.on('pointerdown', () => {
            draw(0x15803d, 0xe2e8f0, 0.1);
            this.tweens.add({ targets: container, scale: 0.98, duration: 80, ease: 'Sine.easeOut' });
            this.restartRun();
        });
        container.on('pointerup', () => {
            draw(0x16a34a, 0xffffff, 0.2);
            this.tweens.add({ targets: container, scale: 1.02, duration: 80, ease: 'Sine.easeOut' });
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
        const baseColor = palette[index % palette.length];

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

        const redraw = (state: 'normal' | 'correct' | 'wrong') => {
            const layout = container.getData('layout') as { x: number; w: number; h: number; radius: number } | undefined;
            const drawX = layout?.x ?? -width / 2;
            const drawW = layout?.w ?? width;
            const drawH = layout?.h ?? height;
            const drawR = layout?.radius ?? radius;

            let fill = baseColor;
            let stroke = 0xffffff;
            let badgeFill = 0xffffff;

            if (state === 'correct') {
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
            bg.fillRoundedRect(drawX, -drawH / 2, drawW, drawH, drawR);
            bg.lineStyle(2, stroke, 0.8);
            bg.strokeRoundedRect(drawX, -drawH / 2, drawW, drawH, drawR);

            badge.clear();
            badge.fillStyle(badgeFill, 1);
            badge.fillRoundedRect(drawX + 10, -drawH / 2 + 10, 30, drawH - 20, 10);
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
            onPress();
        });

        container.setData('redraw', redraw);
        container.setData('text', text);
        container.setData('glow', glow);
        container.setData('bg', bg);
        container.setData('badge', badge);
        container.setData('badgeText', labelText);
        container.setData('hit', zone);
        container.setData('baseColor', baseColor);
        container.setData('hoverColor', baseColor);

        return container;
    }

    private setQuestion(data: { index: number; total: number; question: string; options: string[] }): void {
        this.quizIndexText.setText(`Câu ${data.index}/${data.total}`);
        const maxQuestionChars = 55;
        const question =
            data.question.length > maxQuestionChars
                ? `${data.question.slice(0, maxQuestionChars - 1)}…`
                : data.question;
        this.quizQuestionText.setText(question);

        this.quizOptionButtons.forEach((btn, i) => {
            const redraw = btn.getData('redraw') as (state: 'normal' | 'correct' | 'wrong') => void;
            const text = btn.getData('text') as Phaser.GameObjects.Text;
            const glow = btn.getData('glow') as Phaser.GameObjects.Graphics | undefined;

            redraw('normal');
            glow?.setVisible(false);
            text.setFontSize(21);
            text.setText(`${['A', 'B', 'C', 'D'][i]}. ${data.options[i] ?? ''}`);

            // Auto-shrink long answers for mobile
            if (text.width > 520) text.setFontSize(19);
            if (text.width > 560) text.setFontSize(18);
        });

        this.layoutQuiz();
    }

    private layoutQuiz(): void {
        if (!this.quizPanelContainer) return;

        const { width, height } = this.scale;

        this.uiScale = Phaser.Math.Clamp(width / 900, 0.9, 1.05);
        this.safeInsetBottom = Math.max(24, Math.round(height * 0.03));

        const panelWidth = Math.floor(width * 0.9);
        const maxPanelHeight = Math.floor(height * 0.62 / this.uiScale);

        // Question wrap width
        const questionWrap = Math.floor(panelWidth * 0.8);
        this.quizQuestionText.setWordWrapWidth(questionWrap, true);

        // Auto-reduce question font until layout fits
        let fontSize = 30;
        const minFont = 22;
        let panelHeight = 0;

        while (fontSize >= minFont) {
            this.quizQuestionText.setFontSize(fontSize);
            const qBounds = this.quizQuestionText.getBounds();
            const headerH = this.quizIndexText.getBounds().height;
            const paddingTop = 10;
            const paddingBottom = 14;
            const questionGap = 6;
            const optionsTopGap = 14;
            const buttonHeight = 62;
            const buttonGap = 14;

            panelHeight =
                paddingTop +
                headerH +
                questionGap +
                qBounds.height +
                optionsTopGap +
                (buttonHeight * 4) +
                (buttonGap * 3) +
                paddingBottom;

            if (panelHeight <= maxPanelHeight) break;
            fontSize -= 2;
        }

        // If still too tall, shrink gaps a little
        const qBounds = this.quizQuestionText.getBounds();
        const headerH = this.quizIndexText.getBounds().height;
        let paddingTop = 12;
        let paddingBottom = 16;
        let questionGap = 8;
        let optionsTopGap = 14;
        let buttonHeight = 62;
        let buttonGap = 14;
        if (panelHeight > maxPanelHeight) {
            paddingTop = 10;
            paddingBottom = 12;
            questionGap = 6;
            optionsTopGap = 12;
        }

        const minButtonHeight = 52;
        const minButtonGap = 8;
        const fixedHeight =
            paddingTop +
            headerH +
            questionGap +
            qBounds.height +
            optionsTopGap +
            paddingBottom;
        const maxButtonsSpace = Math.max(0, maxPanelHeight - fixedHeight);
        const desiredButtonsSpace = (buttonHeight * 4) + (buttonGap * 3);
        if (desiredButtonsSpace > maxButtonsSpace) {
            const perButton = Math.floor((maxButtonsSpace - (buttonGap * 3)) / 4);
            buttonHeight = Phaser.Math.Clamp(perButton, minButtonHeight, buttonHeight);
            const remaining = maxButtonsSpace - (buttonHeight * 4);
            const perGap = Math.floor(remaining / 3);
            buttonGap = Phaser.Math.Clamp(perGap, minButtonGap, buttonGap);
        }

        panelHeight =
            paddingTop +
            headerH +
            questionGap +
            qBounds.height +
            optionsTopGap +
            (buttonHeight * 4) +
            (buttonGap * 3) +
            paddingBottom;

        this.quizPanelHeight = panelHeight;
        this.quizPanelWidth = panelWidth;

        // Anchor bottom with safe area
        const panelX = width / 2;
        const panelY = height - (panelHeight * this.uiScale) / 2 - this.safeInsetBottom;
        this.quizPanelContainer.setScale(this.uiScale);
        this.quizPanelContainer.setPosition(panelX, panelY);

        // Draw panel
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

        // Header + question positions
        const headerY = -panelHeight / 2 + paddingTop;
        this.quizIndexText.setPosition(0, headerY);
        const questionY = headerY + headerH + questionGap;
        this.quizQuestionText.setPosition(0, questionY);

        // Buttons
        const answersStartY = questionY + qBounds.height + optionsTopGap + (buttonHeight / 2);
        this.quizOptionButtons.forEach((btn, i) => {
            const y = answersStartY + i * (buttonHeight + buttonGap);
            const x = -panelWidth / 2 + 16;
            const w = panelWidth - 32;

            btn.setPosition(0, y);

            const bg = btn.getData('bg') as Phaser.GameObjects.Graphics;
            const badge = btn.getData('badge') as Phaser.GameObjects.Graphics;
            const badgeText = btn.getData('badgeText') as Phaser.GameObjects.Text;
            const text = btn.getData('text') as Phaser.GameObjects.Text;
            const baseColor = btn.getData('baseColor') as number;

            btn.setData('layout', { x, w, h: buttonHeight, radius: 16 });

            bg.clear();
            bg.fillStyle(baseColor, 1);
            bg.fillRoundedRect(x, -buttonHeight / 2, w, buttonHeight, 16);
            bg.lineStyle(2, 0xffffff, 0.8);
            bg.strokeRoundedRect(x, -buttonHeight / 2, w, buttonHeight, 16);

            badge.clear();
            badge.fillStyle(0xffffff, 1);
            badge.fillRoundedRect(x + 10, -buttonHeight / 2 + 10, 30, buttonHeight - 20, 10);

            badgeText.setPosition(x + 25, 0);
            text.setPosition(x + 55, 0);

            const hit = btn.getData('hit') as Phaser.GameObjects.Zone;
            const hitPad = 10;
            hit.setSize(w + hitPad * 2, buttonHeight + hitPad * 2);
            hit.setPosition(0, 0);
            btn.setSize(w, buttonHeight);
        });

        // Ensure top art visible
        if (panelY - (panelHeight * this.uiScale) / 2 < 80) {
            this.quizPanelContainer.y = 80 + (panelHeight * this.uiScale) / 2;
        }
    }

    private openQuizModal(): void {
        if (this.gameOver) return;
        if (this.gameCompleted) return;
        if (this.player.isJumping()) return;
        this.quizOpen = true;
        this.quizLocked = false;
        this.jumpButton.setAlpha(0.6);

        const question = this.getMockQuestions()[this.quizCurrentIndex % this.getMockQuestions().length];
        this.setQuestion({
            index: this.quizCurrentIndex + 1,
            total: this.getMockQuestions().length,
            question: question.question,
            options: question.options
        });

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
        const overlay = this.endModal.getData('overlay') as Phaser.GameObjects.Rectangle | undefined;
        panel.setScale(0.9);
        if (overlay) overlay.setAlpha(0);
        this.endModal.setVisible(true);
        this.endModal.setAlpha(1);
        this.launchConfetti();
        this.tweens.add({
            targets: overlay,
            alpha: 0.6,
            duration: 200
        });
        this.tweens.add({
            targets: panel,
            scale: 1,
            duration: 260,
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
            scale: { start: 0.32, end: 0.1 },
            lifespan: { min: 1400, max: 2200 },
            quantity: 0,
            frequency: -1,
            gravityY: 160
        });

        this.confettiEmitter.setScrollFactor(0);
        this.confettiEmitter.setDepth(2100);
        this.uiRoot.add(this.confettiEmitter);

        this.confettiBurstEvent = this.time.addEvent({
            delay: 900,
            repeat: 0,
            callback: () => {
                if (!this.confettiEmitter) return;
                this.confettiEmitter.explode(18, width / 2, height / 2);
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

    private closeEndModal(): void {
        if (!this.endModal) return;
        this.endModal.setVisible(false);
        this.endModal.setAlpha(0);
        const overlay = this.endModal.getData('overlay') as Phaser.GameObjects.Rectangle | undefined;
        if (overlay) overlay.setAlpha(0);
        if (this.confettiEmitter) {
            this.confettiEmitter.destroy();
            this.confettiEmitter = undefined;
        }
        if (this.confettiBurstEvent) {
            this.confettiBurstEvent.remove(false);
            this.confettiBurstEvent = undefined;
        }
    }

    private restartRun(): void {
        this.gameOver = false;
        this.gameCompleted = false;
        this.quizOpen = false;
        this.quizLocked = false;
        this.quizCurrentIndex = 0;
        this.startModalOpen = false;
        this.score = 0;
        this.scoreText.setText('Score: 0');
        this.jumpDurationMs = 900;

        this.closeTimeUpModal();
        this.closeQuizModal();
        this.closeEndModal();
        if (this.startModal) this.startModal.setVisible(false);

        const startPos = this.getLeafPosition(0);
        this.player.setPosition(startPos.x, startPos.y);
        this.player.playIdle();

        this.currentLeafIndex = 0;
        const nextPos = this.getLeafPosition(this.currentLeafIndex + 1);
        this.player.flip(nextPos.x > startPos.x);

        this.camera.scrollY = startPos.y - 900;

        this.stopTimer();
        this.timerOverlay.setVisible(true);
        this.jumpButton.setAlpha(1);
        this.startTimer();
        this.openQuizModal();
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
