package org.matzil.sar;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;

public class MatzilMessagingService extends MessagingService {

    static final String CHANNEL_ID = "matzil_critical_v2";
    static final String PREFS = "matzil_prefs";

    @Override
    public void onCreate() {
        super.onCreate();
        ensureAlarmChannel(this);
    }

    static void ensureAlarmChannel(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Critical Alerts", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("High-priority SAR alerts");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 400});
        ch.setBypassDnd(true);
        Uri sound = Uri.parse("android.resource://" + ctx.getPackageName() + "/raw/alert");
        AudioAttributes aa = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        ch.setSound(sound, aa);
        nm.createNotificationChannel(ch);
    }

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        super.onMessageReceived(msg); // Capacitor handles foreground

        String title = msg.getNotification() != null ? msg.getNotification().getTitle() : msg.getData().get("title");
        String body  = msg.getNotification() != null ? msg.getNotification().getBody()  : msg.getData().get("body");
        String location = msg.getData().get("location");
        if (title == null) title = "Matzil SAR Alert";

        // Save for JS to read on app open
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("pending_title", title)
            .putString("pending_body", body != null ? body : "")
            .putString("pending_location", location != null ? location : "")
            .putLong("pending_ts", System.currentTimeMillis())
            .apply();

        if (isAppInForeground()) return; // JS handles foreground popup

        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("from_alert", true);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        ensureAlarmChannel(this);
        NotificationCompat.Builder nb = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body != null ? body : "")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(pi, true)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setVibrate(new long[]{0, 400, 200, 400, 200, 400})
            .setSound(Uri.parse("android.resource://" + getPackageName() + "/raw/alert"));

        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE))
            .notify((int) System.currentTimeMillis(), nb.build());
    }

    private boolean isAppInForeground() {
        android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        java.util.List<android.app.ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
        if (procs == null) return false;
        for (android.app.ActivityManager.RunningAppProcessInfo p : procs) {
            if (p.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                    && p.processName.equals(getPackageName())) return true;
        }
        return false;
    }
}
