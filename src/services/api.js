/**
 * ERM Web — API service module
 *
 * Mirror of the mobile app's services/api.ts. Same endpoints, same
 * request shapes, same response shapes — so a request submitted from
 * the web lands in the SAME `employees` / `attendance` / `leaves` /
 * `allowances` collections in MongoDB and HRMS reads it via its
 * existing proxy without any further changes.
 *
 * Auth header
 * ────────────
 * The AuthContext installs a global window.fetch interceptor that
 * attaches `Authorization: Bearer <jwt>` to every outgoing request,
 * so we don't have to handle it here.
 */
import { API } from '../config/api';

// ─── Cold-start aware fetch helper ───────────────────────────────────
// Render free tier sleeps after 15 min idle and takes ~30-60s to wake.
// First request retries automatically with a longer timeout.
async function request(method, path, { body, params, timeoutMs = 60000 } = {}) {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      ).toString()
    : '';
  const url = `${API}${path}${qs}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const err = new Error(data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return { data, status: res.status };
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Server is taking too long to respond. The backend may be cold-starting on Render — wait 30 seconds and try again.');
      err.code = 'TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const get   = (p, params)        => request('GET',    p, { params });
const post  = (p, body)          => request('POST',   p, { body });
const put   = (p, body)          => request('PUT',    p, { body });
const patch = (p, body)          => request('PATCH',  p, { body });
const del   = (p)                => request('DELETE', p);

// Fire-and-forget warmup so first real call doesn't time out.
export const wakeBackend = () => get('/health').catch(() => {});
export const pingBackend = () => get('/health');

// ─── Auth ────────────────────────────────────────────────────────────
// AuthContext already wraps these for login/forgot/reset, but expose
// them here too for parity with the mobile API surface.
export const authAPI = {
  login:          (userId, password)          => post('/auth/login', { userId, password }),
  sendOtp:        (email)                     => post('/auth/send-otp', { email }),
  verifyOtp:      (email, otp)                => post('/auth/verify-otp', { email, otp }),
  resetPassword:  (resetToken, newPassword)   => post('/auth/reset-password', { resetToken, newPassword }),
  changePassword: (oldPassword, newPassword)  => post('/auth/change-password', { oldPassword, newPassword }),
};

// ─── Attendance ──────────────────────────────────────────────────────
export const attendanceAPI = {
  checkIn:  (location = 'office', coords = {}) =>
    post('/attendance/checkin', { location, lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy }),
  checkOut: (coords = {}) =>
    post('/attendance/checkout', { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy }),
  autoCheckOut:  (reason) => post('/attendance/auto-checkout', { reason: reason || 'gps-off' }),
  locationPing:  (lat, lng, accuracy, speed) => post('/attendance/location-ping', { lat, lng, accuracy, speed }),
  setPresence:   (state)               => post('/attendance/presence', { state }),
  today:         ()                    => get('/attendance/today'),
  getMonthly:    (month, year)         => get('/attendance/monthly',  { month, year }),
  getCalendar:   (month, year)         => get('/attendance/calendar', { month, year }),
  getSummary:    (month, year)         => get('/attendance/summary',  { month, year }),
  getHistory:    (month, year)         => get('/attendance/history',  { month, year }),
  createRequest: (data)                => post('/attendance/request', data),
  listRequests:  ()                    => get('/attendance/requests'),
};

// ─── Leave + Permission ──────────────────────────────────────────────
// Anything submitted here lands in the shared `leaves` collection,
// which HRMS reads via its /api/leave-requests proxy. So a request
// filed on the web immediately appears on the HRMS Leave Approvals
// page for HR to act on.
export const leaveAPI = {
  applyLeave: (data) => post('/leave/apply', data),
  // data: { leaveType, startDate, endDate, isHalfDay, reason }
  applyPermission: (data) => post('/leave/permission', data),
  // data: { permissionType, date, startTime, endTime, reason }
  getMyLeaves: ({ month, year, type } = {}) => get('/leave/me', { month, year, type }),
  cancelLeave: (id) => del(`/leave/${id}`),
  getLeaveTypes:      () => get('/leave/types'),
  getPermissionTypes: () => get('/leave/permission-types'),
  getBalance:         () => get('/leave/balance'),
};

// ─── Allowance (travel + petrol) ─────────────────────────────────────
// Submitted via web → lands in `allowances` collection → HRMS
// Allowance Approvals page picks it up through the existing proxy.
export const allowanceAPI = {
  submit: (data) => post('/allowance/submit', data),
  // data: { type, fromLocation, toLocation, date, amount, distance?, notes?, purpose?, transport? }
  getMyAllowances: ({ month, year, type } = {}) => get('/allowance/my', { month, year, type }),
  getSummary: ({ month, year, type } = {}) => get('/allowance/summary', { month, year, type }),
  cancel:  (id) => del(`/allowance/${id}`),
  getById: (id) => get(`/allowance/${id}`),
};

// ─── Profile ─────────────────────────────────────────────────────────
export const profileAPI = {
  getProfile:    ()      => get('/profile'),
  updateProfile: (data)  => put('/profile/update', data),
};

// ─── Payslip ─────────────────────────────────────────────────────────
export const payslipAPI = {
  getLatest:  ()           => get('/payslip/latest'),
  getHistory: (year)       => get('/payslip/history', { year }),
  getById:    (id)         => get(`/payslip/${id}`),
  request:    (month, year)=> post('/payslip/request', { month, year }),
};

// ─── Complaint (employee → HRMS) ─────────────────────────────────────
// Lands in `complaints` collection → HRMS ComplainRegister page picks
// it up via /api/complaints proxy. No special wiring needed for the
// "request goes to HRMS" requirement — the unified DB handles it.
export const complaintAPI = {
  list:   ()      => get('/complaint'),
  getOne: (id)    => get(`/complaint/${id}`),
  create: (data)  => post('/complaint', data),
  // data: { subject, priority?, description? }
};

// ─── Announcement ────────────────────────────────────────────────────
export const announcementAPI = {
  list:    (limit = 20) => get('/announcement', { limit }),
  getById: (id)         => get(`/announcement/${id}`),
};

// ─── Notification ────────────────────────────────────────────────────
export const notificationAPI = {
  list: ({ limit, onlyUnread } = {}) => get('/notification', { limit, onlyUnread }),
  unreadCount: ()    => get('/notification/unread-count'),
  getById:     (id)  => get(`/notification/${id}`),
  markAsRead:  (id)  => patch(`/notification/${id}/read`),
  markAllRead: ()    => patch('/notification/read-all'),
  remove:      (id)  => del(`/notification/${id}`),
};

export default {
  authAPI, attendanceAPI, leaveAPI, allowanceAPI,
  profileAPI, payslipAPI, complaintAPI,
  announcementAPI, notificationAPI,
};

// ─── Manager (team-scoped — only the signed-in user's subordinates) ──
// Backed by /api/manager/* on the ERM Web backend. The backend resolves
// "my team" via the `assignedTo` field on User records — any subordinate
// where assignedTo matches the manager's name is included automatically.
export const managerAPI = {
  team:          ()      => get('/manager/team'),
  leaves:        (params)=> get('/manager/leaves', params),
  allowances:    (params)=> get('/manager/allowances', params),
  actLeave:      (id, managerStatus) => patch(`/manager/leaves/${id}`,     { managerStatus }),
  actAllowance:  (id, managerStatus) => patch(`/manager/allowances/${id}`, { managerStatus }),
  attendance:    (date)  => get('/manager/attendance', { date }),
  attendanceSummary: ({ month, year } = {}) => get('/manager/attendance-summary', { month, year }),
  liveLocations: ()      => get('/manager/live-locations'),
};
