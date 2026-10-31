function showResourceHelp(type) {
    document.querySelectorAll(".resource-type-help").forEach(section => {
        section.hidden = section.id !== `help-${type}`;
    });
}

const resourceTypeLinks = document.querySelectorAll("[data-resource-type]");
resourceTypeLinks.forEach(link => {
    link.addEventListener("mouseenter", () => showResourceHelp(link.dataset.resourceType));
    link.addEventListener("focus", () => showResourceHelp(link.dataset.resourceType));
});
if (resourceTypeLinks.length) showResourceHelp(resourceTypeLinks[0].dataset.resourceType);

document.getElementById("monitoringMenu").classList.remove("in");
document.getElementById("configurationMenu").classList.add("in");
document.querySelector('a[href="/cib/live/resources/types"]').setAttribute("aria-current", "page");
