using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SahaPro.Api.Data;

namespace SahaPro.Api.Controllers;

[ApiController]
[Route("api/dev")]
public class DevController : ControllerBase
{
    private readonly SahaProDbContext _db;
    public DevController(SahaProDbContext db) => _db = db;

    // ✅ DEV ONLY: Scheduled test işi üretir + team assignee bağlar
    // GET /api/dev/seed-workorder?tenantId=...&teamId=...
    [HttpGet("seed-workorder")]
    public async Task<IActionResult> SeedWorkOrder([FromQuery] Guid tenantId, [FromQuery] Guid teamId)
    {
        if (tenantId == Guid.Empty) return BadRequest("tenantId_required");
        if (teamId == Guid.Empty) return BadRequest("teamId_required");

        // Customer + Site: mevcut yoksa ilk bulduğunu kullan (demo)
        var customerId = await _db.Customers
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var siteId = await _db.CustomerSites
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        if (customerId == Guid.Empty || siteId == Guid.Empty)
            return BadRequest("customer_or_site_missing_for_tenant");

        var workOrderId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        // work_orders insert
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            insert into work_orders
            (id, tenant_id, customer_id, site_id, status, notes, scheduled_start_at, started_at, completed_at, start_lat, start_lng, end_lat, end_lng)
            values
            ({workOrderId}, {tenantId}, {customerId}, {siteId}, 'scheduled', 'DEV Scheduled Test Job', {now.AddMinutes(10)}, null, null, null, null, null, null)
        ");

        // work_order_assignees insert (team assignee)
        var assigneeId = Guid.NewGuid();
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            insert into work_order_assignees
            (id, tenant_id, work_order_id, assignee_type, assignee_id, assigned_at, note)
            values
            ({assigneeId}, {tenantId}, {workOrderId}, 'team', {teamId}, {now}, 'dev seed')
        ");

        return Ok(new
        {
            workOrderId,
            tenantId,
            teamId,
            status = "scheduled"
        });
    }
}
