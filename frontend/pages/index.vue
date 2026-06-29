<script setup lang="ts">
const auth = useAuthStore()
await auth.fetchMe()
if (auth.isAdmin) {
  await navigateTo('/admin')
} else if (auth.isAuthenticated) {
  await navigateTo('/request')
} else {
  await navigateTo('/login')
}
</script>

<template>
  <div />
</template>
