<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="area in AREAS"
      :key="area"
      type="button"
      class="px-3 py-1 rounded-lg text-xs font-semibold transition-all border"
      :class="modelValue.includes(area)
        ? 'bg-accent-weak text-accent border-accent/40'
        : 'bg-s2 text-text-dim border-border-strong hover:border-text-faint'"
      @click="toggle(area)"
    >
      {{ area }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const AREAS = ['ART', 'GEN', 'INT', 'OPS', 'RTG', 'SEC', 'WIT']

function toggle(area: string) {
  const next = props.modelValue.includes(area)
    ? props.modelValue.filter((a) => a !== area)
    : [...props.modelValue, area]
  emit('update:modelValue', next)
}
</script>
