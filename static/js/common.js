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
