namespace SahaPro.Api.Domain;

public class CustomerSite
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    public Guid CustomerId { get; set; }

    public string Title { get; set; } = default!;
    public string AddressText { get; set; } = default!;

    public string? City { get; set; }
    public string? CountryCode { get; set; }
}
