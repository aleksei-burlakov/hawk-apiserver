# this is the what ends up in the RPM "Version" field and embedded in the --version CLI flag
VERSION ?= $(shell .ci/get_version_from_git.sh)
PREFIX ?= /usr
SBINDIR ?= $(PREFIX)/sbin
SHAREDIR ?= $(PREFIX)/share
TEMPLATEDIR ?= $(SHAREDIR)/hawk/templates
STATICDIR ?= $(SHAREDIR)/hawk/static

default: build test
build:
	go vet ./...
	go build -ldflags "-s -w -X main.version=$(VERSION)"
	go mod tidy
test:
	go test ./... -v
install:
	install -D -m 0755 hawk-apiserver "$(DESTDIR)$(SBINDIR)/hawk-apiserver"
	install -d "$(DESTDIR)$(TEMPLATEDIR)"
	install -m 0644 templates/* "$(DESTDIR)$(TEMPLATEDIR)/"
	install -d "$(DESTDIR)$(STATICDIR)"
	cp -R static/* "$(DESTDIR)$(STATICDIR)/"

.PHONY: build test install
