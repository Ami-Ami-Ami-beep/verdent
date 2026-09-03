import type { TowerApi } from '@shared/types/ipc'

declare global {
  interface Window {
    tower: TowerApi
  }
}

export {}
