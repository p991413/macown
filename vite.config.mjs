import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 使用相对路径，保证 Electron 生产环境用 file:// 加载 dist 时资源路径正确
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
