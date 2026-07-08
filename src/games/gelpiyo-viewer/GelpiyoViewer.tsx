import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage, Loader } from '@react-three/drei';
import { usePortalStore } from '@/stores/portalStore';
import './gelpiyo-viewer.css';

// 3Dモデルを表示するコンポーネント
function Model() {
  // ダウンロードしたアヒルのモデルをロード
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}assets/models/duck.glb`);
  return <primitive object={scene} />;
}

export const GelpiyoViewer: React.FC = () => {
  const navigateToPortal = usePortalStore((state) => state.navigateToPortal);

  return (
    <div className="gelpiyo-viewer-container">
      <header className="viewer-header">
        <button className="viewer-back-btn" onClick={navigateToPortal}>
          &#8592; もどる
        </button>
        <h1 className="viewer-title">360度 3Dビューア</h1>
      </header>

      <div className="viewer-content">
        <p className="instruction-text">画面をドラッグしてぐるぐる回してね！</p>
        
        <div className="video-wrapper" style={{ cursor: 'grab', background: 'radial-gradient(circle, #333, #000)' }}>
          <Canvas shadows camera={{ position: [0, 0, 5], fov: 50 }}>
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.6}>
                <Model />
              </Stage>
            </Suspense>
            <OrbitControls 
              makeDefault 
              autoRotate 
              autoRotateSpeed={1.0}
              enableZoom={true} 
              enablePan={false} 
            />
          </Canvas>
          <Loader />
        </div>
      </div>
    </div>
  );
};

// プリロード
useGLTF.preload(`${import.meta.env.BASE_URL}assets/models/duck.glb`);
