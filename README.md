# Hawk API Server

[![GoDoc](https://godoc.org/github.com/ClusterLabs/hawk-apiserver?status.svg)](https://godoc.org/github.com/ClusterLabs/hawk-apiserver)
[![Go Report Card](https://goreportcard.com/badge/github.com/ClusterLabs/hawk-apiserver)](https://goreportcard.com/report/github.com/ClusterLabs/hawk-apiserver)

HTTPS API server / minimalist web proxy for Hawk.

# Table of content

- [Rationale](#Rationale)
- [Devel](#devel)
- [Usage](#usage)
- [Features](#features)

# Rationale
This project currently provides a minimalistic web server which
handles SSL certificate termination, proxying and static file serving
for [HAWK](https://github.com/ClusterLabs/hawk)

The **primary goal** for this project is to provide the minimal web server
needed by Hawk while consuming as few system resources as
possible. Second, it provides the `/monitor` API endpoint which
handles long-lived connections from the frontend to enable instant
updates of the interface on cluster events, leveraged by [go-pacemaker](https://github.com/ClusterLabs/go-pacemaker)

The API server is still under its basic development phase.

# Devel

### Dependencies:

- following pkgs: `libqb-devel libpacemaker-devel`.

* Use `make` to interact with the standards dev lifecycle.

Generating an SSL certificates:

``` bash
SSLGEN_KEY=hawk.key SSLGEN_CERT=hawk.pem ./tools/generate-ssl-cert
```

# Usage:

The `hawk-api-server` is used currently mainly for hawk usage purposes, and in future as API-server.

## Configuration

Set `HAWK_TLS12_CIPHER_SUITES` in `/etc/sysconfig/hawk` to a comma-separated
list of Go TLS 1.2 cipher suite names, for example:

```sh
HAWK_TLS12_CIPHER_SUITES="TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
```

Systemd passes this variable to the API server through the existing
`EnvironmentFile`. When running the binary directly, export the variable.
An unset or empty value preserves the original four TLS 1.2 cipher suites:
`TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`,
`TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA`,
`TLS_RSA_WITH_AES_256_GCM_SHA384`, and
`TLS_RSA_WITH_AES_256_CBC_SHA`. Unknown names, empty list
entries, and TLS 1.3 suite names cause a startup error. TLS 1.3 cipher suites
are managed by Go and cannot be restricted by this variable. Restart
`hawk.service` after changing the value.

Pass `-config <config>` as an argument to give the server a
configuration file. The format is a json dictionary with key / value
pairs.

The available configuration values are described below. If a value is
set both in the configuration file and in a command line argument, the
command line argument takes precedence.

* `key`: Path to SSL key. (argument: -key)

* `cert`: Path to SSL certificate. (argument: -cert)

* `port`: TCP port to listen to for connections. (argument: -port)

* `route`: List of json maps that configure the routing table.

The route format is very limited and adapted to serving hawk, but
enable reconfiguration of the exact paths to certificates, files and
sockets.

Example:

``` json
{
  "key": "/etc/hawk/hawk.key",
  "cert": "/etc/hawk/hawk.pem",
  "port": 7630,
  "route": [
    {
      "handler": "monitor",
      "path": "/monitor"
    },
    {
      "handler": "file",
      "path": "/",
      "target": "/usr/share/hawk/public"
    },
    {
      "handler": "proxy",
      "path": "/",
      "target": "unix:///var/run/hawk/app.sock"
    }
  ]
}
```
# Features:

- HTTPS server
- reverse proxy
- `/monitor`  API endpoint which handles long-lived connections from the frontend to enable instant
              updates of the interface on cluster events.


### Authentication

* Basic auth: Get user:password from HTTP headers. Map to system
  user. Verify that system user is a member of the haclient group.

* Cookie auth (cookie created by hawk rails app): If a valid cookie is
  found in the HTTP headers, this is accepted as authentication.
  Session cookie is stored in attrd.
