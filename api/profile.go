package api

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
)

const advancedOptionsCookie = "advancedoptions"

func profileAdvancedOptionsEnabled(r *http.Request) bool {
	cookie, err := r.Cookie(advancedOptionsCookie)
	return err == nil && cookie.Value == "true"
}

// Advanced options are a display preference, not an authorization grant.
func ProfileAdvancedOptionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		http.Error(w, "Expected application/json", http.StatusUnsupportedMediaType)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	var input struct {
		Enabled *bool `json:"enabled"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || input.Enabled == nil {
		http.Error(w, "Invalid advanced options preference", http.StatusBadRequest)
		return
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		http.Error(w, "Invalid advanced options preference", http.StatusBadRequest)
		return
	}
	cookie := &http.Cookie{Name: advancedOptionsCookie, Value: "true", Path: "/", Secure: r.TLS != nil, SameSite: http.SameSiteLaxMode}
	message := "FOOBAR is unlocked"
	if !*input.Enabled {
		cookie.Value = ""
		cookie.MaxAge = -1
		message = "Advanced options disabled"
	}
	http.SetCookie(w, cookie)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"enabled": *input.Enabled, "message": message})
}

func ProfileHandler(w http.ResponseWriter, r *http.Request) {
	const editPath = "/cib/live/profile/edit"
	if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodPost && r.Method != http.MethodPut {
		w.Header().Set("Allow", "GET, HEAD, POST, PUT")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	warning := true
	if cookie, err := r.Cookie("stonithwarning"); err == nil {
		warning = cookie.Value == "true"
	}
	if r.Method == http.MethodPost || r.Method == http.MethodPut {
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		if err := r.ParseForm(); err != nil {
			http.Error(w, "Invalid preferences", 400)
			return
		}
		if r.PostForm.Has("revert") {
			http.Redirect(w, r, editPath, http.StatusSeeOther)
			return
		}
		value := r.PostForm.Get("profile[stonithwarning]")
		if value != "true" && value != "false" {
			http.Error(w, "Select whether to display the fencing warning", 422)
			return
		}
		// Match Ruby: disabling sets a session cookie; enabling removes the override.
		// Language selection is unavailable, so leave any existing locale cookie alone.
		cookie := &http.Cookie{Name: "stonithwarning", Value: "false", Path: "/"}
		if value == "true" {
			cookie.Value = ""
			cookie.MaxAge = -1
		}
		http.SetCookie(w, cookie)
		http.Redirect(w, r, editPath+"?updated=true", http.StatusSeeOther)
		return
	}
	message := ""
	if r.URL.Query().Get("updated") == "true" {
		message = "Preferences updated successfully"
	}
	renderTemplate(w, "profile", map[string]any{"Title": "Preferences", "Warning": warning, "Message": message, "AdvancedOptions": profileAdvancedOptionsEnabled(r)})
}
