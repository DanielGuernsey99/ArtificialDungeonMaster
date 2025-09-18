using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System;
using System.Runtime.InteropServices;
using ArtificialDungeonMaster.Data.Models;

namespace ArtificialDungeonMaster.Data.DBContext
{
    public class ApplicationDbContext : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<Character> Characters => Set<Character>();
        public DbSet<AdventureSession> Sessions => Set<AdventureSession>();
        public DbSet<Turn> Turns => Set<Turn>();
        public DbSet<SrdChunk> SrdChunks => Set<SrdChunk>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // --- value converter for embeddings (float[] <-> varbinary(max)) ---
            var floatArrayToBytes = new ValueConverter<float[]?, byte[]?>(
                v => FloatEmbeddingConverter.ToBytes(v),
                v => FloatEmbeddingConverter.ToFloats(v));

            // --- Character ---
            modelBuilder.Entity<Character>(b =>
            {
                b.HasKey(c => c.Id);
                b.Property(c => c.Name).HasMaxLength(64).IsRequired();
                b.Property(c => c.Class).HasMaxLength(64);
                b.Property(c => c.Race).HasMaxLength(64);
                b.Property(c => c.RawJson).HasColumnType("nvarchar(max)");

                b.HasIndex(c => new { c.UserId, c.Name }).HasDatabaseName("IX_Characters_User_Name");

                // Make EF use UserId (prevents shadow AppUserId)
                b.HasOne<AppUser>()
                 .WithMany(u => u.Characters)
                 .HasForeignKey(c => c.UserId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            // --- AdventureSession + StoryState (JSON owned) ---
            modelBuilder.Entity<AdventureSession>(b =>
            {
                b.HasKey(s => s.Id);
                b.Property(s => s.Title).HasMaxLength(128);
                b.Property(s => s.CreatedUtc).HasDefaultValueSql("SYSUTCDATETIME()");
                b.Property(s => s.UpdatedUtc).HasDefaultValueSql("SYSUTCDATETIME()");

                b.HasIndex(s => new { s.UserId, s.UpdatedUtc }).HasDatabaseName("IX_Sessions_User_UpdatedUtc");

                // FK to AppUser via UserId
                b.HasOne<AppUser>()
                 .WithMany(u => u.Sessions)
                 .HasForeignKey(s => s.UserId)
                 .OnDelete(DeleteBehavior.Cascade);

                // JSON-mapped StoryState (requires EF Core 8+ on SQL Server)
                b.OwnsOne(s => s.StoryState, sb =>
                {
                    sb.ToJson();
                    sb.Property(x => x.SceneSummary).HasMaxLength(2000);

                    // If your StoryState has these collections (Option A from earlier):
                    // sb.OwnsMany(x => x.WorldFlags);
                    // sb.OwnsMany(x => x.PartyHP);
                });
            });

            // --- Turn (with embedding as varbinary until VECTOR is ready) ---
            modelBuilder.Entity<Turn>(b =>
            {
                b.HasKey(t => t.Id);
                b.Property(t => t.Content).HasColumnType("nvarchar(max)");
                b.Property(t => t.CreatedUtc).HasDefaultValueSql("SYSUTCDATETIME()");
                b.HasIndex(t => new { t.SessionId, t.CreatedUtc }).HasDatabaseName("IX_Turns_Session_CreatedUtc");

                b.Property(t => t.Embedding)
                 .HasConversion(floatArrayToBytes)
                 .HasColumnType("varbinary(max)");

                b.HasOne<AdventureSession>()
                 .WithMany()
                 .HasForeignKey(t => t.SessionId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<SrdChunk>(b =>
            {
                b.HasKey(s => s.Id);
                b.Property(s => s.Section).HasMaxLength(128);
                b.Property(s => s.Text).HasColumnType("nvarchar(max)");
                b.Property(s => s.Source).HasMaxLength(32).HasDefaultValue("srd5.1");
                b.Property(s => s.CreatedUtc).HasDefaultValueSql("SYSUTCDATETIME()");
                b.HasIndex(s => s.Section).HasDatabaseName("IX_SrdChunks_Section");

                b.Property(s => s.Embedding)
                 .HasConversion(floatArrayToBytes)
                 .HasColumnType("varbinary(max)");
            });

        }
    }
}
