import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// Copy assets and emu to public/ if not already there
function copyPublicAssets() {
  const root = resolve(__dirname)
  const pubAssets = resolve(root, 'public/assets')
  const pubEmu = resolve(root, 'public/emu')

  if (!existsSync(pubAssets)) {
    cpSync(resolve(root, 'assets'), pubAssets, { recursive: true })
  }
  if (!existsSync(pubEmu)) {
    mkdirSync(pubEmu, { recursive: true })
    cpSync(resolve(root, 'js/emu'), pubEmu, { recursive: true })
  }
}

copyPublicAssets()

export default defineConfig({
  plugins: [react()],
  base: './',
})
