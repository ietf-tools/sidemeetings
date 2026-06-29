import { defineStore } from 'pinia'

interface User {
  id: string
  email: string
  name: string
  isAdmin: boolean
  isActive: boolean
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => !!state.user?.isAdmin,
  },

  actions: {
    async fetchMe() {
      this.loading = true
      try {
        const config = useRuntimeConfig()
        const data = await $fetch<User>(config.public.apiUrl + '/auth/me', {
          credentials: 'include',
        })
        this.user = data
      } catch {
        this.user = null
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        const config = useRuntimeConfig()
        await $fetch(config.public.apiUrl + '/auth/logout', {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        // ignore errors
      }
      this.user = null
      await navigateTo('/login')
    },
  },
})
