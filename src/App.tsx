import { usePortalStore } from '@/stores/portalStore';
import { Portal } from '@/pages/Portal';
import { AirHockeyGame } from '@/games/air-hockey/AirHockeyGame';
import { BounceGame } from '@/games/bounce/BounceGame';
import { PuzzleRangerGame } from '@/games/puzzle-ranger/PuzzleRangerGame';
import { GelpiyoFactoryGame } from '@/games/factory/GelpiyoFactoryGame';
import { AgentGame } from '@/games/agent/AgentGame';
import { HammerJump } from '@/games/hammer-jump/HammerJump';
import { SpeedGunman } from '@/games/speed-gunman/SpeedGunman';

function App(): React.JSX.Element {
  const currentScreen = usePortalStore((s) => s.currentScreen);
  const isTransitioning = usePortalStore((s) => s.isTransitioning);

  return (
    <div className={`app ${isTransitioning ? 'app--transitioning' : ''}`}>
      {currentScreen === 'portal' && <Portal />}

      {/* Phase 2: エアホッケー（実装済み） */}
      {currentScreen === 'air-hockey' && <AirHockeyGame />}

      {currentScreen === 'factory' && <GelpiyoFactoryGame />}

      {currentScreen === 'bounce' && <BounceGame />}

      {currentScreen === 'puzzle-ranger' && <PuzzleRangerGame />}

      {currentScreen === 'agent' && <AgentGame />}

      {currentScreen === 'hammer-jump' && <HammerJump />}

      {currentScreen === 'speed-gunman' && <SpeedGunman />}
    </div>
  );
}

export default App;
