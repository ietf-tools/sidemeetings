<template>
  <div class="w-full max-w-sm mx-auto">
    <div class="card p-8 text-center">
      <div class="flex items-center justify-center mb-6">
        <div class="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-text font-bold text-base mr-3">
          SM
        </div>
        <div class="text-left">
          <div class="text-lg font-bold text-text">Side Meetings</div>
          <div class="text-xs text-text-dim">IETF Meeting System</div>
        </div>
      </div>

      <h1 class="text-xl font-bold text-text mb-1">Welcome back</h1>
      <p class="text-sm text-text-dim mb-8">Sign in to continue</p>

      <a
        :href="config.public.apiUrl + '/auth/login'"
        class="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
      >
        <LogIn class="w-5 h-5" />
        Sign in with Authentik
      </a>

      <p class="text-xs text-text-faint mt-6">
        Access is restricted to IETF participants
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'

definePageMeta({ layout: 'auth' })

const config = useRuntimeConfig()
</script>
