using Microsoft.EntityFrameworkCore;
using SahaPro.Api.Domain;
using SahaPro.Api.Data.Entities;

namespace SahaPro.Api.Data;

public class SahaProDbContext : DbContext
{
    public SahaProDbContext(DbContextOptions<SahaProDbContext> options) : base(options) { }

    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<WorkOrderDispatch> WorkOrderDispatches => Set<WorkOrderDispatch>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Payment> Payments => Set<Payment>();

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerSite> CustomerSites => Set<CustomerSite>();

    // ✅ Auth v2
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<AppUser> Users => Set<AppUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<WorkOrder>(e =>
        {
            e.ToTable("work_orders");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.CustomerId).HasColumnName("customer_id");
            e.Property(x => x.SiteId).HasColumnName("site_id");

            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Notes).HasColumnName("notes");

            e.Property(x => x.ScheduledStartAt).HasColumnName("scheduled_start_at");
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.CompletedAt).HasColumnName("completed_at");

            e.Property(x => x.StartLat).HasColumnName("start_lat");
            e.Property(x => x.StartLng).HasColumnName("start_lng");
            e.Property(x => x.EndLat).HasColumnName("end_lat");
            e.Property(x => x.EndLng).HasColumnName("end_lng");
        });

        modelBuilder.Entity<WorkOrderDispatch>(e =>
        {
            e.ToTable("work_order_dispatch");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.WorkOrderId).HasColumnName("work_order_id");
            e.Property(x => x.AssignedToUserId).HasColumnName("assigned_to_user_id");
            e.Property(x => x.AssignedAt).HasColumnName("assigned_at");
            e.Property(x => x.Note).HasColumnName("note");
        });

        modelBuilder.Entity<Attachment>(e =>
        {
            e.ToTable("attachments");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.EntityType).HasColumnName("entity_type");
            e.Property(x => x.EntityId).HasColumnName("entity_id");
            e.Property(x => x.Kind).HasColumnName("kind");
            e.Property(x => x.StorageKey).HasColumnName("storage_key");
            e.Property(x => x.TakenAt).HasColumnName("taken_at");
            e.Property(x => x.TakenBy).HasColumnName("taken_by");
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.ToTable("payments");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.WorkOrderId).HasColumnName("work_order_id");
            e.Property(x => x.Amount).HasColumnName("amount");
            e.Property(x => x.Currency).HasColumnName("currency");
            e.Property(x => x.Method).HasColumnName("method");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.PaidAt).HasColumnName("paid_at");
            e.Property(x => x.CreatedBy).HasColumnName("created_by");
        });

        modelBuilder.Entity<Customer>(e =>
        {
            e.ToTable("customers");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.Type).HasColumnName("type");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Phone).HasColumnName("phone");
            e.Property(x => x.Notes).HasColumnName("notes");
        });

        modelBuilder.Entity<CustomerSite>(e =>
        {
            e.ToTable("customer_sites");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.CustomerId).HasColumnName("customer_id");
            e.Property(x => x.Title).HasColumnName("title");
            e.Property(x => x.AddressText).HasColumnName("address_text");
            e.Property(x => x.City).HasColumnName("city");
            e.Property(x => x.CountryCode).HasColumnName("country_code");
        });

        modelBuilder.Entity<Tenant>(e =>
        {
            e.ToTable("tenants");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");

            e.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<AppUser>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);

            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.FullName).HasColumnName("full_name");
            e.Property(x => x.Phone).HasColumnName("phone");
            e.Property(x => x.Email).HasColumnName("email");
            e.Property(x => x.PasswordHash).HasColumnName("password_hash");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Role).HasColumnName("role"); // owner/dispatcher/tech/sales...
            e.Property(x => x.CreatedAt).HasColumnName("created_at");

            // ✅ Email opsiyonelse: null olanlar unique'e takılmasın
            e.HasIndex(x => new { x.TenantId, x.Email })
             .IsUnique()
             .HasFilter("\"email\" is not null");

            // ✅ Phone opsiyonelse: null olanlar unique'e takılmasın
            e.HasIndex(x => new { x.TenantId, x.Phone })
             .IsUnique()
             .HasFilter("\"phone\" is not null");

            // ✅ Role bazlı filtreler için hız
            e.HasIndex(x => new { x.TenantId, x.Role });
        });
    }
}
