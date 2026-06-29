<template>
  <div
    class="rounded-full flex items-center justify-center font-semibold flex-shrink-0 text-white"
    :class="sizeClass"
    :style="{ background: gradient }"
  >
    {{ initials }}
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  name: string
  size?: 'sm' | 'md'
}>()

const GRADIENTS = [
  'linear-gradient(135deg, #2dd4bf 0%, #0891b2 100%)',
  'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
  'linear-gradient(135deg, #34d399 0%, #059669 100%)',
  'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
  'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
  'linear-gradient(135deg, #f0716a 0%, #dc2626 100%)',
  'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)',
]

const initials = computed(() => {
  return (props.name || '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
})

const gradient = computed(() => {
  let hash = 0
  for (const ch of props.name || '') {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  }
  return GRADIENTS[hash % GRADIENTS.length]
})

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'w-7 h-7 text-[10px]'
  return 'w-9 h-9 text-xs'
})
</script>
