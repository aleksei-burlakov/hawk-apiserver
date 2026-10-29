package server

import (
	"crypto/tls"
	"reflect"
	"testing"
)

func TestCipherSuites(t *testing.T) {
	for _, value := range []string{"", "  "} {
		got, err := cipherSuites(value)
		if err != nil {
			t.Fatal(err)
		}
		want := []uint16{
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
			tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_RSA_WITH_AES_256_CBC_SHA,
		}
		if len(got) == 0 || !reflect.DeepEqual(got, want) {
			t.Fatalf("empty value: got %v, want original four suites %v", got, want)
		}
	}

	got, err := cipherSuites(" TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, TLS_RSA_WITH_AES_256_CBC_SHA ")
	want := []uint16{tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, tls.TLS_RSA_WITH_AES_256_CBC_SHA}
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("explicit list: got %v, %v; want %v", got, err, want)
	}
	for _, value := range []string{"UNKNOWN", "TLS_AES_128_GCM_SHA256", ",", "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,"} {
		if _, err := cipherSuites(value); err == nil {
			t.Errorf("expected error for %q", value)
		}
	}
}
