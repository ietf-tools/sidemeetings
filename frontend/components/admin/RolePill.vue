<template>
  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium" :class="pillClass">
    <span class="w-1.5 h-1.5 rounded-full" :class="dotClass"></span>
    {{ role }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  role: 'Admin' | 'User'
}>()

const pillClass = computed(() =>
  props.role === 'Admin'
    ? 'bg-accent-weak text-accent border border-accent/20'
    : 'bg-s2 text-text-dim border border-border-strong'
)

const dotClass = computed(() =>
  props.role === 'Admin' ? 'bg-accent' : 'bg-muted'
)
</script>
