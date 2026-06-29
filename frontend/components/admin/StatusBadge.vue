<template>
  <span class="status-badge" :class="badgeClass">
    <span class="w-1.5 h-1.5 rounded-full" :class="dotClass"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  state: 'pending' | 'confirmed' | 'rejected' | 'cancelled'
}>()

const label = computed(() => {
  if (props.state === 'pending') return 'Pending'
  if (props.state === 'confirmed') return 'Approved'
  if (props.state === 'rejected') return 'Rejected'
  if (props.state === 'cancelled') return 'Cancelled'
  return props.state
})

const badgeClass = computed(() => {
  if (props.state === 'pending') return 'border-warn/30 bg-warn/10 text-warn'
  if (props.state === 'confirmed') return 'border-ok/30 bg-ok/10 text-ok'
  if (props.state === 'rejected') return 'border-bad/30 bg-bad/10 text-bad'
  if (props.state === 'cancelled') return 'border-border-strong bg-s2 text-muted'
  return 'border-border-strong bg-s2 text-muted'
})

const dotClass = computed(() => {
  if (props.state === 'pending') return 'bg-warn'
  if (props.state === 'confirmed') return 'bg-ok'
  if (props.state === 'rejected') return 'bg-bad'
  return 'bg-muted'
})
</script>
