import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';

export function StartGame(parent: string | HTMLElement): Phaser.Game {
    return new Phaser.Game({
        type: Phaser.AUTO,
        parent: parent,
        width: 800,
        height: 600,
        backgroundColor: '#87CEEB', // 空色
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { x: 0, y: 1000 },
                debug: false
            }
        },
        scene: [MainScene]
    });
}
