/**
 * Purpose: centralise Buildy environment names and compatibility aliases.
 * Constraints: secrets are read server-side only; this module never logs values.
 */
function first(...values) { return values.find(value => typeof value === 'string' && value.length > 0); }
function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || 'development',
    publicMode: env.BUILDY_PUBLIC_MODE === 'true',
    sessionSecret: first(env.BUILDY_SESSION_SECRET, env.SESSION_SECRET),
    tokenEncryptionKey: first(env.BUILDY_TOKEN_ENCRYPTION_KEY, env.TOKEN_ENCRYPTION_KEY),
    github: {
      clientId: first(env.BUILDY_GITHUB_CLIENT_ID, env.GITHUB_APP_CLIENT_ID),
      clientSecret: first(env.BUILDY_GITHUB_CLIENT_SECRET, env.GITHUB_APP_CLIENT_SECRET),
      slug: first(env.BUILDY_GITHUB_APP_SLUG, env.GITHUB_APP_SLUG),
      callbackUrl: first(env.BUILDY_GITHUB_CALLBACK_URL, env.GITHUB_APP_CALLBACK_URL)
    },
    jobApiToken: first(env.BUILDY_JOB_API_TOKEN),
    jobsEnabled: env.BUILDY_JOBS_ENABLED === 'true'
  };
}
module.exports = { loadConfig };
