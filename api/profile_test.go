package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProfilePage(t *testing.T) {
	cwd, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(".."))
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	for _, value := range []string{"", "false", "true"} {
		request := httptest.NewRequest("GET", "/cib/live/profile/edit", nil)
		if value != "" {
			request.AddCookie(&http.Cookie{Name: "stonithwarning", Value: value})
		}
		response := httptest.NewRecorder()
		ProfileHandler(response, request)
		require.Equal(t, 200, response.Code)
		html := response.Body.String()
		require.Contains(t, html, `name="profile[language]" disabled aria-describedby="profile-language-help"`)
		require.Contains(t, html, "Language selection will be available in a future release.")
		require.Contains(t, html, `>English</option>`)
		if value == "false" {
			require.Contains(t, html, `value="false" selected`)
		} else {
			require.Contains(t, html, `value="true" selected`)
		}
		require.Empty(t, response.Result().Cookies())
	}
}

func TestProfileApplyPreservesLocale(t *testing.T) {
	for _, method := range []string{"POST", "PUT"} {
		for _, warning := range []string{"true", "false"} {
			form := url.Values{"profile[stonithwarning]": {warning}, "profile[language]": {"de"}}
			request := httptest.NewRequest(method, "/cib/live/profile", strings.NewReader(form.Encode()))
			request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			request.AddCookie(&http.Cookie{Name: "locale", Value: "fr"})
			response := httptest.NewRecorder()
			ProfileHandler(response, request)
			require.Equal(t, 303, response.Code)
			require.Equal(t, "/cib/live/profile/edit?updated=true", response.Header().Get("Location"))
			cookies := response.Result().Cookies()
			require.Len(t, cookies, 1)
			require.Equal(t, "stonithwarning", cookies[0].Name)
			require.Equal(t, "/", cookies[0].Path)
			if warning == "true" {
				require.Equal(t, -1, cookies[0].MaxAge)
			} else {
				require.Equal(t, "false", cookies[0].Value)
				require.Zero(t, cookies[0].MaxAge)
			}
		}
	}
}

func TestProfileRevertAndInvalidRequests(t *testing.T) {
	for _, test := range []struct {
		method, body string
		status       int
	}{
		{"POST", "revert=", 303},
		{"POST", "profile%5Bstonithwarning%5D=invalid", 422},
		{"DELETE", "", 405},
	} {
		request := httptest.NewRequest(test.method, "/cib/live/profile", strings.NewReader(test.body))
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		response := httptest.NewRecorder()
		ProfileHandler(response, request)
		require.Equal(t, test.status, response.Code)
		require.Empty(t, response.Result().Cookies())
		if test.status == 303 {
			require.Equal(t, "/cib/live/profile/edit", response.Header().Get("Location"))
		}
	}
}

func TestProfileAdvancedOptions(t *testing.T) {
	for _, enabled := range []bool{true, false} {
		for _, scheme := range []string{"http", "https"} {
			request := httptest.NewRequest("POST", scheme+"://hawk.test/api/profile/advanced-options", strings.NewReader(fmt.Sprintf(`{"enabled":%t}`, enabled)))
			request.Header.Set("Content-Type", "application/json; charset=utf-8")
			request.AddCookie(&http.Cookie{Name: "stonithwarning", Value: "false"})
			response := httptest.NewRecorder()
			ProfileAdvancedOptionsHandler(response, request)
			require.Equal(t, 200, response.Code, response.Body.String())
			require.Equal(t, "no-store", response.Header().Get("Cache-Control"))
			cookies := response.Result().Cookies()
			require.Len(t, cookies, 1)
			cookie := cookies[0]
			require.Equal(t, advancedOptionsCookie, cookie.Name)
			require.Equal(t, "/", cookie.Path)
			require.Equal(t, scheme == "https", cookie.Secure)
			require.Equal(t, http.SameSiteLaxMode, cookie.SameSite)
			require.False(t, cookie.HttpOnly, "The shared sidebar reads this display preference")
			if enabled {
				require.Equal(t, "true", cookie.Value)
				require.Zero(t, cookie.MaxAge, "Use the same browser-session lifetime as other profile preferences")
				require.JSONEq(t, `{"enabled":true,"message":"FOOBAR is unlocked"}`, response.Body.String())
			} else {
				require.Equal(t, -1, cookie.MaxAge)
				require.JSONEq(t, `{"enabled":false,"message":"Advanced options disabled"}`, response.Body.String())
			}
		}
	}
}

