namespace SahaPro.Api.Domain;

public class Customer
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Type { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Phone { get; set; }
    public string? Notes { get; set; }
}
