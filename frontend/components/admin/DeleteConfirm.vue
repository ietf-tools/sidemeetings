<template>
  <AdminModal :model-value="modelValue" title="Confirm deletion" size="sm" @update:model-value="$emit('update:modelValue', $event)">
    <div class="px-6 py-5">
      <div class="flex items-start gap-3 p-4 rounded-xl mb-4" style="background: rgba(240,113,106,.1); border: 1px solid rgba(240,113,106,.3);">
        <TriangleAlert class="w-5 h-5 text-bad flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-semibold text-bad mb-1">{{ title }}</p>
          <p class="text-sm text-text-dim">{{ message }}</p>
        </div>
      </div>
      <slot />
    </div>
    <template #footer>
      <div class="flex justify-end gap-2 px-6 py-4 border-t border-border">
        <button class="btn-secondary" @click="$emit('cancel'); $emit('update:modelValue', false)">Cancel</button>
        <button class="btn-danger" @click="$emit('confirm'); $emit('update:modelValue', false)">
          {{ confirmText || 'Delete' }}
        </button>
      </div>
    </template>
  </AdminModal>
</template>

<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

defineProps<{
  modelValue: boolean
  title: string
  message: string
  confirmText?: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
}>()
</script>
