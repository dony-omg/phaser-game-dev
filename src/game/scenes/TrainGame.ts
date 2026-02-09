import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import type { GameQuestion } from '../../services/api';
import { getGameConfig, resolveGameCode } from '../gameConfig';

type TrainCarSlot = {
    index: number;
    car: Phaser.GameObjects.Image;
    lock: Phaser.GameObjects.Container;
};

type TrainGameInitData = {
    gameCode?: string | null;
    gameId?: string | null;
    questions?: GameQuestion[] | null;
    timeLimit?: number | null;
};

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
    }
];

export class TrainGame extends Scene
{
    private readonly debugTrack = true;
    private readonly showCars = false;
    private trackSpline?: Phaser.Curves.Spline;
    private trainSprite?: Phaser.GameObjects.Image;
    private trainProgress: number = 0;
    camera!: Phaser.Cameras.Scene2D.Camera;
    background!: Phaser.GameObjects.Image;
    carSlots: TrainCarSlot[] = [];
    quizModal!: Phaser.GameObjects.Container;
    quizPanel!: Phaser.GameObjects.Container;
    quizQuestionText!: Phaser.GameObjects.Text;
    quizFeedbackText!: Phaser.GameObjects.Text;
    quizOptionButtons: Phaser.GameObjects.Container[] = [];
    timerText!: Phaser.GameObjects.Text;
    scoreText!: Phaser.GameObjects.Text;

    gameCode: string = 'train_game';
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

    constructor ()
    {
        super('TrainGame');
    }

    init (data: TrainGameInitData)
    {
        this.gameCode = resolveGameCode(data?.gameCode ?? (this.registry.get('gameCode') as string | undefined));
        this.registry.set('gameCode', this.gameCode);
        this.sessionGameId = data?.gameId ?? null;
        this.sessionQuestions = data?.questions ?? null;
        this.sessionTimeLimit = data?.timeLimit ?? null;
    }

    create ()
    {
        const { width, height } = this.scale;
        const gameConfig = getGameConfig(this.gameCode);

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(gameConfig.backgroundColor);

        this.background = this.add.image(width / 2, height / 2, 'train-bg')
            .setDisplaySize(width, height)
            .setOrigin(0.5, 0.5);

        this.setupQuestions();
        this.setupTimer();
        this.createHud();
        // Temporary: show full train without unlock flow
        this.currentIndex = this.maxCars;
        this.score = this.maxCars;
        this.createRailway();
        if (this.showCars) {
            this.layoutTrain();
        }
        this.createQuizModal();

        EventBus.emit('current-scene-ready', this);
    }

    update (_time: number, delta: number)
    {
        if (this.gameOver) return;

        this.remainingMs = Math.max(0, this.remainingMs - delta);
        const seconds = Math.ceil(this.remainingMs / 1000);
        if (seconds !== this.lastSecondShown) {
            this.lastSecondShown = seconds;
            this.timerText.setText(this.formatTime(seconds));
        }

        if (this.remainingMs <= 0 && !this.gameOver) {
            this.endGame('Hết thời gian.', 'lose');
        }
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
        const { width } = this.scale;

        const hudBg = this.add.rectangle(width / 2, 60, width - 48, 64, 0x0f172a, 0.6);
        hudBg.setStrokeStyle(2, 0xfbbf24, 0.8);
        hudBg.setDepth(50);

        this.scoreText = this.add.text(40, 60, `Toa: 0/${this.maxCars}`, {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#fef3c7'
        }).setOrigin(0, 0.5).setDepth(60);

        this.timerText = this.add.text(width - 40, 60, this.formatTime(Math.ceil(this.remainingMs / 1000)), {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#e2e8f0'
        }).setOrigin(1, 0.5).setDepth(60);
    }

    private layoutTrain ()
    {
        const { width, height } = this.scale;
        const scaleX = this.background.displayWidth / this.background.width;
        const scaleY = this.background.displayHeight / this.background.height;
        const scale = Math.min(scaleX, scaleY) * 0.72;

        const trackCurve = this.createTrackCurve(width, height);
        const trackPoints = this.sampleTrack(trackCurve, this.maxCars);

        this.carSlots = [];

        for (let i = 0; i < this.maxCars; i += 1) {
            const carKey = `train-car-${i + 1}`;
            const point = trackPoints[i] ?? { x: width / 2, y: height / 2 };
            const angle = this.getTrackAngle(trackPoints, i);
            const car = this.add.image(point.x, point.y, carKey).setScale(scale).setRotation(angle);
            if (this.debugTrack) {
                car.setAlpha(0);
            } else {
                car.setAlpha(0.2);
            }

            const lock = this.createLockOverlay(point.x, point.y, car.displayWidth, car.displayHeight, i);

            this.carSlots.push({ index: i, car, lock });
        }

        this.refreshLocks();
    }

