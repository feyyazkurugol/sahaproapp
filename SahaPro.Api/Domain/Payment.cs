namespace SahaPro.Api.Domain;

public class Payment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid WorkOrderId { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public string Method { get; set; } = default!; // cash/transfer/pos_later
    public string Status { get; set; } = default!; // pending/paid/refunded

    public DateTimeOffset? PaidAt { get; set; }
    public Guid? CreatedBy { get; set; }
}
