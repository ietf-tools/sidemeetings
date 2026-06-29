<template>
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="t in toastStore.toasts"
        :key="t.id"
        class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium pointer-events-auto cursor-pointer"
        style="box-shadow: 0 4px 24px rgba(0,0,0,.5); min-width: 220px;"
        :style="toastBg(t.kind)"
        @click="toastStore.remove(t.id)"
      >
        <div class="w-2 h-2 rounded-full flex-shrink-0" :class="dotClass(t.kind)"></div>
        <span :class="textClass(t.kind)">{{ t.msg }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const toastStore = useToastStore()

function toastBg(kind: string) {
  if (kind === 'ok') return 'background: #0d2b1d; border: 1px solid rgba(52,211,153,.3);'
  if (kind === 'bad') return 'background: #2a0f0e; border: 1px solid rgba(240,113,106,.3);'
  if (kind === 'warn') return 'background: #2a1e0a; border: 1px solid rgba(227,169,59,.3);'
  return 'background: #0d2626; border: 1px solid rgba(45,212,191,.3);'
}

function dotClass(kind: string) {
  if (kind === 'ok') return 'bg-ok'
  if (kind === 'bad') return 'bg-bad'
  if (kind === 'warn') return 'bg-warn'
  return 'bg-accent'
}

function textClass(kind: string) {
  if (kind === 'ok') return 'text-ok'
  if (kind === 'bad') return 'text-bad'
  if (kind === 'warn') return 'text-warn'
  return 'text-accent'
}
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.25s; }
.toast-enter-from { opacity: 0; transform: translateY(12px) scale(0.95); }
.toast-leave-to { opacity: 0; transform: translateY(-8px) scale(0.95); }
</style>
