using System.ComponentModel.DataAnnotations;

namespace SahaPro.Api.Data.Entities;

public class Tenant
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(120)]
    public string Name { get; set; } = default!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
