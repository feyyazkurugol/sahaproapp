using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SahaPro.Api.Data;
using SahaPro.Api.Data.Entities;

namespace SahaPro.Api.Controllers;

[ApiController]
[Route("api/dev/seed")]
public class DevSeedController : ControllerBase
{
    private readonly SahaProDbContext _db;
    private readonly IWebHostEnvironment _env;

    public DevSeedController(SahaProDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpPost]
    public async Task<IActionResult> Seed()
    {
        if (!_env.IsDevelopment()) return NotFound();

        // tenant yoksa oluştur
        var tenant = await _db.Tenants.FirstOrDefaultAsync();
        if (tenant is null)
        {
            tenant = new Tenant { Name = "Demo Tenant" };
            _db.Tenants.Add(tenant);
            await _db.SaveChangesAsync();
        }

        static string NormalizePhone(string raw)
        {
            var s = (raw ?? "").Trim();
            var digits = new string(s.Where(char.IsDigit).ToArray());
            if (digits.Length < 10) return "";

            if (digits.StartsWith("0") && digits.Length == 11)
                digits = "90" + digits.Substring(1);

            if (digits.Length == 10 && digits.StartsWith("5"))
                digits = "90" + digits;

            return digits;
        }

        async Task EnsureUser(string? email, string? phone, string name, string role, string pass)
        {
            var phoneNorm = string.IsNullOrWhiteSpace(phone) ? null : NormalizePhone(phone);

            var exists = await _db.Users.AnyAsync(x =>
                x.TenantId == tenant!.Id &&
                (
                    (email != null && x.Email != null && x.Email.ToLower() == email.ToLower())
                    || (phoneNorm != null && x.PhoneNorm == phoneNorm)
                )
            );

            if (exists) return;

            _db.Users.Add(new AppUser
            {
                TenantId = tenant!.Id,
                Email = email,              // opsiyonel
                Phone = phone,              // opsiyonel
                PhoneNorm = phoneNorm,      // login için kritik
                FullName = name,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(pass),

                Status = "active",          // ✅ doğru: active/passive
                Role = role,                // ✅ doğru: owner/sales/tech/dispatcher
                ForcePasswordChange = false, // dev seed rahat olsun
                CreatedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
        }

        // ✅ örnek telefonlar: TR format
        await EnsureUser("owner@sahapro.local", "0555 000 00 01", "Patron", "owner", "123456");
        await EnsureUser("sales@sahapro.local", "0555 000 00 02", "Satışçı", "sales", "123456");
        await EnsureUser("tech@sahapro.local", "0555 000 00 03", "Teknisyen", "tech", "123456");

        return Ok(new { ok = true, tenantId = tenant.Id });
    }
}
