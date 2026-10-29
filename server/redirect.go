package server

import (
	"bufio"
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// cipherSuites parses TLS 1.2 cipher suite names. An empty value uses
// the server's original four cipher suites.
// Examples of supported cipher suites:
//
//	TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
//	TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
//	TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
//	TLS_RSA_WITH_AES_256_GCM_SHA384
//	TLS_RSA_WITH_AES_256_CBC_SHA
//	...
func cipherSuites(value string) ([]uint16, error) {
	if strings.TrimSpace(value) == "" {
		return []uint16{
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
			tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_RSA_WITH_AES_256_CBC_SHA,
		}, nil
	}
	available := make(map[string]uint16)
	for _, suite := range append(tls.CipherSuites(), tls.InsecureCipherSuites()...) {
		for _, version := range suite.SupportedVersions {
			if version == tls.VersionTLS12 {
				available[suite.Name] = suite.ID
				break
			}
		}
	}
	var selected []uint16
	for _, name := range strings.Split(value, ",") {
		name = strings.TrimSpace(name)
		id, ok := available[name]
		if !ok {
			return nil, fmt.Errorf("/etc/sysconfig/hawk#HAWK_TLS12_CIPHER_SUITES: unknown or unsupported TLS 1.2 cipher suite %q", name)
		}
		selected = append(selected, id)
	}
	return selected, nil
}

// ListenAndServeWithRedirect enables seamless HTTP -> HTTPS redirect
// on the same port. This is useful for Hawk so that if someone
// accesses the :7630 port over HTTP, it'll automagically redirect to
// HTTPS.
func ListenAndServeWithRedirect(addr string, handler http.Handler, cert string, key string) {
	suites, err := cipherSuites(os.Getenv("HAWK_TLS12_CIPHER_SUITES"))
	if err != nil {
		log.Fatal(err)
	}
	config := &tls.Config{
		MinVersion:               tls.VersionTLS12,
		CurvePreferences:         []tls.CurveID{tls.CurveP521, tls.CurveP384, tls.CurveP256},
		PreferServerCipherSuites: true,
		CipherSuites:             suites,
	}

	if config.NextProtos == nil {
		config.NextProtos = []string{"http/1.1"}
	}

	config.Certificates = make([]tls.Certificate, 1)
	config.Certificates[0], err = tls.LoadX509KeyPair(cert, key)
	if err != nil {
		log.Fatal(err)
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal(err)
	}

	listener := &splitListener{
		Listener: ln,
		config:   config,
	}

	srv := &http.Server{
		Addr: addr,
		Handler: &httpRedirectHandler{
			handler: handler,
		},
		TLSConfig: config,
	}
	err = srv.Serve(listener)
	if err != nil {
		log.Fatal(err)
	}

}

type splitListener struct {
	net.Listener
	config *tls.Config
}

func (l *splitListener) Accept() (net.Conn, error) {
	c, err := l.Listener.Accept()
	if err != nil {
		return nil, err
	}

	bconn := &conn{
		Conn: c,
		buf:  bufio.NewReader(c),
	}

	// inspect the first bytes to see if it is HTTPS
	hdr, err := bconn.buf.Peek(6)
	if err != nil {
		log.Printf("Short %s: %s\n", c.RemoteAddr().String(), err.Error())
		// couldn't peek, assume it's HTTPS
		return tls.Server(bconn, l.config), nil
	}

	// SSL 3.0 or TLS 1.0, 1.1 and 1.2
	if hdr[0] == 0x16 && hdr[1] == 0x3 && hdr[5] == 0x1 {
		return tls.Server(bconn, l.config), nil
		// SSL 2
	} else if hdr[0] == 0x80 {
		return tls.Server(bconn, l.config), nil
	}
	return bconn, nil
}

type conn struct {
	net.Conn
	buf *bufio.Reader
}

func (c *conn) Read(b []byte) (int, error) {
	return c.buf.Read(b)
}

type httpRedirectHandler struct {
	handler http.Handler
}

func (handler *httpRedirectHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
	if r.TLS == nil {
		u := url.URL{
			Scheme:   "https",
			Opaque:   r.URL.Opaque,
			User:     r.URL.User,
			Host:     r.Host,
			Path:     r.URL.Path,
			RawQuery: r.URL.RawQuery,
			Fragment: r.URL.Fragment,
		}
		log.Printf("http -> %s\n", u.String())
		http.Redirect(w, r, u.String(), http.StatusMovedPermanently)
		return
	}
	handler.handler.ServeHTTP(w, r)
}
