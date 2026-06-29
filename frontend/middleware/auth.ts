export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.user) await auth.fetchMe()
  if (!auth.isAuthenticated && !to.path.startsWith('/login') && !to.path.startsWith('/auth')) {
    return navigateTo('/login')
  }
})
