import type { GameInfo } from '@/types/game';
import { GameCard } from '@/components/GameCard';

/** ゲーム一覧データ */
const GAMES: GameInfo[] = [
  {
    id: 'air-hockey',
    title: 'エアホッケー',
    subtitle: '対戦アクション',
    description: '3ラウンド先取で勝利！分裂アイテムに注目⭐',
    emoji: '🏒',
    gradient: 'linear-gradient(135deg, hsl(200, 80%, 50%), hsl(220, 90%, 40%))',
    available: true,
  },
  {
    id: 'factory',
    title: 'ゲルぴよファクトリー',
    subtitle: 'アクション接客',
    description: 'ゲルぴよを製造して販売！制限時間内にハイスコアを目指そう！',
    emoji: '🧪',
    gradient: 'linear-gradient(135deg, hsl(280, 70%, 50%), hsl(320, 80%, 45%))',
    available: true,
  },
  {
    id: 'bounce',
    title: 'ゲルぴよバウンス',
    subtitle: '物理パズルアクション',
    description: 'ゲルぴよを引っ張って飛ばす！ぷにぷにバウンドアクション💥',
    emoji: '🐤',
    gradient: 'linear-gradient(135deg, hsl(45, 90%, 55%), hsl(30, 85%, 50%))',
    available: true,
  },
  {
    id: 'puzzle-ranger',
    title: 'ぴよレンジャー TD',
    subtitle: 'パズル × タワーディフェンス',
    description: 'パズルで仲間を召喚！連鎖でパワーアップ⚔️',
    emoji: '⚔️',
    gradient: 'linear-gradient(135deg, hsl(0, 75%, 55%), hsl(340, 80%, 45%))',
    available: true,
  },
  {
    id: 'agent',
    title: 'エージェント',
    subtitle: 'PS1風3D探索ゲーム',
    description: '3D空間を探索するエージェントゲーム🔫',
    emoji: '🕵️',
    gradient: 'linear-gradient(135deg, hsl(120, 75%, 45%), hsl(150, 80%, 35%))',
    available: true,
  },
  {
    id: 'hammer-jump',
    title: 'ハンマーぴよ飛ばし',
    subtitle: '連打アクション',
    description: '10秒間連打でエネルギー充填！宇宙の彼方へ飛んでいけ！',
    emoji: '🔨',
    gradient: 'linear-gradient(135deg, hsl(20, 90%, 55%), hsl(350, 80%, 45%))',
    available: true,
  },
];

export function Portal(): React.JSX.Element {
  return (
    <div className="portal">
      {/* ヘッダー */}
      <header className="portal__header">
        <div className="portal__logo">
          <span className="portal__logo-emoji">🐤</span>
          <div>
            <h1 className="portal__title">ゲルぴよ</h1>
            <span className="portal__subtitle">GAME PORTAL</span>
          </div>
        </div>
      </header>

      {/* ゲーム一覧 */}
      <main className="portal__games">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </main>

      {/* フッター */}
      <footer className="portal__footer">
        <p>© 2024-2026 ゲルぴよ</p>
      </footer>
    </div>
  );
}
