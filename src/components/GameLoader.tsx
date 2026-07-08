import './GameLoader.css';

export function GameLoader(): React.JSX.Element {
  return (
    <div className="game-loader">
      <div className="game-loader__content">
        <div className="game-loader__piyo">🐤</div>
        <div className="game-loader__text">よみこみ中...</div>
        <div className="game-loader__bar">
          <div className="game-loader__bar-fill" />
        </div>
      </div>
    </div>
  );
}
