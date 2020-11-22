const axios = require('axios');
const https = require('https');
const config = require('./config.js');

const token = config.USER_TOKEN;
const globalConfig = {
  headers: { Authorization: `Bearer ${token}` },
  httpsAgent: new https.Agent({
    rejectUnauthorized: config.INSECURE_REQUESTS !== 'true',
  }),
};
const axiosInstance = axios.create({
  baseURL: config.CLUSTER_SERVER,
  headers: globalConfig.headers,
  httpsAgent: globalConfig.httpsAgent,
});

async function getResource(name, kind, namespace, apiVersion) {
  const url = `/api${apiVersion.indexOf('/') === -1 ? '' : 's'}/${apiVersion}/namespaces/${namespace}/${kind.toLowerCase() + 's'}/${name}`;
  const response = await axiosInstance.get(url);
  return response.data;
}

async function updateResource(object) {
  const apiVersion = object.apiVersion;
  const namespace = object.metadata.namespace;
  const kind = object.kind;
  const name = object.metadata.name;

  console.log(`[UPDATE] ${name} - ${kind} (${namespace})`);

  const url = `/api${apiVersion.indexOf('/') === -1 ? '' : 's'}/${apiVersion}/namespaces/${namespace}/${kind.toLowerCase() + 's'}/${name}`;
  const response = await axiosInstance.put(url, object);
  return response.data;

}

module.exports = {
  getResource,
  updateResource,
};