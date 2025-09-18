using System;
using System.ComponentModel.DataAnnotations;

namespace ArtificialDungeonMaster.Data.Models
{
    public sealed class AdventureSession
    {
        public Guid Id { get; set; }

        // Owner
        public Guid UserId { get; set; }

        [MaxLength(128)]
        public string? Title { get; set; }

        // Optional primary PC (you can support multi-PC later)
        public Guid? PrimaryCharacterId { get; set; }

        public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Compact snapshot of world & party so we can resume without replaying the whole log.
        /// Mapped to a single JSON column via EF Core 8's ToJson() in ApplicationDbContext.
        /// </summary>
        public StoryState StoryState { get; set; } = new();
    }
}
