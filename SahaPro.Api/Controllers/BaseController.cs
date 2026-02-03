using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Linq;

namespace SahaPro.Api.Controllers;

public abstract class BaseController : ControllerBase
{
    protected Guid CurrentTenantId
    {
        get
        {
            // en yaygın: "tenant_id"
            var raw =
                User?.FindFirstValue("tenant_id")
                ?? User?.FindFirstValue("tenantId")
                ?? User?.Claims?.FirstOrDefault(c =>
                       c.Type.EndsWith("/tenant_id", StringComparison.OrdinalIgnoreCase) ||
                       c.Type.EndsWith("/tenantid", StringComparison.OrdinalIgnoreCase)
                   )?.Value;

            return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
        }
    }

    protected Guid CurrentUserId
    {
        get
        {
            // sub en garantisi, bazı sistemler NameIdentifier da koyar (schema'lı da gelebilir)
            var raw =
                User?.FindFirstValue("sub")
                ?? User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User?.Claims?.FirstOrDefault(c =>
                       c.Type.EndsWith("/nameidentifier", StringComparison.OrdinalIgnoreCase)
                   )?.Value;

            return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
        }
    }

    protected string CurrentRole
    {
        get
        {
            var raw =
                User?.FindFirstValue("role")
                ?? User?.FindFirstValue(ClaimTypes.Role)
                ?? User?.Claims?.FirstOrDefault(c =>
                       c.Type.EndsWith("/role", StringComparison.OrdinalIgnoreCase)
                   )?.Value;

            return (raw ?? "").Trim().ToLowerInvariant();
        }
    }
}
