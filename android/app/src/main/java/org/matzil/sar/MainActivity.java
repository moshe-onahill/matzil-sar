package org.matzil.sar;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AlertSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        MatzilMessagingService.ensureAlarmChannel(this);
    }

    @CapacitorPlugin(name = "AlertSettings")
    public static class AlertSettingsPlugin extends Plugin {

        @PluginMethod
        public void openChannelSettings(PluginCall call) {
            Intent i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.putExtra(Settings.EXTRA_CHANNEL_ID, MatzilMessagingService.CHANNEL_ID);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        }

        @PluginMethod
        public void openDndSettings(PluginCall call) {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        }

        @PluginMethod
        public void openOverlaySettings(PluginCall call) {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        }

        @PluginMethod
        public void checkOverlayPermission(PluginCall call) {
            JSObject ret = new JSObject();
            ret.put("granted", Settings.canDrawOverlays(getContext()));
            call.resolve(ret);
        }

        @PluginMethod
        public void getPendingAlert(PluginCall call) {
            SharedPreferences prefs = getContext().getSharedPreferences(MatzilMessagingService.PREFS, Context.MODE_PRIVATE);
            long ts = prefs.getLong("pending_ts", 0);
            // Only return if received in the last 60 seconds
            if (ts == 0 || System.currentTimeMillis() - ts > 60_000) {
                call.resolve(new JSObject().put("found", false));
                return;
            }
            JSObject ret = new JSObject();
            ret.put("found", true);
            ret.put("title", prefs.getString("pending_title", ""));
            ret.put("body", prefs.getString("pending_body", ""));
            ret.put("location", prefs.getString("pending_location", ""));
            call.resolve(ret);
        }

        @PluginMethod
        public void clearPendingAlert(PluginCall call) {
            getContext().getSharedPreferences(MatzilMessagingService.PREFS, Context.MODE_PRIVATE)
                .edit().clear().apply();
            call.resolve();
        }
    }
}
