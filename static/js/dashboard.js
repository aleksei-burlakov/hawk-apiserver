function insertAllNodesRow(tbody, clusterDetails,  nodes) {
    const trAllNodes = document.createElement("tr");

    tbody.appendChild(trAllNodes);
    trAllNodes.className = "no-top-border table-header";
    trAllNodes.id = "nodes-table-row";

    const thLeftBorder = document.createElement("th");
    trAllNodes.appendChild(thLeftBorder);
    thLeftBorder.className = "col-sm-2 no-left-border";
    thLeftBorder.colSpan = 2;

    nodes.forEach(node => {
        const thNode = document.createElement("th");
        trAllNodes.appendChild(thNode);
        thNode.className = "no-left-border";

        const spanStatusBar = document.createElement("span");
        thNode.appendChild(spanStatusBar);
        spanStatusBar.className = "status-bar status-success";

        const divNodeName = document.createElement("div");
        thNode.appendChild(divNodeName);
        divNodeName.id = `node-${node?.name}`;
        divNodeName.className = "node-name";
        divNodeName.title = `Node id: ${node?.id}`;
        divNodeName.innerText = node.name;

        const spanNodeStatus = document.createElement("span");
        divNodeName.appendChild(spanNodeStatus);
        spanNodeStatus.className = "table-cluster-name";
        spanNodeStatus.title = `Status:  ${clusterDetails?.status}
Epoch:  ${clusterDetails?.epoch}
Update Origin:  ${clusterDetails?.updateOrigin}
Update User:  ${clusterDetails?.updateUser}
Stack:  ${clusterDetails?.stack}`;
        spanNodeStatus.innerText = `${clusterDetails?.clusterName} `;

        const iInfoCircle = document.createElement("i");
        spanNodeStatus.appendChild(iInfoCircle);
        iInfoCircle.className = "fa fa-info-circle";
        iInfoCircle.ariaHidden = true;

        const spanStatus = document.createElement("span");
        thNode.appendChild(spanStatus);
        spanStatus.className = "status-icon";

        if(node?.isDC) {
            const iHome = document.createElement("i");
            spanStatus.appendChild(iHome);
            iHome.className = "fa fa-home";
            iHome.ariaHidden = true;
            iHome.title = "Designated coordinator";
            thNode.appendChild(document.createTextNode(" "));
        }

        const iEventsFound = document.createElement("i");
        thNode.appendChild(iEventsFound);
        iEventsFound.className = "fa fa-refresh text-warning";
        iEventsFound.title = node.eventsFound;
    });
}

function insertResourceRow(tbody, resource) {
    const tr = document.createElement("tr");
    tbody.appendChild(tr);

    const tdLeftBorder = document.createElement("td");
    tr.appendChild(tdLeftBorder);
    tdLeftBorder.className = "no-left-border resource-icon";
    if (resource.maintenance) {
        const spanLeftStatusIcon = document.createElement("span");
        tdLeftBorder.appendChild(spanLeftStatusIcon);
        spanLeftStatusIcon.className = "status-icon";

        const iWrench = document.createElement("i");
        spanLeftStatusIcon.appendChild(iWrench);
        iWrench.className = "fa fa-wrench";
        iWrench.ariaHidden = true;
    }

    const tdResourceName = document.createElement("td");
    tr.appendChild(tdResourceName);
    tdResourceName.className = "text-left no-left-border";
    const spanStatusBar = document.createElement("span");
    tdResourceName.appendChild(spanStatusBar);
    spanStatusBar.className = `status-bar status-${resource.maintenance ? "success" :  (resource.active ? "success" : "offline" )}`;
    const spanResourceName = document.createElement("span");
    tdResourceName.appendChild(spanResourceName);
    spanResourceName.className = "resource-name";
    spanResourceName.id = `resource-${resource.name}`;
    spanResourceName.innerText = resource.name;

    for(i = 0; i < resource.roles.length; i++) {
        const tdCircle = document.createElement("td");
        tr.appendChild(tdCircle);
        if (i == 0) {
            tdCircle.className = "no-left-border";
        }

        const tdDiv = document.createElement("div");
        tdCircle.appendChild(tdDiv);
        tdDiv.className = "node-circle";
        if (resource.roles[i] == RESOURCE_STATUS_STARTED) {
            tdDiv.classList.add("status-success");
            tdDiv.title = "Started";
        } else if (resource.roles[i] == RESOURCE_STATUS_PROMOTED) {
            tdDiv.classList.add("status-success");
            tdDiv.title = "Promoted";
            const spanPromoted = document.createElement("span");
            tdCircle.appendChild(spanPromoted);
            spanPromoted.className = "table-label promoted-unpromoted";
            const iAsterisk = document.createElement("i");
            spanPromoted.appendChild(iAsterisk);
            iAsterisk.className = "fa fa-asterisk";
        } else if (resource.roles[i] == RESOURCE_STATUS_UNPROMOTED) {
            tdDiv.classList.add("status-success");
            tdDiv.title = "Started";
        } else if (resource.roles[i] == RESOURCE_STATUS_STOPPED) {
            tdDiv.classList.add("status-danger");
        } else if (resource.roles[i] == RESOURCE_STATUS_DEFAULT){
            tdDiv.classList.add("status-default");
        } else {
            tdDiv.classList.add("status-default");
        }
    }
}

function addTab(tabsPlaceholder, clusterName, clusterStatus, isActive = false) {
    const tabID = clusterName; // FIXME: what about spaces in the name?
    const liTab = document.createElement("li");
    tabsPlaceholder.appendChild(liTab);
    if(isActive) liTab.className = "active";
    liTab.role = "presentation";

    const aTabName = document.createElement("a");
    liTab.appendChild(aTabName);
    aTabName.href = "#" + tabID;
    aTabName.role = "tab";
    aTabName.dataset.Toggle = "tab";
    aTabName.setAttribute("aria-controls", tabID);
    aTabName.textContent = `${clusterName} `;

    const iClusterStatus = document.createElement("i");
    aTabName.appendChild(iClusterStatus);
    iClusterStatus.className = getClusterStatusIconClasses(clusterStatus);
}

async function updateDashboard() {

    const tbody = document.getElementById("hacluster-tbody");
    tbody.innerHTML = "Loading, please wait...";

    const res1 = await fetch("/api/cib/cluster/dashboard/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: window.location.hostname }),
    });
    if (!res1.ok && res1.status !== 503) throw new Error(`Details error: ${res1.status}`);

    const { clusterDetails, nodes, resources } = await res1.json();

    /* Assumption:  | + Add Cluster | button doesn't work,
     * there is only one tab */

    // 1. Generate the tab
    const tabsPlaceholder = document.getElementById("dashboard-tabs-placeholder");
    tabsPlaceholder.innerHTML = "";
    addTab(tabsPlaceholder, "hacluster", CLUSTER_STATUS_ONLINE, true);
    addTab(tabsPlaceholder, "foobar", CLUSTER_STATUS_ONLINE, false);

    setClusterStatusBar("dashboard-cluster-status-alarm", clusterDetails.summary, clusterDetails.status);

    tbody.innerHTML = "";
    insertAllNodesRow(tbody, clusterDetails,  nodes);
    resources.forEach(resource => {
        insertResourceRow(tbody, resource);
    });
}

updateDashboard();  // call it once to initialize
pollClusterStatus(updateDashboard);
