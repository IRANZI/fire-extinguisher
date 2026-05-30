import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./store/authSlice";
import inventoryReducer from "./store/inventorySlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    inventory: inventoryReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

