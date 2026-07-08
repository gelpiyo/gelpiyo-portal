import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Simple WASD controller
const keys: { [key: string]: boolean } = { w: false, a: false, s: false, d: false }
window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = true
  }
})
window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = false
  }
})

// eslint-disable-next-line react-refresh/only-export-components
export const setPlayerKey = (key: string, value: boolean) => {
  if (keys.hasOwnProperty(key)) {
    keys[key] = value
  }
}

export function Player() {
  const playerRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  
  // Variables for movement
  const speed = 10;
  const velocity = new THREE.Vector3()
  
  // Camera offset from player (TPS view)
  const cameraOffset = new THREE.Vector3(0, 3, 6)

  useFrame((state, delta) => {
    if (!playerRef.current) return

    // Movement logic
    velocity.set(0, 0, 0)
    if (keys.w) velocity.z -= 1
    if (keys.s) velocity.z += 1
    if (keys.a) velocity.x -= 1
    if (keys.d) velocity.x += 1

    velocity.normalize().multiplyScalar(speed * delta)
    playerRef.current.position.add(velocity)

    // Running animation (bobbing)
    const isMoving = velocity.lengthSq() > 0
    if (isMoving) {
      playerRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.2
    } else {
      playerRef.current.position.y = 0
    }

    // Camera follow logic
    const playerPos = playerRef.current.position
    const targetCameraPos = playerPos.clone().add(cameraOffset)
    
    // Smooth camera follow
    camera.position.lerp(targetCameraPos, 0.1)
    
    // Look slightly ahead of the player
    const lookAtTarget = playerPos.clone().add(new THREE.Vector3(0, 1, -5))
    camera.lookAt(lookAtTarget)
  })

  return (
    <group ref={playerRef}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="hotpink" />
      </mesh>
    </group>
  )
}
