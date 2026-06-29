export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()
  if (!auth.isAdmin) return navigateTo('/')
})
