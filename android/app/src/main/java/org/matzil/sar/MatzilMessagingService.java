package org.matzil.sar;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;

public class MatzilMessagingService extends MessagingService {

    private static final String CHANNEL_ID = "matzil_critical_v2";

    @Override
    public void onCreate() {
        super.onCreate();
        createAlarmChannel();
    }

    private void createAlarmChannel() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Critical Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("High-priority SAR alerts");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 400});
        channel.setBypassDnd(true);

        // ALARM audio stream — bypasses silent and vibrate modes
        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/alert");
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(soundUri, audioAttributes);
        nm.createNotificationChannel(channel);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage); // Capacitor plugin handles foreground

        // Only show full-screen notification when app is in background/killed
        if (isAppInForeground()) return;

        String title = remoteMessage.getNotification() != null
            ? remoteMessage.getNotification().getTitle()
            : remoteMessage.getData().get("title");
        String body = remoteMessage.getNotification() != null
            ? remoteMessage.getNotification().getBody()
            : remoteMessage.getData().get("body");
        if (title == null) title = "Matzil SAR Alert";

        // Intent to open the app
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body != null ? body : "")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(pendingIntent, true)  // wakes screen + opens app
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVibrate(new long[]{0, 400, 200, 400, 200, 400})
            .setSound(Uri.parse("android.resource://" + getPackageName() + "/raw/alert"));

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify((int) System.currentTimeMillis(), builder.build());
    }

    private boolean isAppInForeground() {
        android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        java.util.List<android.app.ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
        if (processes == null) return false;
        for (android.app.ActivityManager.RunningAppProcessInfo p : processes) {
            if (p.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                && p.processName.equals(getPackageName())) {
                return true;
            }
        }
        return false;
    }
}
