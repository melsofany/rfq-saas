#!/bin/bash
# Usage: ./setup.sh "<DATABASE_URL>" "<admin-email>" "<admin-password>"
set -e
DB_URL="$1"
ADMIN_EMAIL="$2"
ADMIN_PASS="$3"

if [ -z "$DB_URL" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASS" ]; then
  echo "Usage: ./setup.sh <DATABASE_URL> <admin-email> <admin-password>"
  exit 1
fi

echo "==> تشغيل السكيما على قاعدة البيانات..."
psql "$DB_URL" -f migrations/001_init.sql

echo "==> إنشاء حساب الأدمن..."
DATABASE_URL="$DB_URL" node scripts/seed-admin.js "$ADMIN_EMAIL" "$ADMIN_PASS"

echo "==> تم! سجل دخول على /admin/login بالإيميل والباسورد اللي دخلتهم."
