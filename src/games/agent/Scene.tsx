import { Terrain } from './Terrain'
import { Player } from './Player'

export function Scene() {
  return (
    <>
      {/* Background color matching fog for a seamless horizon */}
      <color attach="background" args={['#88bbee']} />
      
      {/* Fog is critical for PS1 look to hide draw distance */}
      <fog attach="fog" args={['#88bbee', 10, 40]} />
      
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={0.5} />
      
      <Terrain />
      <Player />
    </>
  )
}
