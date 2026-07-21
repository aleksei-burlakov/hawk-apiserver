package api

import (
	"encoding/json"
	"encoding/xml"
	"log"
	"net/http"
	"os/exec"
	"strings"
)

/***************************************************
 * crm_resource --show-metadata ocf:pacemaker:Dummy
 ***************************************************/

type CrmResourceMetadata struct {
	Name       string          `xml:"name,attr"`
	Version    string          `xml:"version,attr"`
	Longdesc   string          `xml:"longdesc"`
	Shortdesc  string          `xml:"shortdesc"`
	Parameters []MetaParameter `xml:"parameters>parameter"` // maps to instance_attributes
	Actions    []Action        `xml:"actions>action"`
	/* RscDefaults (#meta_attributes) is not in 'crm_resource --show-metadata'
	 * but it's copied from rscDefaults
	 * and later enriched from 'cibadmin' */
	RscDefaults []MetaParameter
}

type MetaParameter struct {
	Name      string      `xml:"name,attr"`
	Longdesc  string      `xml:"longdesc"`
	Shortdesc string      `xml:"shortdesc"`
	Content   ContentAttr `xml:"content"`
}

type ContentAttr struct {
	Type    string `xml:"type,attr"`
	Default string `xml:"default,attr"`
	// Possible values are hardcoded
	PossibleValues []string
	// We take CibID and CibValue later from cib, if they are defined
	Required string // string, so that ["true", "false", "" for undefined]
	CibID    string // "" in case of operation attributes, the Action.CibID is used instead
	CibValue string
}

/* TODO: Action struct is messy. It's used for both to parse cib.xml
 * and to store the default values of operations.
 * Maybe there should be two different structures
 * (however I might change my mind, so don't hastle with it (17.05.2025))*/
type Action struct {
	Depth          string `xml:"depth,attr,omitempty"`
	Description    string `xml:"description,attr,omitempty"`
	Enabled        string `xml:"enabled,attr,omitempty"`
	Interval       string `xml:"interval,attr,omitempty"`
	IntervalOrigin string `xml:"interval-origin,attr,omitempty"`
	OnFail         string `xml:"on-fail,attr,omitempty"`
	Name           string `xml:"name,attr"`
	RecordPending  string `xml:"record-pending,attr,omitempty"`
	Requires       string `xml:"requires,attr,omitempty"`
	Role           string `xml:"role,attr,omitempty"`
	StartDelay     string `xml:"start-delay,attr,omitempty"`
	Timeout        string `xml:"timeout,attr,omitempty"`
	// We take CibID later from cib, if they are defined
	CibID string
	// Default values
	OpDefaults []MetaParameter
	// Help info
	Shortdesc string
	Longdesc  string
}

func getResourceMetadata(resourceAgent string) (CrmResourceMetadata, error) {
	//var cmd *exec.Cmd
	cmd := exec.Command("crm_resource", "--show-metadata", resourceAgent)

	out, err := cmd.Output()
	if err != nil {
		return CrmResourceMetadata{}, err
	}

	var metadata CrmResourceMetadata // Directly unmarshal into this
	if err := xml.Unmarshal(out, &metadata); err != nil {
		return CrmResourceMetadata{}, err
	}
	metadata.Actions = firstActionsByName(metadata.Actions)

	// Additional handling for stonith agents
	if strings.HasPrefix(resourceAgent, "stonith:") {

		stonithPaths := []string{
			"/usr/libexec/pacemaker/pacemaker-fenced",
			"/usr/lib/pacemaker/pacemaker-fenced",
		}

		var stonithOut []byte
		var stonithErr error

		for _, p := range stonithPaths {
			cmd = exec.Command(p, "metadata")
			stonithOut, stonithErr = cmd.Output()
			if stonithErr == nil {
				break // Success → stop trying
			}
		}

		if stonithErr != nil {
			log.Printf("warning: failed to fetch stonith metadata: %v", stonithErr)
			return metadata, stonithErr
		}

		var stonithMetadata CrmResourceMetadata
		if err := xml.Unmarshal(stonithOut, &stonithMetadata); err != nil {
			return CrmResourceMetadata{}, err
		}

		// merge stonith_metadata into metadata
		metadata.Parameters = append(metadata.Parameters, stonithMetadata.Parameters...)
	}

	return metadata, nil
}

