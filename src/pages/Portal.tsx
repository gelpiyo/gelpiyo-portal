import { useRef, useEffect, useState } from 'react';
import type { GameCategoryId } from '@/types/game';
import { CATEGORIES, GAMES } from '@/data/games';
import { GameCard } from '@/components/GameCard';
import { usePortalStore } from '@/stores/portalStore';

export function Portal(): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<GameCategoryId | null>(null);
  const [focusedGameId, setFocusedGameId] = useState<string | null>(null);
  const carouselRef = useRef<HTMLUListElement>(null);
  const navigateToGame = usePortalStore((s) => s.navigateToGame);

  const filteredGames = GAMES.filter(g => g.categoryId === selectedCategory);
  const focusedGame = filteredGames.find(g => g.id === focusedGameId) || filteredGames[0];

  useEffect(() => {
    if (selectedCategory && filteredGames.length > 0) {
      setFocusedGameId(filteredGames[0].id);
      if (carouselRef.current) {
        carouselRef.current.scrollTo({ left: 0, behavior: 'instant' });
      }
    }
  }, [selectedCategory]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !selectedCategory) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
             const gameId = entry.target.getAttribute('data-game-id');
             if (gameId) setFocusedGameId(gameId);
          }
        });
      },
      {
        root: el,
        threshold: 0.6,
      }
    );

    const children = Array.from(el.children);
    children.forEach(child => observer.observe(child));

    return () => {
      children.forEach(child => observer.unobserve(child));
    };
  }, [selectedCategory, filteredGames]);

  const handleStartQuest = () => {
    if (focusedGame?.available) {
      navigateToGame(focusedGame.id);
    }
  };

  return (
    <div className="portal">
      {/* ヘッダー */}
      <header className="portal__header">
        <div className="portal__logo">
          <img 
            src={`${import.meta.env.BASE_URL}assets/factory/characters/gelpiyo_transparent.png`} 
            alt="Gelpiyo" 
            className="portal__logo-img" 
          />
          <div>
            <h1 className="portal__title">ゲルぴよ</h1>
            <span className="portal__subtitle">QUEST PORTAL</span>
          </div>
        </div>
      </header>

      {!selectedCategory ? (
        /* カテゴリ選択画面 */
        <main className="portal__category-select">
          <h2 className="portal__category-title">ジャンルを選択してね</h2>
          <div className="portal__category-grid">
            {CATEGORIES.map(cat => (
              <button 
                key={cat.id} 
                className="portal__category-btn"
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="portal__category-emoji">{cat.emoji}</span>
                <span className="portal__category-name">{cat.name}</span>
              </button>
            ))}
          </div>
        </main>
      ) : (
        /* ゲーム一覧（カルーセル）画面 */
        <div className="portal__game-view">
          <button className="portal__back-btn" onClick={() => setSelectedCategory(null)}>
            ◀ カテゴリ選択へ
          </button>
          
          {/* カルーセル */}
          <main className="portal__carousel-container">
            <ul className="portal__carousel" ref={carouselRef}>
                {filteredGames.map((game) => (
                  <li key={game.id} className="portal__carousel-item" data-game-id={game.id}>
                    <GameCard game={game} isFocused={game.id === focusedGameId} />
                  </li>
                ))}
            </ul>
          </main>

          {/* スワイプヒント */}
          <div className="portal__swipe-hint">
            <span className="swipe-arrow">◀</span>
            スワイプで探す
            <span className="swipe-arrow">▶</span>
          </div>

          {/* ナレーションUI */}
          <footer className="portal__narration-container">
            <div className="portal__narration-box">
                <div className="portal__narration-tab">ワンポイント</div>
                <div className="portal__narration-content">
                  <h3 className="portal__narration-title">{focusedGame?.title}</h3>
                  <p className="portal__narration-desc">{focusedGame?.description}</p>
                </div>
                <button 
                  className="portal__narration-start-btn" 
                  onClick={handleStartQuest}
                  disabled={!focusedGame?.available}
                >
                  ▶ 遊ぶ
                </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
