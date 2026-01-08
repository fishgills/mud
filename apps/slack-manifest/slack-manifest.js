const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const TOOL_DIR = path.resolve(__dirname);
const MANIFEST_DIR = path.join(TOOL_DIR, 'manifest');
const BASE_PATH = path.join(MANIFEST_DIR, 'base.json');
const ENV_DIR = path.join(MANIFEST_DIR, 'env');
const GENERATED_DIR = path.join(MANIFEST_DIR, 'generated');
const APP_IDS_PATH = path.join(MANIFEST_DIR, 'app-ids.json');
const DOTENV_PATHS = [path.join(TOOL_DIR, '.env'), path.join(ROOT_DIR, '.env')];

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const loadDotEnv = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) {
      return;
    }
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
};

const deepMerge = (base, override) => {
  if (!isPlainObject(base)) {
    return isPlainObject(override) ? { ...override } : override;
  }
  const result = { ...base };
  if (!isPlainObject(override)) {
    return result;
  }
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      result[key] = deepMerge(baseValue, value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

const sortManifestKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortManifestKeys);
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortManifestKeys(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const formatUsage = () => `\
Usage:
  yarn slack:manifest render --env <dev|prod> [--out <path>] [--stdout]
  yarn slack:manifest promote [--out <path>] [--stdout]
  yarn slack:manifest update-dev [--app-id <id>] [--token <token>] [--stdout]
  yarn slack:manifest update-prod [--app-id <id>] [--token <token>] [--stdout]
  yarn slack:manifest export-dev [--app-id <id>] [--token <token>] [--out <path>] [--stdout]
  yarn slack:manifest export-prod [--app-id <id>] [--token <token>] [--out <path>] [--stdout]
  yarn slack:manifest verify-dev [--app-id <id>] [--token <token>] [--out <path>] [--stdout]
  yarn slack:manifest verify-prod [--app-id <id>] [--token <token>] [--out <path>] [--stdout]

Notes:
  - Base manifest: ${path.relative(ROOT_DIR, BASE_PATH)}
  - Env overrides: ${path.relative(ROOT_DIR, ENV_DIR)}/<env>.json
  - Default output: ${path.relative(
    ROOT_DIR,
    path.join(MANIFEST_DIR, 'generated', '<env>.json'),
  )}
  - API token can be passed via --token or SLACK_MANIFEST_TOKEN
  - App IDs can be passed via --app-id, app-ids.json, SLACK_APP_ID_DEV, or SLACK_APP_ID_PROD
`;

const args = process.argv.slice(2);
let command = args[0];
const options = {
  env: null,
  out: null,
  stdout: false,
  appId: null,
  token: null,
};

const parseArgs = (input) => {
  const rest = command && !command.startsWith('-') ? input.slice(1) : input;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--env' || arg === '-e') {
      options.env = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--out' || arg === '-o') {
      options.out = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--stdout') {
      options.stdout = true;
      continue;
    }
    if (arg === '--app-id') {
      options.appId = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--token') {
      options.token = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      command = 'help';
      return;
    }
  }
};

if (!command || command.startsWith('-')) {
  command = 'render';
}

parseArgs(args);

const resolveEnv = () => {
  if (
    command === 'promote' ||
    command === 'update-prod' ||
    command === 'export-prod' ||
    command === 'verify-prod'
  ) {
    return 'prod';
  }
  if (
    command === 'update-dev' ||
    command === 'export-dev' ||
    command === 'verify-dev'
  ) {
    return 'dev';
  }
  if (!options.env) {
    console.error('Missing --env <dev|prod>.');
    console.log(formatUsage());
    process.exit(1);
  }
  return options.env;
};

const fetchJson = async (url, payload, token) => {
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  }
  const https = require('node:https');
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json; charset=utf-8',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
};

const exportManifest = async (appId, token) => {
  const response = await fetchJson(
    'https://slack.com/api/apps.manifest.export',
    { app_id: appId },
    token,
  );
  if (!response.ok) {
    console.error(
      `Slack manifest export failed: ${response.error ?? 'unknown error'}`,
    );
    process.exit(1);
  }
  const exported = response.manifest;
  if (!exported) {
    console.error('Slack manifest export did not return a manifest payload.');
    process.exit(1);
  }
  return exported;
};

const verifyManifest = (localManifest, remoteManifest) => {
  const localNormalized = JSON.stringify(sortManifestKeys(localManifest));
  const remoteNormalized = JSON.stringify(sortManifestKeys(remoteManifest));
  if (localNormalized !== remoteNormalized) {
    console.error(
      'Slack manifest differs from the rendered manifest. Use --out to save the exported version for inspection.',
    );
    process.exit(1);
  }
  console.log('Slack manifest matches the rendered manifest.');
};

const formatScopeList = (manifest) => {
  const scopes = manifest?.oauth_config?.scopes?.bot;
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return '(none)';
  }
  return scopes.join(', ');
};

