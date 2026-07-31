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

function clickApplyButton() {
    const metaAttributes = document.getElementById("kvgroup-meta_attributes");
    const result = metaAttributes.submitSanityCheck();
    if (!result.ok) {
        showFlash("danger", result.message);
        return;
    }

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
 * input-clone-id and input-child-resource are only left w/o it's own listener. */
document.getElementById("input-clone-id")?.addEventListener("mouseenter", () => {
    fieldShortdesc.textContent = "Clone ID";
    fieldLongdesc.textContent = "Unique identifier for the clone resource. May not contain spaces.";
});

document.getElementById("input-child-resource")?.addEventListener("mouseenter", () => {
    fieldShortdesc.textContent = "Child Resource";
    fieldLongdesc.textContent = "Child resource to use as clone.";
});
