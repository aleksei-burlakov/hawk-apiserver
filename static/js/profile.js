class ProfileRevertPopup extends Popup {
    constructor(onConfirm) {
        super();
        const body = document.createElement("div");
        body.className = "modal-body text-center";
        body.textContent = "Any changes will be lost - do you wish to proceed?";
        const footer = document.createElement("div");
        footer.className = "modal-footer";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-default cancel";
        cancel.textContent = "Cancel";
        cancel.onclick = () => this.close();
        const ok = document.createElement("button");
        ok.type = "button";
        ok.className = "btn btn-primary commit";
        ok.textContent = "OK";
        ok.onclick = () => { this.close(); onConfirm(); };
        footer.append(cancel, ok);
        this._appendModalContentChild(body);
        this._appendModalContentChild(footer);
    }
}

const profileForm = document.getElementById("edit_profile");
profileForm.querySelector('[name="revert"]').addEventListener("click", event => {
    event.preventDefault();
    new ProfileRevertPopup(() => { window.location.href = "/cib/live/profile/edit"; });
});
const profileURL = new URL(window.location.href);
if (profileURL.searchParams.has("updated")) {
    profileURL.searchParams.delete("updated");
    history.replaceState({}, "", profileURL);
}

const advancedOptionsToggle = document.getElementById("profile_advanced_options");

async function saveAdvancedOptions(enabled) {
    advancedOptionsToggle.disabled = true;
    try {
        const response = await fetch("/api/profile/advanced-options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled }),
        });
        if (!response.ok) throw new Error(await response.text() || "Unable to save advanced options.");
        const result = await response.json();
        showProfileNotification(result.message);
    } catch (error) {
        showProfileNotification(error.message, "danger");
    } finally {
        advancedOptionsToggle.checked = advancedOptionsEnabled();
        advancedOptionsToggle.disabled = false;
        updateAdvancedOptionsMenu();
    }
}

function showProfileNotification(message, type = "success") {
    const alert = document.createElement("x-alert");
    alert.setAttribute("type", type);
    alert.setAttribute("message", message);
    alert.setAttribute("visible", "true");
    document.getElementById("profile-notifications").replaceChildren(alert);
}

advancedOptionsToggle.addEventListener("change", () => {
    const enabled = advancedOptionsToggle.checked;
    // Keep the saved state until the user confirms and the request succeeds.
    advancedOptionsToggle.checked = advancedOptionsEnabled();
    if (enabled) {
        new ConfirmActionPopup(null, null,
            "Are you sure you want to enable advanced options, special permissions are required?",
            null, () => saveAdvancedOptions(true));
    } else {
        saveAdvancedOptions(false);
    }
});
