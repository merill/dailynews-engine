'use strict';

// One place that decides how the engine authenticates to OpenAI.
//
// In GitHub Actions the engine uses OpenAI workload identity federation: the
// job asks GitHub for a short-lived OIDC token and the SDK exchanges it for a
// short-lived OpenAI access token bound to a service account. No API key is
// stored anywhere. It is used when both of these are set (repository or
// organisation variables, not secrets: neither is a credential):
//
//   OPENAI_IDENTITY_PROVIDER_ID   the Workload Identity Provider in OpenAI
//   OPENAI_SERVICE_ACCOUNT_ID     the service account the mapping binds to
//   OPENAI_WIF_AUDIENCE           optional; defaults to https://api.openai.com/v1
//
// and the job has `permissions: id-token: write`, which is what makes GitHub
// set ACTIONS_ID_TOKEN_REQUEST_URL and ACTIONS_ID_TOKEN_REQUEST_TOKEN.
//
// Outside Actions (a local backfill, say) OPENAI_API_KEY still works.

const OpenAI = require('openai');

const DEFAULT_AUDIENCE = 'https://api.openai.com/v1';

function federationConfigured(env = process.env) {
  return Boolean(env.OPENAI_IDENTITY_PROVIDER_ID && env.OPENAI_SERVICE_ACCOUNT_ID);
}

function openAIConfigured(env = process.env) {
  return federationConfigured(env) || Boolean(env.OPENAI_API_KEY);
}

// A SubjectTokenProvider that asks GitHub Actions for an OIDC token. It is
// called again whenever the SDK needs a fresh OpenAI token, and GitHub issues
// a new OIDC token on every request, so long runs keep working.
function githubActionsTokenProvider({ audience = DEFAULT_AUDIENCE, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return {
    tokenType: 'jwt',
    async getToken() {
      const url = env.ACTIONS_ID_TOKEN_REQUEST_URL;
      const bearer = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
      if (!url || !bearer) {
        throw new Error('GitHub did not provide an OIDC token: give the job `permissions: id-token: write`');
      }
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetchImpl(`${url}${separator}audience=${encodeURIComponent(audience)}`, {
        headers: { Authorization: `bearer ${bearer}`, Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`GitHub OIDC token request failed with HTTP ${response.status}`);
      const body = await response.json();
      if (!body || typeof body.value !== 'string' || !body.value) {
        throw new Error('GitHub OIDC token response had no token');
      }
      return body.value;
    }
  };
}

// Returns an OpenAI client, or null when no credentials are configured (the
// callers fall back to summaries that need no model).
function createOpenAIClient({ apiKey, env = process.env, fetchImpl, ...clientOptions } = {}) {
  if (federationConfigured(env)) {
    return new OpenAI({
      ...clientOptions,
      // The SDK reads OPENAI_API_KEY by default and refuses a key alongside
      // workloadIdentity; federation wins when both are present.
      apiKey: null,
      workloadIdentity: {
        identityProviderId: env.OPENAI_IDENTITY_PROVIDER_ID,
        serviceAccountId: env.OPENAI_SERVICE_ACCOUNT_ID,
        provider: githubActionsTokenProvider({ audience: env.OPENAI_WIF_AUDIENCE || DEFAULT_AUDIENCE, env, fetchImpl }),
        // GitHub's OIDC token, and so the exchanged token, lives about five
        // minutes; the SDK's 20-minute default buffer would exchange on every
        // request.
        refreshBufferSeconds: 60
      }
    });
  }
  const key = apiKey || env.OPENAI_API_KEY;
  return key ? new OpenAI({ ...clientOptions, apiKey: key }) : null;
}

module.exports = { createOpenAIClient, openAIConfigured, federationConfigured, githubActionsTokenProvider, DEFAULT_AUDIENCE };
