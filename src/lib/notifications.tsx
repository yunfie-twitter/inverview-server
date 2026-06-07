import type { ToastIntent } from "@fluentui/react-components";
import { Toast, ToastTitle } from "@fluentui/react-components";

export const APP_TOASTER_ID = "app-toaster";

type DispatchToast = (message: string, intent: ToastIntent) => void;

let dispatchRef: DispatchToast | null = null;

export const registerToastDispatcher = (dispatch: DispatchToast): void => {
  dispatchRef = dispatch;
};

export const unregisterToastDispatcher = (): void => {
  dispatchRef = null;
};

const notify = (message: string, intent: ToastIntent): void => {
  if (!dispatchRef) return;
  dispatchRef(message, intent);
};

export const makeToastContent = (message: string): JSX.Element => (
  <Toast>
    <ToastTitle>{message}</ToastTitle>
  </Toast>
);

export const notifySuccess = (message: string): void => notify(message, "success");
export const notifyError = (message: string): void => notify(message, "error");
export const notifyInfo = (message: string): void => notify(message, "info");
