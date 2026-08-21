<template>
  <ManageBookingList
    :states="['confirmed']"
    empty-title="No confirmed side meetings"
    empty-hint="Approved requests appear here with their room, time and video link." />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'manage', middleware: ['auth'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')

pageTitle.value = 'Confirmed'
pageSubtitle.value = 'Your approved side meetings for this meeting'
</script>
