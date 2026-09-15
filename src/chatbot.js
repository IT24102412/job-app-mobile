import api from "./api/client";
import { getCurrentUserRole } from "./api/auth";

async function getMyJobs() {
  const response = await api.get("/jobs/");
  return response.data;
}

async function getMyNotifications() {
  try {
    const response = await api.get("/notifications/me");
    return response.data;
  } catch {
    return [];
  }
}

async function getMonthlyReport() {
  const now = new Date();
  const response = await api.get("/reports/monthly", {
    params: { year: now.getFullYear(), month: now.getMonth() + 1 },
  });
  return response.data;
}

async function tryLocalResponse(message, role) {
  const text = message.toLowerCase().trim();

  if (/^(hi|hey|hello|hai)\b/.test(text)) {
    return "Hey! I can help with things like your job list, notifications, reports, how to use the app, or any generator/technical question you have. What do you need?";
  }

  if (text.includes("report") && (text.includes("month") || text.includes("this month"))) {
    if (role !== "admin") return "Only an admin can view monthly reports.";
    try {
      const report = await getMonthlyReport();
      return `This month: ${report.total_jobs} total job(s). Tap the chart icon at the top of your Job List to see the full breakdown.`;
    } catch {
      return null;
    }
  }

  if (text.includes("my job") || text.includes("how many job")) {
    const jobs = await getMyJobs();
    if (jobs.length === 0) return "You don't have any jobs right now.";
    const byStatus = {};
    jobs.forEach((j) => {
      byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    });
    const summary = Object.entries(byStatus)
      .map(([status, count]) => `${count} ${status}`)
      .join(", ");
    return `You have ${jobs.length} job(s) total: ${summary}.`;
  }

  if (text.includes("pending") || text.includes("not started")) {
    const jobs = await getMyJobs();
    const pending = jobs.filter((j) => j.status === "created" || j.status === "assigned");
    return pending.length === 0
      ? "No pending jobs right now."
      : `You have ${pending.length} pending job(s): ${pending.map((j) => j.job_number).join(", ")}.`;
  }

  if (text.includes("notification")) {
    const notifications = await getMyNotifications();
    const unread = notifications.filter((n) => !n.is_read).length;
    return unread === 0
      ? "You have no unread notifications."
      : `You have ${unread} unread notification(s). Tap the bell icon to view them.`;
  }

  if (text.includes("start") && text.includes("job") && text.includes("how")) {
    return 'To start a job: open it from your Job List, then tap "Start Job" — this only works once it has been assigned to you.';
  }

  if ((text.includes("upload") || text.includes("job sheet")) && text.includes("how")) {
    return 'Open the job, tap "Upload Job Sheet (PDF)", then pick the completed PDF from your phone. The job will close automatically after upload.';
  }

  if (text.includes("assign") && text.includes("how")) {
    if (role !== "admin") return "Only an admin can assign technicians to a job.";
    return 'Open the job (while it\'s still "created"), tap "Assign Technician", and pick from the recommended list.';
  }

  if (text.includes("create") && text.includes("job") && text.includes("how")) {
    if (role === "technician") return "Only a sales executive or admin can create new jobs.";
    return 'Tap the "+" icon at the top of your Job List, fill in the details, and tap "Create Job".';
  }

  if (text.includes("logout") || text.includes("log out")) {
    return 'Tap "Logout" at the top of your Job List screen.';
  }

  if (text.includes("who am i") || text.includes("my role")) {
    return `You're logged in as a ${role || "user"}.`;
  }

  return null; // no local match — fall through to real AI
}

export async function getBotResponse(message) {
  const role = await getCurrentUserRole();

  try {
    const localAnswer = await tryLocalResponse(message, role);
    if (localAnswer) return localAnswer;
  } catch (error) {
    console.log("Local response check failed:", error.message);
  }

  // Fall back to the real AI assistant for anything else
  try {
    const response = await api.post("/chatbot/ask", { message });
    return response.data.reply;
  } catch (error) {
    console.log("AI assistant failed:", error.message);
    return "Sorry, I couldn't get an answer right now. Please try again in a moment.";
  }
}