const k8s = require('@kubernetes/client-node');

const config = require('./config.js');
const kc = new k8s.KubeConfig();

if (config.KUBE_DEFAULT_USER === 'true') {
  console.log(`Loading default Kube configuration`);
  kc.loadFromDefault();
  config.USER_TOKEN = kc.getCurrentUser().token;
  config.CLUSTER_SERVER = kc.getCurrentCluster().server;
} else {
  console.log(`Loading Kube configuration from environment variables`);
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

const diffuseLabels = [
  'io.shyrka.erebus/hypnos',
];
const diffuseKinds = [
  'DeploymentConfig',
];

watchStart();

async function watchStart() {
  //console.log('Start watching');
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

    const namespace = (await k8sApiCore.readNamespace(involvedObject.namespace)).response.body;

    const metadataLabels = Object.entries(namespace.metadata.labels || {}).filter(entry => diffuseLabels.indexOf(entry[0]) !== -1);

    if (metadataLabels.length === 0) return;

    if (diffuseKinds.indexOf(involvedObject.kind) === -1) return;

    try {
      console.log(`${involvedObject.name} - ${involvedObject.kind} (${involvedObject.namespace})`);
      const object = await openshift.getResource(involvedObject.name, involvedObject.kind, involvedObject.namespace, involvedObject.apiVersion);
      for (const [key, value] of metadataLabels) {
        object.metadata.labels[key] = value;
      }
      const updatedObject = await openshift.updateResource(object);
    } catch (e) {
      console.error(e.response.data.message);
    }

  } catch (e) {
    console.error(apiObj);
    console.error(e);
  }
}

async function watchEnd(response) {
  //console.log('Watch ended');
  // Chain with another watch
  await watchStart();
}