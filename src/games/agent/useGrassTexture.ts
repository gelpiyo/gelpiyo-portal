import { useMemo } from 'react'
import * as THREE from 'three'

export function useGrassTexture() {
  const texture = useMemo(() => {
    const size = 64; // Low res for PS1
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')!
    
    // Generate noise for grass
    const imageData = context.createImageData(size, size)
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Base green color
      let r = 30 + Math.random() * 20
      let g = 80 + Math.random() * 40
      let b = 30 + Math.random() * 20
      
      imageData.data[i] = r
      imageData.data[i + 1] = g
      imageData.data[i + 2] = b
      imageData.data[i + 3] = 255
    }
    context.putImageData(imageData, 0, 0)
    
    const tex = new THREE.CanvasTexture(canvas)
    // Critical for PS1 look: NearestFilter removes blur
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    // We will repeat this texture many times over the terrain
    tex.repeat.set(100, 100) 
    
    return tex
  }, [])
  
  return texture
}
