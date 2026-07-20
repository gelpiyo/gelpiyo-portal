import type { GameInfo } from '@/types/game';
import { usePortalStore } from '@/stores/portalStore';

interface GameCardProps {
  game: GameInfo;
  isFocused?: boolean;
}

export function GameCard({ game, isFocused = false }: GameCardProps): React.JSX.Element {
  const navigateToGame = usePortalStore((s) => s.navigateToGame);

  const handleClick = () => {
    if (!game.available) return;
    navigateToGame(game.id);
  };

  return (
    <button
      className={`game-card ${!game.available ? 'game-card--locked' : ''} ${isFocused ? 'game-card--focused' : ''}`}
      onClick={handleClick}
      disabled={!game.available}
      aria-label={`${game.title}をプレイ`}
      style={{
        '--card-gradient': game.gradient,
      } as React.CSSProperties}
    >
      <div className="game-card__glow" />
      <div className="game-card__content">
        {game.image ? (
          <img
            src={`${import.meta.env.BASE_URL}${game.image}`}
            alt={`${game.title} icon`}
            className="game-card__image"
          />
        ) : (
          <div className="game-card__emoji">{game.emoji}</div>
        )}
        <div className="game-card__text">
          <h2 className="game-card__title">{game.title}</h2>
        </div>
        {!game.available && (
          <div className="game-card__badge">SOON</div>
        )}
      </div>
    </button>
  );
}
