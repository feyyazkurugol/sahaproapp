using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SahaPro.Api.Data;
using SahaPro.Api.Data.Entities;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SahaPro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly SahaProDbContext _db;
    private readonly IConfiguration _cfg;

    public AuthController(SahaProDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cfg = cfg;
    }

    // ✅ MVP: telefon ile login (email optional)
    // identifier: phone OR email (geriye dönük)
    public record LoginRequest(string Identifier, string Password);
    public record LoginResponse(
        string Token,
        string Role,
        Guid TenantId,
        Guid UserId,
        string FullName,
        bool ForcePasswordChange
    );

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest req)
    {
        var identifier = (req.Identifier ?? "").Trim();
        var password = req.Password ?? "";

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(password))
            return BadRequest("identifier_password_required");

        // ✅ önce phone_norm ile ara (asıl login yolu)
        var phoneNorm = NormalizePhone(identifier);

        AppUser? user = null;

        if (!string.IsNullOrEmpty(phoneNorm))
        {
            user = await _db.Users.FirstOrDefaultAsync(x =>
                x.PhoneNorm == phoneNorm && x.Status != "passive"
            );
        }

        // ✅ geriye dönük: email ile login (identifier email format ise)
        if (user is null && LooksLikeEmail(identifier))
        {
            var email = identifier.ToLowerInvariant();
            user = await _db.Users.FirstOrDefaultAsync(x =>
                x.Email != null && x.Email.ToLower() == email && x.Status != "passive"
            );
        }

        if (user is null) return Unauthorized("invalid_credentials");

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return Unauthorized("invalid_credentials");

        var role = NormalizeRole(user.Role);

        var jwt = _cfg.GetSection("Jwt");
        var token = BuildJwt(
            issuer: jwt["Issuer"]!,
            audience: jwt["Audience"]!,
            key: jwt["Key"]!,
            expiresMinutes: int.Parse(jwt["ExpiresMinutes"] ?? "720"),
            user: user,
            role: role
        );

        return Ok(new LoginResponse(token, role, user.TenantId, user.Id, user.FullName, user.ForcePasswordChange));
    }

    private static string BuildJwt(string issuer, string audience, string key, int expiresMinutes, AppUser user, string role)
    {
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim("tenant_id", user.TenantId.ToString()),
            new Claim(ClaimTypes.Role, role),
            new Claim("name", user.FullName ?? ""),

            // ✅ frontend isterse buradan anlayıp şifre değiştir ekranına atar
            new Claim("force_password_change", user.ForcePasswordChange ? "true" : "false"),
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string NormalizeRole(string? role)
    {
        var r = (role ?? "").Trim().ToLowerInvariant();
        return r switch
        {
            "owner" => "owner",
            "admin" => "admin", // geriye dönük
            "dispatcher" => "dispatcher",
            "sales" => "sales",
            "tech" => "tech",
            _ => "tech"
        };
    }

    private static bool LooksLikeEmail(string s)
    {
        s = (s ?? "").Trim();
        return s.Contains("@") && s.Contains(".");
    }

    // ✅ En düşük maliyetli normalize:
    // "05xx..." -> "90..." ; "+90..." -> "90..." ; tüm non-digit silinir
    // Not: ülke kodu yoksa TR varsayılır.
    private static string? NormalizePhone(string raw)
    {
        var s = (raw ?? "").Trim();
        if (string.IsNullOrWhiteSpace(s)) return null;

        var digits = new string(s.Where(char.IsDigit).ToArray());
        if (digits.Length < 10) return null;

        // 0 ile başlıyorsa TR local
        if (digits.StartsWith("0") && digits.Length == 11)
            digits = "90" + digits.Substring(1);

        // 5XXXXXXXXX (10 hane) gelirse TR varsay
        if (digits.Length == 10 && digits.StartsWith("5"))
            digits = "90" + digits;

        // zaten 90 ile başlıyorsa tamam
        if (digits.Length >= 12 && digits.StartsWith("90"))
            return digits;

        // farklı ülke/format: en azından digits dönelim (tenant içinde unique olacaksa yönetiriz)
        return digits;
    }
}
