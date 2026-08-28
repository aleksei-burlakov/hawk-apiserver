class AddClusterPopup extends Popup {
    #resourceID;
    #hostName;
    #Add;

    constructor() {
        super();

        this.#resourceID = "foobar";

        const header = document.createElement("div");
        header.className = "modal-header";

        const closeBtn = document.createElement("button");
        closeBtn.className = "close";
        closeBtn.type = "button";
        closeBtn.innerHTML = `<span aria-hidden="true">&times;</span><span class="sr-only">Close</span>`;
        closeBtn.onclick = () => this.close();
        header.appendChild(closeBtn);

        const title = document.createElement("h3");
        title.className = "modal-title";
        title.innerHTML = `<i class="fas fa-server page"></i> Add Cluster`;
        header.appendChild(title);
        this._appendModalContentChild(header);

        // Body
        const modalBody = document.createElement("div");
        modalBody.className = "modal-body";

        const externalWrapOldName = document.createElement("div");
        externalWrapOldName.className = "kvsection-row";

        const externalWrapNewName = document.createElement("div");
        externalWrapNewName.className = "kvsection-row";

        const externalWrapPort = document.createElement("div");
        externalWrapPort.className = "kvsection-row";

        const clusterName = new Input(externalWrapOldName, null, "Cluster name",
            "", true, "", "","Web Coast (example)", false);
        this.#hostName = new Input(externalWrapNewName, null, "Hostname of node in cluster",
            "", true, "", "", "node1.west.example.com", false);
        const port = new Input(externalWrapPort, null, "Server port to connect to",
            "", true, "", "", "7630", false);

        modalBody.append(externalWrapOldName, externalWrapNewName, externalWrapPort);
        this._appendModalContentChild(modalBody);

        // Footer
        const footer = document.createElement("div");
        footer.className = "modal-footer";

        this.#Add = document.createElement("button");
        this.#Add.className = "btn btn-primary";
        this.#Add.innerText = "Add";
        this.#Add.onclick = () => this.#handleRename();
        this.#Add.type = "submit"; // to be able to find by selenium test

        footer.appendChild(this.#Add);
        this._appendModalContentChild(footer);

        // Focus this.#newID after the popup drawn
        requestAnimationFrame(() => this.#hostName.getHTML().focus());

        // submit on Enter
        externalWrapNewName.addEventListener("keydown",
            e => {
                if (e.key === "Enter")
                    this.#handleRename();
            }
        );
    }

    // to enable both primitives and clones
    /*
    #editPageURL(resourceID) {
        const url = new URL(window.location.href);
        const parts = url.pathname.split("/");

        // /cib/live/{primitives|clones}/{resource-id}/edit
        parts[4] = encodeURIComponent(resourceID);
        url.pathname = parts.join("/");
        url.search = "";

        return url;
    }
    */

    #handleRename() {
        alert("Hello World");
        /*
        const oldID = this.#resourceID;
        const newID = (this.#hostName.getFrontendValue() || "").trim();

        if (!newID) { alert("New ID can't be empty."); return; }
        if (newID === oldID) { alert("New ID must be different from the current ID."); return; }

        this.#okBtn.disabled = true;

        fetch('/api/cib/resource/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldID, newID })
        })
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Unknown error");
                }
                return res.json();
            })
            .then(() => {
                const url = this.#editPageURL(newID);
                url.searchParams.set("flash", "renamed");
                window.location.assign(url);
            })
            .catch(err => {
                console.error("Rename failed:", err);
                const msg = `Failed to rename ${oldID} -> ${newID}: ${err.message}`;

                const url = this.#editPageURL(oldID);
                url.searchParams.set("flash", "error");
                url.searchParams.set("msg", msg);
                window.location.assign(url);
            });
        */
        this.close();
    }

    close() {
        super.close();
    }
}
