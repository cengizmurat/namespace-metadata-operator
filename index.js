const k8s = require('@kubernetes/client-node');

const config = require('./config.js');
const kc = new k8s.KubeConfig();

const logLevel = parseInt(config.LOG_LEVEL);

if (config.KUBE_DEFAULT_USER === 'true') {
  logMessage(`Loading default Kube configuration`);
  kc.loadFromDefault();
  config.USER_TOKEN = kc.getCurrentUser().token;
  config.CLUSTER_SERVER = kc.getCurrentCluster().server;
} else {
  logMessage(`Loading Kube configuration from environment variables`);
  const cluster = {
    name: config.CLUSTER_NAME,
    server: config.CLUSTER_SERVER,
  };
  const user = {
    name: config.USER_NAME,
    token: config.USER_TOKEN,
  };
  const context = {
    name: config.CONTEXT,
    user: user.name,
    cluster: cluster.name,
  };

  kc.loadFromOptions({
    clusters: [cluster],
    users: [user],
    contexts: [context],
    currentContext: context.name,
  });
}

if (config.INSECURE_REQUESTS === 'true') {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
}

const openshift = require('./openshift');
const k8sApiCore = kc.makeApiClient(k8s.CoreV1Api);
const watch = new k8s.Watch(kc);

const diffuseLabels = config.SPREAD_NAMESPACE_LABELS.split(',');
const diffuseKinds = config.SPREAD_KINDS.split(',').map(kind => kind.toLowerCase());

let watching = false;

watchStart();

const cacheTime = parseInt(config.CACHE_TIME) * 1000;
const namespacesCache = {};

async function initCache() {
  logMessage(`[${new Date().toISOString()}] GET All Namespaces`, 2);
  const namespaces = (await k8sApiCore.listNamespace()).response.body;
  for (const namespace of namespaces.items) {
    namespacesCache[namespace.metadata.name] = namespace;
  }
}

async function watchStart() {
  if (!watching) {
    logMessage(`[${new Date().toISOString()}] Cache initializing...`, 1);
    await initCache();
    logMessage(`[${new Date().toISOString()}] Cache OK`, 1);
    setInterval(initCache, cacheTime);
  }

  const now = new Date().toISOString();
  if (!watching) {
    logMessage(`[${now}] Start watching`);
    watching = true;
  } else {
    logMessage(`[${now}] Restart watching`, 1);
  }

  const request = await watch.watch('/api/v1/watch/events', {}, watchCallback, watchEnd);

  // watch returns a request object which you can use to abort the watch.
  // request.abort();
}

async function watchCallback(type, apiObj, watchObj) {
  let shouldModify = false;
  if (type === 'ADDED') {
    shouldModify = true;
  } else if (type === 'MODIFIED') {
    shouldModify = true;
  }
  if (!shouldModify) return;

  try {
    const involvedObject = apiObj.involvedObject;

    // Check resource kind
    if (involvedObject.kind && diffuseKinds.indexOf(involvedObject.kind.toLowerCase()) === -1) return;

    if (!involvedObject.namespace) return;

    let namespace = namespacesCache[involvedObject.namespace];
    if (!namespace) {
      logMessage(`[${new Date().toISOString()}] GET Namespace "${involvedObject.namespace}"`);
      namespace = (await k8sApiCore.readNamespace(involvedObject.namespace)).response.body;
      namespacesCache[involvedObject.namespace] = namespace;
    }

    const metadataLabels = Object.entries(namespace.metadata.labels || {}).filter(entry => diffuseLabels.indexOf(entry[0]) !== -1);

    // Check namespace metadata labels
    if (metadataLabels.length === 0) return;

    try {
      logMessage(`[${new Date().toISOString()}] GET ${involvedObject.kind} "${involvedObject.name}" (namespace "${involvedObject.namespace}")`);

      const object = await openshift.getResource(involvedObject.name, involvedObject.kind, involvedObject.namespace, involvedObject.apiVersion);
      object.metadata.labels = object.metadata.labels || {};

      let changed = false;
      for (const [key, value] of metadataLabels) {
        const label = object.metadata.labels[key];
        if (label !== value) {
          object.metadata.labels[key] = value;
          changed = true;
        }
      }

      if (changed) {
        let message = `[${new Date().toISOString()}] UPDATE ${involvedObject.kind} "${involvedObject.name}" (namespace "${involvedObject.namespace}")`;
        message += object.metadata.labels.map(entry => entry.join('=')).join('\n');
        logMessage(message);

        await openshift.updateResource(object);
      }
    } catch (e) {
      console.error(e.response.data.message);
    }

  } catch (e) {
    console.error(apiObj);
    console.error(e);
  }
}

async function watchEnd(response) {
  logMessage(`[${new Date().toISOString()}] Watch ended`, 1);

  // Chain with another watch
  await watchStart();
}

function logMessage(message, level = 0) {
  if (logLevel >= level) console.log(message);
}