import {
  refreshStaleProfileCostSnapshots,
  refreshStaleProfilePresets,
} from "./profiles.mjs?v=20260903-async-cache";

self.addEventListener("message", (event) => {
  const profiles = Array.isArray(event.data?.profiles) ? event.data.profiles : [];
  const profilePresets = Array.isArray(event.data?.profilePresets)
    ? event.data.profilePresets
    : [];

  self.postMessage({
    profiles: refreshStaleProfileCostSnapshots(profiles),
    profilePresets: refreshStaleProfilePresets(profilePresets),
  });
});
