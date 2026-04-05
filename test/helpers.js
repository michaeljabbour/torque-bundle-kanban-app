// Vendored mock factories — no @torquedev/test-helpers dependency

export function createMockData() {
  const store = {};
  let idCounter = 0;
  return {
    insert(table, attrs) {
      if (!store[table]) store[table] = [];
      const record = {
        ...attrs,
        id: attrs.id || `id-${++idCounter}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store[table].push(record);
      return { ...record };
    },
    find(table, id) {
      return (store[table] || []).find((r) => r.id === id) || null;
    },
    query(table, filters = {}, opts = {}) {
      let results = (store[table] || []).filter((r) =>
        Object.entries(filters).every(([k, v]) => r[k] === v),
      );
      if (opts.order) {
        const [col, dir] = opts.order.split(' ');
        results.sort((a, b) =>
          dir === 'DESC'
            ? b[col] > a[col] ? 1 : -1
            : a[col] > b[col] ? 1 : -1,
        );
      }
      if (opts.offset) results = results.slice(opts.offset);
      if (opts.limit) results = results.slice(0, opts.limit);
      return results;
    },
    update(table, id, attrs) {
      const arr = store[table] || [];
      const idx = arr.findIndex((r) => r.id === id);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...attrs, updated_at: new Date().toISOString() };
        return { ...arr[idx] };
      }
      return null;
    },
    delete(table, id) {
      if (store[table]) store[table] = store[table].filter((r) => r.id !== id);
      return true;
    },
    count(table, filters = {}) {
      return (store[table] || []).filter((r) =>
        Object.entries(filters).every(([k, v]) => r[k] === v),
      ).length;
    },
    transaction(fn) { fn(); },
    _store: store,
  };
}

export function createMockEvents() {
  const published = [];
  return {
    publish(name, payload, opts) { published.push({ name, payload, opts }); },
    _published: published,
  };
}

export function createMockCoordinator(responses = {}) {
  return {
    async call(bundle, iface, args) {
      const key = `${bundle}.${iface}`;
      if (responses[key]) return responses[key](args);
      return null;
    },
  };
}
