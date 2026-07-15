import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    electron([
      {
        // Ponto de entrada do Processo Main (Principal)
        entry: 'src/main.ts',
      },
      {
        // Ponto de entrada do script Preload (Ponte de contexto)
        entry: 'src/preload.ts',
        onstart(options) {
          // Recarrega a janela quando o Preload for recompilado
          options.reload()
        },
      },
    ]),
    renderer(),
  ],
})
