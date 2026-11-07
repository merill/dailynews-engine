'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createOpenAIClient, openAIConfigured, githubActionsTokenProvider, DEFAULT_AUDIENCE } = require('../src/openai-client');

const federated = {
  OPENAI_IDENTITY_PROVIDER_ID: 'idp_123',
  OPENAI_SERVICE_ACCOUNT_ID: 'svc_456',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.example/req?api-version=2.0',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'runner-bearer'
};

test('no credentials gives no client', () => {
  assert.equal(createOpenAIClient({ env: {} }), null);
  assert.equal(openAIConfigured({}), false);
});

test('an API key still works outside Actions', () => {
  const client = createOpenAIClient({ env: { OPENAI_API_KEY: 'sk-test' } });
  assert.ok(client);
  assert.equal(client.apiKey, 'sk-test');
});

test('workload identity wins over a key in the environment', () => {
  const client = createOpenAIClient({ env: { ...federated, OPENAI_API_KEY: 'sk-test' } });
  assert.ok(client);
  assert.equal(client._options.workloadIdentity.identityProviderId, 'idp_123');
  assert.equal(client._options.workloadIdentity.serviceAccountId, 'svc_456');
  assert.equal(client._options.workloadIdentity.refreshBufferSeconds, 60);
  assert.equal(openAIConfigured(federated), true);
});

test('the GitHub provider requests a token for the audience', async () => {
  let seen;
  const provider = githubActionsTokenProvider({
    env: federated,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, json: async () => ({ value: 'oidc-jwt' }) };
    }
  });
  assert.equal(provider.tokenType, 'jwt');
  assert.equal(await provider.getToken(), 'oidc-jwt');
  assert.equal(seen.url, `https://token.actions.example/req?api-version=2.0&audience=${encodeURIComponent(DEFAULT_AUDIENCE)}`);
  assert.equal(seen.init.headers.Authorization, 'bearer runner-bearer');
});

test('a job without id-token: write gets a clear error', async () => {
  const provider = githubActionsTokenProvider({ env: { OPENAI_IDENTITY_PROVIDER_ID: 'x', OPENAI_SERVICE_ACCOUNT_ID: 'y' } });
  await assert.rejects(provider.getToken(), /id-token: write/);
});
