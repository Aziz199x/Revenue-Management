import { toast } from "sonner";

const SHORT_DURATION = 2500;
const NORMAL_DURATION = 3000;

export const showSuccess = (message: string) => {
<<<<<<< HEAD
  toast.success(message, { duration: 2500 });
};

export const showError = (message: string) => {
  toast.error(message, { duration: 3000 });
};

=======
  toast.success(message, { duration: SHORT_DURATION, position: "top-center" });
};

export const showError = (message: string) => {
  toast.error(message, { duration: NORMAL_DURATION, position: "top-center" });
};

export const showInfo = (message: string) => {
  toast.info(message, { duration: NORMAL_DURATION, position: "top-center" });
};

export const showLoading = (message: string) => {
  return toast.loading(message, { position: "top-center" });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
