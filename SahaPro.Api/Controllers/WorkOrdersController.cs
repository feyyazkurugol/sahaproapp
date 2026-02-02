using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SahaPro.Api.Controllers.Models;
using SahaPro.Api.Data;
using SahaPro.Api.Domain;

namespace SahaPro.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/workorders")]
public class WorkOrdersController : BaseController
{
    private readonly SahaProDbContext _db;
    public WorkOrdersController(SahaProDbContext db) => _db = db;

    public sealed record WorkOrderListItemRow(
        Guid Id,
        string Status,
        string? Notes,
        DateTimeOffset? ScheduledStartAt,
        DateTimeOffset? AssignedAt,
        string? Note,
        int PhotoCount,
        int PaymentCount,
        DateTimeOffset? CancelledAt,
        string? CancelReason,
        string? CancelNote
    );

    public sealed record WorkOrderDispatchListRow(
        Guid Id,
        string Status,
        string? Notes,
        DateTimeOffset? ScheduledStartAt,
        Guid? CustomerId,
        string? CustomerName,
        Guid? SiteId,
        string? SiteTitle,
        string? AddressText,
        Guid? AssignedToUserId,
        DateTimeOffset? AssignedAt,
        string? DispatchNote,
        DateTimeOffset? CancelledAt,
        string? CancelReason
    );

    public sealed record WorkOrderCountsRow(
        long Pending,
        long InProgress,
        long Completed,
        long Cancelled,
        long Total
    );

    public sealed class AssignUserRequest
    {
        public Guid TechUserId { get; set; }
        public string? Note { get; set; }
    }

    // ✅ role helper (claim: "role")
    // ⚠️ Forbid("x") kullanma -> "x" scheme sanılıp patlar.
    private IActionResult? RequireAnyRole(params string[] roles)
    {
        var role = User?.Claims?.FirstOrDefault(c =>
            c.Type == "role" || c.Type.EndsWith("/role", StringComparison.OrdinalIgnoreCase)
        )?.Value;

        role = (role ?? "").Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(role))
            return StatusCode(StatusCodes.Status403Forbidden, "role_claim_missing");

        foreach (var r in roles)
        {
            if (role == r.Trim().ToLowerInvariant()) return null;
        }

