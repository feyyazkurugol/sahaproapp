namespace SahaPro.Api.Domain;

public class WorkOrderDispatch
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid WorkOrderId { get; set; }
    public Guid AssignedToUserId { get; set; }
    public DateTimeOffset AssignedAt { get; set; }
    public string? Note { get; set; }
}
