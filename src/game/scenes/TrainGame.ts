import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import type { GameQuestion } from '../../services/api';
import { getGameConfig, resolveGameCode } from '../gameConfig';
import { QuizPanel } from '../ui/QuizPanel';

type TrainCarSlot = {
    index: number;
    car: Phaser.GameObjects.Image;
    lock: Phaser.GameObjects.Container;
};

type TrainGameInitData = {
    gameCode?: string | null;
    sessionId?: string | null;
    gameId?: string | null;
    questions?: GameQuestion[] | null;
    timeLimit?: number | null;
};

type LeadCarState = 'idle' | 'correct' | 'incorrect';

const FALLBACK_QUESTIONS: GameQuestion[] = [
    {
        question: {
            content: 'Thủ đô của Việt Nam là gì?',
            options: [
                { text: 'Hà Nội', is_correct: true },
                { text: 'Đà Nẵng', is_correct: false },
                { text: 'Hải Phòng', is_correct: false },
                { text: 'Cần Thơ', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Phaser sử dụng ngôn ngữ nào?',
            options: [
                { text: 'TypeScript/JavaScript', is_correct: true },
                { text: 'C#', is_correct: false },
                { text: 'Python', is_correct: false },
                { text: 'Go', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Chọn từ trái nghĩa của “fast”.',
            options: [
                { text: 'slow', is_correct: true },
                { text: 'far', is_correct: false },
                { text: 'high', is_correct: false },
                { text: 'small', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Chọn đáp án đúng: She ___ to school every day.',
            options: [
                { text: 'goes', is_correct: true },
                { text: 'go', is_correct: false },
                { text: 'going', is_correct: false },
                { text: 'gone', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Từ nào có nghĩa là “nhảy”?',
            options: [
                { text: 'jump', is_correct: true },
                { text: 'swim', is_correct: false },
                { text: 'crawl', is_correct: false },
                { text: 'sleep', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Từ nào là danh từ?',
            options: [
                { text: 'river', is_correct: true },
                { text: 'run', is_correct: false },
                { text: 'quickly', is_correct: false },
                { text: 'blue', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Chọn câu đúng ngữ pháp.',
            options: [
                { text: 'He is playing football.', is_correct: true },
                { text: 'He are playing football.', is_correct: false },
                { text: 'He playing football.', is_correct: false },
                { text: 'He play football.', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Từ nào là tính từ?',
            options: [
                { text: 'beautiful', is_correct: true },
                { text: 'beauty', is_correct: false },
                { text: 'beautify', is_correct: false },
                { text: 'beautifully', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Chọn đáp án đúng: I ___ a book now.',
            options: [
                { text: 'am reading', is_correct: true },
                { text: 'read', is_correct: false },
                { text: 'reads', is_correct: false },
                { text: 'reading', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Từ nào là trạng từ?',
            options: [
                { text: 'quickly', is_correct: true },
                { text: 'quick', is_correct: false },
                { text: 'quicker', is_correct: false },
                { text: 'quickness', is_correct: false }
            ]
        }
    },
    {
        question: {
            content: 'Chọn câu hỏi phù hợp khi gặp người mới.',
            options: [
                { text: 'What is your name?', is_correct: true },
                { text: 'Where do you live?', is_correct: false },
                { text: 'How old are you?', is_correct: false },
                { text: 'What time is it?', is_correct: false }
            ]
        }
    }
];

export class TrainGame extends Scene
{
    private debugTrack = false;
    private showRailOverlay = false;
    private showCars = true;
    private trainMoving = false;
    private trackSpline?: Phaser.Curves.Spline;
    private trainSprite?: Phaser.GameObjects.Image;
    private trafficLight?: Phaser.GameObjects.Image;
    private trafficLightVariants?: {
        red: Phaser.GameObjects.Image;
        yellow: Phaser.GameObjects.Image;
        green: Phaser.GameObjects.Image;
    };
    private trafficLightState: 'red' | 'yellow' | 'green' | null = null;
    private trainDistancePx: number = 0;
    private trainSpeedPxPerSec: number = -180;
    private trainGapPx: number = 0;
    private trackLength: number = 0;
    private readonly trainCarGapFactor = 0.68;
    private readonly trainCarScaleFactor = 0.468;
    private railPathPoints: Phaser.Math.Vector2[] = [];
    private railSegmentLengths: number[] = [];
    private railTotalLength: number = 0;
    private readonly trainRotationOffset = Phaser.Math.DegToRad(-90);
    private leadCarState: LeadCarState = 'idle';
    private leadCarBaseSize: { width: number; height: number } | null = null;
    private leadCarBadge?: Phaser.GameObjects.Image;
    private railwayContainer?: Phaser.GameObjects.Container;
    private debugCurveGraphics?: Phaser.GameObjects.Graphics;
    private debugMarkerGraphics?: Phaser.GameObjects.Graphics;
    private debugMarkerLabels: Phaser.GameObjects.Text[] = [];
    private showHoverCoords = false;
    private hoverCoordText?: Phaser.GameObjects.Text;
    private barrierGate?: Phaser.GameObjects.Image;
    private barrierBaseAngle: number = 0;
    private barrierIsOpen: boolean = false;
    camera!: Phaser.Cameras.Scene2D.Camera;
    background!: Phaser.GameObjects.Image;
    carSlots: TrainCarSlot[] = [];
    quizModal!: Phaser.GameObjects.Container;
    quizPanel!: QuizPanel;
    timerText!: Phaser.GameObjects.Text;
    scoreText!: Phaser.GameObjects.Text;
    hudBackButton!: Phaser.GameObjects.Container;
    hudPointsPill!: Phaser.GameObjects.Container;
    hudTimerPill!: Phaser.GameObjects.Container;
    uiRoot!: Phaser.GameObjects.Container;
    startModal!: Phaser.GameObjects.Container;
    startModalPanel!: Phaser.GameObjects.Container;
    timeUpModal!: Phaser.GameObjects.Container;
    timeUpModalPanel!: Phaser.GameObjects.Container;
    timeUpTitleText!: Phaser.GameObjects.Text;
    startModalOpen: boolean = false;
    hasStarted: boolean = false;

    gameCode: string = 'train_game';
    sessionId: string | null = null;
    sessionGameId: string | null = null;
    sessionQuestions: GameQuestion[] | null = null;
    sessionTimeLimit: number | null = null;

    maxCars: number = 11;
    currentIndex: number = 0;
    score: number = 0;

    totalTimeMs: number = 300000;
    remainingMs: number = 300000;
    lastSecondShown: number = -1;

    quizOpen: boolean = false;
    quizLocked: boolean = false;
    gameOver: boolean = false;

    private questions: GameQuestion[] = [];
    private currentCorrectIndex: number = 0;
    private currentSessionQuestionId: string | null = null;
    private currentOptionIds: string[] = [];
    private trainStepPx: number = 0;

    constructor ()
    {
        super('TrainGame');
    }

    init (data: TrainGameInitData)
    {
        this.gameCode = resolveGameCode(data?.gameCode ?? (this.registry.get('gameCode') as string | undefined));
        this.registry.set('gameCode', this.gameCode);
        this.sessionId = data?.sessionId ?? null;
        this.sessionGameId = data?.gameId ?? null;
        this.sessionQuestions = data?.questions ?? null;
        this.sessionTimeLimit = data?.timeLimit ?? null;
    }

    create ()
    {
        const { width, height } = this.scale;
        const gameConfig = getGameConfig(this.gameCode);

        // Reset runtime state on every create() because scene.restart reuses the same instance.
        this.gameOver = false;
        this.quizOpen = false;
        this.quizLocked = false;
        this.startModalOpen = false;
        this.hasStarted = false;
        this.currentSessionQuestionId = null;
        this.currentOptionIds = [];
        this.leadCarState = 'idle';
        this.barrierIsOpen = false;

        this.carSlots = [];
        this.leadCarBadge = undefined;

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(gameConfig.backgroundColor);

        this.background = this.add.image(width / 2, height / 2, 'train-bg')
            .setDisplaySize(width, height)
            .setOrigin(0.5, 0.5);

        this.setupQuestions();
        this.setupTimer();
        this.createHud();
        this.currentIndex = 0;
        this.score = 0;
        this.createRailway();
        if (this.showCars) {
            this.layoutTrain();
            this.updateTrainCars(true);
        }
        this.createBarrierGate();
        this.createQuizModal();
        this.createStartModal();
        this.createTimeUpModal();
        this.openStartModal();

        this.scale.on('resize', () => {
            const { width: newWidth, height: newHeight } = this.scale;
            this.background.setPosition(newWidth / 2, newHeight / 2).setDisplaySize(newWidth, newHeight);
            this.layoutHud();
            this.layoutQuiz();
            this.updateBarrierPosition();
            this.layoutStartModal();
            this.layoutTimeUpModal();
        });

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        if (this.gameOver) return;
        if (!this.hasStarted) {
            this.updateTrainCars();
            return;
        }

        this.remainingMs = Math.max(0, this.remainingMs - delta);
        const seconds = Math.ceil(this.remainingMs / 1000);
        if (seconds !== this.lastSecondShown) {
            this.lastSecondShown = seconds;
            this.timerText.setText(this.formatTime(seconds));
        }

        if (this.remainingMs <= 0 && !this.gameOver) {
            this.endGame('Out of time.', 'lose');
        }

        this.updateTrainCars();
    }

    private setupQuestions ()
    {
        const source = this.sessionQuestions && this.sessionQuestions.length > 0
            ? this.sessionQuestions
            : FALLBACK_QUESTIONS;

        this.questions = source.slice(0);
    }

    private setupTimer ()
    {
        if (this.sessionTimeLimit && this.sessionTimeLimit > 0) {
            this.totalTimeMs = this.sessionTimeLimit * 1000;
        }
        this.remainingMs = this.totalTimeMs;
    }

    private createHud ()
    {
        this.uiRoot = this.add.container(0, 0).setDepth(2000);

        this.hudBackButton = this.add.container(0, 0);
        const backBg = this.add.graphics();
        backBg.fillStyle(0xffffff, 0.95);
        backBg.fillRoundedRect(-22, -22, 44, 44, 14);
        backBg.lineStyle(2, 0x0ea5e9, 0.2);
        backBg.strokeRoundedRect(-22, -22, 44, 44, 14);
        const backIcon = this.add.text(0, 1, '<', {
            fontFamily: 'Arial Black',
            fontSize: '26px',
            color: '#0f172a'
        }).setOrigin(0.5);
        this.hudBackButton.add([backBg, backIcon]);
        this.hudBackButton.setSize(44, 44);
        this.hudBackButton.setInteractive(new Phaser.Geom.Rectangle(-22, -22, 44, 44), Phaser.Geom.Rectangle.Contains);
        this.hudBackButton.on('pointerdown', () => {
            if (this.quizOpen) return;
            this.scene.start('MainMenu');
        });

        this.hudPointsPill = this.add.container(0, 0);
        const pointsBg = this.add.graphics();
        const pointsW = 168;
        const pointsH = 44;
        pointsBg.fillStyle(0xffffff, 0.98);
        pointsBg.fillRoundedRect(-pointsW / 2, -pointsH / 2, pointsW, pointsH, 22);
        pointsBg.lineStyle(2, 0xf59e0b, 0.4);
        pointsBg.strokeRoundedRect(-pointsW / 2, -pointsH / 2, pointsW, pointsH, 22);
        const star = this.add.image(-pointsW / 2 + 24, 0, 'star')
            .setScale(0.32)
            .setTint(0xfbbf24);
        this.scoreText = this.add.text(-pointsW / 2 + 46, 0, 'POINTS: 00', {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#0f172a'
        }).setOrigin(0, 0.5);
        this.hudPointsPill.add([pointsBg, star, this.scoreText]);

        this.hudTimerPill = this.add.container(0, 0);
        const timerBg = this.add.graphics();
        const timerW = 96;
        const timerH = 40;
        timerBg.fillStyle(0xffffff, 0.98);
        timerBg.fillRoundedRect(-timerW / 2, -timerH / 2, timerW, timerH, 20);
        timerBg.lineStyle(2, 0x94a3b8, 0.4);
        timerBg.strokeRoundedRect(-timerW / 2, -timerH / 2, timerW, timerH, 20);
        this.timerText = this.add.text(0, 0, this.formatTime(Math.ceil(this.remainingMs / 1000)), {
            fontFamily: 'Arial Black',
            fontSize: '16px',
            color: '#0f172a'
        }).setOrigin(0.5);
        this.hudTimerPill.add([timerBg, this.timerText]);

        this.uiRoot.add([this.hudBackButton, this.hudPointsPill, this.hudTimerPill]);
        this.layoutHud();
        this.createTrafficLight();
    }

    private layoutHud ()
    {
        const { width, height } = this.scale;
        const topInset = Math.max(16, Math.round(height * 0.03));
        const sideInset = Math.max(14, Math.round(width * 0.04));
        const rightEdge = width - sideInset;
        this.hudBackButton.setPosition(sideInset + 22, topInset + 22);
        this.hudPointsPill.setPosition(width / 2, topInset + 22);
        this.hudTimerPill.setPosition(rightEdge - 48, topInset + 22);
    }

    private createTrafficLight ()
    {
        const lightHeight = 230;
        const sourceHeight = 1463;
        const sourceWidth = 335;
        const lightWidth = Math.round(lightHeight * (sourceWidth / sourceHeight));
        const baseX = 88;
        const baseY = 808;
        const anchorY = Math.round(baseY + lightHeight / 2);
        const makeVariant = (key: string) => this.add.image(baseX, baseY, key)
            .setOrigin(0.5, 1)
            .setDisplaySize(lightWidth, lightHeight)
            .setDepth(1000)
            .setAlpha(1);

        const container = this.add.container(baseX, anchorY).setDepth(1000);
        const offsets = {
            red: { x: 0, y: 0 },
            yellow: { x: 0, y: 0 },
            green: { x: -1, y: 0 }
        };
        const red = this.textures.exists('train-light-red')
            ? this.add.image(0, 0, 'train-light-red')
            : this.add.rectangle(0, 0, lightWidth, lightHeight, 0xef4444, 1);
        const yellow = this.textures.exists('train-light-yellow')
            ? this.add.image(0, 0, 'train-light-yellow')
            : this.add.rectangle(0, 0, lightWidth, lightHeight, 0xfbbf24, 1);
        const green = this.textures.exists('train-light-green')
            ? this.add.image(0, 0, 'train-light-green')
            : this.add.rectangle(0, 0, lightWidth, lightHeight, 0x22c55e, 1);

        const normalize = (obj: Phaser.GameObjects.GameObject) => {
            if ('setOrigin' in obj) {
                (obj as Phaser.GameObjects.Image).setOrigin(0.5, 1);
            }
            if ('setDisplaySize' in obj) {
                (obj as Phaser.GameObjects.Image).setDisplaySize(lightWidth, lightHeight);
            }
        };
        normalize(red);
        normalize(yellow);
        normalize(green);
        red.setPosition(offsets.red.x, offsets.red.y);
        yellow.setPosition(offsets.yellow.x, offsets.yellow.y);
        green.setPosition(offsets.green.x, offsets.green.y);
        container.add([red, yellow, green]);

        this.trafficLightVariants = {
            red: red as Phaser.GameObjects.Image,
            yellow: yellow as Phaser.GameObjects.Image,
            green: green as Phaser.GameObjects.Image
        };
        this.trafficLight = this.trafficLightVariants.red;
        const cycle: Array<'red' | 'yellow' | 'green'> = ['red', 'yellow', 'green'];
        let cycleIndex = 0;
        this.setTrafficLightColor(cycle[cycleIndex]);
        this.time.addEvent({
            delay: 700,
            loop: true,
            callback: () => {
                cycleIndex = (cycleIndex + 1) % cycle.length;
                this.setTrafficLightColor(cycle[cycleIndex]);
            }
        });
    }

    private setTrafficLightColor (color: 'red' | 'yellow' | 'green')
    {
        if (!this.trafficLightVariants) return;
        if (this.trafficLightState === color) return;
        this.trafficLightState = color;

        const { red, yellow, green } = this.trafficLightVariants;
        red.setVisible(color === 'red');
        yellow.setVisible(color === 'yellow');
        green.setVisible(color === 'green');
    }

    private layoutTrain ()
    {
        const { width, height } = this.scale;
        const scaleX = this.background.displayWidth / this.background.width;
        const scaleY = this.background.displayHeight / this.background.height;
        const scale = Math.min(scaleX, scaleY) * this.trainCarScaleFactor;

        const trackCurve = this.createTrackCurve(width, height);
        const trackPoints = this.sampleTrack(trackCurve, this.maxCars);

        this.carSlots = [];

        for (let i = 0; i < this.maxCars; i += 1) {
            const carKey = `train-car-${i + 1}`;
            const point = trackPoints[i] ?? { x: width / 2, y: height / 2 };
            const angle = this.getTrackAngle(trackPoints, i) + this.trainRotationOffset;
            const car = this.add.image(point.x, point.y, carKey).setScale(scale).setRotation(angle);
            car.setAlpha(1);

            const lock = this.createLockOverlay(point.x, point.y, car.displayWidth, car.displayHeight, i);
            lock.setVisible(false);
            lock.disableInteractive();

            this.carSlots.push({ index: i, car, lock });
        }

        if (this.carSlots.length > 0) {
            const referenceCar = this.carSlots[0].car;
            const carLength = Math.max(referenceCar.displayWidth, referenceCar.displayHeight);
            this.trainGapPx = carLength * this.trainCarGapFactor;
            this.trainStepPx = this.trainGapPx;
            this.leadCarBaseSize = {
                width: referenceCar.displayWidth,
                height: referenceCar.displayHeight
            };
        }

        this.carSlots[0]?.car.setTexture('train-car-1');
        this.setLeadCarState('idle');
        this.refreshLocks();
    }

    private getLeadCarTextureKey (state: LeadCarState)
    {
        switch (state) {
            case 'correct':
                return 'train-fox-correct';
            case 'incorrect':
                return 'train-fox-incorrect';
            case 'idle':
            default:
                return 'train-fox-idle';
        }
    }

    private setLeadCarState (state: LeadCarState)
    {
        this.leadCarState = state;
        const leadCar = this.carSlots[0]?.car;
        if (!leadCar) return;
        if (!leadCar.scene) return;
        if (this.leadCarBadge && !this.leadCarBadge.scene) {
            this.leadCarBadge = undefined;
        }
        if (leadCar.texture.key !== 'train-car-1') {
            leadCar.setTexture('train-car-1');
        }
        if (this.leadCarBaseSize) {
            leadCar.setDisplaySize(this.leadCarBaseSize.width, this.leadCarBaseSize.height);
            leadCar.setOrigin(0.5, 0.5);
        }

        const textureKey = this.getLeadCarTextureKey(state);
        if (!this.textures.exists(textureKey)) {
            if (this.leadCarBadge) this.leadCarBadge.setVisible(false);
            return;
        }

        if (!this.leadCarBadge) {
            this.leadCarBadge = this.add.image(leadCar.x, leadCar.y, textureKey)
                .setDepth(leadCar.depth + 1)
                .setOrigin(0.5, 0.5);
        } else {
            this.leadCarBadge.setTexture(textureKey).setVisible(true);
        }

        if (this.leadCarBaseSize && this.leadCarBadge && this.leadCarBadge.scene) {
            this.leadCarBadge.setDisplaySize(this.leadCarBaseSize.width * 0.5, this.leadCarBaseSize.height * 0.5);
        }
    }

    private createLockOverlay (x: number, y: number, width: number, height: number, index: number)
    {
        const lock = this.add.container(x, y);
        lock.setDepth(10);
        const panelW = Math.max(140, width * 0.6);
        const panelH = Math.max(48, height * 0.35);

        const bg = this.add.rectangle(0, 0, panelW, panelH, 0x1f2937, 0.9);
        bg.setStrokeStyle(2, 0xfbbf24, 0.9);

        const text = this.add.text(0, 0, 'UNLOCK', {
            fontFamily: 'Arial Black',
            fontSize: '18px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        lock.add([bg, text]);
        lock.setSize(panelW, panelH);
        const hitArea = new Phaser.Geom.Rectangle(-panelW / 2, -panelH / 2, panelW, panelH);
        lock.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        lock.setData('hitArea', hitArea);

        lock.on('pointerover', () => {
            if (this.quizOpen || this.gameOver) return;
            bg.setFillStyle(0x334155, 0.95);
            lock.setScale(1.05);
            this.input.setDefaultCursor('pointer');
        });

        lock.on('pointerout', () => {
            bg.setFillStyle(0x1f2937, 0.9);
            lock.setScale(1);
            this.input.setDefaultCursor('default');
        });

        lock.on('pointerdown', () => {
            if (this.quizOpen || this.gameOver) return;
            if (index !== this.currentIndex) return;
            this.openQuestion(index);
        });

        return lock;
    }

    private refreshLocks ()
    {
        this.carSlots.forEach((slot) => {
            if (!slot || !slot.car || !slot.lock) return;
            if (!slot.car.scene || !slot.lock.scene) return;
            slot.car.setAlpha(1);
            slot.lock.setVisible(false);
            if (slot.lock.input) {
                slot.lock.disableInteractive();
            }
        });

        const points = Math.max(0, this.score);
        this.scoreText.setText(`POINTS: ${points.toString().padStart(2, '0')}`);
    }

    private createQuizModal ()
    {
        this.quizPanel = new QuizPanel(this, { optionCount: 4, depth: 2000, parent: this.uiRoot, showIndex: true });
        this.quizModal = this.quizPanel.container;

        this.quizPanel.onOptionSelected((index) => {
            if (this.quizLocked) return;
            void this.handleAnswer(index);
        });

        this.layoutQuiz();
    }

    private createStartModal ()
    {
        const { width, height } = this.scale;
        const container = this.add.container(0, 0).setDepth(2100).setVisible(false);

        const overlay = this.add.rectangle(0, 0, width, height, 0xffffff, 0.12).setOrigin(0, 0);

        const panel = this.add.container(width / 2, Math.round(height * 0.56));
        const panelWidth = Math.min(620, width - 80);
        const panelHeight = Math.min(220, Math.round(height * 0.32));

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.18);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 8, -panelHeight / 2 + 10, panelWidth, panelHeight, 30);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0xffffff, 0.85);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);
        panelBg.lineStyle(2, 0xffffff, 0.65);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);

        const title = this.add.text(0, -38, 'Answer the questions to help the\ntrain go ahead.', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#0f172a',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);

        const button = this.createStartButton(0, Math.round(panelHeight * 0.23));

        panel.add([panelShadow, panelBg, title, button]);
        container.add([overlay, panel]);

        this.startModal = container;
        this.startModalPanel = panel;
        this.uiRoot.add(container);
        this.layoutStartModal();
    }

    private createTimeUpModal ()
    {
        const { width, height } = this.scale;
        const container = this.add.container(0, 0).setDepth(2200).setVisible(false);
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.1).setOrigin(0, 0);

        const panel = this.add.container(width / 2, Math.round(height * 0.56));
        const panelWidth = Math.min(620, width - 80);
        const panelHeight = Math.min(220, Math.round(height * 0.32));

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.18);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 8, -panelHeight / 2 + 10, panelWidth, panelHeight, 30);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0xffffff, 0.85);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);
        panelBg.lineStyle(2, 0xffffff, 0.65);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 28);

        this.timeUpTitleText = this.add.text(0, -14, 'Out of time! Failed!', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#0f172a',
            align: 'center'
        }).setOrigin(0.5);

        const button = this.createTimeoutButton(0, Math.round(panelHeight * 0.23));

        panel.add([panelShadow, panelBg, this.timeUpTitleText, button]);
        container.add([overlay, panel]);

        this.timeUpModal = container;
        this.timeUpModalPanel = panel;
        this.uiRoot.add(container);
        this.layoutTimeUpModal();
    }

    private layoutStartModal ()
    {
        if (!this.startModal || !this.startModalPanel) return;
        const { width, height } = this.scale;
        const overlay = this.startModal.list[0];
        if (overlay && 'setSize' in overlay) {
            (overlay as Phaser.GameObjects.Rectangle).setSize(width, height);
        }
        this.startModalPanel.setPosition(width / 2, Math.round(height * 0.56));
    }

    private layoutTimeUpModal ()
    {
        if (!this.timeUpModal || !this.timeUpModalPanel) return;
        const { width, height } = this.scale;
        const overlay = this.timeUpModal.list[0];
        if (overlay && 'setSize' in overlay) {
            (overlay as Phaser.GameObjects.Rectangle).setSize(width, height);
        }
        this.timeUpModalPanel.setPosition(width / 2, Math.round(height * 0.56));
    }

    private createStartButton (x: number, y: number)
    {
        const container = this.add.container(x, y);
        const width = 530;
        const height = 72;
        const radius = 30;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x1e3a8a, 0.18);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const draw = (fill: number, stroke: number) => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, stroke, 0.65);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        draw(0x3b82f6, 0x93c5fd);

        const text = this.add.text(0, 1, 'Start Game', {
            fontFamily: 'Arial Black',
            fontSize: '34px',
            color: '#ffffff'
        }).setOrigin(0.5).setScale(0.66);

        const hit = this.add.rectangle(0, 0, width + 16, height + 16, 0xffffff, 0.001);
        hit.setInteractive();

        container.add([shadow, bg, text, hit]);
        container.setSize(width, height);

        hit.on('pointerover', () => {
            draw(0x2563eb, 0xbfdbfe);
            this.input.setDefaultCursor('pointer');
            this.tweens.add({ targets: container, scale: 1.02, duration: 100, ease: 'Sine.easeOut' });
        });
        hit.on('pointerout', () => {
            draw(0x3b82f6, 0x93c5fd);
            this.input.setDefaultCursor('default');
            this.tweens.add({ targets: container, scale: 1, duration: 100, ease: 'Sine.easeOut' });
        });
        hit.on('pointerdown', () => {
            if (!this.startModalOpen) return;
            draw(0x1d4ed8, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 0.98, duration: 70, ease: 'Sine.easeOut' });
            this.startGameFlow();
        });
        hit.on('pointerup', () => {
            draw(0x2563eb, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 1.02, duration: 70, ease: 'Sine.easeOut' });
        });

        this.tweens.add({
            targets: container,
            scale: 1.03,
            duration: 850,
            yoyo: true,
            repeat: -1
        });

        return container;
    }

    private createTimeoutButton (x: number, y: number)
    {
        const container = this.add.container(x, y);
        const width = 530;
        const height = 72;
        const radius = 30;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x1e3a8a, 0.18);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const draw = (fill: number, stroke: number) => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, stroke, 0.65);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        draw(0x3b82f6, 0x93c5fd);

        const text = this.add.text(0, 1, 'Play Again', {
            fontFamily: 'Arial Black',
            fontSize: '34px',
            color: '#ffffff'
        }).setOrigin(0.5).setScale(0.66);

        const hit = this.add.rectangle(0, 0, width + 16, height + 16, 0xffffff, 0.001);
        hit.setInteractive();

        container.add([shadow, bg, text, hit]);
        container.setSize(width, height);

        hit.on('pointerover', () => {
            if (hit.getData('restarting')) return;
            draw(0x2563eb, 0xbfdbfe);
            this.input.setDefaultCursor('pointer');
            this.tweens.add({ targets: container, scale: 1.02, duration: 100, ease: 'Sine.easeOut' });
        });
        hit.on('pointerout', () => {
            if (hit.getData('restarting')) return;
            draw(0x3b82f6, 0x93c5fd);
            this.input.setDefaultCursor('default');
            this.tweens.add({ targets: container, scale: 1, duration: 100, ease: 'Sine.easeOut' });
        });
        hit.on('pointerdown', () => {
            if (hit.getData('restarting')) return;
            hit.setData('restarting', true);
            hit.disableInteractive();
            draw(0x1d4ed8, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 0.98, duration: 70, ease: 'Sine.easeOut' });
            this.time.delayedCall(90, () => {
                if (!this.sys.isActive()) return;
                this.restartTrainRun();
            });
        });
        hit.on('pointerup', () => {
            if (hit.getData('restarting')) return;
            draw(0x2563eb, 0xbfdbfe);
            this.tweens.add({ targets: container, scale: 1.02, duration: 70, ease: 'Sine.easeOut' });
        });

        return container;
    }

    private openStartModal ()
    {
        if (!this.startModal) return;
        this.startModalOpen = true;
        this.hasStarted = false;
        this.startModal.setVisible(true);
        this.startModal.setAlpha(0);
        this.tweens.add({
            targets: this.startModal,
            alpha: 1,
            duration: 180
        });
    }

    private closeStartModal ()
    {
        if (!this.startModal) return;
        this.startModalOpen = false;
        this.startModal.setVisible(false);
    }

    private startGameFlow ()
    {
        if (this.hasStarted) return;
        this.hasStarted = true;
        this.closeStartModal();
        this.openQuestion(this.currentIndex);
    }

    private openTimeUpModal (message: string = 'Out of time! Try again.')
    {
        if (!this.timeUpModal || !this.timeUpModalPanel) return;
        this.timeUpTitleText.setText(message);
        this.timeUpModalPanel.setScale(0.96);
        this.timeUpModal.setVisible(true);
        this.timeUpModal.setAlpha(0);
        this.tweens.add({
            targets: this.timeUpModal,
            alpha: 1,
            duration: 200
        });
        this.tweens.add({
            targets: this.timeUpModalPanel,
            scale: 1,
            duration: 240,
            ease: 'Back.easeOut'
        });
    }

    private submitSessionResult ()
    {
        if (!this.sessionGameId) return;
        import('../../services/api')
            .then(({ endGameSession }) => endGameSession(this.sessionGameId as string, this.score))
            .catch((error) => {
                console.error('endGameSession failed', error);
            });
    }

    private restartTrainRun ()
    {
        if (!this.sys || !this.sys.isActive()) return;
        this.input.setDefaultCursor('default');
        this.closeQuiz();
        if (this.timeUpModal) {
            this.timeUpModal.setVisible(false);
        }
        this.scene.restart({
            gameCode: this.gameCode,
            sessionId: this.sessionId,
            gameId: this.sessionGameId,
            questions: this.sessionQuestions,
            timeLimit: this.sessionTimeLimit
        });
    }

    private layoutQuiz ()
    {
        const { width, height } = this.scale;
        this.quizPanel.layout(width, height);
    }

    private openQuestion (index: number)
    {
        if (this.quizOpen || this.gameOver) return;
        if (!this.hasStarted) return;
        this.setLeadCarState('idle');

        const question = this.getQuestionForIndex(index);
        const options = question.question.options.map((opt) => opt.text);
        this.currentOptionIds = question.question.options.map((opt) => opt.id ?? '');
        this.currentSessionQuestionId = question.session_question_id ?? null;
        let correctIndex = question.question.options.findIndex((opt) => opt.is_correct);
        if (correctIndex < 0) correctIndex = 0;
        this.currentCorrectIndex = correctIndex;
        this.quizPanel.setFeedback('idle');
        this.quizPanel.setQuestion({
            index: index + 1,
            total: this.maxCars,
            question: question.question.content,
            options
        });
        this.updateBarrierPosition();
        this.setBarrierOpen(false);
        this.layoutQuiz();

        this.quizOpen = true;
        this.quizLocked = false;
        this.quizModal.setVisible(true);
        this.quizPanel.setInteractive(true);
    }

    private async handleAnswer (selectedIndex: number)
    {
        if (this.quizLocked) return;
        this.quizLocked = true;

        let isCorrect = selectedIndex === this.currentCorrectIndex;
        const selectedOptionId = this.currentOptionIds[selectedIndex];
        if (this.sessionId && this.currentSessionQuestionId && selectedOptionId) {
            try {
                const { submitAnswer } = await import('../../services/api');
                const res = await submitAnswer(this.sessionId, this.currentSessionQuestionId, selectedOptionId);
                isCorrect = res.data.is_correct;
            } catch (error) {
                console.error('submitAnswer failed, fallback to local check', error);
            }
        }

        if (isCorrect) {
            this.setLeadCarState('correct');
            this.quizPanel.setFeedback('correct');
            this.quizPanel.setOptionState(selectedIndex, 'correct');
            this.quizPanel.setInteractive(false);
            this.time.delayedCall(500, () => {
                this.closeQuiz();
                this.applyCorrect();
            });
        } else {
            this.setLeadCarState('incorrect');
            this.quizPanel.setFeedback('wrong');
            this.quizPanel.setOptionState(selectedIndex, 'wrong');
            this.quizPanel.setInteractive(false);
            this.time.delayedCall(650, () => {
                this.applyWrong();
                this.setLeadCarState('idle');
                this.quizPanel.setOptionState(selectedIndex, 'normal');
                this.quizPanel.setFeedback('idle');
                this.quizPanel.setInteractive(true);
                this.quizLocked = false;
            });
        }
    }

    private applyCorrect ()
    {
        this.currentIndex = Math.min(this.maxCars, this.currentIndex + 1);
        this.score = this.currentIndex;
        this.refreshLocks();

        if (this.currentIndex >= this.maxCars) {
            this.setBarrierOpen(true);
            this.moveTrainToEnd(() => {
                this.endGame(`You completed all ${this.maxCars} cars!`, 'win');
            });
            return;
        }

        this.moveTrainToIndex(this.currentIndex, () => {
            this.openQuestion(this.currentIndex);
        });
    }

    private applyWrong ()
    {
        this.refreshLocks();
    }

    private moveTrainToIndex (targetIndex: number, onComplete?: () => void)
    {
        if (this.railTotalLength <= 0 || this.trainStepPx <= 0) {
            if (onComplete) onComplete();
            return;
        }

        const visualIndex = Phaser.Math.Clamp(targetIndex, 0, this.maxCars);
        const maxDistance = Math.max(0, this.railTotalLength - 1);
        const targetDistance = Math.min(this.trainStepPx * visualIndex, maxDistance);
        const delta = Math.abs(targetDistance - this.trainDistancePx);
        const duration = Phaser.Math.Clamp(Math.round(420 + delta * 1.8), 650, 1200);

        this.trainMoving = true;
        const tweenState = { value: this.trainDistancePx };
        this.tweens.add({
            targets: tweenState,
            value: targetDistance,
            duration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.trainDistancePx = tweenState.value;
                this.updateTrainCars(true);
            },
            onComplete: () => {
                this.trainDistancePx = targetDistance;
                this.trainMoving = false;
                this.updateTrainCars(true);
                if (onComplete) onComplete();
            }
        });
    }

    private moveTrainToEnd (onComplete?: () => void)
    {
        if (this.railTotalLength <= 0) {
            if (onComplete) onComplete();
            return;
        }

        const maxDistance = Math.max(0, this.railTotalLength - 1);
        const trainLength = Math.max(0, (this.maxCars - 1) * this.trainGapPx);
        const targetDistance = maxDistance + trainLength;
        const delta = Math.abs(targetDistance - this.trainDistancePx);
        const duration = Phaser.Math.Clamp(Math.round(520 + delta * 1.6), 800, 1800);

        this.trainMoving = true;
        const tweenState = { value: this.trainDistancePx };
        this.tweens.add({
            targets: tweenState,
            value: targetDistance,
            duration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.trainDistancePx = tweenState.value;
                this.updateTrainCars(true);
            },
            onComplete: () => {
                this.trainDistancePx = targetDistance;
                this.trainMoving = false;
                this.updateTrainCars(true);
                if (onComplete) onComplete();
            }
        });
    }

    private closeQuiz ()
    {
        this.quizModal.setVisible(false);
        this.quizOpen = false;
        this.quizLocked = false;
    }

    private getQuestionForIndex (index: number)
    {
        if (this.questions.length === 0) {
            return FALLBACK_QUESTIONS[0];
        }
        return this.questions[index % this.questions.length];
    }

    private createTrackCurve (width: number, height: number)
    {
        const baseWidth = 750;
        const baseHeight = 1334;
        const scaleX = width / baseWidth;
        const scaleY = height / baseHeight;

        const points = [
            { x: 405, y: 10 },
            { x: 455, y: 85 },
            { x: 515, y: 200 },
            { x: 485, y: 360 },
            { x: 375, y: 540 },
            { x: 250, y: 740 },
            { x: 220, y: 920 },
            { x: 270, y: 1100 },
            { x: 325, y: 1185 },
            { x: 505, y: 1325 }
        ].map((p) => new Phaser.Math.Vector2(p.x * scaleX, p.y * scaleY));

        return new Phaser.Curves.Spline(points);
    }

    private sampleTrack (curve: Phaser.Curves.Spline, count: number)
    {
        const points: { x: number; y: number }[] = [];
        const total = Math.max(1, count - 1);
        for (let i = 0; i < count; i += 1) {
            const t = total === 0 ? 0 : i / total;
            const p = curve.getPointAt(t);
            points.push({ x: p.x, y: p.y });
        }
        return points;
    }

    private drawTrackCurve (curve: Phaser.Curves.Spline)
    {
        const { startT, endT } = this.getVisibleTRange(curve);
        const graphics = this.add.graphics();
        graphics.setDepth(1000);
        graphics.lineStyle(10, 0xff0000, 1);
        const steps = 120;
        const first = curve.getPoint(startT);
        graphics.beginPath();
        graphics.moveTo(first.x, first.y);
        for (let i = 1; i <= steps; i += 1) {
            const t = startT + (endT - startT) * (i / steps);
            const p = curve.getPoint(t);
            graphics.lineTo(p.x, p.y);
        }
        graphics.strokePath();
        this.debugCurveGraphics = graphics;
    }

    private drawCurveMarkers (curve: Phaser.Curves.Spline, count: number)
    {
        const { width, height } = this.scale;
        const { startT, endT } = this.getVisibleTRange(curve);
        const graphics = this.add.graphics();
        graphics.setDepth(1001);
        graphics.fillStyle(0x22c55e, 1);
        graphics.lineStyle(2, 0x22c55e, 1);

        const total = Math.max(1, count - 1);
        for (let i = 0; i < count; i += 1) {
            const t = total === 0 ? startT : startT + (endT - startT) * (i / total);
            const point = curve.getPoint(t);
            const clampedX = Phaser.Math.Clamp(point.x, 16, width - 16);
            const clampedY = Phaser.Math.Clamp(point.y, 16, height - 16);
            if (clampedX !== point.x || clampedY !== point.y) {
                graphics.strokeLineShape(new Phaser.Geom.Line(point.x, point.y, clampedX, clampedY));
            }

            graphics.fillCircle(clampedX, clampedY, 8);
            const labelText = `${i + 1} (${Math.round(point.x)}, ${Math.round(point.y)})`;
            const label = this.add.text(clampedX + 10, clampedY - 10, labelText, {
                fontFamily: 'Arial Black',
                fontSize: '18px',
                color: '#22c55e',
                stroke: '#0f172a',
                strokeThickness: 3
            });
            label.setDepth(1002);
            this.debugMarkerLabels.push(label);
        }
        this.debugMarkerGraphics = graphics;
    }

    private getVisibleTRange (curve: Phaser.Curves.Spline)
    {
        const { width, height } = this.scale;
        const margin = 8;
        const samples = 400;
        let startT = 0;
        let endT = 1;
        let foundStart = false;

        for (let i = 0; i <= samples; i += 1) {
            const t = i / samples;
            const p = curve.getPoint(t);
            const inside = p.x >= margin && p.x <= width - margin && p.y >= margin && p.y <= height - margin;
            if (inside && !foundStart) {
                startT = t;
                foundStart = true;
            }
            if (inside) {
                endT = t;
            }
        }

        const startExtend = 0.0;
        const endExtend = 0.0;
        return {
            startT: Math.max(0, startT - startExtend),
            endT: Math.min(1, endT + endExtend)
        };
    }

    private getTrackAngle (points: { x: number; y: number }[], index: number)
    {
        const curr = points[index];
        const next = points[index + 1] ?? points[index - 1] ?? curr;
        const angle = Math.atan2(next.y - curr.y, next.x - curr.x);
        return angle;
    }

    private buildRailPath (spline: Phaser.Curves.Spline)
    {
        const length = spline.getLength();
        const sampleEveryPx = 20;
        const samples = Math.max(60, Math.round(length / sampleEveryPx));
        const points: Phaser.Math.Vector2[] = [];

        for (let i = 0; i <= samples; i += 1) {
            const t = i / samples;
            const p = spline.getPointAt(t);
            points.push(new Phaser.Math.Vector2(p.x, p.y));
        }

        if (points.length < 2) {
            this.railPathPoints = points;
            this.railSegmentLengths = [];
            this.railTotalLength = 0;
            return;
        }

        const segments: number[] = [];
        let total = 0;

        for (let i = 0; i < points.length - 1; i += 1) {
            const curr = points[i];
            const next = points[i + 1];
            const segLen = Phaser.Math.Distance.Between(curr.x, curr.y, next.x, next.y);
            segments.push(segLen);
            total += segLen;
        }

        this.railPathPoints = points;
        this.railSegmentLengths = segments;
        this.railTotalLength = total;
    }

    private sampleRailByDistanceNoWrap (distancePx: number)
    {
        if (this.railPathPoints.length < 2 || this.railTotalLength <= 0) {
            return {
                position: new Phaser.Math.Vector2(0, 0),
                angle: 0
            };
        }

        const total = this.railTotalLength;
        if (distancePx <= 0) {
            const start = this.railPathPoints[0];
            const next = this.railPathPoints[1];
            const angle = Math.atan2(next.y - start.y, next.x - start.x);
            const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
            const pos = new Phaser.Math.Vector2(start.x, start.y).add(dir.scale(distancePx));
            return { position: pos, angle };
        }
        if (distancePx >= total) {
            const end = this.railPathPoints[this.railPathPoints.length - 1];
            const prev = this.railPathPoints[this.railPathPoints.length - 2];
            const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
            const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
            const pos = new Phaser.Math.Vector2(end.x, end.y).add(dir.scale(distancePx - total));
            return { position: pos, angle };
        }

        let remaining = distancePx;
        let segIndex = 0;

        while (segIndex < this.railSegmentLengths.length && remaining > this.railSegmentLengths[segIndex]) {
            remaining -= this.railSegmentLengths[segIndex];
            segIndex += 1;
        }

        const safeIndex = Math.min(segIndex, this.railPathPoints.length - 2);
        const curr = this.railPathPoints[safeIndex];
        const next = this.railPathPoints[safeIndex + 1];
        const segLen = this.railSegmentLengths[safeIndex] || 1;
        const ratio = Phaser.Math.Clamp(remaining / segLen, 0, 1);

        const x = Phaser.Math.Linear(curr.x, next.x, ratio);
        const y = Phaser.Math.Linear(curr.y, next.y, ratio);
        const angle = Math.atan2(next.y - curr.y, next.x - curr.x);

        return {
            position: new Phaser.Math.Vector2(x, y),
            angle
        };
    }

    private createRailway ()
    {
        const { width, height } = this.scale;
        const spline = this.createTrackCurve(width, height);
        this.trackSpline = spline;
        this.trackLength = spline.getLength();
        this.buildRailPath(spline);

        const baseScale = Math.min(width / 750, height / 1334);
        const railOffset = 18 * baseScale;
        const sleeperWidth = railOffset * 1.8;
        const sleeperHeight = 7 * baseScale;

        const railwayContainer = this.add.container(0, 0);
        this.railwayContainer = railwayContainer;

        const railLeft: Phaser.Math.Vector2[] = [];
        const railRight: Phaser.Math.Vector2[] = [];

        const samples = 140;
        for (let i = 0; i <= samples; i += 1) {
            const t = i / samples;
            const point = spline.getPoint(t);
            const tangent = spline.getTangent(t).normalize();
            const normal = new Phaser.Math.Vector2(-tangent.y, tangent.x).normalize();
            railLeft.push(new Phaser.Math.Vector2(
                point.x + normal.x * railOffset,
                point.y + normal.y * railOffset
            ));
            railRight.push(new Phaser.Math.Vector2(
                point.x - normal.x * railOffset,
                point.y - normal.y * railOffset
            ));
        }

        const rails = this.add.graphics();
        rails.lineStyle(8 * baseScale, 0xf8fafc, 1);
        rails.beginPath();
        rails.moveTo(railLeft[0].x, railLeft[0].y);
        railLeft.forEach((p) => rails.lineTo(p.x, p.y));
        rails.strokePath();

        rails.beginPath();
        rails.moveTo(railRight[0].x, railRight[0].y);
        railRight.forEach((p) => rails.lineTo(p.x, p.y));
        rails.strokePath();
        rails.setDepth(5);
        railwayContainer.add(rails);

        const sleeperCount = 28;
        for (let i = 0; i <= sleeperCount; i += 1) {
            const t = i / sleeperCount;
            const point = spline.getPoint(t);
            const tangent = spline.getTangent(t).normalize();
            const angle = Math.atan2(tangent.y, tangent.x) + Math.PI / 2;
            const sleeper = this.add.rectangle(point.x, point.y, sleeperWidth, sleeperHeight, 0xb45309, 0.95);
            sleeper.setRotation(angle);
            sleeper.setDepth(4);
            railwayContainer.add(sleeper);
        }

        if (this.debugTrack) {
            this.drawTrackCurve(spline);
            this.drawCurveMarkers(spline, 11);
        }

        this.setRailwayVisible(this.showRailOverlay);
        this.setDebugTrackVisible(this.debugTrack);

        this.trainDistancePx = 0;
        if (this.trainStepPx <= 0) {
            this.trainStepPx = this.railTotalLength > 1 ? (this.railTotalLength - 1) / this.maxCars : 0;
        }
        this.refreshLocks();
        this.updateTrainCars(true);
    }

    private createBarrierGate ()
    {
        if (!this.textures.exists('train-barrier')) return;
        const gate = this.add.image(0, 0, 'train-barrier');
        gate.setDepth(6);
        gate.setOrigin(0.08, 0.5);
        this.barrierGate = gate;
        this.updateBarrierPosition();
        this.setBarrierOpen(false, true);
    }

    private updateBarrierPosition ()
    {
        if (!this.barrierGate) return;
        const baseWidth = 750;
        const baseHeight = 1334;
        const scaleX = this.scale.width / baseWidth;
        const scaleY = this.scale.height / baseHeight;
        const baseX = 355;
        const baseY = 230;
        this.barrierGate.setPosition(baseX * scaleX, baseY * scaleY);
        const scale = Math.min(scaleX, scaleY) * 0.35;
        this.barrierGate.setScale(scale);
        this.barrierBaseAngle = 0;
        const targetAngle = this.barrierIsOpen ? this.barrierBaseAngle - Phaser.Math.DegToRad(45) : this.barrierBaseAngle;
        this.barrierGate.setRotation(targetAngle);
    }

    private setBarrierOpen (open: boolean, immediate: boolean = false)
    {
        if (!this.barrierGate) return;
        this.barrierIsOpen = open;
        const targetAngle = open
            ? this.barrierBaseAngle - Phaser.Math.DegToRad(45)
            : this.barrierBaseAngle;
        if (immediate) {
            this.barrierGate.setRotation(targetAngle);
            return;
        }
        this.tweens.add({
            targets: this.barrierGate,
            rotation: targetAngle,
            duration: 220,
            ease: 'Sine.easeInOut'
        });
    }

    private updateTrainCars (force: boolean = false)
    {
        if (!this.showCars) return;
        if (!force && !this.trainMoving) return;
        if (this.railTotalLength <= 0) return;

        for (let i = 0; i < this.carSlots.length; i += 1) {
            const slot = this.carSlots[i];
            const distanceFromBottom = this.trainDistancePx - i * this.trainGapPx;
            const mappedDistance = Math.max(0, this.railTotalLength - 1) - distanceFromBottom;
            const sample = this.sampleRailByDistanceNoWrap(mappedDistance);
            slot.car.setPosition(sample.position.x, sample.position.y);
            slot.car.setRotation(sample.angle + this.trainRotationOffset);
        }

        const leadCar = this.carSlots[0]?.car;
        if (leadCar && this.leadCarBadge && this.leadCarBadge.scene) {
            const offsetX = -leadCar.displayWidth * 0.34;
            const offsetY = -leadCar.displayHeight * 0.08;
            const rotation = leadCar.rotation;
            const worldX = leadCar.x + Math.cos(rotation) * offsetX - Math.sin(rotation) * offsetY;
            const worldY = leadCar.y + Math.sin(rotation) * offsetX + Math.cos(rotation) * offsetY;
            this.leadCarBadge.setPosition(worldX, worldY);
            this.leadCarBadge.setRotation(rotation);
        }
    }

    private setShowCars (value: boolean)
    {
        this.showCars = value;
        this.carSlots.forEach((slot) => {
            slot.car.setVisible(value);
            slot.lock.setVisible(false);
        });
        if (this.leadCarBadge) {
            this.leadCarBadge.setVisible(value);
        }
        if (value) {
            this.refreshLocks();
            this.updateTrainCars(true);
        }
    }

    private setRailwayVisible (value: boolean)
    {
        if (this.railwayContainer) {
            this.railwayContainer.setVisible(value);
        }
        if (this.debugCurveGraphics) {
            this.debugCurveGraphics.setVisible(value && this.debugTrack);
        }
        if (this.debugMarkerGraphics) {
            this.debugMarkerGraphics.setVisible(value && this.debugTrack);
        }
        this.debugMarkerLabels.forEach((label) => label.setVisible(value && this.debugTrack));
    }

    private isRailwayVisible ()
    {
        return this.railwayContainer?.visible ?? true;
    }

    private setDebugTrackVisible (value: boolean)
    {
        this.debugTrack = value;
        if (this.debugCurveGraphics) {
            this.debugCurveGraphics.setVisible(value);
        }
        if (this.debugMarkerGraphics) {
            this.debugMarkerGraphics.setVisible(value);
        }
        this.debugMarkerLabels.forEach((label) => label.setVisible(value));
    }

    private setTrainMoving (value: boolean)
    {
        this.trainMoving = value;
        if (!value) {
            this.updateTrainCars(true);
        }
    }

    private endGame (reason: string, result: 'win' | 'lose')
    {
        if (this.gameOver) return;
        this.gameOver = true;
        this.quizOpen = false;
        this.quizLocked = false;
        this.hasStarted = false;
        this.closeQuiz();
        this.submitSessionResult();

        if (result === 'lose') {
            this.openTimeUpModal('Out of time! Try again.');
            return;
        }
        this.openTimeUpModal(reason || 'Great job! You won!');
    }

    private formatTime (seconds: number)
    {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
}
