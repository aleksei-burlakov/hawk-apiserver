package internal

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"

	"github.com/aleksei-burlakov/hawk-apiserver/cib"
	"github.com/aleksei-burlakov/hawk-apiserver/server"
	log "github.com/sirupsen/logrus"
)

type routeHandler struct {
	Cib      cib.AsyncCib
	config   *Config
	proxies  map[*ConfigRoute]*server.ReverseProxy
	proxymux sync.Mutex
}

// NewRoutehandler creates a routeHandler object from a configuration
func NewRouteHandler(config *Config) *routeHandler {
	return &routeHandler{
		config:  config,
		proxies: make(map[*ConfigRoute]*server.ReverseProxy),
	}
}

func (handler *routeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	for _, route := range handler.config.Route {
		if !strings.HasPrefix(r.URL.Path, route.Path) {
			continue
		}
		switch route.Handler {
		case "monitor":
			if handler.serveMonitor(w, r, &route) {
				return
			}
		case "file":
			if handler.serveFile(w, r, &route) {
				return
			}
		case "proxy":
			if handler.serveProxy(w, r, &route) {
				return
			}
		}
	}
	http.Error(w, fmt.Sprintf("Unmatched request: %v.", r.URL.Path), 500)
	return
}

func (handler *routeHandler) proxyForRoute(route *ConfigRoute) *server.ReverseProxy {
	if route.Handler != "proxy" {
		return nil
	}

	handler.proxymux.Lock()
	proxy, ok := handler.proxies[route]
	handler.proxymux.Unlock()
	if ok {
		return proxy
	}

	// TODO(krig): Parse and verify URL in config parser?
	url, err := url.Parse(*route.Target)
	if err != nil {
		log.Error(err)
		return nil
	}
	proxy = server.NewSingleHostReverseProxy(url, "", http.DefaultMaxIdleConnsPerHost)
	handler.proxymux.Lock()
	handler.proxies[route] = proxy
	handler.proxymux.Unlock()
	return proxy
}

func (handler *routeHandler) serveMonitor(w http.ResponseWriter, r *http.Request, route *ConfigRoute) bool {
	if r.URL.Path != route.Path && r.URL.Path != fmt.Sprintf("%s.json", route.Path) {
		return false
	}
	log.Debugf("[monitor] %v", r.URL.Path)

	epoch := ""
	args := strings.Split(r.URL.RawQuery, "&")
	if len(args) >= 1 {
		epoch = args[0]
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	if r.Header.Get("Origin") != "" {
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-CSRF-Token, Token")
		w.Header().Set("Access-Control-Max-Age", "1728000")
	}
	// Flush headers if possible
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	newEpoch := ""
	ver := handler.Cib.Version()
	if ver != nil {
		newEpoch = ver.String()
	}
	if newEpoch == "" || newEpoch == epoch {
		// either we haven't managed to connect
		// to the CIB yet, or there hasn't been
		// any change since we asked last.
		// Wait with a timeout for something to
		// appear, and return whatever we had
		// if we time out
		newEpoch = handler.Cib.Wait(60, newEpoch)
	}
	io.WriteString(w, fmt.Sprintf("{\"epoch\":\"%s\"}\n", newEpoch))
	return true
}

func (handler *routeHandler) serveFile(w http.ResponseWriter, r *http.Request, route *ConfigRoute) bool {
	// TODO(krig): Verify configuration file (ensure Target != nil) in config parser
	if route.Target == nil {
		return false
	}
	filename := path.Clean(fmt.Sprintf("%v%v", *route.Target, r.URL.Path))
	info, err := os.Stat(filename)
	if err == nil && !info.IsDir() {
		log.Debugf("[file] %s", filename)
		e := fmt.Sprintf(`W/"%x-%x"`, info.ModTime().Unix(), info.Size())
		if match := r.Header.Get("If-None-Match"); match != "" {
			if strings.Contains(match, e) {
				w.WriteHeader(http.StatusNotModified)
				return true
			}
		}
		w.Header().Set("Cache-Control", "public, max-age=2592000")
		w.Header().Set("ETag", e)
		http.ServeFile(w, r, filename)
		return true
	}
	return false
}

func (handler *routeHandler) serveProxy(w http.ResponseWriter, r *http.Request, route *ConfigRoute) bool {
	if route.Target == nil {
		return false
	}
	log.Debugf("[proxy] %s -> %s", r.URL.Path, *route.Target)
	rproxy := handler.proxyForRoute(route)
	if rproxy == nil {
		http.Error(w, "Bad web server configuration.", 500)
		return true
	}
	rproxy.ServeHTTP(w, r, nil)
	return true
}