    private createLockOverlay (x: number, y: number, width: number, height: number, index: number)
    {
        const lock = this.add.container(x, y);
        lock.setDepth(10);
        const panelW = Math.max(140, width * 0.6);
        const panelH = Math.max(48, height * 0.35);

        const bg = this.add.rectangle(0, 0, panelW, panelH, 0x1f2937, 0.9);
        bg.setStrokeStyle(2, 0xfbbf24, 0.9);

        const text = this.add.text(0, 0, 'MỞ KHÓA', {
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
            if (this.debugTrack) {
                slot.car.setAlpha(0);
                slot.lock.setVisible(false);
                slot.lock.disableInteractive();
                return;
            }

            const isUnlocked = slot.index < this.currentIndex;
            const isActive = slot.index === this.currentIndex;

            slot.car.setAlpha(isUnlocked ? 1 : 0.2);
            slot.lock.setVisible(!isUnlocked);
            slot.lock.setAlpha(isActive ? 1 : 0.4);
            if (isActive) {
                const hitArea = slot.lock.getData('hitArea') as Phaser.Geom.Rectangle | undefined;
                if (hitArea) {
                    slot.lock.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
                } else {
                    slot.lock.setInteractive();
                }
            } else {
                slot.lock.disableInteractive();
            }
        });

        this.scoreText.setText(`Toa: ${this.score}/${this.maxCars}`);
    }

    private createQuizModal ()
    {
        const { width, height } = this.scale;

        this.quizModal = this.add.container(0, 0).setDepth(2000).setVisible(false);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0);

        const panelWidth = width * 0.84;
        const panelHeight = height * 0.58;
        const panelX = width / 2;
        const panelY = height / 2;

