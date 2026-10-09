#!/usr/bin/env python3
"""Exercise the SQL registered in AppDatabase's Room 2 -> 3 migration.

Run from any directory with: python3 scripts/test-room-migration.py
This uses stdlib SQLite and does not require Gradle or an Android runtime.
"""

from pathlib import Path
import re
import sqlite3


ROOT = Path(__file__).resolve().parents[1]
DATABASE_SOURCE = ROOT / "android/app/src/main/java/com/ainotif/data/local/AppDatabase.kt"


def migration_sql(source: str) -> list[str]:
    match = re.search(
        r"MIGRATION_2_3\s*=\s*object\s*:\s*Migration\(2,\s*3\)\s*\{(?P<body>.*?)\n\s*\}",
        source,
        re.DOTALL,
    )
    if not match:
        raise AssertionError("Could not find AppDatabase.MIGRATION_2_3")

    statements = re.findall(r'db\.execSQL\("([^"\\]*)"\)', match.group("body"))
    if len(statements) != 6:
        raise AssertionError(f"Expected 6 literal migration statements, found {len(statements)}")
    return statements


def main() -> None:
    sql = migration_sql(DATABASE_SOURCE.read_text(encoding="utf-8"))
    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(
            """
            CREATE TABLE transactions (
                id TEXT NOT NULL PRIMARY KEY,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                merchant TEXT NOT NULL,
                category TEXT NOT NULL,
                type TEXT NOT NULL,
                rawNotification TEXT NOT NULL,
                sourcePackage TEXT,
                timestamp INTEGER NOT NULL,
                note TEXT,
                isSynced INTEGER NOT NULL
            );
            CREATE TABLE suspicious_alerts (
                id TEXT NOT NULL PRIMARY KEY,
                rawNotification TEXT NOT NULL,
                sourcePackage TEXT,
                riskScore INTEGER NOT NULL,
                reason TEXT NOT NULL,
                phishingCues TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                isDismissed INTEGER NOT NULL,
                isSynced INTEGER NOT NULL
            );
            CREATE TABLE notification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                title TEXT,
                text TEXT,
                packageName TEXT,
                decision TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );
            INSERT INTO transactions VALUES
                ('txn-1', 12.5, 'USD', 'Cafe', 'Food', 'DEBIT', 'Paid Cafe', 'com.bank', 1700000000, 'lunch', 0);
            INSERT INTO suspicious_alerts VALUES
                ('alert-1', 'Suspicious link', 'com.sms', 91, 'phishing', 'shortened URL', 1700000001, 0, 1);
            INSERT INTO notification_logs VALUES
                (7, 'Bank', 'Payment received', 'com.bank', 'TRANSACTION', 1700000002);
            """
        )

        for statement in sql:
            connection.execute(statement)

        assert connection.execute(
            "SELECT id, amount, currency, merchant, note, isSynced, sourceEventId FROM transactions"
        ).fetchall() == [("txn-1", 12.5, "USD", "Cafe", "lunch", 0, None)]
        assert connection.execute(
            "SELECT id, rawNotification, riskScore, isDismissed, isSynced, sourceEventId FROM suspicious_alerts"
        ).fetchall() == [("alert-1", "Suspicious link", 91, 0, 1, None)]
        assert connection.execute(
            "SELECT id, title, text, packageName, decision, timestamp, sourceEventId FROM notification_logs"
        ).fetchall() == [(7, "Bank", "Payment received", "com.bank", "TRANSACTION", 1700000002, None)]

        indexes = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'index'"
            ).fetchall()
        }
        expected_indexes = {
            "index_transactions_sourceEventId",
            "index_suspicious_alerts_sourceEventId",
            "index_notification_logs_sourceEventId",
        }
        assert expected_indexes <= indexes, f"Missing sourceEventId indexes: {expected_indexes - indexes}"
        print("Room 2 -> 3 migration fixture passed: rows preserved and all sourceEventId indexes created.")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
