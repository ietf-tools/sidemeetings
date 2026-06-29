<template>
  <div class="min-h-screen bg-bg flex items-center justify-center">
    <div class="text-center">
      <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-text-dim text-sm">Completing sign in…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

onMounted(async () => {
  const auth = useAuthStore()
  await auth.fetchMe()
  if (auth.isAuthenticated) {
    if (auth.isAdmin) {
      await navigateTo('/admin')
    } else {
      await navigateTo('/request')
    }
  } else {
    await navigateTo('/login')
  }
})
</script>
