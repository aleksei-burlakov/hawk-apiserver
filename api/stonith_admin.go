package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os/exec"
)

func GetFenceHistory(nodeName string) (string, int, error) {
	cmd := exec.Command("stonith_admin", "-H", nodeName)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	output, err := cmd.Output()
	if err != nil {
		exitCode := -1

		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitCode()
		}

		return stderr.String(), exitCode, err
	}

	return string(output), 0, nil
}

func FetchNodeFencingHistory(w http.ResponseWriter, r *http.Request) {
	var nodeName string

	if err := json.NewDecoder(r.Body).Decode(&nodeName); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Printf("[FetchNodeAttributes] JSON decode error: %v", err)
	}

	fenceHistory, pacemakerRC, err := GetFenceHistory(nodeName)

	if err != nil {
		if pacemakerRC == 102 {
			http.Error(w, "Pacemaker cluster is offline: "+err.Error(), http.StatusServiceUnavailable)
			return
		}
		http.Error(w, "Failed to fencing history: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(fenceHistory); err != nil {
		log.Printf("[FetchFencingHistory] JSON encode error: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}
