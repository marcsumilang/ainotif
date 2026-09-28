package com.ainotif.data.local;

import androidx.annotation.NonNull;
import androidx.room.DatabaseConfiguration;
import androidx.room.InvalidationTracker;
import androidx.room.RoomDatabase;
import androidx.room.RoomOpenHelper;
import androidx.room.migration.AutoMigrationSpec;
import androidx.room.migration.Migration;
import androidx.room.util.DBUtil;
import androidx.room.util.TableInfo;
import androidx.sqlite.db.SupportSQLiteDatabase;
import androidx.sqlite.db.SupportSQLiteOpenHelper;
import com.ainotif.data.local.dao.AlertDao;
import com.ainotif.data.local.dao.AlertDao_Impl;
import com.ainotif.data.local.dao.NotificationLogDao;
import com.ainotif.data.local.dao.NotificationLogDao_Impl;
import com.ainotif.data.local.dao.TransactionDao;
import com.ainotif.data.local.dao.TransactionDao_Impl;
import java.lang.Class;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.annotation.processing.Generated;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class AppDatabase_Impl extends AppDatabase {
  private volatile TransactionDao _transactionDao;

  private volatile AlertDao _alertDao;

  private volatile NotificationLogDao _notificationLogDao;

  @Override
  @NonNull
  protected SupportSQLiteOpenHelper createOpenHelper(@NonNull final DatabaseConfiguration config) {
    final SupportSQLiteOpenHelper.Callback _openCallback = new RoomOpenHelper(config, new RoomOpenHelper.Delegate(1) {
      @Override
      public void createAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS `transactions` (`id` TEXT NOT NULL, `amount` REAL NOT NULL, `currency` TEXT NOT NULL, `merchant` TEXT NOT NULL, `category` TEXT NOT NULL, `type` TEXT NOT NULL, `rawNotification` TEXT NOT NULL, `sourcePackage` TEXT, `timestamp` INTEGER NOT NULL, `isSynced` INTEGER NOT NULL, PRIMARY KEY(`id`))");
        db.execSQL("CREATE TABLE IF NOT EXISTS `suspicious_alerts` (`id` TEXT NOT NULL, `rawNotification` TEXT NOT NULL, `sourcePackage` TEXT, `riskScore` INTEGER NOT NULL, `reason` TEXT NOT NULL, `phishingCues` TEXT NOT NULL, `timestamp` INTEGER NOT NULL, `isDismissed` INTEGER NOT NULL, PRIMARY KEY(`id`))");
        db.execSQL("CREATE TABLE IF NOT EXISTS `notification_logs` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `title` TEXT, `text` TEXT, `packageName` TEXT, `decision` TEXT NOT NULL, `timestamp` INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY,identity_hash TEXT)");
        db.execSQL("INSERT OR REPLACE INTO room_master_table (id,identity_hash) VALUES(42, 'af6e97a515e98066c7b2a8652889a9ea')");
      }

      @Override
      public void dropAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("DROP TABLE IF EXISTS `transactions`");
        db.execSQL("DROP TABLE IF EXISTS `suspicious_alerts`");
        db.execSQL("DROP TABLE IF EXISTS `notification_logs`");
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onDestructiveMigration(db);
          }
        }
      }

      @Override
      public void onCreate(@NonNull final SupportSQLiteDatabase db) {
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onCreate(db);
          }
        }
      }

      @Override
      public void onOpen(@NonNull final SupportSQLiteDatabase db) {
        mDatabase = db;
        internalInitInvalidationTracker(db);
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onOpen(db);
          }
        }
      }

      @Override
      public void onPreMigrate(@NonNull final SupportSQLiteDatabase db) {
        DBUtil.dropFtsSyncTriggers(db);
      }

      @Override
      public void onPostMigrate(@NonNull final SupportSQLiteDatabase db) {
      }

      @Override
      @NonNull
      public RoomOpenHelper.ValidationResult onValidateSchema(
          @NonNull final SupportSQLiteDatabase db) {
        final HashMap<String, TableInfo.Column> _columnsTransactions = new HashMap<String, TableInfo.Column>(10);
        _columnsTransactions.put("id", new TableInfo.Column("id", "TEXT", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("amount", new TableInfo.Column("amount", "REAL", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("currency", new TableInfo.Column("currency", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("merchant", new TableInfo.Column("merchant", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("category", new TableInfo.Column("category", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("type", new TableInfo.Column("type", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("rawNotification", new TableInfo.Column("rawNotification", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("sourcePackage", new TableInfo.Column("sourcePackage", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("timestamp", new TableInfo.Column("timestamp", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsTransactions.put("isSynced", new TableInfo.Column("isSynced", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysTransactions = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesTransactions = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoTransactions = new TableInfo("transactions", _columnsTransactions, _foreignKeysTransactions, _indicesTransactions);
        final TableInfo _existingTransactions = TableInfo.read(db, "transactions");
        if (!_infoTransactions.equals(_existingTransactions)) {
          return new RoomOpenHelper.ValidationResult(false, "transactions(com.ainotif.data.local.entity.TransactionEntity).\n"
                  + " Expected:\n" + _infoTransactions + "\n"
                  + " Found:\n" + _existingTransactions);
        }
        final HashMap<String, TableInfo.Column> _columnsSuspiciousAlerts = new HashMap<String, TableInfo.Column>(8);
        _columnsSuspiciousAlerts.put("id", new TableInfo.Column("id", "TEXT", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsSuspiciousAlerts.put("rawNotification", new TableInfo.Column("rawNotification", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsSuspiciousAlerts.put("sourcePackage", new TableInfo.Column("sourcePackage", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsSuspiciousAlerts.put("riskScore", new TableInfo.Column("riskScore", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsSuspiciousAlerts.put("reason", new TableInfo.Column("reason", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsSuspiciousAlerts.put("phishingCues", new TableInfo.Column("phishingCues", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsSuspiciousAlerts.put("timestamp", new TableInfo.Column("timestamp", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsSuspiciousAlerts.put("isDismissed", new TableInfo.Column("isDismissed", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysSuspiciousAlerts = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesSuspiciousAlerts = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoSuspiciousAlerts = new TableInfo("suspicious_alerts", _columnsSuspiciousAlerts, _foreignKeysSuspiciousAlerts, _indicesSuspiciousAlerts);
        final TableInfo _existingSuspiciousAlerts = TableInfo.read(db, "suspicious_alerts");
        if (!_infoSuspiciousAlerts.equals(_existingSuspiciousAlerts)) {
          return new RoomOpenHelper.ValidationResult(false, "suspicious_alerts(com.ainotif.data.local.entity.AlertEntity).\n"
                  + " Expected:\n" + _infoSuspiciousAlerts + "\n"
                  + " Found:\n" + _existingSuspiciousAlerts);
        }
        final HashMap<String, TableInfo.Column> _columnsNotificationLogs = new HashMap<String, TableInfo.Column>(6);
        _columnsNotificationLogs.put("id", new TableInfo.Column("id", "INTEGER", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsNotificationLogs.put("title", new TableInfo.Column("title", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsNotificationLogs.put("text", new TableInfo.Column("text", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsNotificationLogs.put("packageName", new TableInfo.Column("packageName", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsNotificationLogs.put("decision", new TableInfo.Column("decision", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsNotificationLogs.put("timestamp", new TableInfo.Column("timestamp", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysNotificationLogs = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesNotificationLogs = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoNotificationLogs = new TableInfo("notification_logs", _columnsNotificationLogs, _foreignKeysNotificationLogs, _indicesNotificationLogs);
        final TableInfo _existingNotificationLogs = TableInfo.read(db, "notification_logs");
        if (!_infoNotificationLogs.equals(_existingNotificationLogs)) {
          return new RoomOpenHelper.ValidationResult(false, "notification_logs(com.ainotif.data.local.entity.NotificationLogEntity).\n"
                  + " Expected:\n" + _infoNotificationLogs + "\n"
                  + " Found:\n" + _existingNotificationLogs);
        }
        return new RoomOpenHelper.ValidationResult(true, null);
      }
    }, "af6e97a515e98066c7b2a8652889a9ea", "a780c0f6c666ecf29c84126d3991a9c0");
    final SupportSQLiteOpenHelper.Configuration _sqliteConfig = SupportSQLiteOpenHelper.Configuration.builder(config.context).name(config.name).callback(_openCallback).build();
    final SupportSQLiteOpenHelper _helper = config.sqliteOpenHelperFactory.create(_sqliteConfig);
    return _helper;
  }

  @Override
  @NonNull
  protected InvalidationTracker createInvalidationTracker() {
    final HashMap<String, String> _shadowTablesMap = new HashMap<String, String>(0);
    final HashMap<String, Set<String>> _viewTables = new HashMap<String, Set<String>>(0);
    return new InvalidationTracker(this, _shadowTablesMap, _viewTables, "transactions","suspicious_alerts","notification_logs");
  }

  @Override
  public void clearAllTables() {
    super.assertNotMainThread();
    final SupportSQLiteDatabase _db = super.getOpenHelper().getWritableDatabase();
    try {
      super.beginTransaction();
      _db.execSQL("DELETE FROM `transactions`");
      _db.execSQL("DELETE FROM `suspicious_alerts`");
      _db.execSQL("DELETE FROM `notification_logs`");
      super.setTransactionSuccessful();
    } finally {
      super.endTransaction();
      _db.query("PRAGMA wal_checkpoint(FULL)").close();
      if (!_db.inTransaction()) {
        _db.execSQL("VACUUM");
      }
    }
  }

  @Override
  @NonNull
  protected Map<Class<?>, List<Class<?>>> getRequiredTypeConverters() {
    final HashMap<Class<?>, List<Class<?>>> _typeConvertersMap = new HashMap<Class<?>, List<Class<?>>>();
    _typeConvertersMap.put(TransactionDao.class, TransactionDao_Impl.getRequiredConverters());
    _typeConvertersMap.put(AlertDao.class, AlertDao_Impl.getRequiredConverters());
    _typeConvertersMap.put(NotificationLogDao.class, NotificationLogDao_Impl.getRequiredConverters());
    return _typeConvertersMap;
  }

  @Override
  @NonNull
  public Set<Class<? extends AutoMigrationSpec>> getRequiredAutoMigrationSpecs() {
    final HashSet<Class<? extends AutoMigrationSpec>> _autoMigrationSpecsSet = new HashSet<Class<? extends AutoMigrationSpec>>();
    return _autoMigrationSpecsSet;
  }

  @Override
  @NonNull
  public List<Migration> getAutoMigrations(
      @NonNull final Map<Class<? extends AutoMigrationSpec>, AutoMigrationSpec> autoMigrationSpecs) {
    final List<Migration> _autoMigrations = new ArrayList<Migration>();
    return _autoMigrations;
  }

  @Override
  public TransactionDao transactionDao() {
    if (_transactionDao != null) {
      return _transactionDao;
    } else {
      synchronized(this) {
        if(_transactionDao == null) {
          _transactionDao = new TransactionDao_Impl(this);
        }
        return _transactionDao;
      }
    }
  }

  @Override
  public AlertDao alertDao() {
    if (_alertDao != null) {
      return _alertDao;
    } else {
      synchronized(this) {
        if(_alertDao == null) {
          _alertDao = new AlertDao_Impl(this);
        }
        return _alertDao;
      }
    }
  }

  @Override
  public NotificationLogDao notificationLogDao() {
    if (_notificationLogDao != null) {
      return _notificationLogDao;
    } else {
      synchronized(this) {
        if(_notificationLogDao == null) {
          _notificationLogDao = new NotificationLogDao_Impl(this);
        }
        return _notificationLogDao;
      }
    }
  }
}
