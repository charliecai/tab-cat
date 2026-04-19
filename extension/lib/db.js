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

  function generateId(prefix) {
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now()}_${random}`;
  }

  namespace.openTabOutDb = openTabOutDb;
  namespace.requestToPromise = requestToPromise;
  namespace.runTransaction = runTransaction;
  namespace.generateId = generateId;
})();
