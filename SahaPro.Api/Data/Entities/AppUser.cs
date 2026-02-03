using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SahaPro.Api.Data.Entities;

[Table("users")]
public class AppUser
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("full_name")]
    [MaxLength(120)]
    public string FullName { get; set; } = default!;

    // Login identifier: phone
    [Column("phone")]
    [MaxLength(50)]
    public string? Phone { get; set; }

    // ✅ Normalize edilmiş telefon (unique kontrol burada)
    // Örn: "+90 (532) 111-22-33" -> "905321112233"
    [Column("phone_norm")]
    [MaxLength(32)]
    public string? PhoneNorm { get; set; }

    // ✅ Email opsiyonel (Saha'da çoğu kullanmıyor)
    [Column("email")]
    [MaxLength(160)]
    public string? Email { get; set; }

    [Column("password_hash")]
    public string PasswordHash { get; set; } = default!;

    // ✅ Ürün mantığı: status sadece aktif/pasif
    // DB: status (text) -> "active" | "passive"
    [Column("status")]
    [MaxLength(30)]
    public string Status { get; set; } = "active";

    // ✅ Ürün mantığı: role ayrı kolon
    // DB: role (text) -> "owner" | "dispatcher" | "sales" | "tech"
    [Column("role")]
    [MaxLength(30)]
    public string Role { get; set; } = "tech";

    // ✅ Geçici şifre ile oluşturulduysa ilk girişte şifre değiştir
    [Column("force_password_change")]
    public bool ForcePasswordChange { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    // -----------------------------
    // Kod tarafı yardımcı alanlar
    // -----------------------------
    [NotMapped]
    public bool IsActive => string.Equals(Status, "active", StringComparison.OrdinalIgnoreCase);

    [NotMapped]
    public string NormalizedRole => NormalizeRole(Role);

    private static string NormalizeRole(string? role)
    {
        var r = (role ?? "").Trim().ToLowerInvariant();
        return r switch
        {
            "owner" => "owner",
            "admin" => "admin", // geriye dönük destek
            "dispatcher" => "dispatcher",
            "sales" => "sales",
            "tech" => "tech",
            _ => "tech"
        };
    }
}
