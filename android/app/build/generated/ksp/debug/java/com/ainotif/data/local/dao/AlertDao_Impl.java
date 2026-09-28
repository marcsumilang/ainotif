package com.ainotif.data.local.dao;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import com.ainotif.data.local.entity.AlertEntity;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Integer;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class AlertDao_Impl implements AlertDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<AlertEntity> __insertionAdapterOfAlertEntity;

  private final SharedSQLiteStatement __preparedStmtOfDismissAlert;

  public AlertDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfAlertEntity = new EntityInsertionAdapter<AlertEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR REPLACE INTO `suspicious_alerts` (`id`,`rawNotification`,`sourcePackage`,`riskScore`,`reason`,`phishingCues`,`timestamp`,`isDismissed`) VALUES (?,?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final AlertEntity entity) {
        statement.bindString(1, entity.getId());
        statement.bindString(2, entity.getRawNotification());
        if (entity.getSourcePackage() == null) {
          statement.bindNull(3);
        } else {
          statement.bindString(3, entity.getSourcePackage());
        }
        statement.bindLong(4, entity.getRiskScore());
        statement.bindString(5, entity.getReason());
        statement.bindString(6, entity.getPhishingCues());
        statement.bindLong(7, entity.getTimestamp());
        final int _tmp = entity.isDismissed() ? 1 : 0;
        statement.bindLong(8, _tmp);
      }
    };
    this.__preparedStmtOfDismissAlert = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "UPDATE suspicious_alerts SET isDismissed = 1 WHERE id = ?";
        return _query;
      }
    };
  }

  @Override
  public Object insertAlert(final AlertEntity alert, final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfAlertEntity.insert(alert);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object insertAll(final List<AlertEntity> alerts,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfAlertEntity.insert(alerts);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object dismissAlert(final String id, final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfDismissAlert.acquire();
        int _argIndex = 1;
        _stmt.bindString(_argIndex, id);
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfDismissAlert.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<AlertEntity>> getActiveAlertsFlow() {
    final String _sql = "SELECT * FROM suspicious_alerts WHERE isDismissed = 0 ORDER BY timestamp DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"suspicious_alerts"}, new Callable<List<AlertEntity>>() {
      @Override
      @NonNull
      public List<AlertEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfRawNotification = CursorUtil.getColumnIndexOrThrow(_cursor, "rawNotification");
          final int _cursorIndexOfSourcePackage = CursorUtil.getColumnIndexOrThrow(_cursor, "sourcePackage");
          final int _cursorIndexOfRiskScore = CursorUtil.getColumnIndexOrThrow(_cursor, "riskScore");
          final int _cursorIndexOfReason = CursorUtil.getColumnIndexOrThrow(_cursor, "reason");
          final int _cursorIndexOfPhishingCues = CursorUtil.getColumnIndexOrThrow(_cursor, "phishingCues");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfIsDismissed = CursorUtil.getColumnIndexOrThrow(_cursor, "isDismissed");
          final List<AlertEntity> _result = new ArrayList<AlertEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final AlertEntity _item;
            final String _tmpId;
            _tmpId = _cursor.getString(_cursorIndexOfId);
            final String _tmpRawNotification;
            _tmpRawNotification = _cursor.getString(_cursorIndexOfRawNotification);
            final String _tmpSourcePackage;
            if (_cursor.isNull(_cursorIndexOfSourcePackage)) {
              _tmpSourcePackage = null;
            } else {
              _tmpSourcePackage = _cursor.getString(_cursorIndexOfSourcePackage);
            }
            final int _tmpRiskScore;
            _tmpRiskScore = _cursor.getInt(_cursorIndexOfRiskScore);
            final String _tmpReason;
            _tmpReason = _cursor.getString(_cursorIndexOfReason);
            final String _tmpPhishingCues;
            _tmpPhishingCues = _cursor.getString(_cursorIndexOfPhishingCues);
            final long _tmpTimestamp;
            _tmpTimestamp = _cursor.getLong(_cursorIndexOfTimestamp);
            final boolean _tmpIsDismissed;
            final int _tmp;
            _tmp = _cursor.getInt(_cursorIndexOfIsDismissed);
            _tmpIsDismissed = _tmp != 0;
            _item = new AlertEntity(_tmpId,_tmpRawNotification,_tmpSourcePackage,_tmpRiskScore,_tmpReason,_tmpPhishingCues,_tmpTimestamp,_tmpIsDismissed);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object getAllAlerts(final Continuation<? super List<AlertEntity>> $completion) {
    final String _sql = "SELECT * FROM suspicious_alerts ORDER BY timestamp DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<AlertEntity>>() {
      @Override
      @NonNull
      public List<AlertEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfRawNotification = CursorUtil.getColumnIndexOrThrow(_cursor, "rawNotification");
          final int _cursorIndexOfSourcePackage = CursorUtil.getColumnIndexOrThrow(_cursor, "sourcePackage");
          final int _cursorIndexOfRiskScore = CursorUtil.getColumnIndexOrThrow(_cursor, "riskScore");
          final int _cursorIndexOfReason = CursorUtil.getColumnIndexOrThrow(_cursor, "reason");
          final int _cursorIndexOfPhishingCues = CursorUtil.getColumnIndexOrThrow(_cursor, "phishingCues");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfIsDismissed = CursorUtil.getColumnIndexOrThrow(_cursor, "isDismissed");
          final List<AlertEntity> _result = new ArrayList<AlertEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final AlertEntity _item;
            final String _tmpId;
            _tmpId = _cursor.getString(_cursorIndexOfId);
            final String _tmpRawNotification;
            _tmpRawNotification = _cursor.getString(_cursorIndexOfRawNotification);
            final String _tmpSourcePackage;
            if (_cursor.isNull(_cursorIndexOfSourcePackage)) {
              _tmpSourcePackage = null;
            } else {
              _tmpSourcePackage = _cursor.getString(_cursorIndexOfSourcePackage);
            }
            final int _tmpRiskScore;
            _tmpRiskScore = _cursor.getInt(_cursorIndexOfRiskScore);
            final String _tmpReason;
            _tmpReason = _cursor.getString(_cursorIndexOfReason);
            final String _tmpPhishingCues;
            _tmpPhishingCues = _cursor.getString(_cursorIndexOfPhishingCues);
            final long _tmpTimestamp;
            _tmpTimestamp = _cursor.getLong(_cursorIndexOfTimestamp);
            final boolean _tmpIsDismissed;
            final int _tmp;
            _tmp = _cursor.getInt(_cursorIndexOfIsDismissed);
            _tmpIsDismissed = _tmp != 0;
            _item = new AlertEntity(_tmpId,_tmpRawNotification,_tmpSourcePackage,_tmpRiskScore,_tmpReason,_tmpPhishingCues,_tmpTimestamp,_tmpIsDismissed);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Object getActiveAlertCount(final Continuation<? super Integer> $completion) {
    final String _sql = "SELECT COUNT(*) FROM suspicious_alerts WHERE isDismissed = 0";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<Integer>() {
      @Override
      @NonNull
      public Integer call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final Integer _result;
          if (_cursor.moveToFirst()) {
            final int _tmp;
            _tmp = _cursor.getInt(0);
            _result = _tmp;
          } else {
            _result = 0;
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @NonNull
  public static List<Class<?>> getRequiredConverters() {
    return Collections.emptyList();
  }
}
