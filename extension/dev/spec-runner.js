(function () {
  const tests = [];
  const output = document.getElementById('output');

  function stableStringify(value) {
    return JSON.stringify(
      value,
      (_, current) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          return Object.keys(current)
            .sort()
            .reduce((acc, key) => {
              acc[key] = current[key];
              return acc;
            }, {});
        }
        return current;
      },
      2
    );
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected} but received ${actual}`);
    }
  }

  function assertDeepEqual(actual, expected, message) {
    const actualString = stableStringify(actual);
    const expectedString = stableStringify(expected);
    if (actualString !== expectedString) {
      throw new Error(
        message ||
          `Expected:\n${expectedString}\n\nReceived:\n${actualString}`
      );
    }
  }

  function test(name, fn) {
    tests.push({ name, fn });
  }

  async function run() {
    const lines = [];
    let failed = 0;

    for (const { name, fn } of tests) {
      try {
        await fn();
        lines.push(`PASS ${name}`);
      } catch (error) {
        failed += 1;
        lines.push(`FAIL ${name}`);
        lines.push(`  ${error && error.message ? error.message : String(error)}`);
      }
    }

    const passed = tests.length - failed;
    lines.unshift(`Tab Out specs: ${passed} passed, ${failed} failed`);
    output.textContent = lines.join('\n');
    document.body.dataset.failures = String(failed);
  }

  window.test = test;
  window.assertEqual = assertEqual;
  window.assertDeepEqual = assertDeepEqual;
  window.addEventListener('load', run);
})();
