package org.matzil.sar;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AlertSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @CapacitorPlugin(name = "AlertSettings")
    public static class AlertSettingsPlugin extends Plugin {

        @PluginMethod
        public void openChannelSettings(PluginCall call) {
            Intent i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.putExtra(Settings.EXTRA_CHANNEL_ID, "matzil_critical_v2");
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
            boolean granted = Settings.canDrawOverlays(getContext());
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("granted", granted);
            call.resolve(ret);
        }
    }
}
