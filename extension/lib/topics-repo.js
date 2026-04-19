(function () {
  const namespace = (globalThis.TabOutTopicsRepo = globalThis.TabOutTopicsRepo || {});
  const { STORES } = globalThis.TabOutSchema;
  const { requestToPromise, runTransaction, generateId } = globalThis.TabOutDb;

  async function listTopics() {
    return runTransaction(STORES.topics, 'readonly', async (stores) => {
      return requestToPromise(stores[STORES.topics].getAll());
    });
  }

  async function getTopicById(id) {
    return runTransaction(STORES.topics, 'readonly', async (stores) => {
      return requestToPromise(stores[STORES.topics].get(id));
    });
  }

  async function upsertTopic(input) {
    const now = new Date().toISOString();
    const topic = {
      id: input.id || generateId('topic'),
      title: input.title,
      one_line_digest: input.one_line_digest || null,
      reading_question: input.reading_question || null,
      article_count: input.article_count || 0,
      related_topics: input.related_topics || [],
      representative_article_ids: input.representative_article_ids || [],
      last_updated: input.last_updated || now,
      created_at: input.created_at || now,
      updated_at: now,
    };

    await runTransaction(STORES.topics, 'readwrite', async (stores) => {
      stores[STORES.topics].put(topic);
    });

    return topic;
  }

  async function deleteTopic(id) {
    await runTransaction(STORES.topics, 'readwrite', async (stores) => {
      stores[STORES.topics].delete(id);
    });
  }

  namespace.listTopics = listTopics;
  namespace.getTopicById = getTopicById;
  namespace.upsertTopic = upsertTopic;
  namespace.deleteTopic = deleteTopic;
})();
