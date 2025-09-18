using System;

namespace ArtificialDungeonMaster.Data.Models
{
    public enum TurnRole { User = 0, DM = 1, System = 2 }

    public sealed class Turn
    {
        public Guid Id { get; set; }
        public Guid SessionId { get; set; }

        public TurnRole Role { get; set; } = TurnRole.User;

        // The human-visible text (player input or DM narration)
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

        // Token accounting (optional)
        public int? PromptTokens { get; set; }
        public int? CompletionTokens { get; set; }

        // Vector embedding for retrieval (configured as VECTOR(1536) in OnModelCreating)
        public float[]? Embedding { get; set; }
    }
}
