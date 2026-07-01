<template>
  <div class="max-w-[680px] mx-auto">
    <div class="card p-6">
      <div class="mb-5">
        <h2 class="text-[15px] font-bold text-text">Request notifications</h2>
        <p class="text-[12.5px] text-text-dim mt-0.5">
          Email settings used when a new side meeting request is submitted.
        </p>
      </div>

      <div v-if="loading" class="py-8 text-center text-text-dim">Loading…</div>
      <form v-else class="space-y-5" @submit.prevent="save">
        <div class="flex items-center justify-between gap-4 pb-5 border-b border-border">
          <div>
            <div class="text-[13.5px] font-semibold text-text">Email notifications</div>
            <div class="text-[11.5px] text-text-faint mt-0.5">
              Master switch for all submission, approval and rejection emails. When off, no
              notifications are sent.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="form.emailEnabled"
            title="Toggle email notifications"
            class="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors"
            :class="form.emailEnabled ? 'bg-accent' : 'bg-s3'"
            @click="form.emailEnabled = !form.emailEnabled">
            <span
              class="inline-block h-5 w-5 rounded-full bg-white transition-transform mt-0.5"
              :class="form.emailEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'"></span>
          </button>
        </div>

        <div :class="form.emailEnabled ? '' : 'opacity-50 pointer-events-none'" class="space-y-5">
        <div>
          <label class="form-label">"From" email address</label>
          <input
            v-model="form.fromEmail"
            type="email"
            class="form-input font-mono text-xs"
            placeholder="e.g. no-reply@ietf.org" />
          <div class="text-[11.5px] text-text-faint mt-1.5">
            Sender address shown on notification emails.
          </div>
        </div>
        <div>
          <label class="form-label">"Reply-to" email address</label>
          <input
            v-model="form.replyTo"
            type="email"
            class="form-input font-mono text-xs"
            placeholder="e.g. support@ietf.org" />
          <div class="text-[11.5px] text-text-faint mt-1.5">
            Where replies from organizers are routed.
          </div>
        </div>

        <div>
          <label class="form-label">
            Approvers
            <span class="text-text-faint font-normal">· notified of every new request</span>
          </label>
          <div v-if="form.approvers.length" class="flex flex-col gap-2 mb-2.5">
            <div
              v-for="(email, i) in form.approvers"
              :key="i"
              class="flex items-center gap-2.5 rounded-lg bg-s2 border border-border pl-3.5 pr-2 py-2">
              <span class="flex-1 min-w-0 text-[13.5px] font-mono text-text truncate">{{
                email
              }}</span>
              <button
                type="button"
                title="Remove approver"
                class="w-6 h-6 flex-shrink-0 rounded-[7px] bg-s3 text-text-dim hover:text-bad flex items-center justify-center transition-colors"
                @click="removeApprover(i)">
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
          <div class="flex gap-2">
            <input
              v-model="newApprover"
              type="email"
              class="form-input font-mono text-xs"
              placeholder="approver@example.org"
              @keydown.enter.prevent="addApprover" />
            <button type="button" class="btn-secondary flex-shrink-0" @click="addApprover">
              Add
            </button>
          </div>
        </div>
        </div>

        <div class="flex pt-[18px] border-t border-border">
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save settings' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Settings'
pageSubtitle.value = 'System configuration'

const toast = useToastStore()
const loading = ref(true)
const saving = ref(false)
const newApprover = ref('')

const form = reactive({
  emailEnabled: true,
  fromEmail: '',
  replyTo: '',
  approvers: [] as string[]
})

function addApprover() {
  const e = newApprover.value.trim()
  if (e && !form.approvers.includes(e)) {
    form.approvers.push(e)
    newApprover.value = ''
  }
}

function removeApprover(i: number) {
  form.approvers.splice(i, 1)
}

async function save() {
  saving.value = true
  try {
    await useApiFetch('/settings', { method: 'PUT', body: { ...form } })
    toast.show('Settings saved', 'ok')
  } catch {
    toast.show('Failed to save settings', 'bad')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const data = await useApiFetch<any>('/settings')
    Object.assign(form, {
      emailEnabled: data.emailEnabled !== false,
      fromEmail: data.fromEmail || '',
      replyTo: data.replyTo || '',
      approvers: data.approvers || []
    })
  } catch {
    toast.show('Failed to load settings', 'bad')
  } finally {
    loading.value = false
  }
})
</script>
