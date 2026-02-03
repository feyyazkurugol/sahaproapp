using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SahaPro.Api.Data;

namespace SahaPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/users")]
public class UsersController : BaseController
{
    private readonly SahaProDbContext _db;
    public UsersController(SahaProDbContext db) => _db = db;

    public sealed record UserListItemRow(
        Guid Id,
        string FullName,
        string? Phone,
        string Email,
        string Role,
        string? Status
    );

    // ✅ Owner/Dispatcher: Tech listesini getir
    // GET /api/users/techs?q=...
    [HttpGet("techs")]
    public async Task<IActionResult> GetTechs([FromQuery] string? q)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        // ✅ Tek kaynak: BaseController.CurrentRole
        // Program.cs'te MapInboundClaims=false + RoleClaimType net olunca stabil çalışır.
        var role = (CurrentRole ?? "").Trim().ToLowerInvariant();

        // ⚠️ Forbid("forbidden") YAPMA -> scheme sanıp patlar
        if (role != "owner" && role != "dispatcher")
            return StatusCode(StatusCodes.Status403Forbidden, "forbidden");

        var query = _db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId)
            .Where(u => (u.Role ?? "").ToLower() == "tech");

        var term = (q ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(term))
        {
            term = term.Trim();

            // ✅ Postgres için en doğru "case-insensitive contains"
            var like = $"%{term}%";

            query = query.Where(u =>
                EF.Functions.ILike(u.FullName ?? "", like) ||
                EF.Functions.ILike(u.Email ?? "", like) ||
                EF.Functions.ILike(u.Phone ?? "", like)
            );
        }

        var items = await query
            .OrderBy(u => u.FullName)
            .Select(u => new UserListItemRow(
                u.Id,
                u.FullName ?? "",
                u.Phone,
                u.Email ?? "",
                u.Role ?? "",
                u.Status
            ))
            .ToListAsync();

        return Ok(items);
    }
}
