/* This const is a glue code. The thing is that e.g. the {{ .ResourceID }}
 * is not processed by Go if it's outside in the partial template.
 */
const { ResourceID, ResourceAgent } = window.resourceData;

console.log("clone_edit.js loaded");

// remove the ?flash=...
// #TODO: later, when there is only Go and no RoR it's better to stop using ?flash
const url = new URL(window.location.href);
if (url.searchParams.has("flash")) {
    url.searchParams.delete("flash");
    url.searchParams.delete("msg");
    history.replaceState({}, "", url);
}

function clickApplyCreateButton(applyButton) {
    const isCreateMode = applyButton.textContent === "Create";

     // sanity check
    if (isCreateMode) {
        const cloneNameInput = document.getElementById("input-clone-id");
        const cloneName = (cloneNameInput?.value || "").trim();

        if (!cloneName) {
            showFlash("danger", "Please enter a Clone ID before creating a clone.");
            return;
        }

        const childResourceXSelect = document.getElementById("child-resource-xselect");
        const childResourceName = (childResourceXSelect?.value || "").trim();

        if (!childResourceName) {
            showFlash("danger", "Please select a resource agent Type before creating a primitive.");
            return;
        }
    }

    const metaAttributes = document.getElementById("kvgroup-meta_attributes");
    const result = metaAttributes.submitSanityCheck();
    if (!result.ok) {
        showFlash("danger", result.message);
        return;
    }

    if (isCreateMode == false) {
        metaAttributes.submit().then(() => {
            const url = new URL(window.location.href);
            url.searchParams.set("flash", "updated");
            // wait 1 sec and update the page.
            setTimeout(() => {
                window.location.href = url.toString();
            }, 1000);
        })
        .catch(err => {
            console.error("Apply failed:", err);
            showFlash("danger", `There was a problem updating the clone:\n${err.message}`);
        });
        return;
    }

    const clone = new Clone(
        document.getElementById("input-clone-id"),
        document.getElementById("child-resource-xselect"),
        metaAttributes
    );

    clone.create();
}

function toggleUpdateCreateMode(createMode) {
    const resourceIdInput = document.getElementById('input-clone-id');
    const applyButton = document.getElementById('apply-create-button');
    const childResourceXSelect = document.getElementById("child-resource-xselect");
    const copyRenameDeleteContainer = document.getElementById("copy-rename-delete-container");

    if (createMode) {
        resourceIdInput.value = "";
        resourceIdInput.readOnly = false;
        applyButton.textContent = "Create";

        if (copyRenameDeleteContainer) {
            copyRenameDeleteContainer.style.display = "none";
        }

        childResourceXSelect.enableEdit();
        updateCreateButtonState();
    } else {
        resourceIdInput.readOnly = true;
        applyButton.textContent = "Apply";
        applyButton.disabled = false; // unnecessary, but to be sure
        applyButton.classList.add("btn-success");

        childResourceXSelect.disableEdit();
    }
}

function updateCreateButtonState() {
    const btn = document.getElementById('apply-create-button');
    if (btn.textContent !== "Create") return;

    btn.classList.toggle("btn-success", true);
}

// TODO: showFlash is too dirty. Remove it later.
// Use the XAlert directly w/o recreating.
function showFlash(type, message) {
    // reuse existing alert if present, otherwise create one at top of .edit-left
    let alertEl = document.querySelector(".edit-left x-alert[data-flash='js']");
    if (!alertEl) {
        alertEl = document.createElement("x-alert");
        alertEl.dataset.flash = "js";

        const left = document.querySelector(".edit-left");
        if (left) left.prepend(alertEl);
    }

    // Why replace? XAlert renders in connectedCallback()
    // and doesn’t watch attribute changes (#TODO, maybe)
    const newAlert = document.createElement("x-alert");
    newAlert.dataset.flash = "js";
    newAlert.setAttribute("type", type);
    newAlert.setAttribute("message", message);
    newAlert.setAttribute("visible", "true");

    alertEl.replaceWith(newAlert);

    console.trace("showFlash called");
}

const fieldShortdesc = document.getElementById('field-shortdesc');
const fieldLongdesc = document.getElementById('field-longdesc');

/* custom elements x-select and x-operations-kvgroup
 * already have their own listeners.
 * input-clone-id is only left w/o it's own listener. */
const input = document.getElementById("input-clone-id");
input.addEventListener("mouseenter", () => {
    fieldShortdesc.textContent = "Resource ID";
    fieldLongdesc.textContent = "Unique identifier for the resource. May not contain spaces.";
});
