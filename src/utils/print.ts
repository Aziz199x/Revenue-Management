import { registerPlugin } from "@capacitor/core";

interface AppPrintPlugin {
  printCurrentPage(options: { jobName?: string }): Promise<void>;
}

const AppPrint = registerPlugin<AppPrintPlugin>("AppPrint", {
  web: () => ({
    printCurrentPage: async () => {
      window.print();
    },
  }),
});

/**
 * Opens the system print dialog for the current page.
 * On Android the user can choose "حفظ كـ PDF"; on web it uses the browser dialog.
 */
export async function printCurrentPage(jobName: string): Promise<void> {
  await AppPrint.printCurrentPage({ jobName });
}