func fetchFullPrimitiveFromCib(ResourceID string, ResourceAgent string) (CrmResourceMetadata, error) {
	// 1. Get the main content 'crm_resource --show-metadata'
	metadata, err := getResourceMetadata(ResourceAgent)
	if err != nil {
		return CrmResourceMetadata{}, err
	}

	// 2. Copy the default meta_attributes, default operations and help info
	metadata.RscDefaults = GetRscDefaults()
	descriptions := GetOpDescriptions()
	for i := range metadata.Actions {
		metadata.Actions[i].OpDefaults = GetOpDefaults()
		// It's a special case. In hawk we also handle this case in the code in oplist.js
		if metadata.Actions[i].Name == "monitor" {
			// T.B.A. (#TODO)
		}
		for _, desc := range descriptions {
			// no idea why we need those 'op-' prefixes, but they exist in hawk
			if metadata.Actions[i].Name == desc.Name || "op-"+metadata.Actions[i].Name == desc.Name {
				metadata.Actions[i].Shortdesc = desc.Shortdesc
				metadata.Actions[i].Longdesc = desc.Longdesc
			}
		}
	}

	// 4. Get current values of the attributes from cib.xml
	err = enrichPrimitiveMetadataWithCibValues(&metadata, ResourceID)
	if err != nil {
		return CrmResourceMetadata{}, err
	}

	return metadata, nil
}

func fetchFullCloneFromCib(CloneID string) (CrmResourceMetadata, error) {
	metadata := CrmResourceMetadata{}

	// 1. Copy the default meta_attributes, default operations and help info
	metadata.RscDefaults = GetCloneDefaults()

	// 2. Get current values of the attributes from cib.xml
	err := enrichCloneMetaAttributesWithCibValues(&metadata, CloneID)
	if err != nil {
		return CrmResourceMetadata{}, err
	}

	return metadata, nil
}

func FetchResourceMetaAttributes(w http.ResponseWriter, r *http.Request) {
	id, agent := parseIDandAgent(w, r)
	metadata, err := fetchFullPrimitiveFromCib(id, agent)
	if err != nil {
		log.Printf("Failed to get cib values: %v", err)
		http.Error(w, "Failed to get cib values: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var content SelectContent
	content.Shortdesc = metadata.Shortdesc
	content.Longdesc = metadata.Longdesc
	for _, param := range metadata.RscDefaults {
		content.Options = append(content.Options,
			SelectOption{
				param.Name,
				param.Content.Default,
				param.Shortdesc,
				param.Longdesc,
				param.Content.Type,
				param.Content.PossibleValues,
				param.Content.Required,
				param.Content.CibID,
				param.Content.CibValue,
			})
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(content); err != nil {
		log.Printf("Failed to encode data: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}

func FetchCloneMetaAttributes(w http.ResponseWriter, r *http.Request) {
	cloneID, _ := parseIDandAgent(w, r)
	// STOPPED HERE: 1. do we need the child resource, or cloneID is enough?
	metadata, err := fetchFullCloneFromCib(cloneID)
	if err != nil {
		log.Printf("Failed to get cib values: %v", err)
		http.Error(w, "Failed to get cib values: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var content SelectContent
	content.Shortdesc = metadata.Shortdesc
	content.Longdesc = metadata.Longdesc
	for _, param := range metadata.RscDefaults {
		content.Options = append(content.Options,
			SelectOption{
				param.Name,
				param.Content.Default,
				param.Shortdesc,
				param.Longdesc,
				param.Content.Type,
				param.Content.PossibleValues,
				param.Content.Required,
				param.Content.CibID,
				param.Content.CibValue,
			})
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(content); err != nil {
		log.Printf("Failed to encode data: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}

func FetchResourceOperations(w http.ResponseWriter, r *http.Request) {
	id, agent := parseIDandAgent(w, r)
	metadata, err := fetchFullPrimitiveFromCib(id, agent)
	if err != nil {
		log.Printf("Failed to get cib values: %v", err)
		http.Error(w, "Failed to get cib values: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var content OperationContent
	for _, action := range metadata.Actions {
		var nameValues []NameValue
		if action.CibID != "" {
			for _, opdef := range action.OpDefaults {
				if opdef.Content.CibValue != "" {
					nameValues = append(nameValues, NameValue{opdef.Name, opdef.Content.CibValue})
				}
			}
		}
		newOption := OperationOption{
			action.Name,
			[]NameValue{
				// action.Interval is what we parse
				// from crm_resource --show-metadata
				{"depth", action.Depth},
				{"description", action.Description},
				{"enabled", action.Enabled},
				{"interval", action.Interval},
				{"interval-origin", action.IntervalOrigin},
				{"on-fail", action.OnFail},
				{"record-pending", action.RecordPending},
				{"requires", action.Requires},
				{"role", action.Role},
				{"start-delay", action.StartDelay},
				{"timeout", action.Timeout},
			},
			action.Shortdesc, //param.Shortdesc,
			action.Longdesc,  //param.Longdesc,
			"",               //param.Content.Type,
			[]string{""},     //param.Content.PossibleValues,
			"",               //param.Content.Required,
			action.CibID,     //param.Content.CibID,
			nameValues,
		}
		content.Options = append(content.Options, newOption)
	}

	// Convert to JSON.
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(content); err != nil {
		log.Printf("Failed to fetch select data: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}
