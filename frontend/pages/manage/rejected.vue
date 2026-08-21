<template>
  <ManageBookingList
    :states="['rejected', 'cancelled']"
    empty-title="Nothing rejected"
    empty-hint="Requests that were turned down or cancelled would be listed here." />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'manage', middleware: ['auth'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')

pageTitle.value = 'Rejected'
pageSubtitle.value = 'Requests that were not approved, plus any you cancelled'
</script>
