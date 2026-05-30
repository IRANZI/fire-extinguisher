import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import { api, getErrorMessage } from "../lib/api";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const storedUser = localStorage.getItem("safehub_user");
const initialState: AuthState = {
  user: storedUser ? (JSON.parse(storedUser) as User) : null,
  token: localStorage.getItem("safehub_token"),
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", credentials);
      return data as { user: User; token: string };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const signup = createAsyncThunk(
  "auth/signup",
  async (input: { name: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/signup", input);
      return data as { user: User; token: string };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem("safehub_token");
      localStorage.removeItem("safehub_user");
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        isAnyOf(login.pending, signup.pending),
        (state) => {
          state.loading = true;
          state.error = null;
        },
      )
      .addMatcher(
        isAnyOf(login.fulfilled, signup.fulfilled),
        (state, action) => {
          state.loading = false;
          state.user = action.payload.user;
          state.token = action.payload.token;
          localStorage.setItem("safehub_token", action.payload.token);
          localStorage.setItem("safehub_user", JSON.stringify(action.payload.user));
        },
      )
      .addMatcher(
        isAnyOf(login.rejected, signup.rejected),
        (state, action) => {
          state.loading = false;
          state.error = String(action.payload ?? "Authentication failed");
        },
      );
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
