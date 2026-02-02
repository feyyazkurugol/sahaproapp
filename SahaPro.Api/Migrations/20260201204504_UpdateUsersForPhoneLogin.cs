using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SahaPro.Api.Migrations
{
    public partial class UpdateUsersForPhoneLogin : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) email nullable yap (zaten nullable ise sorun değil)
            migrationBuilder.Sql(@"
ALTER TABLE users
    ALTER COLUMN email DROP NOT NULL;
");

            // 2) phone / phone_norm / force_password_change kolonlarını güvenli ekle
            migrationBuilder.Sql(@"
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone character varying(50);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_norm character varying(32);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT true;
");

            // 3) status kolonu zaten var olabilir -> ekleme yok.
            // Eğer is_active varsa, status'a taşı (status zaten varsa sadece update yapar)
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='users' AND column_name='is_active'
    ) THEN
        -- status kolonu varsa aktif/pasif doldur
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='users' AND column_name='status'
        ) THEN
            UPDATE users
            SET status = CASE WHEN is_active THEN 'active' ELSE 'passive' END
            WHERE status IS NULL OR status = '';
        END IF;

        -- is_active artık gereksiz: varsa drop
        ALTER TABLE users DROP COLUMN IF EXISTS is_active;
    END IF;
END $$;
");

            // 4) indexleri güvenli yönet
            // email index: drop + recreate filter’lı
            migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_users_tenant_id_email"";
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_users_tenant_id_email""
ON users (tenant_id, email)
WHERE email IS NOT NULL;
");

            // eski phone unique index (varsa) kaldır
            migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_users_tenant_id_phone"";
");

            // phone_norm unique index
            migrationBuilder.Sql(@"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_users_tenant_id_phone_norm""
ON users (tenant_id, phone_norm)
WHERE phone_norm IS NOT NULL;
");

            // role index
            migrationBuilder.Sql(@"
CREATE INDEX IF NOT EXISTS ""IX_users_tenant_id_role""
ON users (tenant_id, role);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Geri dönüşte minimum güvenli rollback (tam eski haline döndürmek zorunlu değil ama temiz kalsın)
            migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_users_tenant_id_phone_norm"";
DROP INDEX IF EXISTS ""IX_users_tenant_id_role"";

-- email tekrar NOT NULL yapmak riskli olabilir (db'de null email olabilir)
-- o yüzden Down'da email'i NOT NULL yapmıyoruz.

ALTER TABLE users DROP COLUMN IF EXISTS force_password_change;
ALTER TABLE users DROP COLUMN IF EXISTS phone_norm;
ALTER TABLE users DROP COLUMN IF EXISTS phone;

-- Eski phone index geri (istersen)
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_users_tenant_id_phone""
ON users (tenant_id, phone)
WHERE phone IS NOT NULL;

-- email index'i (kalsın)
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_users_tenant_id_email""
ON users (tenant_id, email)
WHERE email IS NOT NULL;
");
        }
    }
}
