import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { EmoteCharacter } from '../objects/EmoteCharacter';
import type { GameQuestion } from '../../services/api';
import { getGameConfig, resolveGameCode } from '../gameConfig';
import { QuizPanel } from '../ui/QuizPanel';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    trackImage!: Phaser.GameObjects.Image;
    player!: EmoteCharacter;
    parallaxLayers: Phaser.GameObjects.Image[];
    uiRoot!: Phaser.GameObjects.Container;
    uiCamera!: Phaser.Cameras.Scene2D.Camera;
    timerOverlay!: Phaser.GameObjects.Container;
    hudBackButton!: Phaser.GameObjects.Container;
    hudPointsPill!: Phaser.GameObjects.Container;
    hudTimerPill!: Phaser.GameObjects.Container;
    hudHeartsPill!: Phaser.GameObjects.Container;

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
    quizFeedbackTitleText!: Phaser.GameObjects.Text;
    quizFeedbackSubtitleText!: Phaser.GameObjects.Text;
    quizFeedbackState: 'idle' | 'correct' | 'wrong' = 'idle';
    quizQuestionText!: Phaser.GameObjects.Text;
    quizIndexText!: Phaser.GameObjects.Text;
    quizOptionButtons: Phaser.GameObjects.Container[] = [];
    quizOpen: boolean = false;
    quizLocked: boolean = false;
    quizCurrentIndex: number = 0;
    quizPanel!: QuizPanel;
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
    sessionId: string | null = null;
    sessionGameId: string | null = null;
    sessionQuestions: GameQuestion[] | null = null;
    sessionTimeLimit: number | null = null;
    questionSourceLogged: boolean = false;
    gameCode: string = 'vocab_race';
    gameConfig = getGameConfig('vocab_race');

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

    init (data: { gameCode?: string | null; sessionId?: string | null; gameId?: string | null; questions?: GameQuestion[] | null; timeLimit?: number | null })
    {
        this.gameCode = resolveGameCode(data?.gameCode ?? (this.registry.get('gameCode') as string | undefined));
        this.registry.set('gameCode', this.gameCode);
        this.gameConfig = getGameConfig(this.gameCode);
        this.sessionId = data?.sessionId ?? null;
        this.sessionGameId = data?.gameId ?? null;
        this.sessionQuestions = data?.questions ?? null;
        this.sessionTimeLimit = data?.timeLimit ?? null;
    }

    create ()
    {
        const { width, height } = this.scale;
        this.camera = this.cameras.main;

        // Parallax background
        this.createParallaxBackground();

        // Track (Leaves) - Use bg-main as the scrolling map
        this.trackImage = this.add.image(width / 2, height, this.gameConfig.mapKey).setOrigin(0.5, 1);
        const trackScale = width / this.trackImage.width;
        this.trackImage.setScale(trackScale);

        const mapTop = this.trackImage.y - this.trackImage.displayHeight;
        this.camera.setBounds(0, mapTop, width, this.trackImage.displayHeight);

        // Build leaf path based on the map texture
        this.leafPath = this.gameConfig.useTexturePath ? this.buildLeafPath(this.gameConfig.mapKey) : [];

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

        if (this.sessionTimeLimit && this.sessionTimeLimit > 0) {
            this.totalTimeMs = this.sessionTimeLimit * 1000;
        }

        EventBus.emit('current-scene-ready', this);
    }

    createParallaxBackground() {
        this.cameras.main.setBackgroundColor(this.gameConfig.backgroundColor);
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

        // Timer + Score HUD
        this.timerOverlay = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);

        // Back button
        this.hudBackButton = this.add.container(0, 0);
        const backBg = this.add.graphics();
        backBg.fillStyle(0xffffff, 0.95);
        backBg.fillRoundedRect(-24, -24, 48, 48, 14);
        backBg.lineStyle(2, 0x0ea5e9, 0.2);
        backBg.strokeRoundedRect(-24, -24, 48, 48, 14);
        const backIcon = this.add.text(0, 1, '<', {
            fontFamily: 'Arial Black',
            fontSize: '28px',
            color: '#0f172a'
        }).setOrigin(0.5);
        const backHit = this.add.zone(0, 0, 48, 48)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        backHit.on('pointerup', () => this.handleBackToGameList());
        this.hudBackButton.add([backBg, backIcon]);
        this.hudBackButton.setSize(48, 48);
        this.hudBackButton.add(backHit);

        // Points pill
        this.hudPointsPill = this.add.container(0, 0);
        const pointsBg = this.add.graphics();
        const pointsW = 170;
        const pointsH = 44;
        pointsBg.fillStyle(0xe0f2fe, 0.98);
        pointsBg.fillRoundedRect(-pointsW / 2, -pointsH / 2, pointsW, pointsH, 22);
        pointsBg.lineStyle(2, 0x93c5fd, 0.7);
        pointsBg.strokeRoundedRect(-pointsW / 2, -pointsH / 2, pointsW, pointsH, 22);
        const star = this.add.image(-pointsW / 2 + 24, 0, 'star').setScale(0.32).setTint(0xfbbf24);
        this.scoreText = this.add.text(-pointsW / 2 + 46, 0, 'POINTS: 00', {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#0f172a'
        }).setOrigin(0, 0.5);
        this.hudPointsPill.add([pointsBg, star, this.scoreText]);

        // Timer pill
        this.hudTimerPill = this.add.container(0, 0);
        const timerBg = this.add.graphics();
        const timerW = 100;
        const timerH = 40;
        timerBg.fillStyle(0xdbeafe, 0.98);
        timerBg.fillRoundedRect(-timerW / 2, -timerH / 2, timerW, timerH, 20);
        timerBg.lineStyle(2, 0x60a5fa, 0.6);
        timerBg.strokeRoundedRect(-timerW / 2, -timerH / 2, timerW, timerH, 20);
        this.timerText = this.add.text(0, 0, '03:00', {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#0f172a'
        }).setOrigin(0.5);
        this.hudTimerPill.add([timerBg, this.timerText]);

        // Hearts pill
        this.hudHeartsPill = this.add.container(0, 0);
        const heartsBg = this.add.graphics();
        const heartsW = 92;
        const heartsH = 36;
        heartsBg.fillStyle(0xffffff, 0.98);
        heartsBg.fillRoundedRect(-heartsW / 2, -heartsH / 2, heartsW, heartsH, 18);
        heartsBg.lineStyle(2, 0x93c5fd, 0.35);
        heartsBg.strokeRoundedRect(-heartsW / 2, -heartsH / 2, heartsW, heartsH, 18);
        const heartsText = this.add.text(0, 0, '❤ ❤ ❤', {
            fontFamily: 'Arial Black',
            fontSize: '16px',
            color: '#ef4444'
        }).setOrigin(0.5);
        this.hudHeartsPill.add([heartsBg, heartsText]);

        this.timerOverlay.add([this.hudBackButton, this.hudPointsPill, this.hudTimerPill, this.hudHeartsPill]);
        this.uiRoot.add(this.timerOverlay);
        this.layoutHud();

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
            this.layoutHud();
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

    private layoutHud(): void {
        if (!this.hudBackButton || !this.hudPointsPill || !this.hudTimerPill || !this.hudHeartsPill) return;
        const { width, height } = this.scale;
        const topInset = Math.max(20, Math.round(height * 0.03));
        const sideInset = Math.max(16, Math.round(width * 0.045));
        const gap = 10;
        const heartsW = 92;
        const timerW = 100;

        this.hudBackButton.setPosition(sideInset + 24, topInset + 24);
        this.hudPointsPill.setPosition(width / 2, topInset + 24);

        const rightEdge = width - sideInset;
        this.hudHeartsPill.setPosition(rightEdge - heartsW / 2, topInset + 24);
        this.hudTimerPill.setPosition(rightEdge - heartsW - gap - timerW / 2, topInset + 24);
    }

    private handleBackToGameList(): void {
        window.location.href = '/';
    }

    createJumpButton(x: number, y: number) {
        const container = this.add.container(x, y);
        const width = 300;
        const height = 100;
        
        const bg = this.add.rectangle(0, 0, width, height, 0xfbbf24)
            .setStrokeStyle(4, 0xffffff)
            .setFillStyle(0x22c55e);
            
        const text = this.add.text(0, 0, 'NEXT JUMP!', {
            fontFamily: 'Arial Black', fontSize: '32px', color: '#ffffff'
        }).setOrigin(0.5);

        container.add([bg, text]);
        container.setSize(width, height);

        this.jumpButtonBg = bg;

        const onPress = () => {
            if (this.quizOpen || this.startModalOpen) return;
            bg.setFillStyle(0x16a34a);
            this.openQuizModal();
        };

        const onRelease = () => {
            bg.setFillStyle(0x22c55e);
        };

        container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

        container.on('pointerdown', onPress);

        container.on('pointerup', onRelease);

        container.on('pointerout', onRelease);

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
        this.quizPanel = new QuizPanel(this, { optionCount: 4, depth: 200, parent: this.uiRoot, showIndex: true });
        this.quizModal = this.quizPanel.container;
        this.quizPanelContainer = this.quizPanel.panelContainer;
        this.quizPanelShadow = this.quizPanel.panelShadow;
        this.quizPanelBg = this.quizPanel.panelBg;
        this.quizPanelGlow = this.quizPanel.panelGlow;
        this.quizIndexText = this.quizPanel.indexText;
        this.quizFeedbackTitleText = this.quizPanel.feedbackTitleText;
        this.quizFeedbackSubtitleText = this.quizPanel.feedbackSubtitleText;
        this.quizQuestionText = this.quizPanel.questionText;
        this.quizOptionButtons = this.quizPanel.optionButtons;

        this.quizPanel.onOptionSelected((index) => {
            if (!this.quizOpen || this.quizLocked) return;
            this.handleQuizAnswer(index);
        });

        this.layoutQuiz();
    }

    private createStartModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(220);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.12)
            .setOrigin(0, 0);

        const panelWidth = Math.min(520, width - 80);
        const panelHeight = 160;
        const panelContainer = this.add.container(width / 2, Math.round(height * 0.58)).setScrollFactor(0);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.15);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 26);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0xffffff, 0.85);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(2, 0x93c5fd, 0.45);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const title = this.add.text(0, -26, 'Help the robot cross the river.', {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#0f172a',
            align: 'center',
            wordWrap: { width: panelWidth - 60, useAdvancedWrap: true }
        }).setOrigin(0.5);

        const button = this.createStartButton(0, 42);

        panelContainer.add([panelShadow, panelBg, title, button]);
        container.add([overlay, panelContainer]);
        container.setVisible(false);

        this.startModal = container;
        if (this.uiRoot) this.uiRoot.add(container);
    }

    private createEndModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(230);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0, 0);

        const panelWidth = Math.min(520, width - 80);
        const panelHeight = 220;
        const panelContainer = this.add.container(width / 2, Math.round(height * 0.56)).setScrollFactor(0);
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
        panelShadow.fillStyle(0x000000, 0.15);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 26);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0xffffff, 0.85);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(2, 0x93c5fd, 0.45);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const title = this.add.text(0, -64, 'Congratulations!', {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#0f172a'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -36, 'You completed the run.', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#0f172a',
            align: 'center',
            wordWrap: { width: panelWidth - 60, useAdvancedWrap: true }
        }).setOrigin(0.5);

        const statsGap = 16;
        const cardWidth = Math.min(200, Math.floor((panelWidth - 120) / 2));
        const cardHeight = 46;
        const statsY = 62;

        const scoreCard = this.add.graphics();
        scoreCard.fillStyle(0x93c5fd, 0.18);
        scoreCard.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        scoreCard.lineStyle(2, 0x93c5fd, 0.45);
        scoreCard.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

        const timeCard = this.add.graphics();
        timeCard.fillStyle(0x93c5fd, 0.18);
        timeCard.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        timeCard.lineStyle(2, 0x93c5fd, 0.45);
        timeCard.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

        const scoreCardContainer = this.add.container(-cardWidth / 2 - statsGap / 2, statsY, [scoreCard]);
        const timeCardContainer = this.add.container(cardWidth / 2 + statsGap / 2, statsY, [timeCard]);

        const scoreLabel = this.add.text(scoreCardContainer.x, statsY - 16, 'SCORE', {
            fontFamily: 'Arial Black',
            fontSize: '12px',
            color: '#1e3a8a'
        }).setOrigin(0.5);

        const timeLabel = this.add.text(timeCardContainer.x, statsY - 16, 'TIME', {
            fontFamily: 'Arial Black',
            fontSize: '12px',
            color: '#1e3a8a'
        }).setOrigin(0.5);

        this.endModalScoreText = this.add.text(scoreCardContainer.x, statsY + 6, '0', {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#0f172a'
        }).setOrigin(0.5);

        this.endModalTimeText = this.add.text(timeCardContainer.x, statsY + 6, '00:00', {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#0f172a'
        }).setOrigin(0.5);

        const restartButton = this.createEndRestartButton(0, panelHeight / 2 + 56);
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
            this.endModalTimeText
        ]);
        panelContainer.add(restartButton);

        container.add([overlay, blocker, panelContainer]);
        container.setVisible(false);

        this.endModal = container;
        this.endModal.setData('panel', panelContainer);
        this.endModal.setData('overlay', overlay);
        if (this.uiRoot) this.uiRoot.add(container);
    }
    
    private createEndRestartButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setScrollFactor(0);
        const width = 260;
        const height = 52;
        const radius = 20;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const draw = (fill: number, stroke: number) => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, stroke, 0.8);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        draw(0x3b82f6, 0x93c5fd);

        const text = this.add.text(0, 0, 'Play Again', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
        hit.setInteractive();

        container.add([shadow, bg, text, hit]);
        container.setSize(width, height);

        hit.on('pointerover', () => {
            draw(0x2563eb, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 1.02, duration: 120, ease: 'Sine.easeOut' });
        });
        hit.on('pointerout', () => {
            draw(0x3b82f6, 0x93c5fd);
            this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
        });
        hit.on('pointerdown', () => {
            draw(0x1d4ed8, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 0.98, duration: 80, ease: 'Sine.easeOut' });
            this.restartRun();
        });
        hit.on('pointerup', () => {
            draw(0x2563eb, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 1.02, duration: 80, ease: 'Sine.easeOut' });
        });

        return container;
    }

    private createTimeUpModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(240);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.12)
            .setOrigin(0, 0);

        const panelWidth = Math.min(520, width - 80);
        const panelHeight = 160;
        const panelContainer = this.add.container(width / 2, Math.round(height * 0.56)).setScrollFactor(0);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.15);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 26);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0xffffff, 0.85);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(2, 0x93c5fd, 0.45);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const title = this.add.text(0, -26, 'Out of time! Failed', {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#0f172a'
        }).setOrigin(0.5);

        const restartButton = this.createRestartButton(0, 42);

        panelContainer.add([panelShadow, panelBg, title, restartButton]);

        container.add([overlay, panelContainer]);
        container.setVisible(false);

        this.timeUpModal = container;
        this.timeUpModal.setData('panel', panelContainer);
        if (this.uiRoot) this.uiRoot.add(container);
    }

    private createRestartButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setScrollFactor(0);
        const width = 260;
        const height = 52;
        const radius = 20;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const draw = (fill: number, stroke: number) => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, stroke, 0.8);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        draw(0x3b82f6, 0x93c5fd);

        const text = this.add.text(0, 0, 'Continue', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
        hit.setInteractive();

        container.add([shadow, bg, text, hit]);
        container.setSize(width, height);
        hit.on('pointerover', () => {
            draw(0x2563eb, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 1.02, duration: 120, ease: 'Sine.easeOut' });
        });
        hit.on('pointerout', () => {
            draw(0x3b82f6, 0x93c5fd);
            this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
        });
        hit.on('pointerdown', () => {
            draw(0x1d4ed8, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 0.98, duration: 80, ease: 'Sine.easeOut' });
            this.restartRun();
        });
        hit.on('pointerup', () => {
            draw(0x2563eb, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 1.02, duration: 80, ease: 'Sine.easeOut' });
        });

        return container;
    }

    private createStartButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setScrollFactor(0);
        const width = 260;
        const height = 52;
        const radius = 20;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const draw = (fill: number, stroke: number) => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, stroke, 0.8);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        draw(0x3b82f6, 0x93c5fd);
            
        const text = this.add.text(0, 0, 'Start Game', {
            fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff'
        }).setOrigin(0.5);

        const hitPad = 16;
        const hitW = width + hitPad * 2;
        const hitH = height + hitPad * 2;
        const hit = this.add.rectangle(0, 0, hitW, hitH, 0xffffff, 0.001);
        hit.setInteractive();

        container.add([shadow, bg, text, hit]);
        container.setSize(width, height);

        const onPress = () => {
            if (!this.startModalOpen) return;
            draw(0x1d4ed8, 0xbfdbfe);
            this.closeStartModal();
            this.openQuizModal();
        };

        const onRelease = () => {
            draw(0x3b82f6, 0x93c5fd);
        };

        hit.on('pointerdown', onPress);
        hit.on('pointerup', onRelease);
        hit.on('pointerout', onRelease);

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

    private setQuestion(data: { index: number; total: number; question: string; options: string[] }): void {
        this.quizPanel.setFeedback('idle');
        this.quizPanel.setQuestion(data);
        this.layoutQuiz();
    }

    private layoutQuiz(): void {
        if (!this.quizPanel) return;
        const { width, height } = this.scale;
        const result = this.quizPanel.layout(width, height);
        this.uiScale = result.uiScale;
        this.quizPanelHeight = result.panelHeight;
        this.quizPanelWidth = result.panelWidth;
    }

    private openQuizModal(): void {
        if (this.gameOver) return;
        if (this.gameCompleted) return;
        if (this.player.isJumping()) return;
        this.quizOpen = true;
        this.quizLocked = false;
        this.jumpButton.setAlpha(0.6);

        const questionPool = this.getQuestionPool();
        const question = questionPool[this.quizCurrentIndex % questionPool.length];
        this.setQuestion({
            index: this.quizCurrentIndex + 1,
            total: questionPool.length,
            question: question.question,
            options: question.options
        });

        this.quizModal.setVisible(true);
        this.quizModal.setAlpha(0);
        const panel = this.quizPanel.panelContainer;
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
        const questionPool = this.getQuestionPool();
        const question = questionPool[this.quizCurrentIndex % questionPool.length];
        let isCorrect = index === question.correctIndex;

        const selectedOptionId = question.optionIds[index];
        if (this.sessionId && question.sessionQuestionId && selectedOptionId) {
            try {
                const { submitAnswer } = await import('../../services/api');
                const res = await submitAnswer(
                    this.sessionId,
                    question.sessionQuestionId,
                    selectedOptionId
                );
                isCorrect = res.data.is_correct;
            } catch (error) {
                console.error('submitAnswer failed, fallback to local check', error);
            }
        }

        const btn = this.quizOptionButtons[index];
        const redraw = btn.getData('redraw') as (state: 'normal' | 'correct' | 'wrong') => void;

        if (isCorrect) {
            this.quizLocked = true;
            redraw('correct');
            this.setQuizFeedback('correct');
            this.updateScore(1);
            this.speedUpJump();
            await this.delay(400);
            this.closeQuizModal();
            await this.handleJump();
            this.quizCurrentIndex += 1;
            this.time.delayedCall(250, () => {
                this.openQuizModal();
            });
        } else {
            this.quizLocked = true;
            redraw('wrong');
            this.setQuizFeedback('wrong');
            this.updateScore(-1);
            this.showPlayerState('incorrect');
            const panel = this.quizPanel.panelContainer;
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

    private getQuestionPool() {
        const apiQuestions = this.sessionQuestions;
        if (apiQuestions?.length) {
            if (!this.questionSourceLogged) {
                this.questionSourceLogged = true;
                console.log('[GAME][TOWN] Using session questions', {
                    gameCode: this.gameCode,
                    count: apiQuestions.length,
                    sample: apiQuestions[0]?.question?.content ?? null
                });
            }
            return apiQuestions.map((item) => {
                const options = item.question.options.map((opt) => opt.text);
                const optionIds = item.question.options.map((opt) => opt.id ?? '');
                let correctIndex = item.question.options.findIndex((opt) => opt.is_correct);
                if (correctIndex < 0) correctIndex = 0;
                return {
                    sessionQuestionId: item.session_question_id ?? null,
                    question: item.question.content,
                    options,
                    optionIds,
                    correctIndex
                };
            });
        }

        if (!this.questionSourceLogged) {
            this.questionSourceLogged = true;
            console.warn('[GAME][TOWN] Using fallback local questions', {
                gameCode: this.gameCode
            });
        }
        return [
            {
                sessionQuestionId: null,
                question: 'What is the capital of Vietnam?',
                options: ['Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho'],
                optionIds: ['', '', '', ''],
                correctIndex: 0
            },
            {
                sessionQuestionId: null,
                question: 'Which language does Phaser use?',
                options: ['TypeScript/JavaScript', 'C#', 'Python', 'Go'],
                optionIds: ['', '', '', ''],
                correctIndex: 0
            },
            {
                sessionQuestionId: null,
                question: 'What color are the leaves in the game?',
                options: ['Green', 'Red', 'Purple', 'Yellow'],
                optionIds: ['', '', '', ''],
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

        this.totalTimeMs = this.sessionTimeLimit && this.sessionTimeLimit > 0
            ? this.sessionTimeLimit * 1000
            : 180000;
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
        const text = `${minutes}m ${pad(seconds)}s`;
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
        this.submitSessionResult();
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

    private submitSessionResult(): void {
        if (!this.sessionGameId) return;
        import('../../services/api')
            .then(({ endGameSession }) => endGameSession(this.sessionGameId as string, this.score))
            .catch((err) => {
                console.error('endGameSession failed', err);
            });
    }

    private restartRun(): void {
        this.gameOver = false;
        this.gameCompleted = false;
        this.quizOpen = false;
        this.quizLocked = false;
        this.quizCurrentIndex = 0;
        this.startModalOpen = false;
        this.score = 0;
        this.scoreText.setText('POINTS: 00');
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
        const points = Math.max(0, this.score);
        this.scoreText.setText(`POINTS: ${points.toString().padStart(2, '0')}`);
        if (this.endModalScoreText) {
            this.endModalScoreText.setText(`Score: ${this.score}`);
        }
    }

    private updateEndTimeText(): void {
        if (!this.endModalTimeText) return;
        const baseMs = this.sessionTimeLimit && this.sessionTimeLimit > 0
            ? this.sessionTimeLimit * 1000
            : 180000;
        const elapsedMs = baseMs - this.totalTimeMs;
        const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        this.endModalTimeText.setText(`Time: ${pad(minutes)}:${pad(seconds)}`);
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

    private setQuizFeedback(state: 'idle' | 'correct' | 'wrong'): void {
        if (!this.quizPanel) return;
        this.quizPanel.setFeedback(state);
        this.quizFeedbackState = state;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.time.delayedCall(ms, () => resolve());
        });
    }
}
