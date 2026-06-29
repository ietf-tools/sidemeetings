<template>
  <div class="flex items-center gap-2.5">
    <button
      v-for="c in colors"
      :key="c.name"
      type="button"
      class="w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-transform"
      :style="{ background: c.hex, border: `2px solid ${c.hex}` }"
      :class="modelValue === c.name ? '' : 'hover:scale-110'"
      :title="c.name"
      @click="$emit('update:modelValue', c.name)"
    >
      <Check v-if="modelValue === c.name" class="w-[15px] h-[15px] text-bg" :stroke-width="3" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'

defineProps<{
  modelValue: string
  colors: { name: string; hex: string }[]
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
