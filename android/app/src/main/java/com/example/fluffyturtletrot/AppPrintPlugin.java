package com.aziz.revenue;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Prints the current WebView page through the Android print framework.
 * The system dialog lets the user "Save as PDF" — perfect Arabic/RTL
 * rendering with zero JS dependencies.
 */
@CapacitorPlugin(name = "AppPrint")
public class AppPrintPlugin extends Plugin {

    @PluginMethod
    public void printCurrentPage(PluginCall call) {
        final String jobName = call.getString("jobName", "تقرير");
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null || webView == null) {
                    call.reject("Print service unavailable");
                    return;
                }
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                printManager.print(jobName, adapter, attributes);
                call.resolve(new JSObject());
            } catch (Exception e) {
                call.reject("Print failed", e);
            }
        });
    }
}
