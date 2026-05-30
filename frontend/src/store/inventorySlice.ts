import { createAsyncThunk, createSlice, isFulfilled, isPending, isRejected } from "@reduxjs/toolkit";
import { api, getErrorMessage } from "../lib/api";
import type {
  AppNotification,
  AuditLog,
  Customer,
  Extinguisher,
  Pagination,
  PoliceReport,
  Summary,
} from "../types";

interface PageResult<T> {
  records: T[];
  pagination: Pagination;
}

interface InventoryState {
  summary: Summary | null;
  customers: PageResult<Customer>;
  extinguishers: PageResult<Extinguisher>;
  notifications: PageResult<AppNotification>;
  reports: PageResult<PoliceReport>;
  logs: PageResult<AuditLog>;
  loading: boolean;
  error: string | null;
  notice: string | null;
}

const emptyPage = <T>(): PageResult<T> => ({
  records: [],
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
});

const initialState: InventoryState = {
  summary: null,
  customers: emptyPage(),
  extinguishers: emptyPage(),
  notifications: emptyPage(),
  reports: emptyPage(),
  logs: emptyPage(),
  loading: false,
  error: null,
  notice: null,
};

export const fetchSummary = createAsyncThunk<Summary, void, { rejectValue: string }>("inventory/summary", async (_, { rejectWithValue }) => {
  try {
    return (await api.get("/inventory/reports/summary")).data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchCustomers = createAsyncThunk<PageResult<Customer>, { page?: number; search?: string } | undefined, { rejectValue: string }>(
  "inventory/customers",
  async (params: { page?: number; search?: string } = {}, { rejectWithValue }) => {
    try {
      return (await api.get("/inventory/customers", { params })).data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchExtinguishers = createAsyncThunk<PageResult<Extinguisher>, { page?: number; search?: string; status?: string } | undefined, { rejectValue: string }>(
  "inventory/extinguishers",
  async (params: { page?: number; search?: string; status?: string } = {}, { rejectWithValue }) => {
    try {
      return (await api.get("/inventory/extinguishers", { params })).data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchNotifications = createAsyncThunk<PageResult<AppNotification>, number | undefined, { rejectValue: string }>(
  "inventory/notifications",
  async (page = 1, { rejectWithValue }) => {
    try {
      return (await api.get("/inventory/notifications", { params: { page } })).data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchReports = createAsyncThunk<PageResult<PoliceReport>, number | undefined, { rejectValue: string }>("inventory/reports", async (page = 1, { rejectWithValue }) => {
  try {
    return (await api.get("/inventory/reports/police", { params: { page } })).data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchLogs = createAsyncThunk<PageResult<AuditLog>, number | undefined, { rejectValue: string }>("inventory/logs", async (page = 1, { rejectWithValue }) => {
  try {
    return (await api.get("/inventory/logs", { params: { page } })).data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const markNotificationRead = createAsyncThunk<string, string, { rejectValue: string }>("inventory/read", async (id, { rejectWithValue }) => {
  try {
    await api.patch(`/inventory/notifications/${id}/read`);
    return id;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const runExpiryScan = createAsyncThunk<Record<string, number>, void, { rejectValue: string }>("inventory/scan", async (_, { rejectWithValue }) => {
  try {
    return (await api.post("/notification/notifications/scan")).data.summary;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const inventorySlice = createSlice({
  name: "inventory",
  initialState,
  reducers: {
    clearFeedback: (state) => {
      state.error = null;
      state.notice = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSummary.fulfilled, (state, action) => {
        state.summary = action.payload as Summary;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.customers = action.payload;
      })
      .addCase(fetchExtinguishers.fulfilled, (state, action) => {
        state.extinguishers = action.payload;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reports = action.payload;
      })
      .addCase(fetchLogs.fulfilled, (state, action) => {
        state.logs = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const record = state.notifications.records.find((item) => item.id === action.payload);
        if (record) record.is_read = true;
      })
      .addCase(runExpiryScan.fulfilled, (state, action) => {
        state.notice = `Expiry scan complete: ${action.payload.emails ?? 0} email alert(s) processed.`;
      })
      .addMatcher(
        isPending(fetchSummary, fetchCustomers, fetchExtinguishers, fetchNotifications, fetchReports, fetchLogs, markNotificationRead, runExpiryScan),
        (state) => {
          state.loading = true;
          state.error = null;
          state.notice = null;
        },
      )
      .addMatcher(
        isFulfilled(fetchSummary, fetchCustomers, fetchExtinguishers, fetchNotifications, fetchReports, fetchLogs, markNotificationRead, runExpiryScan),
        (state) => {
          state.loading = false;
        },
      )
      .addMatcher(
        isRejected(fetchSummary, fetchCustomers, fetchExtinguishers, fetchNotifications, fetchReports, fetchLogs, markNotificationRead, runExpiryScan),
        (state, action) => {
          state.loading = false;
          state.error = String(action.payload ?? action.error.message ?? "The request could not be completed");
        },
      );
  },
});

export const { clearFeedback } = inventorySlice.actions;
export default inventorySlice.reducer;
