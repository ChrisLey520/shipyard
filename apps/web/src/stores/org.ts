import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { http } from '../api/client';

interface Org {
  id: string;
  name: string;
  slug: string;
  buildConcurrency: number;
  artifactRetention: number;
}

export const useOrgStore = defineStore('org', () => {
  const orgs = ref<Org[]>([]);
  const currentOrgSlug = ref<string | null>(null);
  const currentOrg = computed(() => orgs.value.find((o) => o.slug === currentOrgSlug.value));

  async function fetchOrgs() {
    const data = await http.get<Org[]>('/orgs').then((r) => r.data);
    orgs.value = data;
  }

  function setCurrentOrg(slug: string) {
    currentOrgSlug.value = slug;
  }

  return { orgs, currentOrg, currentOrgSlug, fetchOrgs, setCurrentOrg };
});
