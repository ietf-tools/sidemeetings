<template>
  <NuxtLink
    :to="to"
    class="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-sm transition-colors w-full"
    :class="isActive
      ? 'bg-sidebar-active-bg text-sidebar-active-text font-medium'
      : 'text-sidebar-text hover:bg-[rgba(45,212,191,0.1)]'"
  >
    <component :is="icon" class="w-4 h-4 flex-shrink-0" />
    <span class="flex-1">{{ label }}</span>
    <span
      v-if="badge"
      class="text-[10px] px-1.5 py-0.5 rounded-full bg-warn/20 text-warn font-semibold min-w-[18px] text-center"
    >{{ badge }}</span>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{
  to: string
  icon: any
  label: string
  badge?: number
  exact?: boolean
}>()

const route = useRoute()
const isActive = computed(() => {
  if (props.exact) return route.path === props.to
  return route.path.startsWith(props.to)
})
</script>
