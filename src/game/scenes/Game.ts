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

    // UI
    jumpButton: Phaser.GameObjects.Container;
    jumpButtonBg!: Phaser.GameObjects.Rectangle;
    scoreText: Phaser.GameObjects.Text;
    quizModal!: Phaser.GameObjects.Container;
    quizQuestionText!: Phaser.GameObjects.Text;
    quizOptionButtons: Phaser.GameObjects.Container[] = [];
    quizOpen: boolean = false;
    quizLocked: boolean = false;
    quizCurrentIndex: number = 0;
    startModal!: Phaser.GameObjects.Container;
    startModalOpen: boolean = false;

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

        // Jump Button
        this.jumpButton = this.createJumpButton(width / 2, height - 150);
        this.jumpButton.setScrollFactor(0);
        this.uiRoot.add(this.jumpButton);

        this.setupJumpInput();

        // Quiz Modal (UI overlay)
        this.createQuizModal();

        // Start Modal (first screen)
        this.createStartModal();
        this.openStartModal();

        // Ensure only UI camera renders UI
        this.cameras.main.ignore(this.uiRoot);
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

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.65)
            .setOrigin(0, 0);

        const panelWidth = Math.min(760, width - 80);
        const panelHeight = Math.min(520, height - 160);

        const panelContainer = this.add.container(width / 2, height / 2).setScrollFactor(0);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.35);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 24);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0b1220, 1);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(3, 0xffffff, 0.6);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const panelGlow = this.add.graphics();
        panelGlow.fillStyle(0x1e293b, 0.9);
        panelGlow.fillRoundedRect(-panelWidth / 2 + 10, -panelHeight / 2 + 10, panelWidth - 20, panelHeight - 20, 18);

        const ribbon = this.add.graphics();
        ribbon.fillStyle(0x16a34a, 1);
        ribbon.fillRoundedRect(-panelWidth / 2 + 24, -panelHeight / 2 + 18, panelWidth - 48, 48, 12);

        const ribbonText = this.add.text(0, -panelHeight / 2 + 42, 'Câu hỏi trắc nghiệm', {
            fontFamily: 'Arial Black',
            fontSize: '26px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        this.quizQuestionText = this.add.text(0, -panelHeight / 2 + 110, '...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#e2e8f0',
            align: 'center',
            wordWrap: { width: panelWidth - 120, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        panelContainer.add([panelShadow, panelBg, panelGlow, ribbon, ribbonText, this.quizQuestionText]);

        const optionsStartY = -panelHeight / 2 + 210;
        const optionGap = 74;
        this.quizOptionButtons = [];

        container.add([overlay, panelContainer]);

        for (let i = 0; i < 4; i++) {
            const option = this.createQuizOption(0, optionsStartY + i * optionGap, i);
            this.quizOptionButtons.push(option);
            panelContainer.add(option);
        }
        container.setVisible(false);
        panelContainer.setScale(0.96);

        this.quizModal = container;
        this.quizModal.setData('panel', panelContainer);
        if (this.uiRoot) this.uiRoot.add(container);
    }

    private createStartModal(): void {
        const { width, height } = this.scale;

        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(220);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.72)
            .setOrigin(0, 0);

        const panelWidth = Math.min(640, width - 120);
        const panelHeight = Math.min(360, height - 220);
        const panelContainer = this.add.container(width / 2, height / 2).setScrollFactor(0);

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.35);
        panelShadow.fillRoundedRect(-panelWidth / 2 + 6, -panelHeight / 2 + 10, panelWidth, panelHeight, 24);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0b1220, 1);
        panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);
        panelBg.lineStyle(3, 0xffffff, 0.6);
        panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 24);

        const title = this.add.text(0, -panelHeight / 2 + 48, 'Bắt đầu trò chơi', {
            fontFamily: 'Arial Black',
            fontSize: '30px',
            color: '#f8fafc'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -panelHeight / 2 + 96, 'Trả lời đúng để nhân vật nhảy tới lá tiếp theo', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#cbd5f5',
            align: 'center',
            wordWrap: { width: panelWidth - 80, useAdvancedWrap: true }
        }).setOrigin(0.5, 0);

        const button = this.createStartButton(0, panelHeight / 2 - 70);

        panelContainer.add([panelShadow, panelBg, title, subtitle, button]);

        container.add([overlay, panelContainer]);
        container.setVisible(false);
        panelContainer.setScale(0.96);

        this.startModal = container;
        this.startModal.setData('panel', panelContainer);
        if (this.uiRoot) this.uiRoot.add(container);
    }

    private createStartButton(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setScrollFactor(0);
        const width = 260;
        const height = 64;
        const radius = 16;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const redraw = (hover: boolean) => {
            bg.clear();
            bg.fillStyle(hover ? 0x22c55e : 0x16a34a, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
            bg.lineStyle(2, 0xffffff, hover ? 0.9 : 0.7);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        };
        redraw(false);

        const text = this.add.text(0, 0, 'START', {
            fontFamily: 'Arial Black',
            fontSize: '26px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const zone = this.add.zone(0, 0, width, height).setScrollFactor(0).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            redraw(true);
            this.tweens.add({ targets: container, scale: 1.04, duration: 120, ease: 'Sine.easeOut' });
        });
        zone.on('pointerout', () => {
            redraw(false);
            this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.easeOut' });
        });
        zone.on('pointerdown', () => {
            if (!this.startModalOpen) return;
            this.closeStartModal();
            this.openQuizModal();
        });

        container.add([shadow, bg, text, zone]);
        container.setSize(width, height);

        return container;
    }

    private openStartModal(): void {
        this.startModalOpen = true;
        this.jumpButton.setAlpha(0.4);

        this.startModal.setVisible(true);
        this.startModal.setAlpha(0);
        const panel = this.startModal.getData('panel') as Phaser.GameObjects.Container;
        panel.setScale(0.96);

        this.tweens.add({
            targets: this.startModal,
            alpha: 1,
            duration: 180
        });
        this.tweens.add({
            targets: panel,
            scale: 1,
            duration: 220,
            ease: 'Back.easeOut'
        });
    }

    private closeStartModal(): void {
        this.startModalOpen = false;
        this.jumpButton.setAlpha(1);
        this.startModal.setVisible(false);
    }

    private createQuizOption(x: number, y: number, index: number): Phaser.GameObjects.Container {
        const label = ['A', 'B', 'C', 'D'][index];
        const container = this.add.container(x, y);

        const width = 600;
        const height = 58;
        const radius = 14;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        const badge = this.add.graphics();

        const labelText = this.add.text(-width / 2 + 34, 0, label, {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#0b1220'
        }).setOrigin(0.5);

        const text = this.add.text(-width / 2 + 74, 0, `${label}. ...`, {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#f8fafc'
        }).setOrigin(0, 0.5);

        const zone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });

        const redraw = (state: 'normal' | 'hover' | 'correct' | 'wrong') => {
            let fill = 0x1e293b;
            let stroke = 0xffffff;
            let badgeFill = 0xfbbf24;

            if (state === 'hover') {
                fill = 0x243b53;
                stroke = 0xf8fafc;
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
            badge.fillRoundedRect(-width / 2 + 14, -height / 2 + 8, 40, height - 16, 10);
        };

        redraw('normal');

        container.add([shadow, bg, badge, labelText, text, zone]);
        container.setSize(width, height);

        const onPress = () => {
            if (!this.quizOpen) return;
            this.handleQuizAnswer(index);
        };

        zone.on('pointerdown', onPress);

        container.setData('redraw', redraw);
        container.setData('text', text);

        return container;
    }

    private openQuizModal(): void {
        if (this.player.isJumping()) return;
        this.quizOpen = true;
        this.quizLocked = false;
        this.jumpButton.setAlpha(0.6);

        const question = this.getMockQuestions()[this.quizCurrentIndex % this.getMockQuestions().length];
        this.quizQuestionText.setText(question.question);

        this.quizOptionButtons.forEach((btn, i) => {
            const redraw = btn.getData('redraw') as (state: 'normal' | 'hover' | 'correct' | 'wrong') => void;
            const text = btn.getData('text') as Phaser.GameObjects.Text;
            redraw('normal');
            text.setText(`${['A', 'B', 'C', 'D'][i]}. ${question.options[i]}`);
        });

        this.quizModal.setVisible(true);
        this.quizModal.setAlpha(0);
        const panel = this.quizModal.getData('panel') as Phaser.GameObjects.Container;
        panel.setScale(0.96);
        this.tweens.add({
            targets: this.quizModal,
            alpha: 1,
            duration: 180
        });
        this.tweens.add({
            targets: panel,
            scale: 1,
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
            this.closeQuizModal();
            await this.handleJump();
            this.quizCurrentIndex += 1;
            this.time.delayedCall(250, () => {
                this.openQuizModal();
            });
        } else {
            this.quizLocked = true;
            redraw('wrong');
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

        const nextIndex = this.currentLeafIndex + 1;
        const targetPos = this.getLeafPosition(nextIndex);

        // Visual feedback
        this.score += 10;
        this.scoreText.setText(`Score: ${this.score}`);

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
        await this.player.jumpTo(targetPos.x, targetPos.y, 900);

        // Update state after jump completes
        this.currentLeafIndex = nextIndex;

        const nextPos = this.getLeafPosition(this.currentLeafIndex + 1);
        this.player.flip(nextPos.x > targetPos.x);

        // Show correct state on new leaf, then resume idle
        this.player.showCorrect(800);
        this.time.delayedCall(800, () => {
            this.player.playIdle();
        });
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
