// QA-only preload: record HTTP status, never headers, credentials or body.
// The original fetch and response are passed through without modification.
const fs = require('node:fs');
const path = require('node:path');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (String(args[0]) === 'https://api.tokenfactory.nebius.com/v1/chat/completions') {
    fs.writeFileSync(path.join(__dirname, 'api-failure-upstream.json'), JSON.stringify({
      recordedAt: new Date().toISOString(),
      status: response.status,
      setup: 'Deliberately invalid QA credential supplied only to the proxy process environment',
    }, null, 2) + '\n');
  }
  return response;
};