func TestProfileAdvancedOptionsRejectsInvalidRequests(t *testing.T) {
	for _, tt := range []struct {
		method, contentType, body string
		status                    int
	}{
		{"GET", "", "", 405},
		{"POST", "application/x-www-form-urlencoded", "enabled=true", 415},
		{"POST", "application/json", `{}`, 400},
		{"POST", "application/json", `{"enabled":null}`, 400},
		{"POST", "application/json", `{"enabled":"true"}`, 400},
		{"POST", "application/json", `{"enabled":true,"unexpected":true}`, 400},
		{"POST", "application/json", `{"enabled":true} {}`, 400},
		{"POST", "application/json", `{"enabled":true`, 400},
		{"POST", "application/json", `{"enabled":true}` + strings.Repeat(" ", 1024), 400},
	} {
		request := httptest.NewRequest(tt.method, "/api/profile/advanced-options", strings.NewReader(tt.body))
		request.Header.Set("Content-Type", tt.contentType)
		response := httptest.NewRecorder()
		ProfileAdvancedOptionsHandler(response, request)
		require.Equal(t, tt.status, response.Code, response.Body.String())
		require.Empty(t, response.Result().Cookies(), "Invalid requests must not change the preference")
	}
}

func TestFoobarVisibilityPreference(t *testing.T) {
	cwd, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(".."))
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	for _, value := range []string{"", "false", "invalid", "true"} {
		request := httptest.NewRequest("GET", "/cib/live/profile/edit", nil)
		if value != "" {
			request.AddCookie(&http.Cookie{Name: advancedOptionsCookie, Value: value})
		}
		response := httptest.NewRecorder()
		ProfileHandler(response, request)
		require.Equal(t, 200, response.Code)
		require.Contains(t, response.Body.String(), `id="foobar-navigation" hidden`)
		require.Contains(t, response.Body.String(), `role="switch" id="profile_advanced_options"`)
		if value == "true" {
			require.Contains(t, response.Body.String(), `aria-describedby="profile-advanced-help" checked`)
		} else {
			require.NotContains(t, response.Body.String(), `aria-describedby="profile-advanced-help" checked`)
		}
		for _, method := range []string{"GET", "HEAD"} {
			for _, path := range []string{"/cib/live/foobar", "/cib/live/foobar/", "/cib/live/foobar/packman", "/cib/live/foobar/packman/"} {
				pageRequest := httptest.NewRequest(method, path, nil)
				for _, cookie := range request.Cookies() {
					pageRequest.AddCookie(cookie)
				}
				page := httptest.NewRecorder()
				FoobarHandler(page, pageRequest)
				if value == "true" {
					require.Equal(t, 200, page.Code)
					require.Contains(t, page.Body.String(), "Packman")
					if strings.Contains(path, "/packman") {
						require.Contains(t, page.Body.String(), "Back to FOOBAR")
					} else {
						require.Contains(t, page.Body.String(), `href="/cib/live/foobar/packman"`)
						require.Contains(t, page.Body.String(), `type="button" disabled`)
					}
				} else {
					require.Equal(t, 303, page.Code)
					require.Equal(t, "/cib/live/profile/edit", page.Header().Get("Location"))
				}
			}
		}
	}
	for _, tt := range []struct {
		method, path string
		status       int
	}{{"POST", "/cib/live/foobar", 405}, {"GET", "/cib/live/foobar/unknown", 404}} {
		response := httptest.NewRecorder()
		FoobarHandler(response, httptest.NewRequest(tt.method, tt.path, nil))
		require.Equal(t, tt.status, response.Code)
	}
}
