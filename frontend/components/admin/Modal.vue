<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.6);"
        @click.self="onOverlayClick"
      >
        <div
          class="card flex flex-col max-h-[90vh] w-full overflow-hidden"
          :class="sizeClass"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 class="text-base font-semibold text-text">{{ title }}</h2>
              <p v-if="subtitle" class="text-xs text-text-dim mt-0.5">{{ subtitle }}</p>
            </div>
            <button
              class="text-text-dim hover:text-text transition-colors ml-4 flex-shrink-0"
              @click="$emit('update:modelValue', false)"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="overflow-y-auto flex-1">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="flex-shrink-0">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg'
    // When false (default), clicking the backdrop does NOT close the modal, so
    // entered form data isn't lost on an accidental outside click.
    closeOnOverlay?: boolean
  }>(),
  {
    subtitle: undefined,
    size: 'md',
    closeOnOverlay: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onOverlayClick() {
  if (props.closeOnOverlay) {
    emit('update:modelValue', false)
  }
}

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'max-w-sm'
  if (props.size === 'lg') return 'max-w-2xl'
  return 'max-w-lg'
})

// Close on Escape
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    // emit close — can't directly here, use a different approach
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .card, .modal-leave-to .card { transform: scale(0.95); }
.modal-enter-active .card, .modal-leave-active .card { transition: transform 0.2s; }
</style>
