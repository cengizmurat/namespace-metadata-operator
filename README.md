# Namespace Metadata Operator

This tool spreads metadata labels of a namespace towards its child components/resources.

To do so, it listens for [Events](https://docs.openshift.com/container-platform/4.5/rest_api/metadata_apis/event-core-v1.html) in a Kube cluster.

An event is generated for every addition or modification of a resource, so intercepted by this tool. Based on some conditions, this resource will wether or not have its namespace's metadata labels applied to itself.

## Requirements

`NodeJS >= v10` and `NPM >= v6`

## Installation

```bash
npm install
```

## Configuration

### Operator's environment variables

| Name | Description |
|------|-------------|
|`SPREAD_KINDS`|List of resource kinds that the operator will spread metadata labels|
|`SPREAD_NAMESPACE_LABELS`|List of metadata labels to be spread|

List elements should be separated by a comma. Example:
```bash
export SPREAD_KINDS=DeploymentConfig,Deployment,BuildConfig
```  

### Authentication environment variables

A Kube cluster and a Kube user information are needed.

To do so, you can set the `KUBE_DEFAULT_USER` environment variable to `true` (default to `false`) to load the environment's default Kube cluster and user.
If set to `false`, these environment variables need to be defined :

| Name | Description |
|------|-------------|
|`CLUSTER_SERVER`|The cluster's API server URL|
|`CLUSTER_NAME`|The cluster's name|
|`USER_NAME`|The user's name|
|`USER_TOKEN`|The user's password/token|
|`CONTEXT`|Kube context to be used|

### Global environment variables

| Name | Description | Default value |
|------|-------------|---------------|
|`INSECURE_REQUESTS`|Use insecure requests in order to communicate with Kube API server|`false`|
|`CACHE_TIME`|Time (in seconds) between each namespace cache is refreshed|`180` (3 minutes)|

## Usage

```bash
npm run start
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.