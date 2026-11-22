package api

import "net/http"

func FoobarHandler(w http.ResponseWriter, r *http.Request) {
	page, title := "foobar", "FOOBAR"
	switch r.URL.Path {
	case "/cib/live/foobar", "/cib/live/foobar/":
	case "/cib/live/foobar/packman", "/cib/live/foobar/packman/":
		page, title = "foobar_packman", "Packman"
	default:
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !profileAdvancedOptionsEnabled(r) {
		http.Redirect(w, r, "/cib/live/profile/edit", http.StatusSeeOther)
		return
	}
	renderTemplate(w, page, map[string]any{"Title": title})
}
