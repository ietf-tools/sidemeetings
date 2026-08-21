<template>
  <ManageBookingList
    :states="['pending']"
    empty-title="Nothing awaiting review"
    empty-hint="Side meeting requests you submit will show up here until an approver reviews them." />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'manage', middleware: ['auth'] })

const pageTitle = useState('page-title')
const pageSubtitle = useState('page-subtitle')

pageTitle.value = 'Pending Review'
pageSubtitle.value = 'Requests you have submitted that are still awaiting a decision'
</script>
