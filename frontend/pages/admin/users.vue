<template>
  <div class="max-w-[1040px] mx-auto">
    <div class="flex items-center justify-between gap-4 mb-4">
      <div class="relative flex items-center w-full max-w-[340px]">
        <Search class="w-4 h-4 text-text-faint absolute left-3 pointer-events-none" />
        <input
          v-model="search"
          type="text"
          placeholder="Search users by name or email…"
          class="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface border border-border-strong text-text text-[13.5px] outline-none focus:border-accent transition-colors"
          @input="loadUsers" />
      </div>
      <button class="btn-primary" @click="openAdd"><Plus class="w-4 h-4" /> Add user</button>
    </div>

    <div class="card overflow-hidden">
      <div v-if="loading" class="py-16 text-center text-text-dim">Loading…</div>
      <div v-else-if="!users.length" class="py-16 text-center text-text-dim">No users found</div>
      <table v-else class="w-full">
        <thead>
          <tr class="bg-s2">
            <th class="text-left text-xs font-semibold text-text-dim px-5 py-3">User</th>
            <th class="text-left text-xs font-semibold text-text-dim px-4 py-3">Role</th>
            <th class="text-left text-xs font-semibold text-text-dim px-4 py-3">Bookings</th>
            <th class="text-right text-xs font-semibold text-text-dim px-5 py-3">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="u in users" :key="u.id" class="hover:bg-s2 transition-colors">
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <AdminAvatar :name="u.name" />
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-text">{{ u.name }}</span>
                    <span v-if="u.id === auth.user?.id" class="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-medium">You</span>
                    <span v-if="!u.isActive" class="text-[10px] px-1.5 py-0.5 rounded-full bg-bad/20 text-bad font-medium">Blocked</span>
                  </div>
                  <div class="text-xs text-text-dim font-mono">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3.5">
              <AdminRolePill :role="u.isAdmin ? 'Admin' : 'User'" />
            </td>
            <td class="px-4 py-3.5">
              <span class="text-sm text-text font-mono">{{ u.bookingCount ?? 0 }}</span>
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-1.5 justify-end">
                <button class="icon-btn text-text" title="Edit user" @click="openEdit(u)">
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button
                  class="icon-btn"
                  :class="u.isActive ? 'text-warn' : 'text-ok'"
                  :disabled="u.isAdmin || u.id === auth.user?.id"
                  :title="
                    u.isAdmin
                      ? 'Cannot block admin'
                      : u.id === auth.user?.id
                        ? 'Cannot block yourself'
                        : u.isActive
                          ? 'Block'
                          : 'Unblock'
                  "
                  @click="toggleBlock(u)">
                  <Ban class="w-3.5 h-3.5" />
                </button>
                <button
                  class="icon-btn text-bad"
                  :disabled="u.isAdmin || u.id === auth.user?.id"
                  :title="
                    u.isAdmin
                      ? 'Cannot delete admin'
                      : u.id === auth.user?.id
                        ? 'Cannot delete yourself'
                        : 'Delete user'
                  "
                  @click="confirmDel = u">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <AdminModal v-model="modalOpen" :title="editing ? 'Edit user' : 'Add user'" size="sm">
      <div class="space-y-4 px-6 py-4">
        <div>
          <label class="form-label">Name *</label>
          <input v-model="form.name" type="text" class="form-input" />
        </div>
        <div>
          <label class="form-label">Email *</label>
          <input v-model="form.email" type="email" class="form-input font-mono text-xs" />
        </div>
        <div>
          <label class="form-label">Role</label>
          <select v-model="form.role" class="form-input">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button class="btn-secondary" @click="modalOpen = false">Cancel</button>
          <button class="btn-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Add user' }}
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- Delete confirm -->
    <AdminDeleteConfirm
      v-if="confirmDel"
      v-model="confirmDelOpen"
      title="Delete user"
      :message="`Delete ${confirmDel?.name}? Their bookings will not be deleted.`"
      confirm-text="Delete user"
      @confirm="deleteUser"
      @cancel="confirmDel = null"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus, Pencil, Ban, Trash2, Search } from '@lucide/vue'

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')
pageTitle.value = 'Users'
pageSubtitle.value = 'Manage user accounts'

const auth = useAuthStore()
const toast = useToastStore()

const loading = ref(true)
const saving = ref(false)
const users = ref<any[]>([])
const search = ref('')
const modalOpen = ref(false)
const editing = ref<any>(null)
const confirmDel = ref<any>(null)
const confirmDelOpen = computed({
  get: () => !!confirmDel.value,
  set: (v) => { if (!v) confirmDel.value = null },
})

const form = reactive({ name: '', email: '', role: 'user' })

async function loadUsers() {
  loading.value = true
  try {
    users.value = await useApiFetch(`/users${search.value ? `?q=${encodeURIComponent(search.value)}` : ''}`)
  } catch {
    toast.show('Failed to load users', 'bad')
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editing.value = null
  Object.assign(form, { name: '', email: '', role: 'user' })
  modalOpen.value = true
}

function openEdit(u: any) {
  editing.value = u
  Object.assign(form, { name: u.name, email: u.email, role: u.isAdmin ? 'admin' : 'user' })
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    const body = { name: form.name, email: form.email, isAdmin: form.role === 'admin' }
    if (editing.value) {
      await useApiFetch(`/users/${editing.value.id}`, {
        method: 'PUT',
        body,
      })
      toast.show('User updated', 'ok')
    } else {
      await useApiFetch('/users', {
        method: 'POST',
        body,
      })
      toast.show('User added', 'ok')
    }
    modalOpen.value = false
    await loadUsers()
  } catch {
    toast.show('Failed to save user', 'bad')
  } finally {
    saving.value = false
  }
}

async function toggleBlock(u: any) {
  try {
    await useApiFetch(`/users/${u.id}/${u.isActive ? 'block' : 'unblock'}`, { method: 'PATCH' })
    toast.show(u.isActive ? 'User blocked' : 'User unblocked', 'ok')
    await loadUsers()
  } catch {
    toast.show('Failed to update user', 'bad')
  }
}

async function deleteUser() {
  try {
    await useApiFetch(`/users/${confirmDel.value.id}`, { method: 'DELETE' })
    toast.show('User deleted', 'ok')
    confirmDel.value = null
    await loadUsers()
  } catch {
    toast.show('Failed to delete user', 'bad')
  }
}

onMounted(() => { loadUsers() })
</script>
