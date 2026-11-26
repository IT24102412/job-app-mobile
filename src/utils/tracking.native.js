// Shares the phone's location with the office while a job is in progress.
// The server decides when tracking should be on (see /tracking/status), so this
// starts and stops itself and never tracks when no job is in progress.
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import api from "../api/client";

const TASK_NAME = "job-location-sharing";

// Runs in the background, even when the screen is off
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error || !data || !data.locations || data.locations.length === 0) return;
  const loc = data.locations[data.locations.length - 1];
  try {
    const res = await api.post("/tracking/ping", {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    });
    // Server says there is no job in progress any more: stop sharing
    if (res.data && res.data.active === false) {
      await stopTracking();
    }
  } catch (e) {
    // No signal or server asleep: try again at the next update
  }
});

async function isRunning() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  } catch (e) {
    return false;
  }
}

async function startTracking() {
  if (await isRunning()) return true;

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  // "Allow all the time" lets sharing continue when the app is closed; not required to start
  try {
    await Location.requestBackgroundPermissionsAsync();
  } catch (e) {}

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60000, // about once a minute
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Job Tracker",
      notificationBody: "Sharing your location with the office while a job is in progress.",
      notificationColor: "#4338CA",
    },
  });
  return true;
}

export async function stopTracking() {
  if (await isRunning()) {
    try {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    } catch (e) {}
  }
  return false;
}

// Ask the server whether a job is in progress for this person, then start or stop sharing
export async function syncTracking() {
  try {
    const res = await api.get("/tracking/status");
    if (res.data && res.data.active) {
      return await startTracking();
    }
    return await stopTracking();
  } catch (e) {
    return false;
  }
}
