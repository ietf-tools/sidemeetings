<template>
  <div class="min-h-screen bg-bg">
    <div class="flex flex-col items-center pt-10 pb-6">
      <div class="flex items-center gap-3 mb-8">
        <div class="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-accent-text font-bold text-sm">
          SM
        </div>
        <span class="text-text font-semibold text-lg">Side Meetings</span>
      </div>
      <div class="w-full" :class="wideStep ? 'max-w-[960px]' : 'max-w-[680px]'" style="padding: 0 1rem;">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const wideStep = computed(() => {
  const step = route.query.step
  return step === '1' || step === '2' || !step
})
</script>
