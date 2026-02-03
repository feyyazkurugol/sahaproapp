namespace SahaPro.Api.Domain;

public class Attachment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string EntityType { get; set; } = default!;
    public Guid EntityId { get; set; }
    public string Kind { get; set; } = default!;
    public string StorageKey { get; set; } = default!;
    public DateTimeOffset TakenAt { get; set; }
    public Guid? TakenBy { get; set; }
}
