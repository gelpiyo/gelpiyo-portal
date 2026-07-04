import type { GameInfo } from '@/types/game';
import { usePortalStore } from '@/stores/portalStore';

interface GameCardProps {
  game: GameInfo;
}

export function GameCard({ game }: GameCardProps): React.JSX.Element {
  const navigateToGame = usePortalStore((s) => s.navigateToGame);

  const handleClick = () => {
    if (!game.available) return;
    navigateToGame(game.id);
  };

  return (
    <button
      className={`game-card ${!game.available ? 'game-card--locked' : ''}`}
      onClick={handleClick}
      disabled={!game.available}
      aria-label={`${game.title}をプレイ`}
      style={{
        '--card-gradient': game.gradient,
      } as React.CSSProperties}
    >
      <div className="game-card__glow" />
      <div className="game-card__content">
        <div className="game-card__emoji">{game.emoji}</div>
        <div className="game-card__text">
          <h2 className="game-card__title">{game.title}</h2>
          <span className="game-card__subtitle">{game.subtitle}</span>
          <p className="game-card__description">{game.description}</p>
        </div>
        {!game.available && (
          <div className="game-card__badge">COMING SOON</div>
        )}
        {game.available && (
          <div className="game-card__play-icon">▶</div>
        )}
      </div>
    </button>
  );
}
