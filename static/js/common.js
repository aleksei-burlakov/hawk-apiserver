async function pollClusterStatus(callback) {
    while (true) {
        try {
            const lastEpoch = sessionStorage.getItem("cibEpoch") || "";
            const res = await fetch(`/monitor?${lastEpoch}`);
            if (!res.ok) throw new Error(`Monitor error: ${res.status}`);
            const { epoch: currentEpoch } = await res.json();

            sessionStorage.setItem("cibEpoch", currentEpoch);
            await callback();
        } catch (err) {
            console.error("[Cluster Status Poll] Failed:", err);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function setClusterStatusBar(divID, summary, status) {
    const statusLabel = document.getElementById(divID);
    if (statusLabel) {
        const link = statusLabel.querySelector("a");
        link.textContent = summary;
        statusLabel.className = "hidden";
        link.className = "";

        switch (status) {
            case CLUSTER_STATUS_ONLINE:
                break;
            case CLUSTER_STATUS_UNCLEAN:
            case CLUSTER_STATUS_NOFENCING:
                statusLabel.className = "alert alert-warning";
                break;
            case CLUSTER_STATUS_NOQUORUM:
                statusLabel.className = "alert alert-danger";
                break;
            case CLUSTER_STATUS_OFFLINE:
                statusLabel.className = "alert alert-danger";
                break;
            default:
            // pass
        }
    }
}

function setClusterStatusIndicator(summary, status) {
    const circle = document.getElementById("cluster-status-indicator");
    if (!circle) return;

    const icon = circle.querySelector("i");

    // Update tooltip content
    circle.setAttribute("title", summary);
    circle.setAttribute("data-original-title", summary);
    $(circle).tooltip("fixTitle");

    switch (status) {
        case CLUSTER_STATUS_ONLINE:
            icon.className = "fas fa-check text-success";
            circle.style.backgroundColor = "#28a745";
            break;
        case CLUSTER_STATUS_UNCLEAN:
            icon.className = "fas fa-exclamation text-warning";
            circle.style.backgroundColor = "#ffc107";
            break;
        case CLUSTER_STATUS_NOFENCING:
            icon.className = "fas fa-plug text-warning";
            circle.style.backgroundColor = "#ffc107";
            break;
        case CLUSTER_STATUS_MAINTENANCE:
            icon.className = "fas fa-wrench text-warning";
            circle.style.backgroundColor = "#ffc107";
            break;
        case CLUSTER_STATUS_NOQUORUM:
        case CLUSTER_STATUS_OFFLINE:
            icon.className = "fas fa-times text-danger";
            circle.style.backgroundColor = "#dc3545";
            break;
        default:
            link.classList.add("hidden");
    }
}

function getClusterStatusIconClasses(status) {
    switch (status) {
        case CLUSTER_STATUS_ONLINE:
            return "fas fa-circle fa-sm text-success";
        case CLUSTER_STATUS_NOFENCING:
            return "fas fa-plug";
        case CLUSTER_STATUS_MAINTENANCE:
            return "fas fa-wrench";
        case CLUSTER_STATUS_UNCLEAN:
        case CLUSTER_STATUS_NOQUORUM:
        case CLUSTER_STATUS_OFFLINE:
            return "fas fa-exclamation-triangle";
    }
    return "";
}
