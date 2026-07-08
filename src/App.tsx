import { Suspense } from 'react';
import { usePortalStore } from '@/stores/portalStore';
import { Portal } from '@/pages/Portal';
import { GAME_COMPONENTS } from '@/data/games';
import { GameLoader } from '@/components/GameLoader';

function App(): React.JSX.Element {
  const currentScreen = usePortalStore((s) => s.currentScreen);
  const isTransitioning = usePortalStore((s) => s.isTransitioning);

  // ポータル以外の画面ではゲームコンポーネントを動的取得
  const GameComponent = currentScreen !== 'portal'
    ? GAME_COMPONENTS[currentScreen]
    : null;

  return (
    <div className={`app ${isTransitioning ? 'app--transitioning' : ''}`}>
      {currentScreen === 'portal' && <Portal />}
      {GameComponent && (
        <Suspense fallback={<GameLoader />}>
          <GameComponent />
        </Suspense>
      )}
    </div>
  );
}

export default App;
