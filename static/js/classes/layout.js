async function updateClusterStatusIndicator() {

  const statusRes = await fetch("/api/cib/cluster/details/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host: window.location.hostname }),
  });

  if (!statusRes.ok) throw new Error(`Details error: ${statusRes.status}`);
  const data = await statusRes.json();

  const summary = data.summary;
  const status = data.status;

  const circle = document.getElementById("cluster-status-indicator");
  if (!circle) return;

  const icon = circle.querySelector("i");

  // Update tooltip content
  circle.setAttribute("title", summary);
  circle.setAttribute("data-original-title", summary);
  $(circle).tooltip("fixTitle");

  switch(status) {
      case CLUSTER_STATUS_ONLINE:
          icon.className = "fas fa-check text-success";
          circle.style.backgroundColor = "#28a745";
          break;
      case CLUSTER_STATUS_UNCLEAN:
      case CLUSTER_STATUS_NOFENCING:
          icon.className = "fas fa-exclamation text-warning";
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

updateClusterStatusIndicator(); // call it once to initialize
pollClusterStatus(updateClusterStatusIndicator);
