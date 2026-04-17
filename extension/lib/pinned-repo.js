(function () {
  const namespace = (globalThis.TabOutPinnedRepo = globalThis.TabOutPinnedRepo || {});
  const { STORES } = globalThis.TabOutSchema;
  const { requestToPromise, runTransaction, generateId } = globalThis.TabOutDb;

  async function listPinnedEntries() {
    return runTransaction(STORES.pinnedEntries, 'readonly', async (stores) => {
      const entries = await requestToPromise(stores[STORES.pinnedEntries].getAll());
      return entries.sort((left, right) => (left.order || 0) - (right.order || 0));
    });
  }

  async function createPinnedEntry(input) {
    const existing = await listPinnedEntries();
    const entry = {
      id: generateId('pin'),
      title: input.title,
      url: input.url,
      icon: input.icon || null,
      order: typeof input.order === 'number' ? input.order : existing.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await runTransaction(STORES.pinnedEntries, 'readwrite', async (stores) => {
      stores[STORES.pinnedEntries].put(entry);
    });

    return entry;
  }

  async function updatePinnedEntry(id, updates) {
    return runTransaction(STORES.pinnedEntries, 'readwrite', async (stores) => {
      const store = stores[STORES.pinnedEntries];
      const entry = await requestToPromise(store.get(id));
      if (!entry) return null;
      const next = {
        ...entry,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      store.put(next);
      return next;
    });
  }

  async function removePinnedEntry(id) {
    await runTransaction(STORES.pinnedEntries, 'readwrite', async (stores) => {
      stores[STORES.pinnedEntries].delete(id);
    });
  }

  async function reorderPinnedEntries(ids) {
    await runTransaction(STORES.pinnedEntries, 'readwrite', async (stores) => {
      const store = stores[STORES.pinnedEntries];
      const entries = await requestToPromise(store.getAll());
      const map = new Map(entries.map((entry) => [entry.id, entry]));
      ids.forEach((id, index) => {
        const entry = map.get(id);
        if (!entry) return;
        store.put({
          ...entry,
          order: index,
          updated_at: new Date().toISOString(),
        });
      });
    });
  }

  namespace.listPinnedEntries = listPinnedEntries;
  namespace.createPinnedEntry = createPinnedEntry;
  namespace.updatePinnedEntry = updatePinnedEntry;
  namespace.removePinnedEntry = removePinnedEntry;
  namespace.reorderPinnedEntries = reorderPinnedEntries;
})();
