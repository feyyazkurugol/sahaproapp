using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SahaPro.Api.Data;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// --------------------
// Controllers
// --------------------
builder.Services.AddControllers();

// --------------------
// PostgreSQL DbContext
// --------------------
builder.Services.AddDbContext<SahaProDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
);

// --------------------
// HttpContext
// --------------------
builder.Services.AddHttpContextAccessor();

// --------------------
// JWT Authentication
// --------------------
var jwtSection = builder.Configuration.GetSection("Jwt");
var issuer = jwtSection["Issuer"];
var audience = jwtSection["Audience"];
var key = jwtSection["Key"];

if (string.IsNullOrWhiteSpace(key))
    throw new InvalidOperationException("Jwt:Key is missing. Check appsettings.json / environment variables.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // ✅ Claim mapping kapansın (sub/role karışmasın)
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ClockSkew = TimeSpan.FromSeconds(15),

            // ✅ Role policy'leri ve BaseController daha stabil olsun
            RoleClaimType = ClaimTypes.Role,  // = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
            NameClaimType = "sub"             // kullanıcı id’yi sub’dan okumak net
        };

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                Console.WriteLine("JWT FAIL: " + ctx.Exception.GetType().Name + " - " + ctx.Exception.Message);
                return Task.CompletedTask;
            },
            OnChallenge = ctx =>
            {
                Console.WriteLine("JWT CHALLENGE: " + ctx.Error + " - " + ctx.ErrorDescription);
                return Task.CompletedTask;
            }
        };
    });

// --------------------
// Authorization (Roles / Policies)
// --------------------
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("OwnerOnly", p => p.RequireRole("owner"));
    options.AddPolicy("SalesOrOwner", p => p.RequireRole("sales", "owner"));
    options.AddPolicy("TechOrDispatcherOrOwner",
        p => p.RequireRole("tech", "dispatcher", "owner"));
});

// --------------------
// CORS (DEV)
// --------------------
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// --------------------
// HTTPS Redirect
// --------------------
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// --------------------
// Static files (wwwroot/uploads)
// --------------------
app.UseStaticFiles();

// --------------------
// CORS
// --------------------
app.UseCors("DevCors");

// --------------------
// Auth middleware
// --------------------
app.UseAuthentication();
app.UseAuthorization();

// --------------------
// Map Controllers
// --------------------
app.MapControllers();

app.Run();
