import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { OrgRow } from '@/api/orgs';
import * as orgsApi from '@/api/orgs';
import { storage } from '@/utils/storage';

export const useOrgStore = defineStore('org', () => {
  const orgs = ref<OrgRow[]>([]);
  const currentOrgSlug = ref<string | null>(storage.getCurrentOrgSlug());
  const currentOrg = computed(() => orgs.value.find((o) => o.slug === currentOrgSlug.value));

  async function fetchOrgs() {
    orgs.value = await orgsApi.listOrgs();
  }

  function setCurrentOrg(slug: string) {
    currentOrgSlug.value = slug;
    storage.setCurrentOrgSlug(slug);
  }

  return { orgs, currentOrg, currentOrgSlug, fetchOrgs, setCurrentOrg };
});
