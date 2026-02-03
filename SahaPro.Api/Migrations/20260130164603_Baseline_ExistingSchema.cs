using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SahaPro.Api.Migrations
{
    public partial class Baseline_ExistingSchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // baseline: intentionally empty
            // This migration exists only to mark the current DB schema as "already applied".
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // baseline: intentionally empty
        }
    }
}