        const panelBg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0xf8fafc, 1);
        panelBg.setStrokeStyle(4, 0x38bdf8, 0.9);

        const titleText = this.add.text(panelX, panelY - panelHeight / 2 + 26, 'Câu hỏi', {
            fontFamily: 'Arial Black',
            fontSize: '24px',
            color: '#0f172a'
        }).setOrigin(0.5, 0);

        this.quizQuestionText = this.add.text(panelX, panelY - panelHeight / 2 + 70, '', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#0f172a',
            align: 'center',
            wordWrap: { width: panelWidth - 80 }
        }).setOrigin(0.5, 0);

        this.quizFeedbackText = this.add.text(panelX, panelY + panelHeight / 2 - 80, '', {
            fontFamily: 'Arial Black',
            fontSize: '22px',
            color: '#16a34a'
        }).setOrigin(0.5, 0.5);

        this.quizPanel = this.add.container(0, 0, [panelBg, titleText, this.quizQuestionText, this.quizFeedbackText]);

        this.quizModal.add([overlay, this.quizPanel]);
    }

    private openQuestion (index: number)
    {
        if (this.quizOpen || this.gameOver) return;

        const question = this.getQuestionForIndex(index);
        this.quizQuestionText.setText(question.question.content);
        this.quizFeedbackText.setText('');

        this.clearOptionButtons();
        this.renderOptions(question.question.options);

        this.quizOpen = true;
        this.quizLocked = false;
        this.quizModal.setVisible(true);
    }

    private renderOptions (options: { text: string; is_correct: boolean }[])
    {
        const { width, height } = this.scale;
        const panelWidth = width * 0.8;
        const startY = height / 2 - 40;
        const gap = 18;
        const buttonHeight = 56;

        options.forEach((option, idx) => {
            const y = startY + idx * (buttonHeight + gap);
            const button = this.add.container(width / 2, y);

            const bg = this.add.rectangle(0, 0, panelWidth, buttonHeight, 0x1e293b, 0.95);
            bg.setStrokeStyle(2, 0x94a3b8, 0.8);

            const text = this.add.text(0, 0, option.text, {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#e2e8f0',
                align: 'center',
                wordWrap: { width: panelWidth - 40 }
            }).setOrigin(0.5);

            button.add([bg, text]);
            button.setSize(panelWidth, buttonHeight);
            button.setInteractive(new Phaser.Geom.Rectangle(-panelWidth / 2, -buttonHeight / 2, panelWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

            button.on('pointerover', () => {
                if (this.quizLocked) return;
                bg.setFillStyle(0x334155, 0.98);
                button.setScale(1.02);
                this.input.setDefaultCursor('pointer');
            });

            button.on('pointerout', () => {
                bg.setFillStyle(0x1e293b, 0.95);
                button.setScale(1);
                this.input.setDefaultCursor('default');
            });

            button.on('pointerdown', () => {
                if (this.quizLocked) return;
                this.handleAnswer(option.is_correct);
            });

            this.quizModal.add(button);
            this.quizOptionButtons.push(button);
        });
    }

    private handleAnswer (isCorrect: boolean)
    {
        if (this.quizLocked) return;
        this.quizLocked = true;

        if (isCorrect) {
            this.quizFeedbackText.setColor('#16a34a');
            this.quizFeedbackText.setText('Đúng rồi! Toa đã được nối.');
            this.time.delayedCall(700, () => {
                this.applyCorrect();
                this.closeQuiz();
            });
        } else {
            this.quizFeedbackText.setColor('#dc2626');
            this.quizFeedbackText.setText('Sai rồi! Quay lại đầu tàu.');
            this.time.delayedCall(900, () => {
                this.applyWrong();
                this.closeQuiz();
            });
        }
    }

    private applyCorrect ()
    {
        this.currentIndex = Math.min(this.maxCars, this.currentIndex + 1);
        this.score = this.currentIndex;
        this.refreshLocks();

        if (this.currentIndex >= this.maxCars) {
            this.endGame(`Hoàn thành đủ ${this.maxCars} toa!`, 'win');
        }
    }

    private applyWrong ()
    {
        this.currentIndex = 0;
        this.score = 0;
        this.remainingMs = Math.max(0, this.remainingMs - 15000);
        this.lastSecondShown = -1;
        this.refreshLocks();

        if (this.remainingMs <= 0) {
            this.endGame('Hết thời gian.', 'lose');
        }
    }

    private closeQuiz ()
    {
        this.quizModal.setVisible(false);
        this.quizOpen = false;
        this.quizLocked = false;
        this.clearOptionButtons();
    }

    private clearOptionButtons ()
    {
        this.quizOptionButtons.forEach((button) => button.destroy());
        this.quizOptionButtons = [];
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
            { x: 470, y: -200 },
            { x: 440, y: -80 },
            { x: 510, y: 180 },
            { x: 485, y: 360 },
            { x: 375, y: 540 },
            { x: 250, y: 740 },
            { x: 220, y: 920 },
            { x: 270, y: 1100 },
            { x: 430, y: 1280 }
        ].map((p) => new Phaser.Math.Vector2(p.x * scaleX, p.y * scaleY));

        return new Phaser.Curves.Spline(points);
    }

    private sampleTrack (curve: Phaser.Curves.Spline, count: number)
    {
        const points: { x: number; y: number }[] = [];
        const total = Math.max(1, count - 1);
        for (let i = 0; i < count; i += 1) {
            const t = total === 0 ? 0 : i / total;
            const p = curve.getPoint(t);
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
            const label = this.add.text(clampedX + 10, clampedY - 10, `${i + 1}`, {
                fontFamily: 'Arial Black',
                fontSize: '18px',
                color: '#22c55e',
                stroke: '#0f172a',
                strokeThickness: 3
            });
            label.setDepth(1002);
        }
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

        return { startT, endT };
    }

    private getTrackAngle (points: { x: number; y: number }[], index: number)
    {
        const curr = points[index];
        const next = points[index + 1] ?? points[index - 1] ?? curr;
        const angle = Math.atan2(next.y - curr.y, next.x - curr.x);
        return angle;
    }

    private createRailway ()
    {
        const { width, height } = this.scale;
        const spline = this.createTrackCurve(width, height);
        this.trackSpline = spline;

        const baseScale = Math.min(width / 750, height / 1334);
        const railOffset = 22 * baseScale;
        const sleeperWidth = railOffset * 2.2;
        const sleeperHeight = 8 * baseScale;

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
        rails.lineStyle(10 * baseScale, 0xf8fafc, 1);
        rails.beginPath();
        rails.moveTo(railLeft[0].x, railLeft[0].y);
        railLeft.forEach((p) => rails.lineTo(p.x, p.y));
        rails.strokePath();

        rails.beginPath();
        rails.moveTo(railRight[0].x, railRight[0].y);
        railRight.forEach((p) => rails.lineTo(p.x, p.y));
        rails.strokePath();
        rails.setDepth(5);

        const sleeperCount = 28;
        for (let i = 0; i <= sleeperCount; i += 1) {
            const t = i / sleeperCount;
            const point = spline.getPoint(t);
            const tangent = spline.getTangent(t).normalize();
            const angle = Math.atan2(tangent.y, tangent.x) + Math.PI / 2;
            const sleeper = this.add.rectangle(point.x, point.y, sleeperWidth, sleeperHeight, 0xb45309, 0.95);
            sleeper.setRotation(angle);
            sleeper.setDepth(4);
        }

        if (this.debugTrack) {
            this.drawTrackCurve(spline);
            this.drawCurveMarkers(spline, 11);
        }

        const trainPoint = spline.getPoint(0);
        this.trainSprite = this.add.image(trainPoint.x, trainPoint.y, 'train-car-1');
        this.trainSprite.setScale(baseScale * 0.72);
        this.trainSprite.setDepth(6);

        this.trainProgress = 0;
        this.tweens.add({
            targets: this,
            trainProgress: 1,
            duration: 12000,
            repeat: -1,
            onUpdate: () => {
                if (!this.trackSpline || !this.trainSprite) return;
                const p = this.trackSpline.getPoint(this.trainProgress);
                const t = this.trackSpline.getTangent(this.trainProgress).normalize();
                this.trainSprite.setPosition(p.x, p.y);
                this.trainSprite.setRotation(Math.atan2(t.y, t.x));
            }
        });
    }

    private endGame (reason: string, result: 'win' | 'lose')
    {
        if (this.gameOver) return;
        this.gameOver = true;

        this.scene.start('GameOver', {
            score: this.score,
            bonus: 0,
            result,
            reason
        });
    }

    private formatTime (seconds: number)
    {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
