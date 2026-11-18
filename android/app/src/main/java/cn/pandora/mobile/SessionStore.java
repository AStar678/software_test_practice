package cn.pandora.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.ProviderException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Stores only the server session token, protected by a key belonging to this Android app. */
final class SessionStore {
  private static final String ALIAS = "pandora.employee.session";
  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private final SharedPreferences prefs;

  SessionStore(Context context) {
    prefs = context.getSharedPreferences("pandora_session", Context.MODE_PRIVATE);
  }

  String restore() {
    String iv = prefs.getString("iv", ""), encrypted = prefs.getString("token", "");
    if (iv.isEmpty() || encrypted.isEmpty()) return "";
    try {
      SecretKey key = key(false);
      if (key == null) {
        forget();
        return "";
      }
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
      cipher.updateAAD(BuildConfig.START_URL.getBytes(StandardCharsets.UTF_8));
      return new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    } catch (GeneralSecurityException | java.io.IOException | IllegalArgumentException | ProviderException unreadable) {
      forget();
      return "";
    }
  }

  boolean save(String token) {
    if (token.isEmpty()) return false;
    try {
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.ENCRYPT_MODE, key(true));
      cipher.updateAAD(BuildConfig.START_URL.getBytes(StandardCharsets.UTF_8));
      byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
      return prefs.edit().putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
          .putString("token", Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit();
    } catch (GeneralSecurityException | java.io.IOException | ProviderException unavailable) {
      forget();
      return false;
    }
  }

  void forget() {
    prefs.edit().clear().commit();
  }

  private SecretKey key(boolean create) throws GeneralSecurityException, java.io.IOException {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    SecretKey existing = (SecretKey) store.getKey(ALIAS, null);
    if (existing != null || !create) return existing;
    KeyGenerator keys = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    keys.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .build());
    return keys.generateKey();
  }
}
