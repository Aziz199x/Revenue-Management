import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message, { duration: 2500 });
};

export const showError = (message: string) => {
  toast.error(message, { duration: 3000 });
};