const main = async () => {
  if (command === 'help') {
    console.log(formatUsage());
    process.exit(0);
  }

  DOTENV_PATHS.forEach((dotenvPath) => loadDotEnv(dotenvPath));

  if (!fs.existsSync(BASE_PATH)) {
    console.error(`Base manifest not found: ${BASE_PATH}`);
    process.exit(1);
  }

  const env = resolveEnv();
  const envPath = path.join(ENV_DIR, `${env}.json`);
  const baseManifest = readJson(BASE_PATH);
  const envManifest = fs.existsSync(envPath) ? readJson(envPath) : {};
  const merged = deepMerge(baseManifest, envManifest);
  const appIds = fs.existsSync(APP_IDS_PATH) ? readJson(APP_IDS_PATH) : {};

  const outputPath = options.out ?? path.join(GENERATED_DIR, `${env}.json`);
  const isUpdate = command === 'update-dev' || command === 'update-prod';
  const isExport = command === 'export-dev' || command === 'export-prod';
  const isVerify = command === 'verify-dev' || command === 'verify-prod';
  const isProd = env === 'prod';

  if (options.stdout) {
    process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
  }

  if (isUpdate) {
    const appIdFromFile = command === 'update-prod' ? appIds.prod : appIds.dev;
    const appId =
      options.appId ??
      appIdFromFile ??
      (command === 'update-prod'
        ? process.env.SLACK_APP_ID_PROD
        : process.env.SLACK_APP_ID_DEV);
    if (!appId) {
      console.error(
        `Missing --app-id or ${
          command === 'update-prod' ? 'SLACK_APP_ID_PROD' : 'SLACK_APP_ID_DEV'
        }.`,
      );
      process.exit(1);
    }
    const token = options.token ?? process.env.SLACK_MANIFEST_TOKEN;
    if (!token) {
      console.error('Missing --token or SLACK_MANIFEST_TOKEN.');
      process.exit(1);
    }
    console.log(`Updating Slack manifest for ${env} (app: ${appId}).`);
    console.log(`Manifest scopes (local): ${formatScopeList(merged)}`);
    const response = await fetchJson(
      'https://slack.com/api/apps.manifest.update',
      { app_id: appId, manifest: merged },
      token,
    );
    if (options.stdout) {
      process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    }
    if (!response.ok) {
      console.error(
        `Slack manifest update failed: ${response.error ?? 'unknown error'}`,
      );
      process.exit(1);
    }
    if (response.permissions_updated) {
      console.log('');
      console.log(
        '================================================================',
      );
      console.log('ATTENTION: SLACK PERMISSIONS UPDATED');
      console.log(
        'The app permissions changed. Reinstall the Slack app to apply updates.',
      );
      console.log(
        '================================================================',
      );
      console.log('');
    }
    console.log(`Updated Slack manifest for ${env}.`);
    console.log(`Verifying Slack manifest for ${env}...`);
    const exported = await exportManifest(appId, token);
    console.log(`Manifest scopes (remote): ${formatScopeList(exported)}`);
    verifyManifest(merged, exported);
  }

  if (isExport || isVerify) {
    const appIdFromFile = isProd ? appIds.prod : appIds.dev;
    const appId =
      options.appId ??
      appIdFromFile ??
      (isProd ? process.env.SLACK_APP_ID_PROD : process.env.SLACK_APP_ID_DEV);
    if (!appId) {
      console.error(
        `Missing --app-id or ${
          isProd ? 'SLACK_APP_ID_PROD' : 'SLACK_APP_ID_DEV'
        }.`,
      );
      process.exit(1);
    }
    const token = options.token ?? process.env.SLACK_MANIFEST_TOKEN;
    if (!token) {
      console.error('Missing --token or SLACK_MANIFEST_TOKEN.');
      process.exit(1);
    }
    console.log(`Exporting Slack manifest for ${env} (app: ${appId}).`);
    const exported = await exportManifest(appId, token);
    console.log(`Manifest scopes (remote): ${formatScopeList(exported)}`);
    if (options.stdout) {
      process.stdout.write(`${JSON.stringify(exported, null, 2)}\n`);
    }
    if (options.out || (!options.stdout && isExport)) {
      const exportOutputPath =
        options.out ?? path.join(GENERATED_DIR, `${env}-export.json`);
      fs.mkdirSync(path.dirname(exportOutputPath), { recursive: true });
      fs.writeFileSync(
        exportOutputPath,
        `${JSON.stringify(exported, null, 2)}\n`,
      );
      console.log(
        `Wrote exported manifest: ${path.relative(ROOT_DIR, exportOutputPath)}`,
      );
    }
    if (isVerify) {
      console.log(`Manifest scopes (local): ${formatScopeList(merged)}`);
      verifyManifest(merged, exported);
    }
    if (isExport) {
      console.log(`Exported Slack manifest for ${env}.`);
    }
  }

  if (!isExport && !isVerify && (!options.stdout || options.out)) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`Wrote manifest: ${path.relative(ROOT_DIR, outputPath)}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
