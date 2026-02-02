using System.ComponentModel.DataAnnotations.Schema;

namespace SahaPro.Api.Domain;

public class WorkOrder
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    public Guid CustomerId { get; set; }
    public Guid SiteId { get; set; }

    public string Status { get; set; } = default!;
    public string Notes { get; set; } = default!;

    public DateTimeOffset? ScheduledStartAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public decimal? StartLat { get; set; }
    public decimal? StartLng { get; set; }
    public decimal? EndLat { get; set; }
    public decimal? EndLng { get; set; }

    // ✅ İPTAL ALANLARI (DB'deki snake_case kolonlara map)
    [Column("cancelled_at")]
    public DateTimeOffset? CancelledAt { get; set; }

    [Column("cancel_reason")]
    public string? CancelReason { get; set; }

    [Column("cancel_note")]
    public string? CancelNote { get; set; }
}