        return StatusCode(StatusCodes.Status403Forbidden, "forbidden");
    }

    // ✅ Dispatch list (tenant-wide, owner/dispatcher)
    // GET /api/workorders?status=pending&q=...&onlyUnassigned=true
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] bool? onlyUnassigned
    )
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var forbid = RequireAnyRole("owner", "dispatcher");
        if (forbid is not null) return forbid;

        var st = (status ?? "all").Trim().ToLowerInvariant();

        var statusWhere = st switch
        {
            "pending" => "and lower(coalesce(wo.status,'')) in ('scheduled','pending')",
            "in_progress" => "and lower(coalesce(wo.status,'')) = 'in_progress'",
            "completed" => "and lower(coalesce(wo.status,'')) = 'completed'",
            "cancelled" or "canceled" => "and lower(coalesce(wo.status,'')) in ('cancelled','canceled')",
            "all" or "" => "",
            _ => ""
        };

        // ✅ Ürün kararı: pending ekranı = "atanacak işler"
        // onlyUnassigned paramı gönderilmezse pending için default TRUE
        var onlyUnassignedEffective = onlyUnassigned ?? (st == "pending");

        // ✅ AssignedToUserId alias'ına bağlı kalmadan, kesin filtre:
        // work_order_assignees içinde 'user' assignee yoksa -> atanmadı
        var unassignedWhere = onlyUnassignedEffective
            ? @"and not exists (
                    select 1
                    from work_order_assignees a2
                    where a2.tenant_id = wo.tenant_id
                      and a2.work_order_id = wo.id
                      and a2.assignee_type = 'user'
                )"
            : "";

        var term = (q ?? "").Trim().ToLowerInvariant();
        var hasQ = !string.IsNullOrWhiteSpace(term);

        var qWhere = hasQ
            ? @"and (
                    lower(coalesce(c.name,'')) like @p1
                 or lower(coalesce(s.title,'')) like @p1
                 or lower(coalesce(s.address_text,'')) like @p1
                 or lower(coalesce(wo.notes,'')) like @p1
                )"
            : "";

        // ✅ work_order_assignees uuid alanına MAX uygulanamaz: max(uuid) yok -> 42883
        // ✅ MVP: tek user assignee varsayımı; deterministik olsun diye assignee_id::text ile sırala + limit 1
        var sql = $@"
            select
              wo.id as ""Id"",
              wo.status as ""Status"",
              wo.notes as ""Notes"",
              wo.scheduled_start_at as ""ScheduledStartAt"",

              wo.customer_id as ""CustomerId"",
              c.name as ""CustomerName"",

              wo.site_id as ""SiteId"",
              s.title as ""SiteTitle"",
              s.address_text as ""AddressText"",

              (
                select a.assignee_id
                from work_order_assignees a
                where a.tenant_id = wo.tenant_id
                  and a.work_order_id = wo.id
                  and a.assignee_type = 'user'
                order by a.assignee_id::text asc
                limit 1
              ) as ""AssignedToUserId"",

              (
                select d.assigned_at
                from work_order_dispatch d
                where d.tenant_id = wo.tenant_id
                  and d.work_order_id = wo.id
                order by d.assigned_at desc
                limit 1
              ) as ""AssignedAt"",

              (
                select d.note
                from work_order_dispatch d
                where d.tenant_id = wo.tenant_id
                  and d.work_order_id = wo.id
                order by d.assigned_at desc
                limit 1
              ) as ""DispatchNote"",

              wo.cancelled_at as ""CancelledAt"",
              wo.cancel_reason as ""CancelReason""

            from work_orders wo
            left join customers c on c.tenant_id = wo.tenant_id and c.id = wo.customer_id
            left join customer_sites s on s.tenant_id = wo.tenant_id and s.id = wo.site_id
            where wo.tenant_id = @p0
              {statusWhere}
              {unassignedWhere}
              {qWhere}
            order by wo.scheduled_start_at asc nulls last
        ";

        List<WorkOrderDispatchListRow> items;
        if (hasQ)
        {
            var like = $"%{term}%";
            items = await _db.Database.SqlQueryRaw<WorkOrderDispatchListRow>(sql, tenantId, like).ToListAsync();
        }
        else
        {
            items = await _db.Database.SqlQueryRaw<WorkOrderDispatchListRow>(sql, tenantId).ToListAsync();
        }

        return Ok(items);
    }

    // ✅ Owner/Dispatcher -> Tech'e iş atama
    [HttpPost("{workOrderId:guid}/assign-user")]
    public async Task<IActionResult> AssignUser(Guid workOrderId, [FromBody] AssignUserRequest req)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");
        if (workOrderId == Guid.Empty) return BadRequest("workOrderId_required");
        if (req is null) return BadRequest("body_required");
        if (req.TechUserId == Guid.Empty) return BadRequest("techUserId_required");

        var forbid = RequireAnyRole("owner", "dispatcher");
        if (forbid is not null) return forbid;

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);
        if (wo is null) return NotFound("work_order_not_found");

        var st = (wo.Status ?? "").Trim().ToLowerInvariant();
        if (st == "completed") return BadRequest("work_order_locked_completed");
        if (st is "cancelled" or "canceled") return BadRequest("work_order_locked_cancelled");

        // ✅ eski user assignee sil
        await _db.Database.ExecuteSqlRawAsync(@"
            delete from work_order_assignees
            where tenant_id = {0}
              and work_order_id = {1}
              and assignee_type = 'user'
        ", tenantId, workOrderId);

        // ✅ yeni user assignee ekle
        await _db.Database.ExecuteSqlRawAsync(@"
            insert into work_order_assignees (tenant_id, work_order_id, assignee_type, assignee_id)
            values ({0}, {1}, 'user', {2})
        ", tenantId, workOrderId, req.TechUserId);

        // ✅ dispatch log yaz (AssignedAt / DispatchNote buradan okunuyor)
        var note = (req.Note ?? "").Trim();
        await _db.Database.ExecuteSqlRawAsync(@"
            insert into work_order_dispatch (tenant_id, work_order_id, assigned_at, note)
            values ({0}, {1}, {2}, {3})
        ", tenantId, workOrderId, DateTimeOffset.UtcNow, string.IsNullOrWhiteSpace(note) ? null : note);

        return Ok(new
        {
            ok = true,
            workOrderId,
            assignee = new
            {
                assigneeType = "user",
                assigneeId = req.TechUserId,
                note = string.IsNullOrWhiteSpace(note) ? null : note
            }
        });
    }

    [HttpGet("by-tech/{techUserId:guid}")]
    public async Task<IActionResult> GetByTech(Guid techUserId, [FromQuery] string? status)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");
        if (techUserId == Guid.Empty) return BadRequest("techUserId_required");

        var st = (status ?? "all").Trim().ToLowerInvariant();

        var statusWhere = st switch
        {
            "pending" => "and lower(coalesce(wo.status,'')) in ('scheduled','pending')",
            "in_progress" => "and lower(coalesce(wo.status,'')) = 'in_progress'",
            "completed" => "and lower(coalesce(wo.status,'')) = 'completed'",
            "cancelled" or "canceled" => "and lower(coalesce(wo.status,'')) in ('cancelled','canceled')",
            "all" or "" => "",
            _ => ""
        };

        var sql = $@"
        select
          wo.id as ""Id"",
          wo.status as ""Status"",
          wo.notes as ""Notes"",
          wo.scheduled_start_at as ""ScheduledStartAt"",

          (
            select d.assigned_at
            from work_order_dispatch d
            where d.tenant_id = wo.tenant_id
              and d.work_order_id = wo.id
            order by d.assigned_at desc
            limit 1
          ) as ""AssignedAt"",

          (
            select d.note
            from work_order_dispatch d
            where d.tenant_id = wo.tenant_id
              and d.work_order_id = wo.id
            order by d.assigned_at desc
            limit 1
          ) as ""Note"",

          (
            select count(*)
            from attachments at
            where at.tenant_id = wo.tenant_id
              and at.entity_type = 'work_order'
              and at.entity_id = wo.id
          ) as ""PhotoCount"",

          (
            select count(*)
            from payments p
            where p.tenant_id = wo.tenant_id
              and p.work_order_id = wo.id
          ) as ""PaymentCount"",

          wo.cancelled_at as ""CancelledAt"",
          wo.cancel_reason as ""CancelReason"",
          wo.cancel_note as ""CancelNote""

        from work_orders wo
        join work_order_assignees a on a.work_order_id = wo.id
        where wo.tenant_id = @p0
          and a.tenant_id = @p0
          and a.assignee_type = 'user'
          and a.assignee_id = @p1
          {statusWhere}
        order by wo.scheduled_start_at asc nulls last
    ";

        var items = await _db.Database
            .SqlQueryRaw<WorkOrderListItemRow>(sql, tenantId, techUserId)
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("by-tech/{techUserId:guid}/counts")]
    public async Task<IActionResult> GetByTechCounts(Guid techUserId)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");
        if (techUserId == Guid.Empty) return BadRequest("techUserId_required");

        var sql = @"
        select
          coalesce(sum(case when lower(coalesce(wo.status,'')) in ('scheduled','pending') then 1 else 0 end),0) as ""Pending"",
          coalesce(sum(case when lower(coalesce(wo.status,'')) = 'in_progress' then 1 else 0 end),0) as ""InProgress"",
          coalesce(sum(case when lower(coalesce(wo.status,'')) = 'completed' then 1 else 0 end),0) as ""Completed"",
          coalesce(sum(case when lower(coalesce(wo.status,'')) in ('cancelled','canceled') then 1 else 0 end),0) as ""Cancelled"",
          count(*) as ""Total""
        from work_orders wo
        join work_order_assignees a on a.work_order_id = wo.id
        where wo.tenant_id = @p0
          and a.tenant_id = @p0
          and a.assignee_type = 'user'
          and a.assignee_id = @p1
    ";

        var row = await _db.Database
            .SqlQueryRaw<WorkOrderCountsRow>(sql, tenantId, techUserId)
            .FirstOrDefaultAsync();

        row ??= new WorkOrderCountsRow(0, 0, 0, 0, 0);
        return Ok(row);
    }

    [HttpGet("{workOrderId:guid}/detail")]
    public async Task<IActionResult> Detail(Guid workOrderId)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var wo = await _db.WorkOrders.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);

        if (wo is null) return NotFound("work_order_not_found");

        var customer = await _db.Customers.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.Id == wo.CustomerId)
            .Select(c => new { c.Id, c.Type, c.Name, c.Phone, c.Notes })
            .FirstOrDefaultAsync();

        var site = await _db.CustomerSites.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.Id == wo.SiteId)
            .Select(s => new { s.Id, s.Title, s.AddressText, s.City, s.CountryCode })
            .FirstOrDefaultAsync();

        var photos = await _db.Attachments.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.EntityType == "work_order" && a.EntityId == workOrderId)
            .OrderBy(a => a.TakenAt)
            .Select(a => new { a.Id, a.Kind, a.StorageKey, a.TakenAt, a.TakenBy })
            .ToListAsync();

        var payments = await _db.Payments.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.WorkOrderId == workOrderId)
            .OrderBy(p => p.PaidAt)
            .Select(p => new { p.Id, p.Amount, p.Currency, p.Method, p.Status, p.PaidAt, p.CreatedBy })
            .ToListAsync();

        return Ok(new
        {
            workOrder = new
            {
                wo.Id,
                wo.Status,
                wo.Notes,
                wo.ScheduledStartAt,
                wo.StartedAt,
                wo.CompletedAt,
                wo.StartLat,
                wo.StartLng,
                wo.EndLat,
                wo.EndLng,
                wo.CancelledAt,
                wo.CancelReason,
                wo.CancelNote
            },
            customer,
            site,
            photos,
            payments
        });
    }

    [HttpPost("{workOrderId:guid}/start")]
    public async Task<IActionResult> Start(Guid workOrderId, [FromBody] StartWorkOrderRequest req)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);
        if (wo is null) return NotFound("work_order_not_found");

        if ((wo.Status ?? "").Trim().ToLowerInvariant() == "completed")
            return BadRequest("work_order_locked_completed");

        wo.Status = "in_progress";
        wo.StartedAt = DateTimeOffset.UtcNow;
        wo.StartLat = req.Lat;
        wo.StartLng = req.Lng;

        await _db.SaveChangesAsync();
        return Ok(new { wo.Id, wo.Status, wo.StartedAt, wo.StartLat, wo.StartLng });
    }

    [HttpPost("{workOrderId:guid}/complete")]
    public async Task<IActionResult> Complete(Guid workOrderId, [FromBody] CompleteWorkOrderRequest req)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);
        if (wo is null) return NotFound("work_order_not_found");

        wo.Status = "completed";
        wo.CompletedAt = DateTimeOffset.UtcNow;
        wo.EndLat = req.Lat;
        wo.EndLng = req.Lng;

        await _db.SaveChangesAsync();
        return Ok(new { wo.Id, wo.Status, wo.CompletedAt, wo.EndLat, wo.EndLng });
    }

    [HttpPost("{workOrderId:guid}/photos/upload")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadPhoto(Guid workOrderId, [FromQuery] string kind, [FromForm] IFormFile file)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var wo = await _db.WorkOrders.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);

        if (wo is null) return NotFound("work_order_not_found");

        if ((wo.Status ?? "").ToLowerInvariant() == "completed")
            return BadRequest("work_order_locked_completed");

        var k = (kind ?? "").Trim().ToLowerInvariant();
        if (k is not ("before" or "after" or "other"))
            return BadRequest("kind_must_be_before_after_other");

        if (file is null || file.Length == 0)
            return BadRequest("file_required");

        var webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var folder = Path.Combine(webRoot, "uploads", tenantId.ToString(), workOrderId.ToString());
        Directory.CreateDirectory(folder);

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

        var fileName = $"{k}_{DateTimeOffset.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(folder, fileName);

        await using (var fs = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(fs);
        }

        var storageKey = $"/uploads/{tenantId}/{workOrderId}/{fileName}";

        var a = new Attachment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = "work_order",
            EntityId = workOrderId,
            Kind = k,
            StorageKey = storageKey,
            TakenAt = DateTimeOffset.UtcNow,
            TakenBy = CurrentUserId == Guid.Empty ? null : CurrentUserId
        };

        _db.Attachments.Add(a);
        await _db.SaveChangesAsync();

        return Ok(new { a.Id, a.Kind, a.StorageKey, a.TakenAt, a.TakenBy });
    }

    [HttpDelete("{workOrderId:guid}/photos/{attachmentId:guid}")]
    public async Task<IActionResult> DeletePhoto(Guid workOrderId, Guid attachmentId)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var wo = await _db.WorkOrders.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);

        if (wo is null) return NotFound("work_order_not_found");

        if ((wo.Status ?? "").ToLowerInvariant() == "completed")
            return BadRequest("work_order_locked_completed");

        var a = await _db.Attachments
            .FirstOrDefaultAsync(x =>
                x.Id == attachmentId &&
                x.TenantId == tenantId &&
                x.EntityType == "work_order" &&
                x.EntityId == workOrderId);

        if (a is null) return NotFound("attachment_not_found");

        _db.Attachments.Remove(a);
        await _db.SaveChangesAsync();

        try
        {
            if (!string.IsNullOrWhiteSpace(a.StorageKey) && a.StorageKey.StartsWith("/uploads/"))
            {
                var webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var rel = a.StorageKey.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);

                var full = Path.GetFullPath(Path.Combine(webRoot, rel));
                var safeRoot = Path.GetFullPath(webRoot);

                if (full.StartsWith(safeRoot, StringComparison.OrdinalIgnoreCase) && System.IO.File.Exists(full))
                    System.IO.File.Delete(full);
            }
        }
        catch { }

        return Ok(new { ok = true, attachmentId });
    }

    [HttpPost("{workOrderId:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid workOrderId, [FromBody] AddPaymentRequest req)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);
        if (wo is null) return NotFound("work_order_not_found");

        if ((wo.Status ?? "").ToLowerInvariant() == "completed")
            return BadRequest("work_order_locked_completed");

        if (req.Amount <= 0) return BadRequest("amount_must_be_positive");

        var method = (req.Method ?? "").Trim().ToLowerInvariant();
        if (method is not ("cash" or "transfer" or "pos_later"))
            return BadRequest("method_invalid");

        var currency = string.IsNullOrWhiteSpace(req.Currency) ? "TRY" : req.Currency.Trim().ToUpperInvariant();

        var p = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            WorkOrderId = workOrderId,
            Amount = req.Amount,
            Currency = currency,
            Method = method,
            Status = "paid",
            PaidAt = DateTimeOffset.UtcNow,
            CreatedBy = CurrentUserId == Guid.Empty ? null : CurrentUserId
        };

        _db.Payments.Add(p);
        await _db.SaveChangesAsync();

        return Ok(new { p.Id, p.Amount, p.Currency, p.Method, p.Status, p.PaidAt, p.CreatedBy });
    }

    public sealed class CancelWorkOrderRequest
    {
        public string Reason { get; set; } = "";
        public string? Note { get; set; }
        public double? Lat { get; set; }
        public double? Lng { get; set; }
    }

    [HttpPost("{workOrderId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid workOrderId, [FromBody] CancelWorkOrderRequest req)
    {
        var tenantId = CurrentTenantId;
        if (tenantId == Guid.Empty) return Unauthorized("tenant_claim_missing");

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(x => x.Id == workOrderId && x.TenantId == tenantId);
        if (wo is null) return NotFound("work_order_not_found");

        var status = (wo.Status ?? "").Trim().ToLowerInvariant();
        if (status == "completed") return BadRequest("work_order_locked_completed");
        if (status == "cancelled" || status == "canceled") return BadRequest("already_cancelled");

        var reason = (req.Reason ?? "").Trim();
        if (string.IsNullOrWhiteSpace(reason)) return BadRequest("reason_required");

        wo.Status = "cancelled";
        wo.CancelledAt = DateTimeOffset.UtcNow;
        wo.CancelReason = reason;

        var note = (req.Note ?? "").Trim();
        wo.CancelNote = string.IsNullOrWhiteSpace(note) ? null : note;

        wo.EndLat = req.Lat is null ? null : (decimal?)req.Lat.Value;
        wo.EndLng = req.Lng is null ? null : (decimal?)req.Lng.Value;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            wo.Id,
            wo.Status,
            wo.CancelledAt,
            wo.CancelReason,
            wo.CancelNote,
            wo.EndLat,
            wo.EndLng
        });
    }
}
