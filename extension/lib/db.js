(function () {
  const namespace = (globalThis.TabOutDb = globalThis.TabOutDb || {});
  const schema = globalThis.TabOutSchema;

  let dbPromise = null;

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
  }

  function transactionComplete(transaction) {
    return new Promise((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve());
      transaction.addEventListener('error', () => reject(transaction.error));
      transaction.addEventListener('abort', () => reject(transaction.error));
    });
  }

  function openTabOutDb() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(schema.DB_NAME, schema.DB_VERSION);

      request.addEventListener('upgradeneeded', (event) => {
        const db = request.result;
        schema.migrateSchema(db, event.oldVersion, event.newVersion || schema.DB_VERSION);
      });

      request.addEventListener('success', () => {
        const db = request.result;
        db.addEventListener('versionchange', () => {
          db.close();
          dbPromise = null;
        });
        resolve(db);
      });

      request.addEventListener('error', () => {
        dbPromise = null;
        reject(request.error);
      });
    });

    return dbPromise;
  }

  async function runTransaction(storeNames, mode, handler) {
    const db = await openTabOutDb();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = db.transaction(names, mode);
    const stores = names.reduce((acc, name) => {
      acc[name] = transaction.objectStore(name);
      return acc;
    }, {});

    const result = await handler(stores, transaction);
    await transactionComplete(transaction);
    return result;
  }

  async function replaceStores(payload) {
    const storePayload = {
      [schema.STORES.articles]: Array.isArray(payload && payload.articles) ? payload.articles : [],
      [schema.STORES.topics]: Array.isArray(payload && payload.topics) ? payload.topics : [],
      [schema.STORES.pinnedEntries]:
        Array.isArray(payload && payload.pinned_entries) ? payload.pinned_entries : [],
      [schema.STORES.jobs]: Array.isArray(payload && payload.jobs) ? payload.jobs : [],
    };
    const storeNames = Object.values(schema.STORES);

    return runTransaction(storeNames, 'readwrite', async (stores) => {
      for (const storeName of storeNames) {
        stores[storeName].clear();
      }

      for (const storeName of storeNames) {
        const rows = storePayload[storeName];
        for (const row of rows) {
          stores[storeName].put(row);
        }
      }

      return storePayload;
    });
  }

  function generateId(prefix) {
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now()}_${random}`;
  }

  function resetCachedDbForTests() {
    dbPromise = null;
  }

  namespace.openTabOutDb = openTabOutDb;
  namespace.requestToPromise = requestToPromise;
  namespace.runTransaction = runTransaction;
  namespace.replaceStores = replaceStores;
  namespace.generateId = generateId;
  namespace.resetCachedDbForTests = resetCachedDbForTests;
})();
