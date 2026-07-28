package com.aziz.revenue;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * WorkManager safety net (every 6 hours). If an OEM battery manager silently
 * cancels the alarm chain, this worker re-delivers anything missed (within the
 * duplicate-guard ledger) and re-arms the next alarm. WorkManager jobs are
 * persisted by the OS and survive reboots and app updates on their own.
 */
public class ReminderMaintenanceWorker extends Worker {

    public ReminderMaintenanceWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            ReminderEngine.deliverDueAndReschedule(getApplicationContext());
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }
}
