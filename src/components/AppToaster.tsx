import { useEffect } from "react";
import { Toaster, useToastController } from "@fluentui/react-components";
import {
  APP_TOASTER_ID,
  makeToastContent,
  notifyError,
  notifySuccess,
  registerToastDispatcher,
  unregisterToastDispatcher,
} from "../lib/notifications";
import i18n from "../i18n";

export const AppToaster = (): JSX.Element => {
  const { dispatchToast } = useToastController(APP_TOASTER_ID);

  useEffect(() => {
    registerToastDispatcher((message, intent) => {
      dispatchToast(makeToastContent(message), { intent });
    });

    return () => {
      unregisterToastDispatcher();
    };
  }, [dispatchToast]);

  useEffect(() => {
    const onOffline = (): void => notifyError(i18n.t("toaster.offline"));
    const onOnline = (): void => notifySuccess(i18n.t("toaster.online"));

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return (
    <Toaster
      toasterId={APP_TOASTER_ID}
      position="top-end"
      limit={3}
      timeout={3500}
      pauseOnHover
      pauseOnWindowBlur
    />
  );
};
