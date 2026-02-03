using System;

namespace SahaPro.Api.Models
{
    public class WorkOrderPhoto
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid TenantId { get; set; }
        public Guid WorkOrderId { get; set; }

        // "before" | "after"
        public string Kind { get; set; } = "before";

        // Dosya bilgileri
        public string FileName { get; set; } = default!;
        public string ContentType { get; set; } = default!;
        public long SizeBytes { get; set; }

        // API'den döneceğimiz public URL (wwwroot altında)
        public string Url { get; set; } = default!;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
