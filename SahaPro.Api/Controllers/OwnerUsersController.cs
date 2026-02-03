using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SahaPro.Api.Data;
using SahaPro.Api.Data.Entities;
using System.Security.Claims;

namespace SahaPro.Api.Controllers;

[ApiController]
[Route("api/owner/users")]
[Authorize(Policy = "OwnerOnly")]
public class OwnerUsersController : ControllerBase
{
    private readonly SahaProDbContext _db;

    public OwnerUsersController(SahaProDbContext db)
    {
        _db = db;
    }

    // ---------- DTOs ----------
    public record UserListItem(
        Guid Id,
        string FullName,
        string? Phone,
        string? Email,
        string Role,
        string Status,
        bool ForcePasswordChange,
        DateTime CreatedAt
    );

    public record CreateUserRequest(
        string FullName,
        string Phone,
        string Role,
        string? Email
    );

    public record CreateUserResponse(
        Guid Id,
        string TempPassword
    );

    public record ResetPasswordResponse(
        Guid Id,
        string TempPassword
    );

    public record UpdateUserRequest(
        string? FullName,
        string? Role,
        string? Status
    );

    // ---------- helpers ----------
    private Guid CurrentTenantId =>
        Guid.TryParse(User?.FindFirstValue("tenant_id"), out var id) ? id : Guid.Empty;

    private static string NormalizeRole(string? role)
    {
        var r = (role ?? "").Trim().ToLowerInvariant();
        return r switch
        {
            "owner" => "owner",
            "admin" => "admin",
            "dispatcher" => "dispatcher",
            "sales" => "sales",
            "tech" => "tech",
            _ => "tech"
        };
    }

    private static string NormalizeStatus(string? status)
    {
        var s = (status ?? "").Trim().ToLowerInvariant();
        return s switch
        {
            "active" => "active",
            "passive" => "passive",
            _ => "active"
        };
    }

    // "0555..." -> "90..." ; "+90..." -> "90..." ; non-digit sil
    private static string NormalizePhone(string raw)
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

    private static string GenTempPassword()
    {
        // basit ama yeterli: 8 char, harf+rakam
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        var rnd = Random.Shared;
        return new string(Enumerable.Range(0, 8).Select(_ => chars[rnd.Next(chars.Length)]).ToArray());
    }

    private static bool LooksLikeEmail(string? s)
    {
        s = (s ?? "").Trim();
        return s.Contains("@") && s.Contains(".");
    }

    private void EnsureTenant()
    {
        if (CurrentTenantId == Guid.Empty) throw new Exception("tenant_required");
    }

    // ---------- endpoints ----------

    // GET /api/owner/users
    [HttpGet]
    public async Task<ActionResult<List<UserListItem>>> List([FromQuery] string? q = null)
    {
        EnsureTenant();
        var tenantId = CurrentTenantId;
        q = (q ?? "").Trim();

        var query = _db.Users.AsNoTracking().Where(x => x.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var ql = q.ToLowerInvariant();
            query = query.Where(x =>
                (x.FullName != null && x.FullName.ToLower().Contains(ql)) ||
                (x.Phone != null && x.Phone.Contains(q)) ||
                (x.Email != null && x.Email.ToLower().Contains(ql)) ||
                (x.Role != null && x.Role.ToLower().Contains(ql))
            );
        }

        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new UserListItem(
                x.Id,
                x.FullName,
                x.Phone,
                x.Email,
                x.Role,
                x.Status,
                x.ForcePasswordChange,
                x.CreatedAt
            ))
            .ToListAsync();

        return Ok(rows);
    }

    // POST /api/owner/users
    // ✅ owner yeni kullanıcı oluşturur, geçici şifre döner (owner whatsapp'tan yollar)
    [HttpPost]
    public async Task<ActionResult<CreateUserResponse>> Create([FromBody] CreateUserRequest req)
    {
        EnsureTenant();
        var tenantId = CurrentTenantId;

        var name = (req.FullName ?? "").Trim();
        var phone = (req.Phone ?? "").Trim();
        var role = NormalizeRole(req.Role);
        var email = (req.Email ?? "").Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(name)) return BadRequest("full_name_required");
        if (string.IsNullOrWhiteSpace(phone)) return BadRequest("phone_required");

        var phoneNorm = NormalizePhone(phone);
        if (string.IsNullOrWhiteSpace(phoneNorm)) return BadRequest("phone_invalid");

        if (!string.IsNullOrWhiteSpace(email) && !LooksLikeEmail(email))
            return BadRequest("email_invalid");

        // unique checks
        var existsPhone = await _db.Users.AnyAsync(x => x.TenantId == tenantId && x.PhoneNorm == phoneNorm);
        if (existsPhone) return Conflict("phone_already_exists");

        if (!string.IsNullOrWhiteSpace(email))
        {
            var existsEmail = await _db.Users.AnyAsync(x => x.TenantId == tenantId && x.Email != null && x.Email.ToLower() == email);
            if (existsEmail) return Conflict("email_already_exists");
        }

        var tempPass = GenTempPassword();

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FullName = name,

            Phone = phone,
            PhoneNorm = phoneNorm,
            Email = string.IsNullOrWhiteSpace(email) ? null : email,

            Role = role,
            Status = "active",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPass),

            ForcePasswordChange = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new CreateUserResponse(user.Id, tempPass));
    }

    // POST /api/owner/users/{id}/reset-password
    [HttpPost("{id:guid}/reset-password")]
    public async Task<ActionResult<ResetPasswordResponse>> ResetPassword([FromRoute] Guid id)
    {
        EnsureTenant();
        var tenantId = CurrentTenantId;

        var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
        if (user is null) return NotFound("user_not_found");

        // owner hesabını resetlemek istersen izin ver; istersen burada engelleriz
        var tempPass = GenTempPassword();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPass);
        user.ForcePasswordChange = true;

        await _db.SaveChangesAsync();

        return Ok(new ResetPasswordResponse(user.Id, tempPass));
    }

    // PATCH /api/owner/users/{id}
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] UpdateUserRequest req)
    {
        EnsureTenant();
        var tenantId = CurrentTenantId;

        var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
        if (user is null) return NotFound("user_not_found");

        if (req.FullName != null)
        {
            var name = req.FullName.Trim();
            if (string.IsNullOrWhiteSpace(name)) return BadRequest("full_name_required");
            user.FullName = name;
        }

        if (req.Role != null)
        {
            user.Role = NormalizeRole(req.Role);
        }

        if (req.Status != null)
        {
            user.Status = NormalizeStatus(req.Status);
        }

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}
