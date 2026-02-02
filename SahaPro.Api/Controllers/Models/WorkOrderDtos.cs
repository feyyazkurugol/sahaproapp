namespace SahaPro.Api.Controllers.Models;

// ✅ TenantId artık body'den gelmez (claim'den alınacak)
public sealed class StartWorkOrderRequest
{
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
}

public sealed class CompleteWorkOrderRequest
{
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
}

public sealed class AddPaymentRequest
{
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public string? Method { get; set; }
}

// (Opsiyonel) JSON ile foto ekleme endpointini tutacaksan
public sealed class AddPhotoRequest
{
    public string? Kind { get; set; }
    public string? StorageKey { get; set; }
}
