<template>
  <div class="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
    <template v-if="tooLarge">
      <!-- Too long to diff token-by-token; show both versions in full instead. -->
      <div class="text-[11px] font-semibold text-text-faint uppercase tracking-wide mb-1">Current</div>
      <div class="text-text-dim mb-3">{{ oldText }}</div>
      <div class="text-[11px] font-semibold text-text-faint uppercase tracking-wide mb-1">Proposed</div>
      <div class="text-text">{{ newText }}</div>
    </template>
    <template v-else>
      <span
        v-for="(part, i) in parts"
        :key="i"
        :class="{
          'text-text-dim': part.type === 'same',
          'line-through decoration-bad/70 text-bad rounded px-0.5 bg-bad/10': part.type === 'del',
          'text-ok rounded px-0.5 bg-ok/10': part.type === 'add'
        }"
        >{{ part.value }}</span
      >
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  oldText: string
  newText: string
}>()

// Word-level diff: an O(n·m) LCS table is fine for meeting descriptions, but bail
// out on pathological input rather than allocating a huge matrix.
const MAX_TOKENS = 800

// Split into words while keeping the whitespace as its own tokens, so the
// rebuilt text reads exactly like the original (newlines included).
function tokenize(text: string) {
  return (text || '').split(/(\s+)/).filter((t) => t !== '')
}

const oldTokens = computed(() => tokenize(props.oldText))
const newTokens = computed(() => tokenize(props.newText))

const tooLarge = computed(
  () => oldTokens.value.length > MAX_TOKENS || newTokens.value.length > MAX_TOKENS
)

interface Part {
  type: 'same' | 'add' | 'del'
  value: string
}

const parts = computed<Part[]>(() => {
  if (tooLarge.value) return []

  const a = oldTokens.value
  const b = newTokens.value
  const n = a.length
  const m = b.length

  // lcs[i][j] = length of the longest common subsequence of a[i…] and b[j…].
  const width = m + 1
  const lcs = new Int32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }

  // Walk the table forwards, emitting deletions before insertions at each step.
  const out: Part[] = []
  const push = (type: Part['type'], value: string) => {
    const last = out[out.length - 1]
    if (last && last.type === type) last.value += value
    else out.push({ type, value })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('same', a[i])
      i++
      j++
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      push('del', a[i])
      i++
    } else {
      push('add', b[j])
      j++
    }
  }
  while (i < n) push('del', a[i++])
  while (j < m) push('add', b[j++])

  return out
})
</script>
