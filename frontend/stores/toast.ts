import { defineStore } from 'pinia'

type ToastKind = 'ok' | 'bad' | 'warn' | 'info'

interface Toast {
  id: string
  msg: string
  kind: ToastKind
}

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [] as Toast[],
  }),

  actions: {
    show(msg: string, kind: ToastKind = 'ok') {
      const id = Math.random().toString(36).slice(2)
      this.toasts.push({ id, msg, kind })
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id)
      }, 2600)
    },

    remove(id: string) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
