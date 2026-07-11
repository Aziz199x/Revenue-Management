import { toast } from "sonner";

const SHORT_DURATION = 2500;
const NORMAL_DURATION = 3000;

export const showSuccess = (message: string) => {
  toast.success(message, { duration: 2500 });
};

export const showError = (message: string) => {
  toast.error(message, { duration: 3000 });
};