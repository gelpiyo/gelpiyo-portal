import { useMemo } from 'react'
import { useGrassTexture } from './useGrassTexture'

function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.5, 2, 0.5]} />
        <meshLambertMaterial color="#5c4033" />
      </mesh>
      {/* Leaves */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshLambertMaterial color="#2d5a27" />
      </mesh>
    </group>
  )
}

export function Terrain() {
  const texture = useGrassTexture()

  // Generate some random trees
  const trees = useMemo(() => {
    const arr = []
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * 200
      const z = (Math.random() - 0.5) * 200
      // Don't place trees too close to the starting position
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
      arr.push(<Tree key={i} position={[x, 0, z]} />)
    }
    return arr
  }, [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        {/* Very large plane so the player can run for a long time */}
        <planeGeometry args={[10000, 10000]} />
        {/* Basic material, no specular highlights, feels older */}
        <meshLambertMaterial map={texture} />
      </mesh>
      {trees}
    </group>
  )
}

